//! Erica Synths DIY Polivoks VCF — aggressive OTA-style low-pass with bite.
//!
//! Attribution: schematics CC-BY-SA-3.0 (Erica Synths DIY Eurorack). Software model © emenay.
//! Circuit-inspired: cascaded soft-clipped integrators + nonlinear resonance (not a SPICE netlist).

use emenay_engine::module::{Module, ModuleInfo, ParamDesc, PortDesc, PortId, SignalKind};
use emenay_engine::Voltage;

pub struct EricaPolivoksVcf {
    info: ModuleInfo,
    cutoff: f32,
    res: f32,
    drive: f32,
    fm_amt: f32,
    sample_rate: f32,
    /// Four soft-clipped integrator states (ladder-ish).
    z: [f32; 4],
}

impl EricaPolivoksVcf {
    pub fn new() -> Self {
        Self {
            info: ModuleInfo {
                type_id: "erica_polivoks_vcf".into(),
                name: "Polivoks VCF".into(),
                hp: 10,
                inputs: vec![
                    PortDesc {
                        name: "in".into(),
                        kind: PortId::Input,
                        signal: SignalKind::Audio,
                    },
                    PortDesc {
                        name: "fm".into(),
                        kind: PortId::Input,
                        signal: SignalKind::Cv,
                    },
                    PortDesc {
                        name: "res_cv".into(),
                        kind: PortId::Input,
                        signal: SignalKind::Cv,
                    },
                ],
                outputs: vec![
                    PortDesc {
                        name: "lp".into(),
                        kind: PortId::Output,
                        signal: SignalKind::Audio,
                    },
                    PortDesc {
                        name: "bp".into(),
                        kind: PortId::Output,
                        signal: SignalKind::Audio,
                    },
                ],
                params: vec![
                    ParamDesc {
                        name: "cutoff".into(),
                        min: 30.0,
                        max: 10_000.0,
                        default: 600.0,
                        unit: "Hz".into(),
                    },
                    ParamDesc {
                        name: "res".into(),
                        min: 0.0,
                        max: 1.0,
                        default: 0.4,
                        unit: "".into(),
                    },
                    ParamDesc {
                        name: "drive".into(),
                        min: 0.0,
                        max: 1.0,
                        default: 0.35,
                        unit: "".into(),
                    },
                    ParamDesc {
                        name: "fm_amt".into(),
                        min: 0.0,
                        max: 1.0,
                        default: 0.55,
                        unit: "".into(),
                    },
                ],
            },
            cutoff: 600.0,
            res: 0.4,
            drive: 0.35,
            fm_amt: 0.55,
            sample_rate: 48_000.0,
            z: [0.0; 4],
        }
    }

    #[inline]
    fn soft(x: f32) -> f32 {
        // Asymmetric soft clip — Polivoks growl cue.
        let y = x + 0.12 * x * x - 0.04 * x * x * x;
        y.tanh()
    }
}

impl Default for EricaPolivoksVcf {
    fn default() -> Self {
        Self::new()
    }
}

impl Module for EricaPolivoksVcf {
    fn info(&self) -> &ModuleInfo {
        &self.info
    }

    fn set_sample_rate(&mut self, sample_rate: f32) {
        self.sample_rate = sample_rate.max(1.0);
    }

    fn set_param(&mut self, name: &str, value: f32) {
        match name {
            "cutoff" => self.cutoff = value.clamp(30.0, 10_000.0),
            "res" => self.res = value.clamp(0.0, 1.0),
            "drive" => self.drive = value.clamp(0.0, 1.0),
            "fm_amt" => self.fm_amt = value.clamp(0.0, 1.0),
            _ => {}
        }
    }

    fn get_param(&self, name: &str) -> Option<f32> {
        match name {
            "cutoff" => Some(self.cutoff),
            "res" => Some(self.res),
            "drive" => Some(self.drive),
            "fm_amt" => Some(self.fm_amt),
            _ => None,
        }
    }

    fn process(&mut self, inputs: &[Voltage], outputs: &mut [Voltage]) {
        let x_in = inputs.first().copied().unwrap_or(0.0) / 5.0;
        let fm = inputs.get(1).copied().unwrap_or(0.0);
        let res_cv = inputs.get(2).copied().unwrap_or(0.0);

        let cut = (self.cutoff * 2f32.powf(fm * self.fm_amt * 0.4)).clamp(20.0, self.sample_rate * 0.42);
        // One-pole coefficient per stage
        let g = (TAU_F * cut / self.sample_rate).clamp(0.001, 1.2);
        let k = (self.res * 3.8 + res_cv * 0.15).clamp(0.0, 4.2);
        let drive = 1.0 + self.drive * 2.5;

        let mut x = Self::soft(x_in * drive) - k * Self::soft(self.z[3]);
        for i in 0..4 {
            self.z[i] += g * (Self::soft(x) - Self::soft(self.z[i]));
            x = self.z[i];
        }

        let lp = self.z[3] * 5.0;
        let bp = (self.z[1] - self.z[2]) * 5.0;

        if let Some(o) = outputs.get_mut(0) {
            *o = lp.clamp(-8.0, 8.0);
        }
        if let Some(o) = outputs.get_mut(1) {
            *o = bp.clamp(-8.0, 8.0);
        }
    }

    fn reset(&mut self) {
        self.z = [0.0; 4];
    }
}

const TAU_F: f32 = std::f32::consts::TAU;
