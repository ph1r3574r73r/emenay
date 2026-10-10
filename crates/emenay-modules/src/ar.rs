//! Attack / Release envelope — gate rises through A, falls through R.

use emenay_engine::module::{
    Module, ModuleInfo, ModuleLights, ParamDesc, PortDesc, PortId, SignalKind,
};
use emenay_engine::Voltage;

#[derive(Clone, Copy, PartialEq, Eq)]
enum Stage {
    Idle,
    Attack,
    Hold,
    Release,
}

pub struct Ar {
    info: ModuleInfo,
    stage: Stage,
    value: f32,
    attack_s: f32,
    release_s: f32,
    sample_rate: f32,
    gate_prev: bool,
    trig_prev: bool,
    eoc_left: u32,
}

impl Ar {
    pub fn new() -> Self {
        Self {
            info: ModuleInfo {
                type_id: "ar".into(),
                name: "AR".into(),
                hp: 4,
                inputs: vec![
                    PortDesc {
                        name: "gate".into(),
                        kind: PortId::Input,
                        signal: SignalKind::Gate,
                    },
                    PortDesc {
                        name: "trig".into(),
                        kind: PortId::Input,
                        signal: SignalKind::Gate,
                    },
                ],
                outputs: vec![
                    PortDesc {
                        name: "env".into(),
                        kind: PortId::Output,
                        signal: SignalKind::Cv,
                    },
                    PortDesc {
                        name: "eoc".into(),
                        kind: PortId::Output,
                        signal: SignalKind::Gate,
                    },
                ],
                params: vec![
                    ParamDesc {
                        name: "attack".into(),
                        min: 0.001,
                        max: 5.0,
                        default: 0.02,
                        unit: "s".into(),
                    },
                    ParamDesc {
                        name: "release".into(),
                        min: 0.001,
                        max: 8.0,
                        default: 0.25,
                        unit: "s".into(),
                    },
                ],
            },
            stage: Stage::Idle,
            value: 0.0,
            attack_s: 0.02,
            release_s: 0.25,
            sample_rate: 48_000.0,
            gate_prev: false,
            trig_prev: false,
            eoc_left: 0,
        }
    }
}

impl Default for Ar {
    fn default() -> Self {
        Self::new()
    }
}

impl Module for Ar {
    fn info(&self) -> &ModuleInfo {
        &self.info
    }

    fn set_sample_rate(&mut self, sample_rate: f32) {
        self.sample_rate = sample_rate.max(1.0);
    }

    fn set_param(&mut self, name: &str, value: f32) {
        match name {
            "attack" => self.attack_s = value.clamp(0.001, 5.0),
            "release" => self.release_s = value.clamp(0.001, 8.0),
            _ => {}
        }
    }

    fn get_param(&self, name: &str) -> Option<f32> {
        match name {
            "attack" => Some(self.attack_s),
            "release" => Some(self.release_s),
            _ => None,
        }
    }

    fn process(&mut self, inputs: &[Voltage], outputs: &mut [Voltage]) {
        let gate = inputs.first().copied().unwrap_or(0.0) > 1.0;
        let trig = inputs.get(1).copied().unwrap_or(0.0) > 1.0;
        let trig_edge = trig && !self.trig_prev;
        self.trig_prev = trig;

        if (gate && !self.gate_prev) || trig_edge {
            self.stage = Stage::Attack;
        } else if !gate && self.gate_prev {
            self.stage = Stage::Release;
        }
        self.gate_prev = gate;

        let dt = 1.0 / self.sample_rate;
        let peak = 5.0;

        match self.stage {
            Stage::Idle => self.value = 0.0,
            Stage::Attack => {
                let step = dt / self.attack_s * peak;
                self.value = (self.value + step).min(peak);
                if self.value >= peak {
                    self.stage = if gate { Stage::Hold } else { Stage::Release };
                }
            }
            Stage::Hold => {
                self.value = peak;
                if !gate {
                    self.stage = Stage::Release;
                }
            }
            Stage::Release => {
                let step = dt / self.release_s * peak;
                self.value = (self.value - step).max(0.0);
                if self.value <= 0.0 {
                    self.stage = Stage::Idle;
                    self.eoc_left = (self.sample_rate * 0.004).max(1.0) as u32;
                }
            }
        }

        let eoc = if self.eoc_left > 0 {
            self.eoc_left -= 1;
            5.0
        } else {
            0.0
        };

        if let Some(o) = outputs.get_mut(0) {
            *o = self.value;
        }
        if let Some(o) = outputs.get_mut(1) {
            *o = eoc;
        }
    }

    fn reset(&mut self) {
        self.stage = Stage::Idle;
        self.value = 0.0;
        self.gate_prev = false;
        self.trig_prev = false;
        self.eoc_left = 0;
    }

    fn lights(&self) -> ModuleLights {
        let mut l = ModuleLights::new();
        l.set("gate", if self.gate_prev { 1.0 } else { 0.0 });
        l.set("level", (self.value / 5.0).clamp(0.0, 1.0));
        l
    }
}
