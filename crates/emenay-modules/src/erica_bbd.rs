//! Erica Synths DIY BBD — bucket-brigade delay / flanger.
//!
//! Attribution: schematics CC-BY-SA-3.0 (Erica Synths EDU DIY BBD). Software model © emenay.
//! Variable-rate delay line with colour LPF, feedback, inhibit (clock hold), wet + mix outs.

use emenay_engine::module::{Module, ModuleInfo, ParamDesc, PortDesc, PortId, SignalKind};
use emenay_engine::Voltage;
use std::f32::consts::TAU;

const MAX_MS: f32 = 800.0;
const MAX_CAP: usize = 48_000;

pub struct EricaBbd {
    info: ModuleInfo,
    time_ms: f32,
    feedback: f32,
    mix: f32,
    colour: f32,
    mod_rate: f32,
    mod_amt: f32,
    sample_rate: f32,
    buf: Vec<f32>,
    w: usize,
    lp: f32,
    lfo_phase: f32,
}

impl EricaBbd {
    pub fn new() -> Self {
        Self {
            info: ModuleInfo {
                type_id: "erica_bbd".into(),
                name: "BBD".into(),
                hp: 10,
                inputs: vec![
                    PortDesc {
                        name: "in".into(),
                        kind: PortId::Input,
                        signal: SignalKind::Audio,
                    },
                    PortDesc {
                        name: "time_cv".into(),
                        kind: PortId::Input,
                        signal: SignalKind::Cv,
                    },
                    PortDesc {
                        name: "inhibit".into(),
                        kind: PortId::Input,
                        signal: SignalKind::Gate,
                    },
                ],
                outputs: vec![
                    PortDesc {
                        name: "wet".into(),
                        kind: PortId::Output,
                        signal: SignalKind::Audio,
                    },
                    PortDesc {
                        name: "mix_out".into(),
                        kind: PortId::Output,
                        signal: SignalKind::Audio,
                    },
                ],
                params: vec![
                    ParamDesc {
                        name: "time".into(),
                        min: 1.0,
                        max: MAX_MS,
                        default: 120.0,
                        unit: "ms".into(),
                    },
                    ParamDesc {
                        name: "feedback".into(),
                        min: 0.0,
                        max: 0.98,
                        default: 0.45,
                        unit: "".into(),
                    },
                    ParamDesc {
                        name: "mix".into(),
                        min: 0.0,
                        max: 1.0,
                        default: 0.4,
                        unit: "".into(),
                    },
                    ParamDesc {
                        name: "colour".into(),
                        min: 0.0,
                        max: 1.0,
                        default: 0.55,
                        unit: "".into(),
                    },
                    ParamDesc {
                        name: "mod_rate".into(),
                        min: 0.05,
                        max: 12.0,
                        default: 0.4,
                        unit: "Hz".into(),
                    },
                    ParamDesc {
                        name: "mod_amt".into(),
                        min: 0.0,
                        max: 1.0,
                        default: 0.15,
                        unit: "".into(),
                    },
                ],
            },
            time_ms: 120.0,
            feedback: 0.45,
            mix: 0.4,
            colour: 0.55,
            mod_rate: 0.4,
            mod_amt: 0.15,
            sample_rate: 48_000.0,
            buf: vec![0.0; MAX_CAP],
            w: 0,
            lp: 0.0,
            lfo_phase: 0.0,
        }
    }

    fn cap(&self) -> usize {
        ((self.sample_rate * MAX_MS / 1000.0) as usize).clamp(2048, MAX_CAP)
    }

    fn read(&self, delay_samp: f32, cap: usize) -> f32 {
        let d = delay_samp.clamp(1.0, (cap - 2) as f32);
        let r = self.w as f32 - d;
        let r0 = ((r.floor() as i32).rem_euclid(cap as i32)) as usize;
        let r1 = (r0 + 1) % cap;
        let frac = r.fract();
        self.buf[r0] + (self.buf[r1] - self.buf[r0]) * frac
    }

    #[inline]
    fn soft(x: f32) -> f32 {
        (x * 0.85).tanh() * 1.15
    }
}

impl Default for EricaBbd {
    fn default() -> Self {
        Self::new()
    }
}

impl Module for EricaBbd {
    fn info(&self) -> &ModuleInfo {
        &self.info
    }

    fn set_sample_rate(&mut self, sample_rate: f32) {
        self.sample_rate = sample_rate.max(1.0);
        let cap = self.cap();
        if self.buf.len() != cap {
            self.buf.resize(cap, 0.0);
            self.w = 0;
        }
    }

    fn set_param(&mut self, name: &str, value: f32) {
        match name {
            "time" => self.time_ms = value.clamp(1.0, MAX_MS),
            "feedback" => self.feedback = value.clamp(0.0, 0.98),
            "mix" => self.mix = value.clamp(0.0, 1.0),
            "colour" => self.colour = value.clamp(0.0, 1.0),
            "mod_rate" => self.mod_rate = value.clamp(0.05, 12.0),
            "mod_amt" => self.mod_amt = value.clamp(0.0, 1.0),
            _ => {}
        }
    }

    fn get_param(&self, name: &str) -> Option<f32> {
        match name {
            "time" => Some(self.time_ms),
            "feedback" => Some(self.feedback),
            "mix" => Some(self.mix),
            "colour" => Some(self.colour),
            "mod_rate" => Some(self.mod_rate),
            "mod_amt" => Some(self.mod_amt),
            _ => None,
        }
    }

    fn process(&mut self, inputs: &[Voltage], outputs: &mut [Voltage]) {
        let dry = inputs.first().copied().unwrap_or(0.0);
        let time_cv = inputs.get(1).copied().unwrap_or(0.0);
        let inhibit = inputs.get(2).copied().unwrap_or(0.0) > 1.0;

        self.lfo_phase = (self.lfo_phase + self.mod_rate / self.sample_rate).fract();
        let lfo = (TAU * self.lfo_phase).sin();
        // External time CV replaces internal LFO depth when present (|cv| > noise floor).
        let mod_term = if time_cv.abs() > 0.05 {
            time_cv * 0.35
        } else {
            lfo * self.mod_amt * 0.45
        };

        let ms = (self.time_ms * 2f32.powf(mod_term)).clamp(0.5, MAX_MS);
        let delay_samp = ms * 0.001 * self.sample_rate;
        let cap = self.cap();

        let wet_raw = self.read(delay_samp, cap);
        // Colour: more CW = brighter (less LPF)
        let cutoff = 400.0 + self.colour * 9_000.0;
        let a = 1.0 - (-TAU * cutoff / self.sample_rate).exp();
        self.lp += a * (wet_raw - self.lp);
        let wet = Self::soft(self.lp);

        if !inhibit {
            let fb = Self::soft(dry + wet * self.feedback);
            self.buf[self.w % cap] = fb;
            self.w = (self.w + 1) % cap;
        }

        let mixed = dry * (1.0 - self.mix) + wet * self.mix;
        if let Some(o) = outputs.get_mut(0) {
            *o = wet;
        }
        if let Some(o) = outputs.get_mut(1) {
            *o = mixed;
        }
    }

    fn reset(&mut self) {
        self.buf.fill(0.0);
        self.w = 0;
        self.lp = 0.0;
        self.lfo_phase = 0.0;
    }
}
