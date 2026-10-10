//! Semi-looping random CV / gates (Free Modular RNG / Turing-inspired).

use emenay_engine::module::{
    Module, ModuleInfo, ModuleLights, ParamDesc, PortDesc, PortId, SignalKind,
};
use emenay_engine::Voltage;

pub struct Rng {
    info: ModuleInfo,
    prob: f32,
    steps: u32,
    scale: f32,
    bias: f32,
    hold: bool,
    write_btn: bool,
    clock_prev: bool,
    bits: u16,
    seed: u32,
    gate_led: f32,
    clock_led: f32,
    write_led: f32,
}

impl Rng {
    pub fn new() -> Self {
        Self {
            info: ModuleInfo {
                type_id: "fm_rng".into(),
                name: "RNG".into(),
                hp: 10,
                inputs: vec![
                    PortDesc {
                        name: "clock".into(),
                        kind: PortId::Input,
                        signal: SignalKind::Gate,
                    },
                    PortDesc {
                        name: "prob_cv".into(),
                        kind: PortId::Input,
                        signal: SignalKind::Cv,
                    },
                    PortDesc {
                        name: "write".into(),
                        kind: PortId::Input,
                        signal: SignalKind::Gate,
                    },
                ],
                outputs: vec![
                    PortDesc {
                        name: "cv".into(),
                        kind: PortId::Output,
                        signal: SignalKind::Cv,
                    },
                    PortDesc {
                        name: "gate".into(),
                        kind: PortId::Output,
                        signal: SignalKind::Gate,
                    },
                    PortDesc {
                        name: "inv".into(),
                        kind: PortId::Output,
                        signal: SignalKind::Cv,
                    },
                ],
                params: vec![
                    ParamDesc {
                        name: "prob".into(),
                        min: 0.0,
                        max: 1.0,
                        default: 0.35,
                        unit: "".into(),
                    },
                    ParamDesc {
                        name: "steps".into(),
                        min: 2.0,
                        max: 16.0,
                        default: 8.0,
                        unit: "int".into(),
                    },
                    ParamDesc {
                        name: "scale".into(),
                        min: 0.0,
                        max: 5.0,
                        default: 5.0,
                        unit: "V".into(),
                    },
                    ParamDesc {
                        name: "bias".into(),
                        min: -2.5,
                        max: 2.5,
                        default: 0.0,
                        unit: "V".into(),
                    },
                    ParamDesc {
                        name: "hold".into(),
                        min: 0.0,
                        max: 1.0,
                        default: 0.0,
                        unit: "bool".into(),
                    },
                    ParamDesc {
                        name: "write_btn".into(),
                        min: 0.0,
                        max: 1.0,
                        default: 0.0,
                        unit: "bool".into(),
                    },
                ],
            },
            prob: 0.35,
            steps: 8,
            scale: 5.0,
            bias: 0.0,
            hold: false,
            write_btn: false,
            clock_prev: false,
            bits: 0b1011_0101_1100_0011,
            seed: 0xA5A5_1337,
            gate_led: 0.0,
            clock_led: 0.0,
            write_led: 0.0,
        }
    }

    fn rand01(&mut self) -> f32 {
        self.seed = self.seed.wrapping_mul(1664525).wrapping_add(1013904223);
        self.seed as f32 / u32::MAX as f32
    }
}

impl Default for Rng {
    fn default() -> Self {
        Self::new()
    }
}

impl Module for Rng {
    fn info(&self) -> &ModuleInfo {
        &self.info
    }

    fn set_sample_rate(&mut self, _sample_rate: f32) {}

    fn set_param(&mut self, name: &str, value: f32) {
        match name {
            "prob" => self.prob = value.clamp(0.0, 1.0),
            "steps" => self.steps = value.clamp(2.0, 16.0).round() as u32,
            "scale" => self.scale = value.clamp(0.0, 5.0),
            "bias" => self.bias = value.clamp(-2.5, 2.5),
            "hold" => self.hold = value >= 0.5,
            "write_btn" => self.write_btn = value >= 0.5,
            _ => {}
        }
    }

    fn get_param(&self, name: &str) -> Option<f32> {
        match name {
            "prob" => Some(self.prob),
            "steps" => Some(self.steps as f32),
            "scale" => Some(self.scale),
            "bias" => Some(self.bias),
            "hold" => Some(if self.hold { 1.0 } else { 0.0 }),
            "write_btn" => Some(if self.write_btn { 1.0 } else { 0.0 }),
            _ => None,
        }
    }

    fn process(&mut self, inputs: &[Voltage], outputs: &mut [Voltage]) {
        let clock = inputs.first().copied().unwrap_or(0.0) > 1.0;
        let prob_cv = inputs.get(1).copied().unwrap_or(0.0);
        let write_jack = inputs.get(2).copied().unwrap_or(0.0) > 1.0;
        let write = write_jack || self.write_btn;
        let p = (self.prob + prob_cv * 0.1).clamp(0.0, 1.0);

        let n_steps = self.steps.clamp(2, 16);
        let mask = if n_steps >= 16 {
            0xffffu16
        } else {
            (1u16 << n_steps) - 1
        };

        if clock && !self.clock_prev {
            self.clock_led = 1.0;
            if !self.hold {
                // Rotate within `steps` bits (Turing-style loop length).
                let reg = self.bits & mask;
                let msb = (reg >> (n_steps - 1)) & 1;
                let mut next = ((reg << 1) | msb) & mask;
                if write || self.rand01() < p {
                    next ^= 1;
                }
                self.bits = next;
            }
        }
        self.clock_prev = clock;
        self.clock_led *= 0.995;
        self.write_led = if write { 1.0 } else { self.write_led * 0.99 };

        let n = (self.bits & mask) as f32;
        let den = mask.max(1) as f32;
        let cv = (n / den) * self.scale + self.bias;
        let gate = if (self.bits & 1) != 0 { 5.0 } else { 0.0 };
        self.gate_led = if gate > 0.0 { 1.0 } else { 0.08 };

        if let Some(o) = outputs.get_mut(0) {
            *o = cv.clamp(-10.0, 10.0);
        }
        if let Some(o) = outputs.get_mut(1) {
            *o = gate;
        }
        if let Some(o) = outputs.get_mut(2) {
            *o = (-cv).clamp(-10.0, 10.0);
        }
    }

    fn reset(&mut self) {
        self.clock_prev = false;
        self.gate_led = 0.0;
        self.clock_led = 0.0;
        self.write_led = 0.0;
    }

    fn lights(&self) -> ModuleLights {
        let mut l = ModuleLights::new();
        l.set("gate", self.gate_led);
        l.set("hold", if self.hold { 1.0 } else { 0.0 });
        l.set("write_btn", if self.write_btn { 1.0 } else { 0.0 });
        l.set("write", self.write_led.max(if self.write_btn { 1.0 } else { 0.0 }));
        l.set("clock", self.clock_led.max(0.06));
        // Top bit bar — show up to 7 LSBs of the loop register.
        for i in 0..7u32 {
            let on = (self.bits >> i) & 1 != 0;
            l.set(format!("bit{i}"), if on { 1.0 } else { 0.08 });
        }
        l
    }
}
