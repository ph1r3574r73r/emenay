#[cfg(all(not(feature = "mi-firmware"), feature = "inspired-fallback"))]
pub use crate::inspired::chimes::Chimes;

#[cfg(feature = "mi-firmware")]
mod firmware {
    use emenay_engine::module::{Module, ModuleInfo, ParamDesc, PortDesc, PortId, SignalKind};
    use emenay_engine::Voltage;
    use emenay_mi_host::chimes::ChimesHost;

    pub struct Chimes {
        info: ModuleInfo,
        host: ChimesHost,
        freq: f32,
        structure: f32,
        brightness: f32,
        damping: f32,
        position: f32,
        model: f32,
        polyphony: f32,
    }

    impl Chimes {
        pub fn new() -> Self {
            Self {
                info: ModuleInfo {
                    type_id: "chimes".into(),
                    name: "Chimes".into(),
                    hp: 12,
                    inputs: vec![
                        PortDesc {
                            name: "v_oct".into(),
                            kind: PortId::Input,
                            signal: SignalKind::Cv,
                        },
                        PortDesc {
                            name: "trig".into(),
                            kind: PortId::Input,
                            signal: SignalKind::Gate,
                        },
                        PortDesc {
                            name: "in".into(),
                            kind: PortId::Input,
                            signal: SignalKind::Audio,
                        },
                        PortDesc {
                            name: "freq_cv".into(),
                            kind: PortId::Input,
                            signal: SignalKind::Cv,
                        },
                        PortDesc {
                            name: "structure_cv".into(),
                            kind: PortId::Input,
                            signal: SignalKind::Cv,
                        },
                        PortDesc {
                            name: "brightness_cv".into(),
                            kind: PortId::Input,
                            signal: SignalKind::Cv,
                        },
                        PortDesc {
                            name: "damping_cv".into(),
                            kind: PortId::Input,
                            signal: SignalKind::Cv,
                        },
                        PortDesc {
                            name: "position_cv".into(),
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
                            name: "freq".into(),
                            min: 20.0,
                            max: 1500.0,
                            default: 110.0,
                            unit: "Hz".into(),
                        },
                        ParamDesc {
                            name: "structure".into(),
                            min: 0.0,
                            max: 1.0,
                            default: 0.4,
                            unit: "".into(),
                        },
                        ParamDesc {
                            name: "brightness".into(),
                            min: 0.0,
                            max: 1.0,
                            default: 0.55,
                            unit: "".into(),
                        },
                        ParamDesc {
                            name: "damping".into(),
                            min: 0.0,
                            max: 1.0,
                            default: 0.45,
                            unit: "".into(),
                        },
                        ParamDesc {
                            name: "position".into(),
                            min: 0.0,
                            max: 1.0,
                            default: 0.3,
                            unit: "".into(),
                        },
                        ParamDesc {
                            name: "model".into(),
                            min: 0.0,
                            max: 1.0,
                            default: 0.0,
                            unit: "".into(),
                        },
                        ParamDesc {
                            name: "polyphony".into(),
                            min: 1.0,
                            max: 4.0,
                            default: 1.0,
                            unit: "int".into(),
                        },
                    ],
                },
                host: ChimesHost::new(),
                freq: 110.0,
                structure: 0.4,
                brightness: 0.55,
                damping: 0.45,
                position: 0.3,
                model: 0.0,
                polyphony: 1.0,
            }
        }
    }

    impl Default for Chimes {
        fn default() -> Self {
            Self::new()
        }
    }

    impl Module for Chimes {
        fn info(&self) -> &ModuleInfo {
            &self.info
        }

        fn set_sample_rate(&mut self, _sample_rate: f32) {}

        fn set_param(&mut self, name: &str, value: f32) {
            match name {
                "freq" => self.freq = value.clamp(20.0, 1500.0),
                "structure" => self.structure = value.clamp(0.0, 1.0),
                "brightness" => self.brightness = value.clamp(0.0, 1.0),
                "damping" => self.damping = value.clamp(0.0, 1.0),
                "position" => self.position = value.clamp(0.0, 1.0),
                "model" => self.model = value.clamp(0.0, 1.0),
                "polyphony" => self.polyphony = value.clamp(1.0, 4.0).round(),
                _ => {}
            }
        }

        fn get_param(&self, name: &str) -> Option<f32> {
            match name {
                "freq" => Some(self.freq),
                "structure" => Some(self.structure),
                "brightness" => Some(self.brightness),
                "damping" => Some(self.damping),
                "position" => Some(self.position),
                "model" => Some(self.model),
                "polyphony" => Some(self.polyphony),
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
                self.freq,
                self.structure,
                self.brightness,
                self.damping,
                self.position,
                self.model,
                self.polyphony,
            );
            for (i, o) in outputs.iter_mut().enumerate().take(2) {
                *o = out[i];
            }
        }

        fn reset(&mut self) {
            self.host.reset();
        }
    }
}

#[cfg(feature = "mi-firmware")]
pub use firmware::Chimes;
