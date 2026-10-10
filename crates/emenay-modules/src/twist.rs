#[cfg(all(not(feature = "mi-firmware"), feature = "inspired-fallback"))]
pub use crate::inspired::twist::Twist;

#[cfg(feature = "mi-firmware")]
mod firmware {
    use emenay_engine::module::{Module, ModuleInfo, ParamDesc, PortDesc, PortId, SignalKind};
    use emenay_engine::Voltage;
    use emenay_mi_host::twist::TwistHost;

    pub struct Twist {
        info: ModuleInfo,
        host: TwistHost,
        algorithm: f32,
        timbre: f32,
        level1: f32,
        level2: f32,
        freq: f32,
        carrier_shape: f32,
    }

    impl Twist {
        pub fn new() -> Self {
            Self {
                info: ModuleInfo {
                    type_id: "twist".into(),
                    name: "Twist".into(),
                    hp: 10,
                    inputs: vec![
                        PortDesc {
                            name: "carrier".into(),
                            kind: PortId::Input,
                            signal: SignalKind::Audio,
                        },
                        PortDesc {
                            name: "modulator".into(),
                            kind: PortId::Input,
                            signal: SignalKind::Audio,
                        },
                        PortDesc {
                            name: "algo_cv".into(),
                            kind: PortId::Input,
                            signal: SignalKind::Cv,
                        },
                        PortDesc {
                            name: "timbre_cv".into(),
                            kind: PortId::Input,
                            signal: SignalKind::Cv,
                        },
                        PortDesc {
                            name: "level1_cv".into(),
                            kind: PortId::Input,
                            signal: SignalKind::Cv,
                        },
                        PortDesc {
                            name: "level2_cv".into(),
                            kind: PortId::Input,
                            signal: SignalKind::Cv,
                        },
                    ],
                    outputs: vec![
                        PortDesc {
                            name: "out".into(),
                            kind: PortId::Output,
                            signal: SignalKind::Audio,
                        },
                        PortDesc {
                            name: "aux".into(),
                            kind: PortId::Output,
                            signal: SignalKind::Audio,
                        },
                    ],
                    params: vec![
                        ParamDesc {
                            name: "algorithm".into(),
                            min: 0.0,
                            max: 1.0,
                            default: 0.35,
                            unit: "".into(),
                        },
                        ParamDesc {
                            name: "timbre".into(),
                            min: 0.0,
                            max: 1.0,
                            default: 0.5,
                            unit: "".into(),
                        },
                        ParamDesc {
                            name: "level1".into(),
                            min: 0.0,
                            max: 1.0,
                            default: 0.8,
                            unit: "".into(),
                        },
                        ParamDesc {
                            name: "level2".into(),
                            min: 0.0,
                            max: 1.0,
                            default: 0.8,
                            unit: "".into(),
                        },
                        ParamDesc {
                            name: "freq".into(),
                            min: 20.0,
                            max: 2000.0,
                            default: 220.0,
                            unit: "Hz".into(),
                        },
                        ParamDesc {
                            name: "carrier_shape".into(),
                            min: 0.0,
                            max: 4.0,
                            default: 1.0,
                            unit: "int".into(),
                        },
                    ],
                },
                host: TwistHost::new(),
                algorithm: 0.35,
                timbre: 0.5,
                level1: 0.8,
                level2: 0.8,
                freq: 220.0,
                carrier_shape: 1.0,
            }
        }
    }

    impl Default for Twist {
        fn default() -> Self {
            Self::new()
        }
    }

    impl Module for Twist {
        fn info(&self) -> &ModuleInfo {
            &self.info
        }

        fn set_sample_rate(&mut self, _sample_rate: f32) {}

        fn set_param(&mut self, name: &str, value: f32) {
            match name {
                "algorithm" => self.algorithm = value.clamp(0.0, 1.0),
                "timbre" => self.timbre = value.clamp(0.0, 1.0),
                "level1" => self.level1 = value.clamp(0.0, 1.0),
                "level2" => self.level2 = value.clamp(0.0, 1.0),
                // legacy alias
                "level" => {
                    self.level1 = value.clamp(0.0, 1.0);
                    self.level2 = value.clamp(0.0, 1.0);
                }
                "freq" => self.freq = value.clamp(20.0, 2000.0),
                "carrier_shape" => self.carrier_shape = value.clamp(0.0, 4.0).round(),
                _ => {}
            }
        }

        fn get_param(&self, name: &str) -> Option<f32> {
            match name {
                "algorithm" => Some(self.algorithm),
                "timbre" => Some(self.timbre),
                "level1" => Some(self.level1),
                "level2" => Some(self.level2),
                "level" => Some(self.level1),
                "freq" => Some(self.freq),
                "carrier_shape" => Some(self.carrier_shape),
                _ => None,
            }
        }

        fn process(&mut self, inputs: &[Voltage], outputs: &mut [Voltage]) {
            self.process_connected(inputs, &[], outputs);
        }

        fn process_connected(
            &mut self,
            inputs: &[Voltage],
            connected: &[bool],
            outputs: &mut [Voltage],
        ) {
            let mut out = [0.0_f32; 2];
            self.host.process_sample(
                inputs,
                connected,
                &mut out,
                self.algorithm,
                self.timbre,
                self.level1,
                self.level2,
                self.freq,
                self.carrier_shape as i32,
            );
            if let Some(o) = outputs.first_mut() {
                *o = out[0];
            }
            if let Some(o) = outputs.get_mut(1) {
                *o = out[1];
            }
        }

        fn reset(&mut self) {
            self.host.reset();
        }
    }
}

#[cfg(feature = "mi-firmware")]
pub use firmware::Twist;
