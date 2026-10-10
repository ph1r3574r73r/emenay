//! Facets macro-oscillator — MI plaits firmware when `mi-firmware` is enabled.

#[cfg(all(not(feature = "mi-firmware"), not(feature = "inspired-fallback")))]
compile_error!("Facets requires `mi-firmware` (default) or `inspired-fallback`.");

#[cfg(all(not(feature = "mi-firmware"), feature = "inspired-fallback"))]
pub use crate::inspired::facets::Facets;

#[cfg(feature = "mi-firmware")]
mod firmware {
    use emenay_engine::module::{Module, ModuleInfo, ParamDesc, PortDesc, PortId, SignalKind};
    use emenay_engine::Voltage;
    use emenay_mi_host::facets::FacetsHost;

    /// Facets 1.2 voice registry: 8 bank-2 + 16 classic engines.
    const MODEL_MAX: f32 = 23.0;

    pub struct Facets {
        info: ModuleInfo,
        host: FacetsHost,
        model: f32,
        freq: f32,
        harmonics: f32,
        timbre: f32,
        morph: f32,
        level: f32,
    }

    impl Facets {
        pub fn new() -> Self {
            Self {
                info: ModuleInfo {
                    type_id: "facets".into(),
                    name: "Facets".into(),
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
                            name: "level_cv".into(),
                            kind: PortId::Input,
                            signal: SignalKind::Cv,
                        },
                        PortDesc {
                            name: "model_cv".into(),
                            kind: PortId::Input,
                            signal: SignalKind::Cv,
                        },
                        PortDesc {
                            name: "timbre_cv".into(),
                            kind: PortId::Input,
                            signal: SignalKind::Cv,
                        },
                        PortDesc {
                            name: "morph_cv".into(),
                            kind: PortId::Input,
                            signal: SignalKind::Cv,
                        },
                        PortDesc {
                            name: "fm".into(),
                            kind: PortId::Input,
                            signal: SignalKind::Cv,
                        },
                        PortDesc {
                            name: "harmonics_cv".into(),
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
                            name: "model".into(),
                            min: 0.0,
                            max: MODEL_MAX,
                            default: 0.0,
                            unit: "int".into(),
                        },
                        ParamDesc {
                            name: "freq".into(),
                            min: 20.0,
                            max: 2000.0,
                            default: 110.0,
                            unit: "Hz".into(),
                        },
                        ParamDesc {
                            name: "harmonics".into(),
                            min: 0.0,
                            max: 1.0,
                            default: 0.5,
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
                            name: "morph".into(),
                            min: 0.0,
                            max: 1.0,
                            default: 0.5,
                            unit: "".into(),
                        },
                        ParamDesc {
                            name: "level".into(),
                            min: 0.0,
                            max: 1.0,
                            default: 0.8,
                            unit: "".into(),
                        },
                    ],
                },
                host: FacetsHost::new(),
                model: 0.0,
                freq: 110.0,
                harmonics: 0.5,
                timbre: 0.5,
                morph: 0.5,
                level: 0.8,
            }
        }
    }

    impl Default for Facets {
        fn default() -> Self {
            Self::new()
        }
    }

    impl Module for Facets {
        fn info(&self) -> &ModuleInfo {
            &self.info
        }

        fn set_sample_rate(&mut self, sample_rate: f32) {
            let _ = sample_rate;
            if (sample_rate - emenay_mi_host::MI_SAMPLE_RATE).abs() > 1.0 {
                eprintln!(
                    "emenay: Facets MI firmware expects {} Hz (got {})",
                    emenay_mi_host::MI_SAMPLE_RATE,
                    sample_rate
                );
            }
        }

        fn set_param(&mut self, name: &str, value: f32) {
            match name {
                "model" => self.model = value.clamp(0.0, MODEL_MAX).round(),
                "freq" => self.freq = value.clamp(20.0, 2000.0),
                "harmonics" => self.harmonics = value.clamp(0.0, 1.0),
                "timbre" => self.timbre = value.clamp(0.0, 1.0),
                "morph" => self.morph = value.clamp(0.0, 1.0),
                "level" => self.level = value.clamp(0.0, 1.0),
                _ => {}
            }
        }

        fn get_param(&self, name: &str) -> Option<f32> {
            match name {
                "model" => Some(self.model),
                "freq" => Some(self.freq),
                "harmonics" => Some(self.harmonics),
                "timbre" => Some(self.timbre),
                "morph" => Some(self.morph),
                "level" => Some(self.level),
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
                self.model,
                self.freq,
                self.harmonics,
                self.timbre,
                self.morph,
                self.level,
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
pub use firmware::Facets;
