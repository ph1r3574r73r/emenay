//! ADSR envelope (Free Modular faceplate / Polivoks-inspired EG).
//!
//! Attribution: Erica Synths DIY Eurorack (CC-BY-SA-3.0); panel twin Free Modular Envelope.

use emenay_engine::module::{
    Module, ModuleInfo, ModuleLights, ParamDesc, PortDesc, PortId, SignalKind,
};
use emenay_engine::Voltage;

#[derive(Clone, Copy, PartialEq, Eq)]
enum Stage {
    Idle,
    Attack,
    Decay,
    Sustain,
    Release,
}

pub struct Envelope {
    info: ModuleInfo,
    stage: Stage,
    value: f32,
    attack_s: f32,
    decay_s: f32,
    sustain: f32,
    release_s: f32,
    sample_rate: f32,
    gate_prev: bool,
    trig_prev: bool,
    eoc_left: u32,
}

impl Envelope {
    pub fn new() -> Self {
        Self {
            info: ModuleInfo {
                type_id: "envelope".into(),
                name: "Envelope".into(),
                hp: 8,
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
                        default: 0.01,
                        unit: "s".into(),
                    },
                    ParamDesc {
                        name: "decay".into(),
                        min: 0.001,
                        max: 5.0,
                        default: 0.1,
                        unit: "s".into(),
                    },
                    ParamDesc {
                        name: "sustain".into(),
                        min: 0.0,
                        max: 1.0,
                        default: 0.7,
                        unit: "".into(),
                    },
                    ParamDesc {
                        name: "release".into(),
                        min: 0.001,
                        max: 8.0,
                        default: 0.2,
                        unit: "s".into(),
                    },
                ],
            },
            stage: Stage::Idle,
            value: 0.0,
            attack_s: 0.01,
            decay_s: 0.1,
            sustain: 0.7,
            release_s: 0.2,
            sample_rate: 48_000.0,
            gate_prev: false,
            trig_prev: false,
            eoc_left: 0,
        }
    }
}

impl Default for Envelope {
    fn default() -> Self {
        Self::new()
    }
}

impl Module for Envelope {
    fn info(&self) -> &ModuleInfo {
        &self.info
    }

    fn set_sample_rate(&mut self, sample_rate: f32) {
        self.sample_rate = sample_rate.max(1.0);
    }

    fn set_param(&mut self, name: &str, value: f32) {
        match name {
            "attack" => self.attack_s = value.clamp(0.001, 5.0),
            "decay" => self.decay_s = value.clamp(0.001, 5.0),
            "sustain" => self.sustain = value.clamp(0.0, 1.0),
            "release" => self.release_s = value.clamp(0.001, 8.0),
            _ => {}
        }
    }

    fn get_param(&self, name: &str) -> Option<f32> {
        match name {
            "attack" => Some(self.attack_s),
            "decay" => Some(self.decay_s),
            "sustain" => Some(self.sustain),
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
        let sus_level = self.sustain * peak;
        match self.stage {
            Stage::Idle => {
                self.value = 0.0;
            }
            Stage::Attack => {
                let step = dt / self.attack_s * peak;
                self.value = (self.value + step).min(peak);
                if self.value >= peak {
                    self.stage = if gate { Stage::Decay } else { Stage::Release };
                }
            }
            Stage::Decay => {
                let step = dt / self.decay_s * peak;
                self.value = (self.value - step).max(sus_level);
                if self.value <= sus_level {
                    self.stage = if gate { Stage::Sustain } else { Stage::Release };
                }
            }
            Stage::Sustain => {
                self.value = sus_level;
                if !gate {
                    self.stage = Stage::Release;
                }
            }
            Stage::Release => {
                let step = dt / self.release_s * peak;
                self.value = (self.value - step).max(0.0);
                if self.value <= 0.0 {
                    self.stage = Stage::Idle;
                    // Hold EOC ~4ms so it can clock other modules.
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
        let stage = match self.stage {
            Stage::Idle => 0.0,
            Stage::Attack => 1.0,
            Stage::Decay => 2.0,
            Stage::Sustain => 3.0,
            Stage::Release => 4.0,
        };
        l.set("stage", stage);
        // Stage letter holes: dim idle glow so the column never looks empty.
        l.set("attack", if self.stage == Stage::Attack { 1.0 } else { 0.28 });
        l.set("decay", if self.stage == Stage::Decay { 1.0 } else { 0.28 });
        l.set(
            "sustain",
            if self.stage == Stage::Sustain { 1.0 } else { 0.28 },
        );
        l.set(
            "release",
            if self.stage == Stage::Release { 1.0 } else { 0.28 },
        );
        l
    }
}
