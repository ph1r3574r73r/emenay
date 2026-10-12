//! Beat — Click2-style clocked pattern player for Eurorack.
//!
//! - **pattern**: which 16-step loop (0…15)
//! - **4 lanes** (BD / SD / CH / OH): on, sound, level, pan
//! - Stereo `out_l` / `out_r` + per-lane gate outs for Twin / external voices
//!
//! Sound bank is procedural one-shots (kick/snare/hat/rim/cowbell/click…),
//! not Pro Tools samples. Edit lanes from the faceplate params or the UI strip
//! when the module is selected.

use emenay_engine::module::{
    Module, ModuleInfo, ModuleLights, ParamDesc, PortDesc, PortId, SignalKind,
};
use emenay_engine::Voltage;

const STEPS: usize = 16;
const NUM_PATTERNS: usize = 16;
const NUM_SOUNDS: usize = 16;
const LANES: usize = 4;
const GATE_SAMPLES: u32 = 240;

const LANE_NAMES: [&str; LANES] = ["bd", "sd", "ch", "oh"];

/// Bit N = step N (0…15).
#[derive(Clone, Copy)]
struct Pattern {
    lanes: [u16; LANES],
}

const PATTERNS: [Pattern; NUM_PATTERNS] = [
    Pattern { lanes: [0x1111, 0x1010, 0x5555, 0x0000] }, // 0 four-on-floor
    Pattern { lanes: [0x1111, 0x1010, 0x4545, 0x1010] }, // 1 disco
    Pattern { lanes: [0x0101, 0x1010, 0x5555, 0x0080] }, // 2 electro
    Pattern { lanes: [0x9001, 0x1420, 0x5555, 0x0000] }, // 3 breaky
    Pattern { lanes: [0x0001, 0x0100, 0x5555, 0x0010] }, // 4 half-time
    Pattern { lanes: [0x0101, 0x1010, 0x5151, 0x0404] }, // 5 garage
    Pattern { lanes: [0x1101, 0x1010, 0x4545, 0x0101] }, // 6 clave-ish
    Pattern { lanes: [0x1111, 0x1000, 0x4444, 0x0000] }, // 7 techno
    Pattern { lanes: [0x0081, 0x1010, 0xFFFF, 0x0000] }, // 8 busy hats
    Pattern { lanes: [0x0801, 0x1010, 0x5555, 0x0040] }, // 9 boom-bap
    Pattern { lanes: [0x8511, 0x1010, 0x5555, 0x0000] }, // 10 syncop
    Pattern { lanes: [0x0101, 0x0000, 0x5555, 0x1010] }, // 11 hats+kick
    Pattern { lanes: [0x0001, 0x5555, 0x0000, 0x0000] }, // 12 snare train
    Pattern { lanes: [0x1111, 0x1010, 0x0000, 0x5555] }, // 13 OH groove
    Pattern { lanes: [0x9111, 0x1610, 0x5F55, 0x0080] }, // 14 fill
    Pattern { lanes: [0x1111, 0x0000, 0x0000, 0x0000] }, // 15 kick only / metronome base
];

/// Default sound index per lane when the module is created.
const DEFAULT_SOUNDS: [f32; LANES] = [0.0, 3.0, 6.0, 8.0];

struct Voice {
    env: f32,
    phase: f32,
    freq: f32,
    aux: f32,
    aux2: f32,
    sound: u8,
    level: f32,
    pan: f32,
    active: bool,
}

impl Voice {
    fn new() -> Self {
        Self {
            env: 0.0,
            phase: 0.0,
            freq: 0.0,
            aux: 0.0,
            aux2: 0.0,
            sound: 0,
            level: 1.0,
            pan: 0.0,
            active: false,
        }
    }
}

struct Lane {
    on: f32,
    sound: f32,
    level: f32,
    pan: f32,
}

pub struct Beat {
    info: ModuleInfo,
    pattern: f32,
    swing: f32,
    master: f32,
    lanes: [Lane; LANES],
    sample_rate: f32,
    step: usize,
    clock_prev: bool,
    gate_left: [u32; LANES],
    voices: [Voice; 8], // poly one-shots
    next_voice: usize,
    noise_seed: u32,
    swing_pending: Option<(u32, u8)>,
    led_step: f32,
}

impl Beat {
    pub fn new() -> Self {
        let mut params = vec![
            ParamDesc {
                name: "pattern".into(),
                min: 0.0,
                max: 15.0,
                default: 0.0,
                unit: "int".into(),
            },
            ParamDesc {
                name: "swing".into(),
                min: 0.0,
                max: 1.0,
                default: 0.0,
                unit: "".into(),
            },
            ParamDesc {
                name: "level".into(),
                min: 0.0,
                max: 1.0,
                default: 0.9,
                unit: "".into(),
            },
        ];
        // Legacy alias so old presets with "loop" still load something useful.
        params.push(ParamDesc {
            name: "loop".into(),
            min: 0.0,
            max: 15.0,
            default: 0.0,
            unit: "int".into(),
        });
        params.push(ParamDesc {
            name: "kit".into(),
            min: 0.0,
            max: 7.0,
            default: 5.0,
            unit: "int".into(),
        });

        for (i, name) in LANE_NAMES.iter().enumerate() {
            params.push(ParamDesc {
                name: format!("{name}_on"),
                min: 0.0,
                max: 1.0,
                default: 1.0,
                unit: "bool".into(),
            });
            params.push(ParamDesc {
                name: format!("{name}_sound"),
                min: 0.0,
                max: (NUM_SOUNDS - 1) as f32,
                default: DEFAULT_SOUNDS[i],
                unit: "int".into(),
            });
            params.push(ParamDesc {
                name: format!("{name}_level"),
                min: 0.0,
                max: 1.0,
                default: 0.85,
                unit: "".into(),
            });
            params.push(ParamDesc {
                name: format!("{name}_pan"),
                min: -1.0,
                max: 1.0,
                default: match i {
                    0 => 0.0,
                    1 => 0.15,
                    2 => -0.25,
                    _ => 0.35,
                },
                unit: "".into(),
            });
        }

        Self {
            info: ModuleInfo {
                type_id: "beat".into(),
                name: "Beat".into(),
                hp: 12,
                inputs: vec![
                    PortDesc {
                        name: "clock".into(),
                        kind: PortId::Input,
                        signal: SignalKind::Gate,
                    },
                    PortDesc {
                        name: "reset".into(),
                        kind: PortId::Input,
                        signal: SignalKind::Gate,
                    },
                ],
                outputs: vec![
                    PortDesc {
                        name: "out_l".into(),
                        kind: PortId::Output,
                        signal: SignalKind::Audio,
                    },
                    PortDesc {
                        name: "out_r".into(),
                        kind: PortId::Output,
                        signal: SignalKind::Audio,
                    },
                    PortDesc {
                        name: "mix".into(),
                        kind: PortId::Output,
                        signal: SignalKind::Audio,
                    },
                    PortDesc {
                        name: "bd_g".into(),
                        kind: PortId::Output,
                        signal: SignalKind::Gate,
                    },
                    PortDesc {
                        name: "sd_g".into(),
                        kind: PortId::Output,
                        signal: SignalKind::Gate,
                    },
                    PortDesc {
                        name: "ch_g".into(),
                        kind: PortId::Output,
                        signal: SignalKind::Gate,
                    },
                    PortDesc {
                        name: "oh_g".into(),
                        kind: PortId::Output,
                        signal: SignalKind::Gate,
                    },
                ],
                params,
            },
            pattern: 0.0,
            swing: 0.0,
            master: 0.9,
            lanes: [
                Lane {
                    on: 1.0,
                    sound: DEFAULT_SOUNDS[0],
                    level: 0.9,
                    pan: 0.0,
                },
                Lane {
                    on: 1.0,
                    sound: DEFAULT_SOUNDS[1],
                    level: 0.85,
                    pan: 0.15,
                },
                Lane {
                    on: 1.0,
                    sound: DEFAULT_SOUNDS[2],
                    level: 0.7,
                    pan: -0.25,
                },
                Lane {
                    on: 1.0,
                    sound: DEFAULT_SOUNDS[3],
                    level: 0.65,
                    pan: 0.35,
                },
            ],
            sample_rate: 48_000.0,
            step: 0,
            clock_prev: false,
            gate_left: [0; LANES],
            voices: std::array::from_fn(|_| Voice::new()),
            next_voice: 0,
            noise_seed: 0xBEA7_0001,
            swing_pending: None,
            led_step: 0.0,
        }
    }

    fn noise(&mut self) -> f32 {
        self.noise_seed = self
            .noise_seed
            .wrapping_mul(1664525)
            .wrapping_add(1013904223);
        (self.noise_seed as f32 / u32::MAX as f32) * 2.0 - 1.0
    }

    fn apply_kit_preset(&mut self, kit: usize) {
        // Map old "kit" knob onto lane sound defaults.
        let table: [[f32; LANES]; 8] = [
            [0.0, 3.0, 6.0, 8.0],
            [1.0, 4.0, 6.0, 8.0],
            [2.0, 5.0, 7.0, 9.0],
            [0.0, 3.0, 10.0, 11.0],
            [1.0, 4.0, 6.0, 9.0],
            [0.0, 3.0, 6.0, 8.0],
            [2.0, 5.0, 7.0, 12.0],
            [0.0, 13.0, 14.0, 15.0],
        ];
        let row = table[kit.min(7)];
        for (lane, &s) in self.lanes.iter_mut().zip(row.iter()) {
            lane.sound = s;
        }
    }

    fn fire_lane(&mut self, lane: usize) {
        let lane_cfg = &self.lanes[lane];
        if lane_cfg.on < 0.5 {
            return;
        }
        let idx = self.next_voice % self.voices.len();
        self.next_voice = self.next_voice.wrapping_add(1);
        let sound = lane_cfg.sound.round().clamp(0.0, (NUM_SOUNDS - 1) as f32) as u8;
        let level = lane_cfg.level;
        let pan = lane_cfg.pan;
        let v = &mut self.voices[idx];
        v.active = true;
        v.env = 1.0;
        v.phase = 0.0;
        v.aux = 0.0;
        v.aux2 = 0.0;
        v.sound = sound;
        v.level = level;
        v.pan = pan;
        // Pitch / character seed by sound family
        v.freq = match sound {
            0 => 48.0,
            1 => 62.0,
            2 => 78.0,
            3 => 180.0,
            4 => 220.0,
            5 => 260.0,
            6 | 7 => 0.0,
            8 | 9 => 0.0,
            10 => 800.0,
            11 => 540.0,
            12 => 0.0,
            13 => 120.0,
            14 => 0.0,
            _ => 1200.0, // metro beep
        };
        if matches!(sound, 0..=2) {
            v.aux = v.freq * 3.4; // kick sweep start
        }
        if matches!(sound, 3..=5) {
            v.aux = 1.0; // snare noise env
        }
        if sound == 12 {
            v.aux2 = 3.0; // clap bursts
        }
        self.gate_left[lane] = GATE_SAMPLES;
    }

    fn fire_mask(&mut self, mask: u8) {
        for i in 0..LANES {
            if mask & (1 << i) != 0 {
                self.fire_lane(i);
            }
        }
    }

    fn step_mask(pat: Pattern, step: usize) -> u8 {
        let bit = 1u16 << (step % STEPS);
        let mut m = 0u8;
        for (i, plane) in pat.lanes.iter().enumerate() {
            if plane & bit != 0 {
                m |= 1 << i;
            }
        }
        m
    }

    fn advance_step(&mut self) {
        let pat = PATTERNS[(self.pattern as usize).min(NUM_PATTERNS - 1)];
        let mask = Self::step_mask(pat, self.step);
        let odd = self.step % 2 == 1;
        if odd && self.swing > 0.05 {
            let delay = (self.swing * 0.35 * self.sample_rate * 0.125) as u32;
            self.swing_pending = Some((delay.max(1), mask));
        } else {
            self.fire_mask(mask);
        }
        self.led_step = 1.0;
        self.step = (self.step + 1) % STEPS;
    }

    fn render_voice(&mut self, vi: usize, dt: f32, sr: f32) -> (f32, f32) {
        if !self.voices[vi].active {
            return (0.0, 0.0);
        }
        let sound = self.voices[vi].sound;
        let n = self.noise();
        let v = &mut self.voices[vi];
        let mut s = 0.0_f32;
        match sound {
            0..=2 => {
                let sweep = v.aux;
                v.aux = (v.aux - dt * (800.0 + sound as f32 * 120.0)).max(v.freq);
                v.phase = (v.phase + sweep / sr).fract();
                let click = if v.env > 0.9 { n * 0.28 } else { 0.0 };
                s = (v.phase * std::f32::consts::TAU).sin() * 1.2 + click;
                let dec = 5.0 + sound as f32 * 2.0;
                v.env *= (-dec * dt).exp();
            }
            3..=5 => {
                v.phase = (v.phase + v.freq / sr).fract();
                let body = (v.phase * std::f32::consts::TAU).sin() * 0.4;
                v.aux *= (-(14.0 + (sound as f32 - 3.0) * 8.0) * dt).exp();
                s = body * v.env + n * v.aux * (0.45 + (sound as f32 - 3.0) * 0.15);
                let dec = 8.0 + (sound as f32 - 3.0) * 3.0;
                v.env *= (-dec * dt).exp();
            }
            6 | 7 => {
                v.aux += (n - v.aux) * 0.35;
                v.env *= (-(38.0 + if sound == 7 { 20.0 } else { 0.0 }) * dt).exp();
                s = (n - v.aux) * v.env * 1.4;
            }
            8 | 9 => {
                v.aux += (n - v.aux) * 0.28;
                v.env *= (-(6.0 + if sound == 9 { 4.0 } else { 0.0 }) * dt).exp();
                s = (n - v.aux) * v.env * 1.15;
            }
            10 => {
                v.phase = (v.phase + v.freq / sr).fract();
                s = (v.phase * std::f32::consts::TAU).sin() * v.env;
                v.env *= (-45.0 * dt).exp();
            }
            11 => {
                v.phase = (v.phase + v.freq / sr).fract();
                let a = (v.phase * std::f32::consts::TAU).sin();
                let b = (v.phase * std::f32::consts::TAU * 1.47).sin();
                s = (a + b * 0.7) * 0.55 * v.env;
                v.env *= (-12.0 * dt).exp();
            }
            12 => {
                v.aux += dt;
                if v.aux2 > 0.0 && v.aux >= 0.016 {
                    v.aux = 0.0;
                    v.aux2 -= 1.0;
                    v.env = (v.env + 0.55).min(1.0);
                }
                s = n * v.env * 1.2;
                v.env *= (-11.0 * dt).exp();
            }
            13 => {
                let sweep = v.freq * (1.0 + v.env * 1.8);
                v.phase = (v.phase + sweep / sr).fract();
                s = (v.phase * std::f32::consts::TAU).sin() * v.env;
                v.env *= (-8.0 * dt).exp();
            }
            14 => {
                s = n * v.env * 0.9;
                v.env *= (-22.0 * dt).exp();
            }
            _ => {
                v.phase = (v.phase + v.freq / sr).fract();
                s = if v.phase < 0.5 { 1.0 } else { -1.0 } * v.env;
                v.env *= (-28.0 * dt).exp();
            }
        }

        if v.env < 0.001 {
            v.active = false;
            return (0.0, 0.0);
        }
        let mono = s.tanh() * v.level * 3.8;
        let ang = (v.pan.clamp(-1.0, 1.0) + 1.0) * 0.25 * std::f32::consts::PI;
        (mono * ang.cos(), mono * ang.sin())
    }
}

impl Default for Beat {
    fn default() -> Self {
        Self::new()
    }
}

impl Module for Beat {
    fn info(&self) -> &ModuleInfo {
        &self.info
    }

    fn set_sample_rate(&mut self, sample_rate: f32) {
        self.sample_rate = sample_rate.max(1.0);
    }

    fn set_param(&mut self, name: &str, value: f32) {
        match name {
            "pattern" | "loop" => self.pattern = value.round().clamp(0.0, 15.0),
            "swing" => self.swing = value.clamp(0.0, 1.0),
            "level" => self.master = value.clamp(0.0, 1.0),
            "kit" => self.apply_kit_preset(value.round().clamp(0.0, 7.0) as usize),
            other => {
                for (i, lane) in LANE_NAMES.iter().enumerate() {
                    if other == format!("{lane}_on") {
                        self.lanes[i].on = if value >= 0.5 { 1.0 } else { 0.0 };
                        return;
                    }
                    if other == format!("{lane}_sound") {
                        self.lanes[i].sound =
                            value.round().clamp(0.0, (NUM_SOUNDS - 1) as f32);
                        return;
                    }
                    if other == format!("{lane}_level") {
                        self.lanes[i].level = value.clamp(0.0, 1.0);
                        return;
                    }
                    if other == format!("{lane}_pan") {
                        self.lanes[i].pan = value.clamp(-1.0, 1.0);
                        return;
                    }
                }
            }
        }
    }

    fn get_param(&self, name: &str) -> Option<f32> {
        match name {
            "pattern" | "loop" => Some(self.pattern),
            "swing" => Some(self.swing),
            "level" => Some(self.master),
            "kit" => Some(5.0),
            other => {
                for (i, lane) in LANE_NAMES.iter().enumerate() {
                    if other == format!("{lane}_on") {
                        return Some(self.lanes[i].on);
                    }
                    if other == format!("{lane}_sound") {
                        return Some(self.lanes[i].sound);
                    }
                    if other == format!("{lane}_level") {
                        return Some(self.lanes[i].level);
                    }
                    if other == format!("{lane}_pan") {
                        return Some(self.lanes[i].pan);
                    }
                }
                None
            }
        }
    }

    fn process(&mut self, inputs: &[Voltage], outputs: &mut [Voltage]) {
        let clock = inputs.first().copied().unwrap_or(0.0) > 1.0;
        let reset = inputs.get(1).copied().unwrap_or(0.0) > 1.0;
        if reset {
            self.step = 0;
            self.swing_pending = None;
        }
        if clock && !self.clock_prev {
            self.advance_step();
        }
        self.clock_prev = clock;

        if let Some((ref mut left, mask)) = self.swing_pending {
            *left = left.saturating_sub(1);
            if *left == 0 {
                let m = mask;
                self.swing_pending = None;
                self.fire_mask(m);
            }
        }

        let sr = self.sample_rate;
        let dt = 1.0 / sr;
        let mut left = 0.0_f32;
        let mut right = 0.0_f32;
        for i in 0..self.voices.len() {
            let (l, r) = self.render_voice(i, dt, sr);
            left += l;
            right += r;
        }
        let m = self.master;
        left = (left * m).tanh() * 4.5;
        right = (right * m).tanh() * 4.5;

        for g in &mut self.gate_left {
            if *g > 0 {
                *g -= 1;
            }
        }
        self.led_step *= 0.995;

        if let Some(o) = outputs.get_mut(0) {
            *o = left;
        }
        if let Some(o) = outputs.get_mut(1) {
            *o = right;
        }
        if let Some(o) = outputs.get_mut(2) {
            *o = (left + right) * 0.5;
        }
        for i in 0..LANES {
            if let Some(o) = outputs.get_mut(3 + i) {
                *o = if self.gate_left[i] > 0 { 5.0 } else { 0.0 };
            }
        }
    }

    fn reset(&mut self) {
        self.step = 0;
        self.clock_prev = false;
        self.gate_left = [0; LANES];
        self.voices = std::array::from_fn(|_| Voice::new());
        self.swing_pending = None;
        self.led_step = 0.0;
    }

    fn lights(&self) -> ModuleLights {
        let mut l = ModuleLights::new();
        l.set("pattern", self.pattern);
        l.set("loop", self.pattern);
        l.set("step", self.step as f32);
        l.set("run", self.led_step);
        for (i, name) in LANE_NAMES.iter().enumerate() {
            l.set(*name, if self.gate_left[i] > 0 { 1.0 } else { 0.0 });
            l.set(format!("{name}_on"), self.lanes[i].on);
        }
        l
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use emenay_engine::module::Module;

    #[test]
    fn pattern_and_lanes_make_stereo() {
        let mut m = Beat::new();
        m.set_sample_rate(48_000.0);
        m.set_param("pattern", 0.0);
        m.set_param("level", 1.0);
        m.set_param("bd_on", 1.0);
        m.set_param("sd_on", 1.0);
        let mut energy = 0.0_f32;
        for _ in 0..16 {
            for i in 0..600 {
                let clk = if i < 80 { 5.0 } else { 0.0 };
                let mut o = [0.0; 7];
                m.process(&[clk, 0.0], &mut o);
                energy += o[0].abs() + o[1].abs();
            }
        }
        assert!(energy > 10.0, "expected stereo Beat energy, got {energy}");
    }

    #[test]
    fn mute_lane_silences_that_part() {
        let mut m = Beat::new();
        m.set_sample_rate(48_000.0);
        m.set_param("pattern", 15.0); // kick only
        m.set_param("bd_on", 0.0);
        m.set_param("level", 1.0);
        let mut energy = 0.0_f32;
        for _ in 0..8 {
            for i in 0..500 {
                let clk = if i < 60 { 5.0 } else { 0.0 };
                let mut o = [0.0; 7];
                m.process(&[clk, 0.0], &mut o);
                energy += o[2].abs();
            }
        }
        assert!(energy < 0.5, "muted BD pattern should be quiet, got {energy}");
    }
}
