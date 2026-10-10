use emenay_circuit::{CircuitModel, PassiveRcLowpass};
use emenay_engine::module::{Module, ModuleInfo, ParamDesc, PortDesc, PortId, SignalKind};
use emenay_engine::Voltage;

pub struct RcFilterModule {
    info: ModuleInfo,
    circuit: PassiveRcLowpass,
}

impl RcFilterModule {
    pub fn new() -> Self {
        Self {
            info: ModuleInfo {
                type_id: "rc_lpf".into(),
                name: "RC LPF".into(),
                hp: 6,
                inputs: vec![PortDesc {
                    name: "in".into(),
                    kind: PortId::Input,
                    signal: SignalKind::Audio,
                }],
                outputs: vec![PortDesc {
                    name: "out".into(),
                    kind: PortId::Output,
                    signal: SignalKind::Audio,
                }],
                params: vec![
                    ParamDesc {
                        name: "r".into(),
                        min: 100.0,
                        max: 100_000.0,
                        default: 10_000.0,
                        unit: "ohm".into(),
                    },
                    ParamDesc {
                        name: "c_nF".into(),
                        min: 0.1,
                        max: 1000.0,
                        default: 10.0,
                        unit: "nF".into(),
                    },
                ],
            },
            circuit: PassiveRcLowpass::new(10_000.0, 10.0e-9),
        }
    }
}

impl Default for RcFilterModule {
    fn default() -> Self {
        Self::new()
    }
}

impl Module for RcFilterModule {
    fn info(&self) -> &ModuleInfo {
        &self.info
    }

    fn set_sample_rate(&mut self, sample_rate: f32) {
        self.circuit.set_sample_rate(sample_rate);
    }

    fn set_param(&mut self, name: &str, value: f32) {
        match name {
            "r" => self.circuit.r = value.clamp(100.0, 100_000.0) as f64,
            "c_nF" => self.circuit.c = (value.clamp(0.1, 1000.0) as f64) * 1e-9,
            _ => {}
        }
    }

    fn get_param(&self, name: &str) -> Option<f32> {
        match name {
            "r" => Some(self.circuit.r as f32),
            "c_nF" => Some((self.circuit.c * 1e9) as f32),
            _ => None,
        }
    }

    fn process(&mut self, inputs: &[Voltage], outputs: &mut [Voltage]) {
        self.circuit.process(inputs, outputs);
    }

    fn reset(&mut self) {
        self.circuit.reset();
    }
}
