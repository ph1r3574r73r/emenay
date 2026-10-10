//! Swell — dual-slope generator (inspired by MI tides; not a firmware port).
//! (orthogonal DSP — not a firmware port).
//!
//! Shape / slope / smoothness control a unipolar envelope-like oscillator
//! that can run as LFO or audio-rate, with PLUCK mode on trigger.

use emenay_engine::module::{Module, ModuleInfo, ParamDesc, PortDesc, PortId, SignalKind};
use emenay_engine::Voltage;
use std::f32::consts::PI;

pub struct Swell {
    info: ModuleInfo,
    freq: f32,
    shape: f32,
    slope: f32,
    smoothness: f32,
    shift: f32,
    sample_rate: f32,
    phase: f32,
    state: f32,
    trig_prev: bool,
    pluck_env: f32,
    /// Panel: 0 = free-run loop, 1 = pluck (one-shot on TRIG).
    pluck: bool,
}

impl Swell {
    pub fn new() -> Self {
        Self {
            info: ModuleInfo {
                type_id: "swell".into(),
                name: "Swell".into(),
                hp: 12,
                inputs: vec![
                    PortDesc {
                        name: "v_oct".into(),
                        kind: PortId::Input,
                        signal: SignalKind::Cv,
                    },
                    PortDesc {
                        name: "trig".into(),
                        kind: PortId::Input,
                        signal: SignalKind::Gate,
                    },
                    PortDesc {
                        name: "shape_cv".into(),
                        kind: PortId::Input,
                        signal: SignalKind::Cv,
                    },
                    PortDesc {
                        name: "slope_cv".into(),
                        kind: PortId::Input,
                        signal: SignalKind::Cv,
                    },
                    PortDesc {
                        name: "fm".into(),
                        kind: PortId::Input,
                        signal: SignalKind::Cv,
                    },
                ],
                outputs: vec![
                    PortDesc {
                        name: "uni".into(),
                        kind: PortId::Output,
                        signal: SignalKind::Cv,
                    },
                    PortDesc {
                        name: "bi".into(),
                        kind: PortId::Output,
                        signal: SignalKind::Cv,
                    },
                    PortDesc {
                        name: "tri".into(),
                        kind: PortId::Output,
                        signal: SignalKind::Cv,
                    },
                    PortDesc {
                        name: "gate".into(),
                        kind: PortId::Output,
                        signal: SignalKind::Gate,
                    },
                ],
                params: vec![
                    ParamDesc {
                        name: "freq".into(),
                        min: 0.05,
                        max: 2000.0,
                        default: 1.5,
                        unit: "Hz".into(),
                    },
                    ParamDesc {
                        name: "shape".into(),
                        min: 0.0,
                        max: 1.0,
                        default: 0.5,
                        unit: "".into(),
                    },
                    ParamDesc {
                        name: "slope".into(),
                        min: 0.0,
                        max: 1.0,
                        default: 0.5,
                        unit: "".into(),
                    },
                    ParamDesc {
                        name: "smooth".into(),
                        min: 0.0,
                        max: 1.0,
                        default: 0.3,
                        unit: "".into(),
                    },
                    ParamDesc {
                        name: "shift".into(),
                        min: 0.0,
                        max: 1.0,
                        default: 0.25,
                        unit: "".into(),
                    },
                    ParamDesc {
                        name: "pluck".into(),
                        min: 0.0,
                        max: 1.0,
                        default: 0.0,
                        unit: "bool".into(),
                    },
                ],
            },
            freq: 1.5,
            shape: 0.5,
            slope: 0.5,
            smoothness: 0.3,
            shift: 0.25,
            sample_rate: 48_000.0,
            phase: 0.0,
            state: 0.0,
            trig_prev: false,
            pluck_env: 0.0,
            pluck: false,
        }
    }

    /// Asymmetric triangle → sine morph with slope skew.
    fn wave(t: f32, shape: f32, slope: f32) -> f32 {
        let apex = slope.clamp(0.05, 0.95);
        let tri = if t < apex {
            t / apex
        } else {
            1.0 - (t - apex) / (1.0 - apex)
        };
        // Shape: 0 = triangle-ish, 1 = pulse/sine blend
        let sine = (PI * tri).sin();
        let pulse = if tri > 0.5 { 1.0 } else { 0.0 };
        let shaped = if shape < 0.5 {
            let a = shape * 2.0;
            tri * (1.0 - a) + sine * a
        } else {
            let a = (shape - 0.5) * 2.0;
            sine * (1.0 - a) + pulse * a
        };
        shaped.clamp(0.0, 1.0)
    }
}

impl Default for Swell {
    fn default() -> Self {
        Self::new()
    }
}

impl Module for Swell {
    fn info(&self) -> &ModuleInfo {
        &self.info
    }

    fn set_sample_rate(&mut self, sample_rate: f32) {
        self.sample_rate = sample_rate.max(1.0);
    }

    fn set_param(&mut self, name: &str, value: f32) {
        match name {
            "freq" => self.freq = value.clamp(0.05, 2000.0),
            "shape" => self.shape = value.clamp(0.0, 1.0),
            "slope" => self.slope = value.clamp(0.0, 1.0),
            "smooth" => self.smoothness = value.clamp(0.0, 1.0),
            "shift" => self.shift = value.clamp(0.0, 1.0),
            "pluck" => self.pluck = value >= 0.5,
            _ => {}
        }
    }

    fn get_param(&self, name: &str) -> Option<f32> {
        match name {
            "freq" => Some(self.freq),
            "shape" => Some(self.shape),
            "slope" => Some(self.slope),
            "smooth" => Some(self.smoothness),
            "shift" => Some(self.shift),
            "pluck" => Some(if self.pluck { 1.0 } else { 0.0 }),
            _ => None,
        }
    }

    fn process(&mut self, inputs: &[Voltage], outputs: &mut [Voltage]) {
        let v_oct = inputs.first().copied().unwrap_or(0.0);
        let trig = inputs.get(1).copied().unwrap_or(0.0) > 1.0;
        let shape_cv = inputs.get(2).copied().unwrap_or(0.0);
        let slope_cv = inputs.get(3).copied().unwrap_or(0.0);
        let fm = inputs.get(4).copied().unwrap_or(0.0);

        if trig && !self.trig_prev {
            self.phase = 0.0;
            self.pluck_env = 1.0;
        }
        self.trig_prev = trig;

        let hz = (self.freq * 2f32.powf(v_oct + fm * 0.4)).clamp(0.01, self.sample_rate * 0.45);
        let advance = hz / self.sample_rate;

        if self.pluck {
            if self.pluck_env > 1e-4 {
                self.phase += advance;
                if self.phase >= 1.0 {
                    self.phase = 0.0;
                    self.pluck_env = 0.0;
                } else {
                    self.pluck_env *= 0.9992;
                }
            }
        } else {
            self.phase = (self.phase + advance).fract();
            self.pluck_env = 1.0;
        }

        let shape = (self.shape + shape_cv * 0.1).clamp(0.0, 1.0);
        let slope = (self.slope + slope_cv * 0.1).clamp(0.0, 1.0);
        let raw = if self.pluck && self.pluck_env <= 1e-4 {
            0.0
        } else {
            Self::wave(self.phase, shape, slope)
        };
        let raw2 = Self::wave((self.phase + self.shift).fract(), shape, slope);

        let smooth_hz = 20.0 + (1.0 - self.smoothness).powi(2) * 8_000.0;
        let a = 1.0 - (-2.0 * PI * smooth_hz / self.sample_rate).exp();
        self.state += (raw - self.state) * a;

        let amp = if self.pluck {
            self.pluck_env.clamp(0.0, 1.0)
        } else {
            1.0
        };
        let uni = self.state * 5.0 * amp;
        let bi = (self.state * 2.0 - 1.0) * 5.0 * amp;
        let tri = (raw2 * 2.0 - 1.0) * 5.0 * amp;
        let gate = if self.state > 0.5 && amp > 0.05 {
            5.0
        } else {
            0.0
        };

        if let Some(o) = outputs.get_mut(0) {
            *o = uni;
        }
        if let Some(o) = outputs.get_mut(1) {
            *o = bi;
        }
        if let Some(o) = outputs.get_mut(2) {
            *o = tri;
        }
        if let Some(o) = outputs.get_mut(3) {
            *o = gate;
        }
    }

    fn reset(&mut self) {
        self.phase = 0.0;
        self.state = 0.0;
        self.trig_prev = false;
        self.pluck_env = 0.0;
    }
}
