//! Dual VCA inspired by Erica DIY Dual VCA (AS3360-class exponential/linear CV).
//!
//! Attribution: Erica Synths DIY Eurorack (CC-BY-SA-3.0)

use emenay_engine::module::{Module, ModuleInfo, ParamDesc, PortDesc, PortId, SignalKind};
use emenay_engine::Voltage;

pub struct DualVca {
    info: ModuleInfo,
    bias_a: f32,
    bias_b: f32,
    /// 0 = LIN, 1 = EXP (per channel).
    exp_a: bool,
    exp_b: bool,
}

impl DualVca {
    pub fn new() -> Self {
        Self {
            info: ModuleInfo {
                type_id: "dual_vca".into(),
                name: "Dual VCA".into(),
                hp: 10,
                inputs: vec![
                    PortDesc {
                        name: "in_a".into(),
                        kind: PortId::Input,
                        signal: SignalKind::Audio,
                    },
                    PortDesc {
                        name: "cv_a".into(),
                        kind: PortId::Input,
                        signal: SignalKind::Cv,
                    },
                    PortDesc {
                        name: "in_b".into(),
                        kind: PortId::Input,
                        signal: SignalKind::Audio,
                    },
                    PortDesc {
                        name: "cv_b".into(),
                        kind: PortId::Input,
                        signal: SignalKind::Cv,
                    },
                ],
                outputs: vec![
                    PortDesc {
                        name: "out_a".into(),
                        kind: PortId::Output,
                        signal: SignalKind::Audio,
                    },
                    PortDesc {
                        name: "out_b".into(),
                        kind: PortId::Output,
                        signal: SignalKind::Audio,
                    },
                    PortDesc {
                        name: "sum".into(),
                        kind: PortId::Output,
                        signal: SignalKind::Audio,
                    },
                ],
                params: vec![
                    ParamDesc {
                        name: "bias_a".into(),
                        min: 0.0,
                        max: 1.0,
                        default: 0.0,
                        unit: "".into(),
                    },
                    ParamDesc {
                        name: "bias_b".into(),
                        min: 0.0,
                        max: 1.0,
                        default: 0.0,
                        unit: "".into(),
                    },
                    ParamDesc {
                        name: "exp_a".into(),
                        min: 0.0,
                        max: 1.0,
                        default: 1.0,
                        unit: "bool".into(),
                    },
                    ParamDesc {
                        name: "exp_b".into(),
                        min: 0.0,
                        max: 1.0,
                        default: 1.0,
                        unit: "bool".into(),
                    },
                ],
            },
            bias_a: 0.0,
            bias_b: 0.0,
            exp_a: true,
            exp_b: true,
        }
    }
}

impl Default for DualVca {
    fn default() -> Self {
        Self::new()
    }
}

fn lin_gain(cv_volts: f32, bias: f32) -> f32 {
    (cv_volts / 5.0 + bias).clamp(0.0, 1.5)
}

fn exp_gain(cv_volts: f32, bias: f32) -> f32 {
    // Mild exponential character (AS3360-ish).
    let x = lin_gain(cv_volts, bias);
    ((x * 3.0).exp() - 1.0) / ((3.0f32).exp() - 1.0)
}

impl Module for DualVca {
    fn info(&self) -> &ModuleInfo {
        &self.info
    }

    fn set_sample_rate(&mut self, _sample_rate: f32) {}

    fn set_param(&mut self, name: &str, value: f32) {
        match name {
            "bias_a" => self.bias_a = value.clamp(0.0, 1.0),
            "bias_b" => self.bias_b = value.clamp(0.0, 1.0),
            "exp_a" => self.exp_a = value >= 0.5,
            "exp_b" => self.exp_b = value >= 0.5,
            _ => {}
        }
    }

    fn get_param(&self, name: &str) -> Option<f32> {
        match name {
            "bias_a" => Some(self.bias_a),
            "bias_b" => Some(self.bias_b),
            "exp_a" => Some(if self.exp_a { 1.0 } else { 0.0 }),
            "exp_b" => Some(if self.exp_b { 1.0 } else { 0.0 }),
            _ => None,
        }
    }

    fn process(&mut self, inputs: &[Voltage], outputs: &mut [Voltage]) {
        let in_a = inputs.first().copied().unwrap_or(0.0);
        let cv_a = inputs.get(1).copied().unwrap_or(0.0);
        let in_b = inputs.get(2).copied().unwrap_or(0.0);
        let cv_b = inputs.get(3).copied().unwrap_or(0.0);
        let ga = if self.exp_a {
            exp_gain(cv_a, self.bias_a)
        } else {
            lin_gain(cv_a, self.bias_a)
        };
        let gb = if self.exp_b {
            exp_gain(cv_b, self.bias_b)
        } else {
            lin_gain(cv_b, self.bias_b)
        };
        let a = in_a * ga;
        let b = in_b * gb;
        if let Some(o) = outputs.get_mut(0) {
            *o = a;
        }
        if let Some(o) = outputs.get_mut(1) {
            *o = b;
        }
        if let Some(o) = outputs.get_mut(2) {
            *o = (a + b).clamp(-10.0, 10.0);
        }
    }
}
