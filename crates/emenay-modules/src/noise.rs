//! Analog-flavored noise source: white, pink, and slow random.

use emenay_engine::module::{Module, ModuleInfo, ParamDesc, PortDesc, PortId, SignalKind};
use emenay_engine::Voltage;

pub struct Noise {
    info: ModuleInfo,
    level: f32,
    color: f32,
    seed: u32,
    pink_b0: f32,
    pink_b1: f32,
    pink_b2: f32,
    pink_b3: f32,
    pink_b4: f32,
    pink_b5: f32,
    pink_b6: f32,
    slow: f32,
    sample_rate: f32,
    slow_phase: f32,
}

impl Noise {
    pub fn new() -> Self {
        Self {
            info: ModuleInfo {
                type_id: "noise".into(),
                name: "Noise".into(),
                hp: 6,
                inputs: vec![PortDesc {
                    name: "level_cv".into(),
                    kind: PortId::Input,
                    signal: SignalKind::Cv,
                }],
                outputs: vec![
                    PortDesc {
                        name: "white".into(),
                        kind: PortId::Output,
                        signal: SignalKind::Audio,
                    },
                    PortDesc {
                        name: "pink".into(),
                        kind: PortId::Output,
                        signal: SignalKind::Audio,
                    },
                    PortDesc {
                        name: "slow".into(),
                        kind: PortId::Output,
                        signal: SignalKind::Cv,
                    },
                ],
                params: vec![
                    ParamDesc {
                        name: "level".into(),
                        min: 0.0,
                        max: 1.0,
                        default: 0.7,
                        unit: "".into(),
                    },
                    ParamDesc {
                        name: "color".into(),
                        min: 0.0,
                        max: 1.0,
                        default: 0.5,
                        unit: "".into(),
                    },
                ],
            },
            level: 0.7,
            color: 0.5,
            seed: 0xDEAD_BEEF,
            pink_b0: 0.0,
            pink_b1: 0.0,
            pink_b2: 0.0,
            pink_b3: 0.0,
            pink_b4: 0.0,
            pink_b5: 0.0,
            pink_b6: 0.0,
            slow: 0.0,
            sample_rate: 48_000.0,
            slow_phase: 0.0,
        }
    }

    fn next_white(&mut self) -> f32 {
        self.seed = self.seed.wrapping_mul(1664525).wrapping_add(1013904223);
        (self.seed as f32 / u32::MAX as f32) * 2.0 - 1.0
    }
}

impl Default for Noise {
    fn default() -> Self {
        Self::new()
    }
}

impl Module for Noise {
    fn info(&self) -> &ModuleInfo {
        &self.info
    }

    fn set_sample_rate(&mut self, sample_rate: f32) {
        self.sample_rate = sample_rate.max(1.0);
    }

    fn set_param(&mut self, name: &str, value: f32) {
        match name {
            "level" => self.level = value.clamp(0.0, 1.0),
            "color" => self.color = value.clamp(0.0, 1.0),
            _ => {}
        }
    }

    fn get_param(&self, name: &str) -> Option<f32> {
        match name {
            "level" => Some(self.level),
            "color" => Some(self.color),
            _ => None,
        }
    }

    fn process(&mut self, inputs: &[Voltage], outputs: &mut [Voltage]) {
        let level_cv = inputs.first().copied().unwrap_or(0.0);
        let amp = (self.level + level_cv * 0.1).clamp(0.0, 1.5) * 5.0;

        let white = self.next_white();

        // Paul Kellet pink-noise approx.
        self.pink_b0 = 0.99886 * self.pink_b0 + white * 0.0555179;
        self.pink_b1 = 0.99332 * self.pink_b1 + white * 0.0750759;
        self.pink_b2 = 0.96900 * self.pink_b2 + white * 0.1538520;
        self.pink_b3 = 0.86650 * self.pink_b3 + white * 0.3104856;
        self.pink_b4 = 0.55000 * self.pink_b4 + white * 0.5329522;
        self.pink_b5 = -0.7616 * self.pink_b5 - white * 0.0168980;
        let pink = (self.pink_b0
            + self.pink_b1
            + self.pink_b2
            + self.pink_b3
            + self.pink_b4
            + self.pink_b5
            + self.pink_b6
            + white * 0.5362)
            * 0.11;
        self.pink_b6 = white * 0.115926;

        // Slow random CV (~0.2–8 Hz shaped by color).
        let slow_hz = 0.15 + self.color * self.color * 6.0;
        self.slow_phase += slow_hz / self.sample_rate;
        if self.slow_phase >= 1.0 {
            self.slow_phase -= 1.0;
            self.slow = self.next_white() * amp * 0.6;
        }

        let blend = white * (1.0 - self.color) + pink * self.color;

        if let Some(o) = outputs.get_mut(0) {
            *o = (white * amp).clamp(-8.0, 8.0);
        }
        if let Some(o) = outputs.get_mut(1) {
            *o = (blend * amp).clamp(-8.0, 8.0);
        }
        if let Some(o) = outputs.get_mut(2) {
            *o = self.slow.clamp(-8.0, 8.0);
        }
    }

    fn reset(&mut self) {
        self.pink_b0 = 0.0;
        self.pink_b1 = 0.0;
        self.pink_b2 = 0.0;
        self.pink_b3 = 0.0;
        self.pink_b4 = 0.0;
        self.pink_b5 = 0.0;
        self.pink_b6 = 0.0;
        self.slow = 0.0;
        self.slow_phase = 0.0;
    }
}
