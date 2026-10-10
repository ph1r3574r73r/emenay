//! BitBoy — Game Boy / LSDJ–inspired chiptune oscillator (original module, not a clone).
//!
//! Modes (1–4):
//! - **1 Wave** — 16 frames × 32 samples × 4-bit, pitch-clocked DAC (aliased on purpose)
//! - **2 Pulse** — Game Boy square duties (12.5 / 25 / 50 / 75%)
//! - **3 Noise** — 15-bit LFSR (long / short), update rate follows pitch
//! - **4 Metal** — wave XOR pulse (GB-ish metallic / ring bite)

use emenay_engine::module::{
    Module, ModuleInfo, ModuleLights, ParamDesc, PortDesc, PortId, SignalKind,
};
use emenay_engine::Voltage;

const FRAMES: usize = 16;
const STEPS: usize = 32;

pub struct Bitboy {
    info: ModuleInfo,
    mode: f32,
    tune: f32,
    frame: f32,
    morph: f32,
    level: f32,
    sample_rate: f32,
    /// Wavetable: [frame][step] in 0..15
    waves: [[u8; STEPS]; FRAMES],
    /// Phase accumulator in wave-steps (0..32) or pulse phase (0..1).
    phase: f64,
    lfsr: u16,
    noise_short: bool,
    gate_prev: bool,
    step_out: f32,
    audio: f32,
}

impl Bitboy {
    pub fn new() -> Self {
        let mut waves = [[0u8; STEPS]; FRAMES];
        // Frame bank: classic GB-ish shapes → morphable set.
        for f in 0..FRAMES {
            let t = f as f32 / (FRAMES - 1) as f32;
            for s in 0..STEPS {
                let x = s as f32 / STEPS as f32;
                let sine = ((x * std::f32::consts::TAU).sin() * 0.5 + 0.5) * 15.0;
                let tri = if x < 0.5 { x * 2.0 } else { 2.0 - x * 2.0 } * 15.0;
                let saw = (1.0 - x) * 15.0;
                let pulse = if x < 0.25 + t * 0.5 { 15.0 } else { 0.0 };
                // Crossfade bank across frames.
                let v = match f {
                    0..=3 => sine * (1.0 - t * 0.3) + tri * (t * 0.3),
                    4..=7 => tri * (1.0 - (t - 0.25).max(0.0)) + saw * ((t - 0.25).max(0.0)),
                    8..=11 => saw * 0.6 + pulse * 0.4,
                    _ => {
                        // LSDJ-ish metallic / organ bites
                        let h = ((x * 4.0).fract() < 0.5) as u8 as f32 * 10.0
                            + ((x * 8.0).fract() < 0.5) as u8 as f32 * 5.0;
                        h * (0.5 + t * 0.5)
                    }
                };
                waves[f][s] = v.clamp(0.0, 15.0).round() as u8;
            }
        }

        Self {
            info: ModuleInfo {
                type_id: "bitboy".into(),
                name: "BitBoy".into(),
                hp: 8,
                inputs: vec![
                    PortDesc {
                        name: "v_oct".into(),
                        kind: PortId::Input,
                        signal: SignalKind::Cv,
                    },
                    PortDesc {
                        name: "frame_cv".into(),
                        kind: PortId::Input,
                        signal: SignalKind::Cv,
                    },
                    PortDesc {
                        name: "gate".into(),
                        kind: PortId::Input,
                        signal: SignalKind::Gate,
                    },
                ],
                outputs: vec![
                    PortDesc {
                        name: "out".into(),
                        kind: PortId::Output,
                        signal: SignalKind::Audio,
                    },
                    PortDesc {
                        name: "step".into(),
                        kind: PortId::Output,
                        signal: SignalKind::Cv,
                    },
                ],
                params: vec![
                    ParamDesc {
                        name: "mode".into(),
                        min: 1.0,
                        max: 4.0,
                        default: 1.0,
                        unit: "int".into(),
                    },
                    ParamDesc {
                        name: "tune".into(),
                        min: -2.0,
                        max: 2.0,
                        default: 0.0,
                        unit: "V".into(),
                    },
                    ParamDesc {
                        name: "frame".into(),
                        min: 0.0,
                        max: 15.0,
                        default: 0.0,
                        unit: "int".into(),
                    },
                    ParamDesc {
                        name: "morph".into(),
                        min: 0.0,
                        max: 1.0,
                        default: 0.5,
                        unit: "".into(),
                    },
                    ParamDesc {
                        name: "level".into(),
                        min: 0.0,
                        max: 1.0,
                        default: 0.8,
                        unit: "".into(),
                    },
                ],
            },
            mode: 1.0,
            tune: 0.0,
            frame: 0.0,
            morph: 0.5,
            level: 0.8,
            sample_rate: 48_000.0,
            waves,
            phase: 0.0,
            lfsr: 0x7FFF,
            noise_short: false,
            gate_prev: false,
            step_out: 0.0,
            audio: 0.0,
        }
    }

    fn freq_hz(&self, v_oct: f32) -> f32 {
        // C3 ≈ 130.81 at 0V + tune
        130.81 * (2.0_f32).powf(v_oct + self.tune)
    }

    /// Mode index 0..3 from faceplate values 1..4.
    fn mode_i(&self) -> u32 {
        (self.mode.round().clamp(1.0, 4.0) as u32) - 1
    }

    fn pulse_duty(&self) -> f32 {
        // Game Boy duties selected by morph.
        match (self.morph * 3.99).floor() as u32 {
            0 => 0.125,
            1 => 0.25,
            2 => 0.5,
            _ => 0.75,
        }
    }

    fn frame_index(&self, frame_cv: f32) -> usize {
        let f = self.frame + frame_cv.clamp(-1.0, 5.0) * 3.0;
        f.round().clamp(0.0, 15.0) as usize
    }

    fn lfsr_tick(&mut self) {
        // DMG noise: XOR bit0 and bit1 (long) or bit0 and bit6 (short), shift right.
        let bit = if self.noise_short {
            ((self.lfsr ^ (self.lfsr >> 6)) & 1) as u16
        } else {
            ((self.lfsr ^ (self.lfsr >> 1)) & 1) as u16
        };
        self.lfsr = (self.lfsr >> 1) | (bit << 14);
        if self.lfsr == 0 {
            self.lfsr = 1;
        }
    }
}

impl Default for Bitboy {
    fn default() -> Self {
        Self::new()
    }
}

impl Module for Bitboy {
    fn info(&self) -> &ModuleInfo {
        &self.info
    }

    fn set_sample_rate(&mut self, sample_rate: f32) {
        self.sample_rate = sample_rate.max(1.0);
    }

    fn set_param(&mut self, name: &str, value: f32) {
        match name {
            "mode" => self.mode = value.round().clamp(1.0, 4.0),
            "tune" => self.tune = value.clamp(-2.0, 2.0),
            "frame" => self.frame = value.round().clamp(0.0, 15.0),
            "morph" => self.morph = value.clamp(0.0, 1.0),
            "level" => self.level = value.clamp(0.0, 1.0),
            _ => {}
        }
    }

    fn get_param(&self, name: &str) -> Option<f32> {
        match name {
            "mode" => Some(self.mode.round().clamp(1.0, 4.0)),
            "tune" => Some(self.tune),
            "frame" => Some(self.frame.round().clamp(0.0, 15.0)),
            "morph" => Some(self.morph),
            "level" => Some(self.level),
            _ => None,
        }
    }

    fn process(&mut self, inputs: &[Voltage], outputs: &mut [Voltage]) {
        self.process_connected(inputs, &[], outputs);
    }

    fn process_connected(
        &mut self,
        inputs: &[Voltage],
        connected: &[bool],
        outputs: &mut [Voltage],
    ) {
        let v_oct = inputs.first().copied().unwrap_or(0.0);
        let frame_cv = inputs.get(1).copied().unwrap_or(0.0);
        let gate = inputs.get(2).copied().unwrap_or(0.0) > 1.0;
        let gate_patched = connected.get(2).copied().unwrap_or(false);
        let gate_edge = gate && !self.gate_prev;
        self.gate_prev = gate;

        let freq = self.freq_hz(v_oct).clamp(20.0, 12_000.0);
        let mode = self.mode_i();

        // Short noise width when morph > 0.5 in noise mode.
        self.noise_short = self.morph > 0.5;

        if gate_edge && mode == 2 {
            // Retrigger LFSR seed (BitBoy / GB style).
            self.lfsr = 0x7FFF;
        }

        match mode {
            0 => {
                // Wave: DAC clocks at freq * 32 (one sample per wave-step).
                let step_rate = freq as f64 * STEPS as f64;
                let advance = step_rate / self.sample_rate as f64;
                let prev = self.phase;
                self.phase = (self.phase + advance) % STEPS as f64;
                let stepped = self.phase.floor() != prev.floor();
                let fi = self.frame_index(frame_cv);
                let si = self.phase.floor() as usize % STEPS;
                let nibble = self.waves[fi][si] as f32;
                self.audio = (nibble / 15.0) * 2.0 - 1.0;
                self.step_out = if stepped { 5.0 } else { 0.0 };
            }
            1 => {
                // Pulse: classic GB duties, still aliased square.
                let advance = freq as f64 / self.sample_rate as f64;
                self.phase = (self.phase + advance).fract();
                let duty = self.pulse_duty() as f64;
                self.audio = if self.phase < duty { 1.0 } else { -1.0 };
                self.step_out = if self.phase < duty { 5.0 } else { 0.0 };
            }
            2 => {
                // Noise: LFSR update rate tracks pitch (GB-ish).
                let update_hz = freq * 32.0;
                let advance = update_hz as f64 / self.sample_rate as f64;
                let prev = self.phase;
                self.phase += advance;
                while self.phase >= 1.0 {
                    self.phase -= 1.0;
                    self.lfsr_tick();
                }
                let bit = (self.lfsr & 1) as f32;
                self.audio = bit * 2.0 - 1.0;
                let stepped = (prev + advance).floor() > prev.floor();
                self.step_out = if stepped { 5.0 } else { 0.0 };
            }
            _ => {
                // Metal: wave XOR pulse — harsh GB-ish ring / metallic.
                let step_rate = freq as f64 * STEPS as f64;
                let advance = step_rate / self.sample_rate as f64;
                let prev = self.phase;
                self.phase = (self.phase + advance) % STEPS as f64;
                let stepped = self.phase.floor() != prev.floor();
                let fi = self.frame_index(frame_cv);
                let si = self.phase.floor() as usize % STEPS;
                let nibble = self.waves[fi][si] as f32;
                let wave = (nibble / 15.0) * 2.0 - 1.0;
                let duty = self.pulse_duty();
                let pulse_phase = (self.phase / STEPS as f64) as f32;
                let pulse = if pulse_phase < duty { 1.0 } else { -1.0 };
                self.audio = if wave * pulse < 0.0 { wave } else { -wave };
                self.step_out = if stepped { 5.0 } else { 0.0 };
            }
        }

        // Unpatched GATE → free-run; patched GATE gates the amp (chiptune voice).
        let gate_amp = if gate_patched {
            if gate { 1.0 } else { 0.0 }
        } else {
            1.0
        };
        let amp = self.level * 4.5 * gate_amp;
        let out = self.audio * amp;

        if let Some(o) = outputs.get_mut(0) {
            *o = out;
        }
        if let Some(o) = outputs.get_mut(1) {
            *o = self.step_out;
        }
    }

    fn reset(&mut self) {
        self.phase = 0.0;
        self.lfsr = 0x7FFF;
        self.gate_prev = false;
        self.step_out = 0.0;
        self.audio = 0.0;
    }

    fn lights(&self) -> ModuleLights {
        let mut l = ModuleLights::new();
        l.set("mode", self.mode.round().clamp(1.0, 4.0));
        l.set("frame", self.frame_index(0.0) as f32);
        l.set("level", self.audio.abs().clamp(0.0, 1.0));
        l
    }
}
