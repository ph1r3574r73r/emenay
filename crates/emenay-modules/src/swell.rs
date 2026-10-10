#[cfg(all(not(feature = "mi-firmware"), feature = "inspired-fallback"))]
pub use crate::inspired::swell::Swell;

#[cfg(feature = "mi-firmware")]
mod firmware {
    use emenay_engine::module::{Module, ModuleInfo, ParamDesc, PortDesc, PortId, SignalKind};
    use emenay_engine::Voltage;
    use emenay_mi_host::swell::SwellHost;

    pub struct Swell {
        info: ModuleInfo,
        host: SwellHost,
        freq: f32,
        shape: f32,
        slope: f32,
        smoothness: f32,
        mode: f32,
        range: f32,
    }

    impl Swell {
        pub fn new() -> Self {
            Self {
                info: ModuleInfo {
                    type_id: "swell".into(),
                    name: "Swell".into(),
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
                            name: "clock".into(),
                            kind: PortId::Input,
                            signal: SignalKind::Gate,
                        },
                        PortDesc {
                            name: "freeze".into(),
                            kind: PortId::Input,
                            signal: SignalKind::Gate,
                        },
                        PortDesc {
                            name: "shape_cv".into(),
                            kind: PortId::Input,
                            signal: SignalKind::Cv,
                        },
                        PortDesc {
                            name: "slope_cv".into(),
                            kind: PortId::Input,
                            signal: SignalKind::Cv,
                        },
                        PortDesc {
                            name: "smooth_cv".into(),
                            kind: PortId::Input,
                            signal: SignalKind::Cv,
                        },
                        PortDesc {
                            name: "fm".into(),
                            kind: PortId::Input,
                            signal: SignalKind::Cv,
                        },
                    ],
                    outputs: vec![
                        PortDesc {
                            name: "uni".into(),
                            kind: PortId::Output,
                            signal: SignalKind::Cv,
                        },
                        PortDesc {
                            name: "bi".into(),
                            kind: PortId::Output,
                            signal: SignalKind::Cv,
                        },
                        PortDesc {
                            name: "eoa".into(),
                            kind: PortId::Output,
                            signal: SignalKind::Gate,
                        },
                        PortDesc {
                            name: "eor".into(),
                            kind: PortId::Output,
                            signal: SignalKind::Gate,
                        },
                    ],
                    params: vec![
                        ParamDesc {
                            name: "freq".into(),
                            min: 0.05,
                            max: 2000.0,
                            default: 1.5,
                            unit: "Hz".into(),
                        },
                        ParamDesc {
                            name: "shape".into(),
                            min: 0.0,
                            max: 1.0,
                            default: 0.5,
                            unit: "".into(),
                        },
                        ParamDesc {
                            name: "slope".into(),
                            min: 0.0,
                            max: 1.0,
                            default: 0.5,
                            unit: "".into(),
                        },
                        ParamDesc {
                            name: "smoothness".into(),
                            min: 0.0,
                            max: 1.0,
                            default: 0.5,
                            unit: "".into(),
                        },
                        ParamDesc {
                            name: "mode".into(),
                            min: 0.0,
                            max: 2.0,
                            default: 1.0,
                            unit: "int".into(),
                        },
                        ParamDesc {
                            name: "range".into(),
                            min: 0.0,
                            max: 2.0,
                            default: 0.0,
                            unit: "int".into(),
                        },
                    ],
                },
                host: SwellHost::new(),
                freq: 1.5,
                shape: 0.5,
                slope: 0.5,
                smoothness: 0.5,
                mode: 1.0,
                range: 0.0,
            }
        }
    }

    impl Default for Swell {
        fn default() -> Self {
            Self::new()
        }
    }

    impl Module for Swell {
        fn info(&self) -> &ModuleInfo {
            &self.info
        }

        fn set_sample_rate(&mut self, _sample_rate: f32) {}

        fn set_param(&mut self, name: &str, value: f32) {
            match name {
                "freq" => self.freq = value.clamp(0.05, 2000.0),
                "shape" => self.shape = value.clamp(0.0, 1.0),
                "slope" => self.slope = value.clamp(0.0, 1.0),
                "smoothness" | "smooth" => self.smoothness = value.clamp(0.0, 1.0),
                "mode" => self.mode = value.clamp(0.0, 2.0).round(),
                "range" => self.range = value.clamp(0.0, 2.0).round(),
                // legacy: pluck → AR mode
                "pluck" => self.mode = if value >= 0.5 { 2.0 } else { 1.0 },
                _ => {}
            }
        }

        fn get_param(&self, name: &str) -> Option<f32> {
            match name {
                "freq" => Some(self.freq),
                "shape" => Some(self.shape),
                "slope" => Some(self.slope),
                "smoothness" | "smooth" => Some(self.smoothness),
                "mode" => Some(self.mode),
                "range" => Some(self.range),
                "pluck" => Some(if self.mode >= 1.5 { 1.0 } else { 0.0 }),
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
            let mut out = [0.0_f32; 4];
            self.host.process_sample(
                inputs,
                connected,
                &mut out,
                self.freq,
                self.shape,
                self.slope,
                self.smoothness,
                self.mode as i32,
                self.range as i32,
            );
            for (i, o) in outputs.iter_mut().enumerate().take(4) {
                *o = out[i];
            }
        }

        fn reset(&mut self) {
            self.host.reset();
        }
    }
}

#[cfg(feature = "mi-firmware")]
pub use firmware::Swell;
