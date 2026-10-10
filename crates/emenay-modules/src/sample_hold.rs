//! Dual sample-and-hold / track-and-hold.

use emenay_engine::module::{Module, ModuleInfo, ParamDesc, PortDesc, PortId, SignalKind};
use emenay_engine::Voltage;

pub struct SampleHold {
    info: ModuleInfo,
    slew: f32,
    noise: f32,
    clock_prev: bool,
    held: f32,
    out: f32,
    seed: u32,
    sample_rate: f32,
}

impl SampleHold {
    pub fn new() -> Self {
        Self {
            info: ModuleInfo {
                type_id: "sample_hold".into(),
                name: "S&H".into(),
                hp: 4,
                inputs: vec![
                    PortDesc {
                        name: "in".into(),
                        kind: PortId::Input,
                        signal: SignalKind::Cv,
                    },
                    PortDesc {
                        name: "clock".into(),
                        kind: PortId::Input,
                        signal: SignalKind::Gate,
                    },
                ],
                outputs: vec![PortDesc {
                    name: "out".into(),
                    kind: PortId::Output,
                    signal: SignalKind::Cv,
                }],
                params: vec![
                    ParamDesc {
                        name: "slew".into(),
                        min: 0.0,
                        max: 1.0,
                        default: 0.0,
                        unit: "".into(),
                    },
                    ParamDesc {
                        name: "noise".into(),
                        min: 0.0,
                        max: 1.0,
                        default: 0.0,
                        unit: "".into(),
                    },
                ],
            },
            slew: 0.0,
            noise: 0.0,
            clock_prev: false,
            held: 0.0,
            out: 0.0,
            seed: 0x5A17_E01D,
            sample_rate: 48_000.0,
        }
    }

    fn next_noise(&mut self) -> f32 {
        self.seed = self.seed.wrapping_mul(1664525).wrapping_add(1013904223);
        (self.seed as f32 / u32::MAX as f32) * 2.0 - 1.0
    }
}

impl Default for SampleHold {
    fn default() -> Self {
        Self::new()
    }
}

impl Module for SampleHold {
    fn info(&self) -> &ModuleInfo {
        &self.info
    }

    fn set_sample_rate(&mut self, sample_rate: f32) {
        self.sample_rate = sample_rate.max(1.0);
    }

    fn set_param(&mut self, name: &str, value: f32) {
        match name {
            "slew" => self.slew = value.clamp(0.0, 1.0),
            "noise" => self.noise = value.clamp(0.0, 1.0),
            _ => {}
        }
    }

    fn get_param(&self, name: &str) -> Option<f32> {
        match name {
            "slew" => Some(self.slew),
            "noise" => Some(self.noise),
            _ => None,
        }
    }

    fn process(&mut self, inputs: &[Voltage], outputs: &mut [Voltage]) {
        let inp = inputs.first().copied().unwrap_or(0.0);
        let clock = inputs.get(1).copied().unwrap_or(0.0) > 1.0;
        let n = self.next_noise() * 5.0;

        if clock && !self.clock_prev {
            // If nothing patched to in (~0), sample internal noise.
            let src = if inp.abs() < 1e-4 {
                n * (0.3 + self.noise * 0.7)
            } else {
                inp + n * self.noise * 0.25
            };
            self.held = src;
        }
        self.clock_prev = clock;

        if self.slew < 0.001 {
            self.out = self.held;
        } else {
            let hz = 0.5 + (1.0 - self.slew).powi(2) * 200.0;
            let a = 1.0 - (-2.0 * std::f32::consts::PI * hz / self.sample_rate).exp();
            self.out += (self.held - self.out) * a;
        }

        if let Some(o) = outputs.get_mut(0) {
            *o = self.out.clamp(-10.0, 10.0);
        }
        let _ = n;
    }

    fn reset(&mut self) {
        self.clock_prev = false;
        self.held = 0.0;
        self.out = 0.0;
    }
}
