//! Erica Synths DIY Bassline — acid voice (saw + Polivoks-style filter + decay).
//!
//! Attribution: schematics CC-BY-SA-3.0 (Erica Synths DIY Eurorack). Software model © emenay.
//! Composes VCO3-style saw + Polivoks VCF character + percussive decay envelope.

use emenay_engine::module::{Module, ModuleInfo, ParamDesc, PortDesc, PortId, SignalKind};
use emenay_engine::Voltage;
use std::f32::consts::TAU;

pub struct EricaBassline {
    info: ModuleInfo,
    tune: f32,
    cutoff: f32,
    res: f32,
    decay: f32,
    accent: f32,
    drive: f32,
    sample_rate: f32,
    phase: f32,
    env: f32,
    gate_prev: bool,
    z: [f32; 4],
}

impl EricaBassline {
    pub fn new() -> Self {
        Self {
            info: ModuleInfo {
                type_id: "erica_bassline".into(),
                name: "Bassline".into(),
                hp: 16,
                inputs: vec![
                    PortDesc {
                        name: "v_oct".into(),
                        kind: PortId::Input,
                        signal: SignalKind::Cv,
                    },
                    PortDesc {
                        name: "gate".into(),
                        kind: PortId::Input,
                        signal: SignalKind::Gate,
                    },
                    PortDesc {
                        name: "accent_gate".into(),
                        kind: PortId::Input,
                        signal: SignalKind::Gate,
                    },
                    PortDesc {
                        name: "cutoff_cv".into(),
                        kind: PortId::Input,
                        signal: SignalKind::Cv,
                    },
                ],
                outputs: vec![PortDesc {
                    name: "out".into(),
                    kind: PortId::Output,
                    signal: SignalKind::Audio,
                }],
                params: vec![
                    ParamDesc {
                        name: "tune".into(),
                        min: 20.0,
                        max: 500.0,
                        default: 55.0,
                        unit: "Hz".into(),
                    },
                    ParamDesc {
                        name: "cutoff".into(),
                        min: 40.0,
                        max: 8_000.0,
                        default: 500.0,
                        unit: "Hz".into(),
                    },
                    ParamDesc {
                        name: "res".into(),
                        min: 0.0,
                        max: 1.0,
                        default: 0.55,
                        unit: "".into(),
                    },
                    ParamDesc {
                        name: "decay".into(),
                        min: 0.02,
                        max: 2.0,
                        default: 0.35,
                        unit: "s".into(),
                    },
                    ParamDesc {
                        name: "accent".into(),
                        min: 0.0,
                        max: 1.0,
                        default: 0.6,
                        unit: "".into(),
                    },
                    ParamDesc {
                        name: "drive".into(),
                        min: 0.0,
                        max: 1.0,
                        default: 0.4,
                        unit: "".into(),
                    },
                ],
            },
            tune: 55.0,
            cutoff: 500.0,
            res: 0.55,
            decay: 0.35,
            accent: 0.6,
            drive: 0.4,
            sample_rate: 48_000.0,
            phase: 0.0,
            env: 0.0,
            gate_prev: false,
            z: [0.0; 4],
        }
    }

    #[inline]
    fn soft(x: f32) -> f32 {
        let y = x + 0.12 * x * x - 0.04 * x * x * x;
        y.tanh()
    }
}

impl Default for EricaBassline {
    fn default() -> Self {
        Self::new()
    }
}

impl Module for EricaBassline {
    fn info(&self) -> &ModuleInfo {
        &self.info
    }

    fn set_sample_rate(&mut self, sample_rate: f32) {
        self.sample_rate = sample_rate.max(1.0);
    }

    fn set_param(&mut self, name: &str, value: f32) {
        match name {
            "tune" => self.tune = value.clamp(20.0, 500.0),
            "cutoff" => self.cutoff = value.clamp(40.0, 8_000.0),
            "res" => self.res = value.clamp(0.0, 1.0),
            "decay" => self.decay = value.clamp(0.02, 2.0),
            "accent" => self.accent = value.clamp(0.0, 1.0),
            "drive" => self.drive = value.clamp(0.0, 1.0),
            _ => {}
        }
    }

    fn get_param(&self, name: &str) -> Option<f32> {
        match name {
            "tune" => Some(self.tune),
            "cutoff" => Some(self.cutoff),
            "res" => Some(self.res),
            "decay" => Some(self.decay),
            "accent" => Some(self.accent),
            "drive" => Some(self.drive),
            _ => None,
        }
    }

    fn process(&mut self, inputs: &[Voltage], outputs: &mut [Voltage]) {
        let v_oct = inputs.first().copied().unwrap_or(0.0);
        let gate = inputs.get(1).copied().unwrap_or(0.0) > 1.0;
        let accent_gate = inputs.get(2).copied().unwrap_or(0.0) > 1.0;
        let cut_cv = inputs.get(3).copied().unwrap_or(0.0);

        if gate && !self.gate_prev {
            let boost = if accent_gate { 1.0 + self.accent } else { 1.0 };
            self.env = boost.min(1.8);
        }
        self.gate_prev = gate;

        let decay_coef = (-1.0 / (self.decay * self.sample_rate)).exp();
        self.env *= decay_coef;

        let hz = (self.tune * 2f32.powf(v_oct)).clamp(0.1, self.sample_rate * 0.4);
        self.phase = (self.phase + hz / self.sample_rate).fract();
        let saw = (2.0 * self.phase - 1.0) * (1.0 + self.drive);

        let cut = (self.cutoff
            * 2f32.powf(cut_cv * 0.35 + self.env * 1.8 + if accent_gate { self.accent } else { 0.0 }))
        .clamp(30.0, self.sample_rate * 0.42);
        let g = (TAU * cut / self.sample_rate).clamp(0.001, 1.2);
        let k = (self.res * 3.9).clamp(0.0, 4.2);

        let mut x = Self::soft(saw) - k * Self::soft(self.z[3]);
        for i in 0..4 {
            self.z[i] += g * (Self::soft(x) - Self::soft(self.z[i]));
            x = self.z[i];
        }

        let out = (self.z[3] * self.env * 5.0).clamp(-8.0, 8.0);
        if let Some(o) = outputs.get_mut(0) {
            *o = out;
        }
    }

    fn reset(&mut self) {
        self.phase = 0.0;
        self.env = 0.0;
        self.gate_prev = false;
        self.z = [0.0; 4];
    }
}
