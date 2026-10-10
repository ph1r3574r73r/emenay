#[cfg(all(not(feature = "mi-firmware"), feature = "inspired-fallback"))]
pub use crate::inspired::lots::Lots;

#[cfg(feature = "mi-firmware")]
mod firmware {
    use emenay_engine::module::{
        Module, ModuleInfo, ModuleLights, ParamDesc, PortDesc, PortId, SignalKind,
    };
    use emenay_engine::Voltage;
    use emenay_mi_host::lots::LotsHost;

    pub struct Lots {
        info: ModuleInfo,
        host: LotsHost,
        rate: f32,
        bias: f32,
        jitter: f32,
        spread: f32,
        x_bias: f32,
        steps: f32,
        deja_vu: f32,
        deja_vu_length: f32,
        t_mode: u32,
        x_mode: u32,
        lights: [f32; 3],
    }

    impl Lots {
        pub fn new() -> Self {
            Self {
                info: ModuleInfo {
                    type_id: "lots".into(),
                    name: "Lots".into(),
                    hp: 18,
                    inputs: vec![
                        PortDesc {
                            name: "t_clock".into(),
                            kind: PortId::Input,
                            signal: SignalKind::Gate,
                        },
                        PortDesc {
                            name: "x_clock".into(),
                            kind: PortId::Input,
                            signal: SignalKind::Gate,
                        },
                        PortDesc {
                            name: "rate_cv".into(),
                            kind: PortId::Input,
                            signal: SignalKind::Cv,
                        },
                        PortDesc {
                            name: "bias_cv".into(),
                            kind: PortId::Input,
                            signal: SignalKind::Cv,
                        },
                        PortDesc {
                            name: "jitter_cv".into(),
                            kind: PortId::Input,
                            signal: SignalKind::Cv,
                        },
                        PortDesc {
                            name: "spread_cv".into(),
                            kind: PortId::Input,
                            signal: SignalKind::Cv,
                        },
                        PortDesc {
                            name: "x_bias_cv".into(),
                            kind: PortId::Input,
                            signal: SignalKind::Cv,
                        },
                        PortDesc {
                            name: "steps_cv".into(),
                            kind: PortId::Input,
                            signal: SignalKind::Cv,
                        },
                    ],
                    outputs: vec![
                        PortDesc {
                            name: "t1".into(),
                            kind: PortId::Output,
                            signal: SignalKind::Gate,
                        },
                        PortDesc {
                            name: "t2".into(),
                            kind: PortId::Output,
                            signal: SignalKind::Gate,
                        },
                        PortDesc {
                            name: "t3".into(),
                            kind: PortId::Output,
                            signal: SignalKind::Gate,
                        },
                        PortDesc {
                            name: "x1".into(),
                            kind: PortId::Output,
                            signal: SignalKind::Cv,
                        },
                        PortDesc {
                            name: "x2".into(),
                            kind: PortId::Output,
                            signal: SignalKind::Cv,
                        },
                        PortDesc {
                            name: "x3".into(),
                            kind: PortId::Output,
                            signal: SignalKind::Cv,
                        },
                        PortDesc {
                            name: "y".into(),
                            kind: PortId::Output,
                            signal: SignalKind::Cv,
                        },
                    ],
                    params: vec![
                        ParamDesc {
                            name: "rate".into(),
                            min: 0.0,
                            max: 1.0,
                            default: 0.35,
                            unit: "".into(),
                        },
                        ParamDesc {
                            name: "bias".into(),
                            min: 0.0,
                            max: 1.0,
                            default: 0.5,
                            unit: "".into(),
                        },
                        ParamDesc {
                            name: "jitter".into(),
                            min: 0.0,
                            max: 1.0,
                            default: 0.0,
                            unit: "".into(),
                        },
                        ParamDesc {
                            name: "spread".into(),
                            min: 0.0,
                            max: 1.0,
                            default: 0.5,
                            unit: "".into(),
                        },
                        ParamDesc {
                            name: "x_bias".into(),
                            min: 0.0,
                            max: 1.0,
                            default: 0.5,
                            unit: "".into(),
                        },
                        ParamDesc {
                            name: "steps".into(),
                            min: 0.0,
                            max: 1.0,
                            default: 0.5,
                            unit: "".into(),
                        },
                        ParamDesc {
                            name: "deja_vu".into(),
                            min: 0.0,
                            max: 1.0,
                            default: 0.0,
                            unit: "".into(),
                        },
                        ParamDesc {
                            name: "deja_vu_length".into(),
                            min: 0.0,
                            max: 1.0,
                            default: 0.5,
                            unit: "".into(),
                        },
                        ParamDesc {
                            name: "t_mode".into(),
                            min: 0.0,
                            max: 5.0,
                            default: 0.0,
                            unit: "int".into(),
                        },
                        ParamDesc {
                            name: "x_mode".into(),
                            min: 0.0,
                            max: 2.0,
                            default: 0.0,
                            unit: "int".into(),
                        },
                    ],
                },
                host: LotsHost::new(),
                rate: 0.35,
                bias: 0.5,
                jitter: 0.0,
                spread: 0.5,
                x_bias: 0.5,
                steps: 0.5,
                deja_vu: 0.0,
                deja_vu_length: 0.5,
                t_mode: 0,
                x_mode: 0,
                lights: [0.0; 3],
            }
        }
    }

    impl Default for Lots {
        fn default() -> Self {
            Self::new()
        }
    }

    impl Module for Lots {
        fn info(&self) -> &ModuleInfo {
            &self.info
        }

        fn set_sample_rate(&mut self, _sample_rate: f32) {}

        fn set_param(&mut self, name: &str, value: f32) {
            match name {
                "rate" => self.rate = value.clamp(0.0, 1.0),
                "bias" => self.bias = value.clamp(0.0, 1.0),
                "jitter" => self.jitter = value.clamp(0.0, 1.0),
                "spread" => self.spread = value.clamp(0.0, 1.0),
                "x_bias" => self.x_bias = value.clamp(0.0, 1.0),
                "steps" => self.steps = value.clamp(0.0, 1.0),
                "deja_vu" => self.deja_vu = value.clamp(0.0, 1.0),
                "deja_vu_length" => self.deja_vu_length = value.clamp(0.0, 1.0),
                "t_mode" => self.t_mode = value.clamp(0.0, 5.0).round() as u32,
                "x_mode" => self.x_mode = value.clamp(0.0, 2.0).round() as u32,
                _ => {}
            }
        }

        fn get_param(&self, name: &str) -> Option<f32> {
            match name {
                "rate" => Some(self.rate),
                "bias" => Some(self.bias),
                "jitter" => Some(self.jitter),
                "spread" => Some(self.spread),
                "x_bias" => Some(self.x_bias),
                "steps" => Some(self.steps),
                "deja_vu" => Some(self.deja_vu),
                "deja_vu_length" => Some(self.deja_vu_length),
                "t_mode" => Some(self.t_mode as f32),
                "x_mode" => Some(self.x_mode as f32),
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
            let mut out = [0.0_f32; 7];
            self.host.process_sample(
                inputs,
                connected,
                &mut out,
                self.rate,
                self.bias,
                self.jitter,
                self.spread,
                self.x_bias,
                self.steps,
                self.deja_vu,
                self.deja_vu_length,
                self.t_mode as i32,
                self.x_mode as i32,
                &mut self.lights,
            );
            for (i, o) in outputs.iter_mut().enumerate().take(7) {
                *o = out[i];
            }
        }

        fn reset(&mut self) {
            self.host.reset();
            self.lights = [0.0; 3];
        }

        fn lights(&self) -> ModuleLights {
            let mut l = ModuleLights::new();
            l.set("t1", self.lights[0]);
            l.set("t2", self.lights[1]);
            l.set("t3", self.lights[2]);
            l
        }
    }
}

#[cfg(feature = "mi-firmware")]
pub use firmware::Lots;
