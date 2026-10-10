//! Quad sequential switch inspired by Doepfer A-151.
//!
//! Trig advances the active step; reset returns to step 1.
//! Steps selectable 2 / 3 / 4.
//! Bidirectional: COM IN → O1…O4, and I1…I4 → COM OUT.

use emenay_engine::module::{
    Module, ModuleInfo, ModuleLights, ParamDesc, PortDesc, PortId, SignalKind,
};
use emenay_engine::Voltage;

pub struct SeqSwitch {
    info: ModuleInfo,
    steps: u32,
    step: u32,
    trig_prev: bool,
    reset_prev: bool,
}

impl SeqSwitch {
    pub fn new() -> Self {
        Self {
            info: ModuleInfo {
                type_id: "seq_switch".into(),
                name: "Switch".into(),
                hp: 6,
                inputs: vec![
                    PortDesc {
                        name: "trig".into(),
                        kind: PortId::Input,
                        signal: SignalKind::Gate,
                    },
                    PortDesc {
                        name: "reset".into(),
                        kind: PortId::Input,
                        signal: SignalKind::Gate,
                    },
                    PortDesc {
                        name: "com".into(),
                        kind: PortId::Input,
                        signal: SignalKind::Audio,
                    },
                    PortDesc {
                        name: "i1".into(),
                        kind: PortId::Input,
                        signal: SignalKind::Audio,
                    },
                    PortDesc {
                        name: "i2".into(),
                        kind: PortId::Input,
                        signal: SignalKind::Audio,
                    },
                    PortDesc {
                        name: "i3".into(),
                        kind: PortId::Input,
                        signal: SignalKind::Audio,
                    },
                    PortDesc {
                        name: "i4".into(),
                        kind: PortId::Input,
                        signal: SignalKind::Audio,
                    },
                ],
                outputs: vec![
                    PortDesc {
                        name: "o1".into(),
                        kind: PortId::Output,
                        signal: SignalKind::Audio,
                    },
                    PortDesc {
                        name: "o2".into(),
                        kind: PortId::Output,
                        signal: SignalKind::Audio,
                    },
                    PortDesc {
                        name: "o3".into(),
                        kind: PortId::Output,
                        signal: SignalKind::Audio,
                    },
                    PortDesc {
                        name: "o4".into(),
                        kind: PortId::Output,
                        signal: SignalKind::Audio,
                    },
                    PortDesc {
                        name: "com_out".into(),
                        kind: PortId::Output,
                        signal: SignalKind::Audio,
                    },
                ],
                params: vec![ParamDesc {
                    name: "steps".into(),
                    min: 2.0,
                    max: 4.0,
                    default: 4.0,
                    unit: "int".into(),
                }],
            },
            steps: 4,
            step: 0,
            trig_prev: false,
            reset_prev: false,
        }
    }
}

impl Default for SeqSwitch {
    fn default() -> Self {
        Self::new()
    }
}

impl Module for SeqSwitch {
    fn info(&self) -> &ModuleInfo {
        &self.info
    }

    fn set_sample_rate(&mut self, _sample_rate: f32) {}

    fn set_param(&mut self, name: &str, value: f32) {
        if name == "steps" {
            self.steps = value.clamp(2.0, 4.0).round() as u32;
            if self.step >= self.steps {
                self.step = 0;
            }
        }
    }

    fn get_param(&self, name: &str) -> Option<f32> {
        if name == "steps" {
            Some(self.steps as f32)
        } else {
            None
        }
    }

    fn process(&mut self, inputs: &[Voltage], outputs: &mut [Voltage]) {
        let trig = inputs.first().copied().unwrap_or(0.0) > 1.0;
        let reset = inputs.get(1).copied().unwrap_or(0.0) > 1.0;
        let com_in = inputs.get(2).copied().unwrap_or(0.0);
        let ch = [
            inputs.get(3).copied().unwrap_or(0.0),
            inputs.get(4).copied().unwrap_or(0.0),
            inputs.get(5).copied().unwrap_or(0.0),
            inputs.get(6).copied().unwrap_or(0.0),
        ];

        let n = self.steps.clamp(2, 4);

        if reset && !self.reset_prev {
            self.step = 0;
        }
        self.reset_prev = reset;

        if trig && !self.trig_prev {
            self.step = (self.step + 1) % n;
        }
        self.trig_prev = trig;

        let s = self.step as usize;

        // 1 → N: common input appears only on the active output.
        for i in 0..4 {
            if let Some(o) = outputs.get_mut(i) {
                *o = if i == s && (i as u32) < n {
                    com_in
                } else {
                    0.0
                };
            }
        }
        // N → 1: selected channel input → common out.
        if let Some(o) = outputs.get_mut(4) {
            *o = if (s as u32) < n { ch[s] } else { 0.0 };
        }
    }

    fn reset(&mut self) {
        self.step = 0;
        self.trig_prev = false;
        self.reset_prev = false;
    }

    fn lights(&self) -> ModuleLights {
        let mut l = ModuleLights::new();
        let n = self.steps.clamp(2, 4);
        for i in 0..4 {
            let on = (i as u32) == self.step && (i as u32) < n;
            l.set(format!("led{}", i + 1), if on { 1.0 } else { 0.05 });
        }
        l.set("step", self.step as f32 + 1.0);
        l
    }
}
