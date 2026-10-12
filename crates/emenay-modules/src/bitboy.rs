//! BitBoy — Game Boy DMG APU–style chiptune oscillator (original module).
//!
//! Modes match the four hardware sound channels (1–4):
//! - **1 Sweep** — CH1 square + frequency sweep on gate; MORPH = duty, FRAME = sweep depth
//! - **2 Pulse** — CH2 square; MORPH = duty (12.5 / 25 / 50 / 75%)
//! - **3 Wave** — CH3 32×4-bit wavetable, pitch-clocked DAC; FRAME selects table
//! - **4 Noise** — CH4 15-bit LFSR; MORPH > 0.5 → short (7-bit) width
//!
//! `mode_cv` (0…5 V) offsets the MODE knob across the four modes when patched.
//! `level_cv` (0…5 V) is a VCA input — patch an ADSR/AR here for articulated notes.

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
    /// Wavetable: [frame][step] in 0..15 (CH3)
    waves: [[u8; STEPS]; FRAMES],
    /// Phase accumulator in wave-steps (0..32) or pulse phase (0..1).
    phase: f64,
    lfsr: u16,
    noise_short: bool,
    gate_prev: bool,
    /// Instantaneous Hz while CH1 sweep is running.
    sweep_hz: f64,
    step_out: f32,
    audio: f32,
    /// Last effective mode (1…4) for the digit / lights.
    mode_disp: f32,
}

impl Bitboy {
    pub fn new() -> Self {
        let mut waves = [[0u8; STEPS]; FRAMES];
        // CH3-style bank: triangle / saw / pulse-ish / organ nibbles.
        for f in 0..FRAMES {
            let t = f as f32 / (FRAMES - 1) as f32;
            for s in 0..STEPS {
                let x = s as f32 / STEPS as f32;
                let sine = ((x * std::f32::consts::TAU).sin() * 0.5 + 0.5) * 15.0;
                let tri = if x < 0.5 { x * 2.0 } else { 2.0 - x * 2.0 } * 15.0;
                let saw = (1.0 - x) * 15.0;
                let pulse = if x < 0.25 + t * 0.5 { 15.0 } else { 0.0 };
                let v = match f {
                    0..=3 => sine * (1.0 - t * 0.3) + tri * (t * 0.3),
                    4..=7 => tri * (1.0 - (t - 0.25).max(0.0)) + saw * ((t - 0.25).max(0.0)),
                    8..=11 => saw * 0.6 + pulse * 0.4,
                    _ => {
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
                    PortDesc {
                        name: "mode_cv".into(),
                        kind: PortId::Input,
                        signal: SignalKind::Cv,
                    },
                    PortDesc {
                        name: "level_cv".into(),
                        kind: PortId::Input,
                        signal: SignalKind::Cv,
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
                        default: 2.0,
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
            mode: 2.0,
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
            sweep_hz: 130.81,
            step_out: 0.0,
            audio: 0.0,
            mode_disp: 2.0,
        }
    }

    fn freq_hz(&self, v_oct: f32) -> f32 {
        // C3 ≈ 130.81 at 0V + tune
        130.81 * (2.0_f32).powf(v_oct + self.tune)
    }

    /// Effective mode 1…4 (knob + optional MODE CV).
    fn mode_value(&self, mode_cv: f32, mode_patched: bool) -> f32 {
        let m = if mode_patched {
            // 0…5 V spans the full 1…4 range on top of the knob.
            self.mode + mode_cv.clamp(0.0, 5.0) * (3.0 / 5.0)
        } else {
            self.mode
        };
        m.round().clamp(1.0, 4.0)
    }

    /// Mode index 0..3 from faceplate values 1..4.
    fn mode_i(mode_val: f32) -> u32 {
        (mode_val as u32) - 1
    }

    fn pulse_duty_from(t: f32) -> f32 {
        // DMG duties from a 0…1 control (morph or normalized CV).
        match (t.clamp(0.0, 1.0) * 3.99).floor() as u32 {
            0 => 0.125,
            1 => 0.25,
            2 => 0.5,
            _ => 0.75,
        }
    }

    fn pulse_duty(&self) -> f32 {
        Self::pulse_duty_from(self.morph)
    }

    fn frame_index(&self, frame_cv: f32) -> usize {
        // FRAME CV is 0…5 V → +0…15 frames on top of the knob.
        let f = self.frame + frame_cv.clamp(-1.0, 5.0) * 3.0;
        f.round().clamp(0.0, 15.0) as usize
    }

    fn lfsr_tick(&mut self) {
        // DMG noise: XOR bit0⊕bit1 (long 15-bit) or bit0⊕bit6 (short 7-bit), shift right.
        let bit = if self.noise_short {
            ((self.lfsr ^ (self.lfsr >> 6)) & 1) as u16
        } else {
            ((self.lfsr ^ (self.lfsr >> 1)) & 1) as u16
        };
        self.lfsr = (self.lfsr >> 1) | (bit << 14);
    }

    /// Render a DMG square at `hz` with `duty` (0…1).
    fn render_pulse(&mut self, hz: f64, duty: f64) {
        let advance = hz / self.sample_rate as f64;
        self.phase = (self.phase + advance).fract();
        self.audio = if self.phase < duty { 1.0 } else { -1.0 };
        self.step_out = if self.phase < duty { 5.0 } else { 0.0 };
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
        let mode_cv = inputs.get(3).copied().unwrap_or(0.0);
        let level_cv = inputs.get(4).copied().unwrap_or(0.0);
        let frame_patched = connected.get(1).copied().unwrap_or(false);
        let gate_patched = connected.get(2).copied().unwrap_or(false);
        let mode_patched = connected.get(3).copied().unwrap_or(false);
        let level_patched = connected.get(4).copied().unwrap_or(false);
        let gate_edge = gate && !self.gate_prev;
        self.gate_prev = gate;

        let freq = self.freq_hz(v_oct).clamp(20.0, 12_000.0);
        let mode_val = self.mode_value(mode_cv, mode_patched);
        self.mode_disp = mode_val;
        let mode = Self::mode_i(mode_val);

        // Short noise width when morph > 0.5 in noise mode (NR43 width bit).
        self.noise_short = self.morph > 0.5;

        if gate_edge && mode == 3 {
            // Retrigger LFSR seed on note (GB CH4 restart).
            self.lfsr = 0x7FFF;
        }

        match mode {
            0 => {
                // CH1 — pulse + frequency sweep toward the note on gate.
                let duty = if frame_patched {
                    // When FRAME CV is used for duty, knob FRAME still sets sweep depth.
                    Self::pulse_duty_from(frame_cv.clamp(0.0, 5.0) / 5.0) as f64
                } else {
                    self.pulse_duty() as f64
                };
                let depth_semi = self.frame.clamp(0.0, 15.0) as f64; // 0…15 semitones
                if gate_edge {
                    // Start sharp (above the note) and fall — classic CH1 “pew”.
                    let start = freq as f64 * 2.0_f64.powf(depth_semi / 12.0);
                    self.sweep_hz = start.clamp(20.0, 12_000.0);
                    self.phase = 0.0;
                }
                let target = freq as f64;
                // Deeper FRAME → faster catch-up (still audible glide at low depths).
                let tau = (0.08 - depth_semi * 0.004).clamp(0.012, 0.08);
                let a = (-1.0 / (tau * self.sample_rate as f64)).exp();
                if depth_semi < 0.5 {
                    self.sweep_hz = target;
                } else {
                    self.sweep_hz = target + (self.sweep_hz - target) * a;
                }
                self.render_pulse(self.sweep_hz.clamp(20.0, 12_000.0), duty);
            }
            1 => {
                // CH2 — pulse, no sweep.
                let duty = if frame_patched {
                    Self::pulse_duty_from(frame_cv.clamp(0.0, 5.0) / 5.0) as f64
                } else {
                    self.pulse_duty() as f64
                };
                if gate_edge {
                    self.phase = 0.0;
                }
                self.render_pulse(freq as f64, duty);
            }
            2 => {
                // CH3 — 32-sample × 4-bit wave RAM, DAC clocks at freq×32.
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
            _ => {
                // CH4 — noise LFSR; pitch tracks divider clock (freq×32).
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
        }

        // LEVEL CV (0…5 V) is a VCA — patch ADSR/env here for note shaping.
        // When LEVEL CV is patched, skip hard GATE mute so release can ring out.
        // Unpatched GATE → free-run; patched GATE (alone) still gates the amp.
        let env_amp = if level_patched {
            (level_cv / 5.0).clamp(0.0, 1.5)
        } else {
            1.0
        };
        let gate_amp = if gate_patched && !level_patched {
            if gate {
                1.0
            } else {
                0.0
            }
        } else {
            1.0
        };
        let amp = self.level * 4.5 * env_amp * gate_amp;
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
        self.sweep_hz = 130.81;
        self.step_out = 0.0;
        self.audio = 0.0;
    }

    fn lights(&self) -> ModuleLights {
        let mut l = ModuleLights::new();
        l.set("mode", self.mode_disp);
        l.set("frame", self.frame_index(0.0) as f32);
        l.set("level", self.audio.abs().clamp(0.0, 1.0));
        l
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use emenay_engine::module::Module;

    fn render(mode: f32, frame: f32, morph: f32, n: usize) -> Vec<f32> {
        let mut m = Bitboy::new();
        m.set_sample_rate(48_000.0);
        m.set_param("mode", mode);
        m.set_param("frame", frame);
        m.set_param("morph", morph);
        m.set_param("level", 1.0);
        let mut out = Vec::with_capacity(n);
        for _ in 0..n {
            let mut o = [0.0];
            // Gate high so CH1 sweep / CH4 restart paths are active.
            m.process(&[0.0, 0.0, 5.0], &mut o);
            out.push(o[0]);
        }
        out
    }

    fn max_abs_diff(a: &[f32], b: &[f32]) -> f32 {
        a.iter()
            .zip(b)
            .map(|(x, y)| (x - y).abs())
            .fold(0.0_f32, f32::max)
    }

    #[test]
    fn pulse_and_noise_are_distinct() {
        let pulse = render(2.0, 0.0, 0.5, 2048);
        let noise = render(4.0, 0.0, 0.5, 2048);
        let d = max_abs_diff(&pulse, &noise);
        assert!(d > 0.5, "mode2≈mode4 pulse/noise maxdiff={d}");
    }

    #[test]
    fn wave_and_pulse_are_distinct() {
        let pulse = render(2.0, 0.0, 0.5, 2048);
        let wave = render(3.0, 0.0, 0.5, 2048);
        let d = max_abs_diff(&pulse, &wave);
        assert!(d > 0.3, "mode2≈mode3 pulse/wave maxdiff={d}");
    }

    #[test]
    fn noise_short_width_changes_timbre() {
        let long = render(4.0, 0.0, 0.0, 4096);
        let short = render(4.0, 0.0, 1.0, 4096);
        let d = max_abs_diff(&long, &short);
        assert!(d > 0.2, "noise width morph should alter LFSR, maxdiff={d}");
    }

    #[test]
    fn sweep_mode_starts_above_note() {
        let mut m = Bitboy::new();
        m.set_sample_rate(48_000.0);
        m.set_param("mode", 1.0);
        m.set_param("frame", 12.0); // deep sweep
        m.set_param("level", 1.0);
        let connected = [false, false, true, false, false];
        let mut o = [0.0, 0.0];
        // Gate low then high → edge starts sweep above target.
        m.process_connected(&[0.0, 0.0, 0.0, 0.0, 0.0], &connected, &mut o);
        m.process_connected(&[0.0, 0.0, 5.0, 0.0, 0.0], &connected, &mut o);
        assert!(
            m.sweep_hz > 200.0,
            "sweep should start above C3 (~131), got {}",
            m.sweep_hz
        );
    }

    #[test]
    fn mode_cv_selects_modes() {
        let mut m = Bitboy::new();
        m.set_sample_rate(48_000.0);
        m.set_param("mode", 1.0);
        m.set_param("level", 1.0);
        let connected = [false, false, false, true, false];
        let mut o = [0.0, 0.0];
        m.process_connected(&[0.0, 0.0, 0.0, 0.0, 0.0], &connected, &mut o);
        assert_eq!(m.lights().values.get("mode").copied().unwrap_or(0.0), 1.0);
        m.process_connected(&[0.0, 0.0, 0.0, 5.0, 0.0], &connected, &mut o);
        assert_eq!(m.lights().values.get("mode").copied().unwrap_or(0.0), 4.0);
        m.process_connected(&[0.0, 0.0, 0.0, 2.5, 0.0], &connected, &mut o);
        let mid = m.lights().values.get("mode").copied().unwrap_or(0.0);
        assert!(
            mid == 2.0 || mid == 3.0,
            "mid CV should land on mode 2 or 3, got {mid}"
        );
    }

    #[test]
    fn level_cv_acts_as_vca() {
        let mut m = Bitboy::new();
        m.set_sample_rate(48_000.0);
        m.set_param("mode", 2.0); // pulse — steady amplitude
        m.set_param("level", 1.0);
        let connected = [false, false, false, false, true];
        let mut o = [0.0, 0.0];
        for _ in 0..64 {
            m.process_connected(&[0.0, 0.0, 0.0, 0.0, 5.0], &connected, &mut o);
        }
        let full = o[0].abs();
        m.process_connected(&[0.0, 0.0, 0.0, 0.0, 0.0], &connected, &mut o);
        assert!(
            o[0].abs() < 1e-4,
            "0 V level_cv should mute, got {}",
            o[0]
        );
        m.process_connected(&[0.0, 0.0, 0.0, 0.0, 2.5], &connected, &mut o);
        let half = o[0].abs();
        assert!(full > 1.0, "full level should be audible, got {full}");
        assert!(
            (half - full * 0.5).abs() < 0.15,
            "2.5 V should be ~half amp: half={half} full={full}"
        );
    }
}
