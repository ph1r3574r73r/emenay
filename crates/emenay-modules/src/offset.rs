//! Dual offset / attenuverter (Free Modular Offset/Atten layout).

use emenay_engine::module::{
    Module, ModuleInfo, ModuleLights, ParamDesc, PortDesc, PortId, SignalKind,
};
use emenay_engine::Voltage;

pub struct OffsetAtten {
    info: ModuleInfo,
    atten_a: f32,
    offset_a: f32,
    atten_b: f32,
    offset_b: f32,
    out_a: f32,
    out_b: f32,
}

impl OffsetAtten {
    pub fn new() -> Self {
        Self {
            info: ModuleInfo {
                type_id: "fm_offset".into(),
                name: "Offset/Atten".into(),
                hp: 4,
                inputs: vec![
                    PortDesc {
                        name: "in_a".into(),
                        kind: PortId::Input,
                        signal: SignalKind::Cv,
                    },
                    PortDesc {
                        name: "in_b".into(),
                        kind: PortId::Input,
                        signal: SignalKind::Cv,
                    },
                ],
                outputs: vec![
                    PortDesc {
                        name: "out_a".into(),
                        kind: PortId::Output,
                        signal: SignalKind::Cv,
                    },
                    PortDesc {
                        name: "out_b".into(),
                        kind: PortId::Output,
                        signal: SignalKind::Cv,
                    },
                ],
                params: vec![
                    ParamDesc {
                        name: "atten_a".into(),
                        min: -1.0,
                        max: 1.0,
                        default: 1.0,
                        unit: "".into(),
                    },
                    ParamDesc {
                        name: "offset_a".into(),
                        min: -5.0,
                        max: 5.0,
                        default: 0.0,
                        unit: "V".into(),
                    },
                    ParamDesc {
                        name: "atten_b".into(),
                        min: -1.0,
                        max: 1.0,
                        default: 1.0,
                        unit: "".into(),
                    },
                    ParamDesc {
                        name: "offset_b".into(),
                        min: -5.0,
                        max: 5.0,
                        default: 0.0,
                        unit: "V".into(),
                    },
                ],
            },
            atten_a: 1.0,
            offset_a: 0.0,
            atten_b: 1.0,
            offset_b: 0.0,
            out_a: 0.0,
            out_b: 0.0,
        }
    }
}

impl Default for OffsetAtten {
    fn default() -> Self {
        Self::new()
    }
}

impl Module for OffsetAtten {
    fn info(&self) -> &ModuleInfo {
        &self.info
    }

    fn set_sample_rate(&mut self, _sample_rate: f32) {}

    fn set_param(&mut self, name: &str, value: f32) {
        match name {
            "atten_a" => self.atten_a = value.clamp(-1.0, 1.0),
            "offset_a" => self.offset_a = value.clamp(-5.0, 5.0),
            "atten_b" => self.atten_b = value.clamp(-1.0, 1.0),
            "offset_b" => self.offset_b = value.clamp(-5.0, 5.0),
            _ => {}
        }
    }

    fn get_param(&self, name: &str) -> Option<f32> {
        match name {
            "atten_a" => Some(self.atten_a),
            "offset_a" => Some(self.offset_a),
            "atten_b" => Some(self.atten_b),
            "offset_b" => Some(self.offset_b),
            _ => None,
        }
    }

    fn process(&mut self, inputs: &[Voltage], outputs: &mut [Voltage]) {
        let a = inputs.first().copied().unwrap_or(0.0) * self.atten_a + self.offset_a;
        let b = inputs.get(1).copied().unwrap_or(0.0) * self.atten_b + self.offset_b;
        self.out_a = a.clamp(-10.0, 10.0);
        self.out_b = b.clamp(-10.0, 10.0);
        if let Some(o) = outputs.get_mut(0) {
            *o = self.out_a;
        }
        if let Some(o) = outputs.get_mut(1) {
            *o = self.out_b;
        }
    }

    fn lights(&self) -> ModuleLights {
        let mut l = ModuleLights::new();
        l.set("led_a", (self.out_a.abs() / 5.0).clamp(0.0, 1.0));
        l.set("led_b", (self.out_b.abs() / 5.0).clamp(0.0, 1.0));
        l
    }
}
