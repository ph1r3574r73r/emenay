//! Multi-waveform LFO with rate, shape, and reset.

use emenay_engine::module::{Module, ModuleInfo, ParamDesc, PortDesc, PortId, SignalKind};
use emenay_engine::Voltage;
use std::f32::consts::{PI, TAU};

pub struct Lfo {
    info: ModuleInfo,
    rate: f32,
    shape: f32,
    level: f32,
    sample_rate: f32,
    phase: f32,
    reset_prev: bool,
}

impl Lfo {
    pub fn new() -> Self {
        Self {
            info: ModuleInfo {
                type_id: "lfo".into(),
                name: "LFO".into(),
                hp: 8,
                inputs: vec![
                    PortDesc {
                        name: "rate_cv".into(),
                        kind: PortId::Input,
                        signal: SignalKind::Cv,
                    },
                    PortDesc {
                        name: "reset".into(),
                        kind: PortId::Input,
                        signal: SignalKind::Gate,
                    },
                    PortDesc {
                        name: "shape_cv".into(),
                        kind: PortId::Input,
                        signal: SignalKind::Cv,
                    },
                ],
                outputs: vec![
                    PortDesc {
                        name: "out".into(),
                        kind: PortId::Output,
                        signal: SignalKind::Cv,
                    },
                    PortDesc {
                        name: "inv".into(),
                        kind: PortId::Output,
                        signal: SignalKind::Cv,
                    },
                    PortDesc {
                        name: "uni".into(),
                        kind: PortId::Output,
                        signal: SignalKind::Cv,
                    },
                ],
                params: vec![
                    ParamDesc {
                        name: "rate".into(),
                        min: 0.01,
                        max: 40.0,
                        default: 1.0,
                        unit: "Hz".into(),
                    },
                    ParamDesc {
                        name: "shape".into(),
                        min: 0.0,
                        max: 1.0,
                        default: 0.0,
                        unit: "".into(),
                    },
                    ParamDesc {
                        name: "level".into(),
                        min: 0.0,
                        max: 1.0,
                        default: 1.0,
                        unit: "".into(),
                    },
                ],
            },
            rate: 1.0,
            shape: 0.0,
            level: 1.0,
            sample_rate: 48_000.0,
            phase: 0.0,
            reset_prev: false,
        }
    }

    /// shape 0 sine · 0.25 tri · 0.5 saw · 0.75 square · 1 random-hold-ish via phase hash
    fn wave(&self, t: f32, shape: f32) -> f32 {
        let sine = (TAU * t).sin();
        let tri = if t < 0.5 {
            4.0 * t - 1.0
        } else {
            3.0 - 4.0 * t
        };
        let saw = 2.0 * t - 1.0;
        let sq = if t < 0.5 { 1.0 } else { -1.0 };
        // Quasi-random step keyed off integer phase buckets
        let bucket = (t * 8.0).floor();
        let rnd = ((bucket * 12.9898).sin() * 43758.5453).fract() * 2.0 - 1.0;

        let s = shape.clamp(0.0, 1.0) * 4.0;
        if s < 1.0 {
            sine * (1.0 - s) + tri * s
        } else if s < 2.0 {
            let a = s - 1.0;
            tri * (1.0 - a) + saw * a
        } else if s < 3.0 {
            let a = s - 2.0;
            saw * (1.0 - a) + sq * a
        } else {
            let a = s - 3.0;
            sq * (1.0 - a) + rnd * a
        }
    }
}

impl Default for Lfo {
    fn default() -> Self {
        Self::new()
    }
}

impl Module for Lfo {
    fn info(&self) -> &ModuleInfo {
        &self.info
    }

    fn set_sample_rate(&mut self, sample_rate: f32) {
        self.sample_rate = sample_rate.max(1.0);
    }

    fn set_param(&mut self, name: &str, value: f32) {
        match name {
            "rate" => self.rate = value.clamp(0.01, 40.0),
            "shape" => self.shape = value.clamp(0.0, 1.0),
            "level" => self.level = value.clamp(0.0, 1.0),
            _ => {}
        }
    }

    fn get_param(&self, name: &str) -> Option<f32> {
        match name {
            "rate" => Some(self.rate),
            "shape" => Some(self.shape),
            "level" => Some(self.level),
            _ => None,
        }
    }

    fn process(&mut self, inputs: &[Voltage], outputs: &mut [Voltage]) {
        let rate_cv = inputs.first().copied().unwrap_or(0.0);
        let reset = inputs.get(1).copied().unwrap_or(0.0) > 1.0;
        let shape_cv = inputs.get(2).copied().unwrap_or(0.0);

        if reset && !self.reset_prev {
            self.phase = 0.0;
        }
        self.reset_prev = reset;

        let hz = (self.rate * 2f32.powf(rate_cv * 0.4)).clamp(0.005, 80.0);
        self.phase = (self.phase + hz / self.sample_rate).fract();
        let shape = (self.shape + shape_cv * 0.1).clamp(0.0, 1.0);
        let w = self.wave(self.phase, shape) * self.level;
        // Mild softening so square edges are less clicky into CV destinations.
        let soft = if shape > 0.7 {
            (w * PI / 2.0).tanh()
        } else {
            w
        };

        let bi = soft * 5.0;
        let uni = (soft * 0.5 + 0.5) * 5.0 * self.level;

        if let Some(o) = outputs.get_mut(0) {
            *o = bi;
        }
        if let Some(o) = outputs.get_mut(1) {
            *o = -bi;
        }
        if let Some(o) = outputs.get_mut(2) {
            *o = uni;
        }
    }

    fn reset(&mut self) {
        self.phase = 0.0;
        self.reset_prev = false;
    }
}
