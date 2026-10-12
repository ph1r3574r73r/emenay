//! Twin — dual Peaks-style processor (EG / LFO / 808 drums / FM).
//!
//! Modes (per channel): 0 env, 1 LFO, 2 tap LFO, 3 BD, 4 SD, 5 HH, 6 FM,
//! 7 pulse shaper, 8 pulse rnd, 9 bounce, 10 mini-seq, 11 number station.
//!
//! `split` ≥ 0.5 → half/split (P1/P2 → A, P3/P4 → B); else twin/full (all four → both).

#[cfg(all(not(feature = "mi-firmware"), feature = "inspired-fallback"))]
pub use crate::inspired::twin::Twin;

#[cfg(feature = "mi-firmware")]
mod firmware {
    use emenay_engine::module::{
        Module, ModuleInfo, ModuleLights, ParamDesc, PortDesc, PortId, SignalKind,
    };
    use emenay_engine::Voltage;
    use emenay_mi_host::twin::TwinHost;

    pub struct Twin {
        info: ModuleInfo,
        host: TwinHost,
        mode_a: f32,
        mode_b: f32,
        p1: f32,
        p2: f32,
        p3: f32,
        p4: f32,
        split: f32,
        level: f32,
        led_a: f32,
        led_b: f32,
    }

    impl Twin {
        pub fn new() -> Self {
            Self {
                info: ModuleInfo {
                    type_id: "twin".into(),
                    name: "Twin".into(),
                    hp: 8,
                    inputs: vec![
                        PortDesc {
                            name: "trig_a".into(),
                            kind: PortId::Input,
                            signal: SignalKind::Gate,
                        },
                        PortDesc {
                            name: "trig_b".into(),
                            kind: PortId::Input,
                            signal: SignalKind::Gate,
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
                            name: "mix".into(),
                            kind: PortId::Output,
                            signal: SignalKind::Audio,
                        },
                    ],
                    params: vec![
                        ParamDesc {
                            name: "mode_a".into(),
                            min: 0.0,
                            max: 11.0,
                            default: 3.0,
                            unit: "int".into(),
                        },
                        ParamDesc {
                            name: "mode_b".into(),
                            min: 0.0,
                            max: 11.0,
                            default: 4.0,
                            unit: "int".into(),
                        },
                        ParamDesc {
                            name: "p1".into(),
                            min: 0.0,
                            max: 1.0,
                            default: 0.45,
                            unit: "".into(),
                        },
                        ParamDesc {
                            name: "p2".into(),
                            min: 0.0,
                            max: 1.0,
                            default: 0.55,
                            unit: "".into(),
                        },
                        ParamDesc {
                            name: "p3".into(),
                            min: 0.0,
                            max: 1.0,
                            default: 0.5,
                            unit: "".into(),
                        },
                        ParamDesc {
                            name: "p4".into(),
                            min: 0.0,
                            max: 1.0,
                            default: 0.45,
                            unit: "".into(),
                        },
                        ParamDesc {
                            name: "split".into(),
                            min: 0.0,
                            max: 1.0,
                            default: 1.0,
                            unit: "bool".into(),
                        },
                        ParamDesc {
                            name: "level".into(),
                            min: 0.0,
                            max: 1.0,
                            default: 0.9,
                            unit: "".into(),
                        },
                    ],
                },
                host: TwinHost::new(),
                mode_a: 3.0,
                mode_b: 4.0,
                p1: 0.45,
                p2: 0.55,
                p3: 0.5,
                p4: 0.45,
                split: 1.0,
                level: 0.9,
                led_a: 0.0,
                led_b: 0.0,
            }
        }
    }

    impl Default for Twin {
        fn default() -> Self {
            Self::new()
        }
    }

    impl Module for Twin {
        fn info(&self) -> &ModuleInfo {
            &self.info
        }

        fn set_sample_rate(&mut self, _sample_rate: f32) {}

        fn set_param(&mut self, name: &str, value: f32) {
            match name {
                "mode_a" => self.mode_a = value.clamp(0.0, 11.0).round(),
                "mode_b" => self.mode_b = value.clamp(0.0, 11.0).round(),
                "p1" => self.p1 = value.clamp(0.0, 1.0),
                "p2" => self.p2 = value.clamp(0.0, 1.0),
                "p3" => self.p3 = value.clamp(0.0, 1.0),
                "p4" => self.p4 = value.clamp(0.0, 1.0),
                "split" => self.split = if value >= 0.5 { 1.0 } else { 0.0 },
                "level" => self.level = value.clamp(0.0, 1.0),
                _ => {}
            }
        }

        fn get_param(&self, name: &str) -> Option<f32> {
            match name {
                "mode_a" => Some(self.mode_a),
                "mode_b" => Some(self.mode_b),
                "p1" => Some(self.p1),
                "p2" => Some(self.p2),
                "p3" => Some(self.p3),
                "p4" => Some(self.p4),
                "split" => Some(self.split),
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
            let mut out = [0.0_f32; 3];
            self.host.process_sample(
                inputs,
                connected,
                &mut out,
                self.mode_a as i32,
                self.mode_b as i32,
                self.p1,
                self.p2,
                self.p3,
                self.p4,
                if self.split >= 0.5 { 1 } else { 0 },
                self.level,
            );
            self.led_a = out[0].abs().clamp(0.0, 1.0);
            self.led_b = out[1].abs().clamp(0.0, 1.0);
            for (i, o) in outputs.iter_mut().enumerate().take(3) {
                *o = out[i];
            }
        }

        fn reset(&mut self) {
            self.host.reset();
            self.led_a = 0.0;
            self.led_b = 0.0;
        }

        fn lights(&self) -> ModuleLights {
            let mut l = ModuleLights::new();
            l.set("mode_a", self.mode_a);
            l.set("mode_b", self.mode_b);
            l.set("a", self.led_a);
            l.set("b", self.led_b);
            l
        }
    }
}

#[cfg(feature = "mi-firmware")]
pub use firmware::Twin;
