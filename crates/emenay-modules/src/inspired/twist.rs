//! Twist — meta-modulator (inspired by MI warps; not a firmware port).
//! (orthogonal DSP — not a firmware port).
//!
//! Algorithm morph: crossfade · fold · ring · XOR/bitcrush · vocoder-ish.

use emenay_engine::module::{Module, ModuleInfo, ParamDesc, PortDesc, PortId, SignalKind};
use emenay_engine::Voltage;
use std::f32::consts::{PI, TAU};

pub struct Twist {
    info: ModuleInfo,
    algorithm: f32,
    timbre: f32,
    level: f32,
    sample_rate: f32,
    phase: f32,
    carrier_hz: f32,
    lp1: f32,
    lp2: f32,
    bp: f32,
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
                        name: "level_cv".into(),
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
                        name: "level".into(),
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
                ],
            },
            algorithm: 0.35,
            timbre: 0.5,
            level: 0.8,
            sample_rate: 48_000.0,
            phase: 0.0,
            carrier_hz: 220.0,
            lp1: 0.0,
            lp2: 0.0,
            bp: 0.0,
        }
    }

    fn internal_carrier(&mut self) -> f32 {
        self.phase = (self.phase + self.carrier_hz / self.sample_rate).fract();
        (TAU * self.phase).sin() * 5.0
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

    fn set_sample_rate(&mut self, sample_rate: f32) {
        self.sample_rate = sample_rate.max(1.0);
    }

    fn set_param(&mut self, name: &str, value: f32) {
        match name {
            "algorithm" => self.algorithm = value.clamp(0.0, 1.0),
            "timbre" => self.timbre = value.clamp(0.0, 1.0),
            "level" => self.level = value.clamp(0.0, 1.0),
            "freq" => self.carrier_hz = value.clamp(20.0, 2000.0),
            _ => {}
        }
    }

    fn get_param(&self, name: &str) -> Option<f32> {
        match name {
            "algorithm" => Some(self.algorithm),
            "timbre" => Some(self.timbre),
            "level" => Some(self.level),
            "freq" => Some(self.carrier_hz),
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
        let mut c = inputs.first().copied().unwrap_or(0.0);
        let mut m = inputs.get(1).copied().unwrap_or(0.0);
        let algo_cv = inputs.get(2).copied().unwrap_or(0.0);
        let timbre_cv = inputs.get(3).copied().unwrap_or(0.0);
        let level_cv = inputs.get(4).copied().unwrap_or(0.0);

        // Unpatched carrier → internal sine; unpatched mod → rectified carrier.
        // Use connection flags (not amplitude) so quiet audio stays external.
        if !connected.get(0).copied().unwrap_or(false) {
            c = self.internal_carrier();
        }
        if !connected.get(1).copied().unwrap_or(false) {
            m = c.abs() * 0.5;
        }

        let algo = (self.algorithm + algo_cv * 0.1).clamp(0.0, 0.999);
        let timbre = (self.timbre + timbre_cv * 0.1).clamp(0.0, 1.0);
        let level = (self.level + level_cv * 0.1).clamp(0.0, 1.5);

        let cn = c / 5.0;
        let mn = m / 5.0;

        // Five algorithms crossfaded across algo dial.
        let xf = cn * (1.0 - timbre) + mn * timbre;
        let fold = {
            let drive = 1.0 + timbre * 6.0;
            let x = (cn * drive).sin();
            x * (1.0 - mn.abs() * 0.3) + mn * cn * timbre
        };
        let ring = cn * mn * (1.0 + timbre * 2.0);
        let crush = {
            let bits = 2.0 + (1.0 - timbre) * 10.0;
            let q = (cn * bits).round() / bits;
            let xorish = (cn.abs() - mn.abs()) * cn.signum();
            q * (1.0 - timbre * 0.5) + xorish * timbre
        };
        // Cheap vocoder-ish: modulator envelope * filtered carrier.
        let voc = {
            let env_t = mn.abs();
            let cutoff = 200.0 + timbre * timbre * 6_000.0;
            let a = 1.0 - (-2.0 * PI * cutoff / self.sample_rate).exp();
            self.lp1 += (cn - self.lp1) * a;
            self.bp += (cn - self.lp1 - self.bp * 0.4) * a;
            self.lp2 += (env_t - self.lp2) * 0.01;
            self.bp * self.lp2 * 4.0
        };

        let algs = [xf, fold, ring, crush, voc];
        let pos = algo * 4.0;
        let i = pos.floor() as usize;
        let f = pos.fract();
        let i2 = (i + 1).min(4);
        let mixed = algs[i] * (1.0 - f) + algs[i2] * f;
        let out = (mixed * level * 5.0).tanh() * 5.0;
        let aux = (cn * 5.0 * level * 0.5).clamp(-8.0, 8.0);

        if let Some(o) = outputs.get_mut(0) {
            *o = out.clamp(-8.0, 8.0);
        }
        if let Some(o) = outputs.get_mut(1) {
            *o = aux;
        }
    }

    fn reset(&mut self) {
        self.phase = 0.0;
        self.lp1 = 0.0;
        self.lp2 = 0.0;
        self.bp = 0.0;
    }
}
