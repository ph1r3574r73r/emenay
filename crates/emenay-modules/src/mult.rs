//! Multiples — buffered 1→4 utility that clones any signal (clock / CV / audio).

use emenay_engine::module::{Module, ModuleInfo, PortDesc, PortId, SignalKind};
use emenay_engine::Voltage;

pub struct Mult {
    info: ModuleInfo,
}

impl Mult {
    pub fn new() -> Self {
        Self {
            info: ModuleInfo {
                type_id: "mult".into(),
                name: "Multiples".into(),
                hp: 2,
                inputs: vec![PortDesc {
                    name: "in".into(),
                    kind: PortId::Input,
                    signal: SignalKind::Audio,
                }],
                outputs: (1..=4)
                    .map(|i| PortDesc {
                        name: format!("out{i}"),
                        kind: PortId::Output,
                        signal: SignalKind::Audio,
                    })
                    .collect(),
                params: vec![],
            },
        }
    }
}

impl Default for Mult {
    fn default() -> Self {
        Self::new()
    }
}

impl Module for Mult {
    fn info(&self) -> &ModuleInfo {
        &self.info
    }

    fn set_sample_rate(&mut self, _sample_rate: f32) {}

    fn set_param(&mut self, _name: &str, _value: f32) {}

    fn get_param(&self, _name: &str) -> Option<f32> {
        None
    }

    fn process(&mut self, inputs: &[Voltage], outputs: &mut [Voltage]) {
        let v = inputs.first().copied().unwrap_or(0.0);
        for o in outputs.iter_mut() {
            *o = v;
        }
    }

    fn reset(&mut self) {}
}
