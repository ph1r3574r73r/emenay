//! Organic drifting modulation source (Free Modular Drift–inspired).

use emenay_engine::module::{
    Module, ModuleInfo, ModuleLights, ParamDesc, PortDesc, PortId, SignalKind,
};
use emenay_engine::Voltage;

pub struct Drift {
    info: ModuleInfo,
    rate: f32,
    depth: f32,
    smooth: f32,
    sample_rate: f32,
    state: f32,
    target: f32,
    phase: f32,
    seed: u32,
}

impl Drift {
    pub fn new() -> Self {
        Self {
            info: ModuleInfo {
                type_id: "fm_drift".into(),
                name: "Drift".into(),
                hp: 4,
                inputs: vec![PortDesc {
                    name: "rate_cv".into(),
                    kind: PortId::Input,
                    signal: SignalKind::Cv,
                }],
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
                ],
                params: vec![
                    ParamDesc {
                        name: "rate".into(),
                        min: 0.01,
                        max: 8.0,
                        default: 0.4,
                        unit: "Hz".into(),
                    },
                    ParamDesc {
                        name: "depth".into(),
                        min: 0.0,
                        max: 5.0,
                        default: 2.5,
                        unit: "V".into(),
                    },
                    ParamDesc {
                        name: "smooth".into(),
                        min: 0.05,
                        max: 1.0,
                        default: 0.35,
                        unit: "".into(),
                    },
                ],
            },
            rate: 0.4,
            depth: 2.5,
            smooth: 0.35,
            sample_rate: 48_000.0,
            state: 0.0,
            target: 0.0,
            phase: 0.0,
            seed: 0xC0FFEE,
        }
    }

    fn next_rand(&mut self) -> f32 {
        self.seed = self.seed.wrapping_mul(1664525).wrapping_add(1013904223);
        (self.seed as f32 / u32::MAX as f32) * 2.0 - 1.0
    }
}

impl Default for Drift {
    fn default() -> Self {
        Self::new()
    }
}

impl Module for Drift {
    fn info(&self) -> &ModuleInfo {
        &self.info
    }

    fn set_sample_rate(&mut self, sample_rate: f32) {
        self.sample_rate = sample_rate.max(1.0);
    }

    fn set_param(&mut self, name: &str, value: f32) {
        match name {
            "rate" => self.rate = value.clamp(0.01, 8.0),
            "depth" => self.depth = value.clamp(0.0, 5.0),
            "smooth" => self.smooth = value.clamp(0.05, 1.0),
            _ => {}
        }
    }

    fn get_param(&self, name: &str) -> Option<f32> {
        match name {
            "rate" => Some(self.rate),
            "depth" => Some(self.depth),
            "smooth" => Some(self.smooth),
            _ => None,
        }
    }

    fn process(&mut self, inputs: &[Voltage], outputs: &mut [Voltage]) {
        let rate_cv = inputs.first().copied().unwrap_or(0.0);
        let hz = (self.rate * 2f32.powf(rate_cv * 0.2)).clamp(0.005, 20.0);
        self.phase += hz / self.sample_rate;
        if self.phase >= 1.0 {
            self.phase -= 1.0;
            self.target = self.next_rand() * self.depth;
        }
        let coeff = (1.0 - self.smooth).powf(2.0).clamp(0.001, 1.0);
        // One-pole towards random targets; slower when smooth is high.
        let a = 1.0 - (-2.0 * std::f32::consts::PI * hz * coeff / self.sample_rate).exp();
        self.state += (self.target - self.state) * a;
        if let Some(o) = outputs.get_mut(0) {
            *o = self.state;
        }
        if let Some(o) = outputs.get_mut(1) {
            *o = -self.state;
        }
    }

    fn reset(&mut self) {
        self.state = 0.0;
        self.target = 0.0;
        self.phase = 0.0;
    }

    fn lights(&self) -> ModuleLights {
        let mut l = ModuleLights::new();
        l.set("led", (self.state.abs() / self.depth.max(0.01)).clamp(0.0, 1.0));
        l
    }
}
