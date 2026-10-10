//! State-variable VCF (LP / BP / HP) with resonance — softsynth voice filter.

use emenay_engine::module::{Module, ModuleInfo, ParamDesc, PortDesc, PortId, SignalKind};
use emenay_engine::Voltage;

pub struct Vcf {
    info: ModuleInfo,
    cutoff: f32,
    res: f32,
    fm_amt: f32,
    sample_rate: f32,
    low: f32,
    band: f32,
}

impl Vcf {
    pub fn new() -> Self {
        Self {
            info: ModuleInfo {
                type_id: "vcf".into(),
                name: "VCF".into(),
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
                    PortDesc {
                        name: "hp".into(),
                        kind: PortId::Output,
                        signal: SignalKind::Audio,
                    },
                ],
                params: vec![
                    ParamDesc {
                        name: "cutoff".into(),
                        min: 20.0,
                        max: 12_000.0,
                        default: 800.0,
                        unit: "Hz".into(),
                    },
                    ParamDesc {
                        name: "res".into(),
                        min: 0.0,
                        max: 0.95,
                        default: 0.25,
                        unit: "".into(),
                    },
                    ParamDesc {
                        name: "fm_amt".into(),
                        min: 0.0,
                        max: 1.0,
                        default: 0.5,
                        unit: "".into(),
                    },
                ],
            },
            cutoff: 800.0,
            res: 0.25,
            fm_amt: 0.5,
            sample_rate: 48_000.0,
            low: 0.0,
            band: 0.0,
        }
    }
}

impl Default for Vcf {
    fn default() -> Self {
        Self::new()
    }
}

impl Module for Vcf {
    fn info(&self) -> &ModuleInfo {
        &self.info
    }

    fn set_sample_rate(&mut self, sample_rate: f32) {
        self.sample_rate = sample_rate.max(1.0);
    }

    fn set_param(&mut self, name: &str, value: f32) {
        match name {
            "cutoff" => self.cutoff = value.clamp(20.0, 12_000.0),
            "res" => self.res = value.clamp(0.0, 0.95),
            "fm_amt" => self.fm_amt = value.clamp(0.0, 1.0),
            _ => {}
        }
    }

    fn get_param(&self, name: &str) -> Option<f32> {
        match name {
            "cutoff" => Some(self.cutoff),
            "res" => Some(self.res),
            "fm_amt" => Some(self.fm_amt),
            _ => None,
        }
    }

    fn process(&mut self, inputs: &[Voltage], outputs: &mut [Voltage]) {
        let x = inputs.first().copied().unwrap_or(0.0);
        let fm = inputs.get(1).copied().unwrap_or(0.0);
        let res_cv = inputs.get(2).copied().unwrap_or(0.0);

        let hz = (self.cutoff * 2f32.powf(fm * self.fm_amt * 0.2)).clamp(20.0, self.sample_rate * 0.45);
        let f = (2.0 * std::f32::consts::PI * hz / self.sample_rate).sin().clamp(0.001, 0.99);
        let q = (1.0 - (self.res + res_cv * 0.08).clamp(0.0, 0.95)).clamp(0.05, 1.0);

        // Chamberlin / state-variable (sample-rate stable for musical cutoffs).
        self.low += f * self.band;
        let high = x - self.low - q * self.band;
        self.band += f * high;

        if let Some(o) = outputs.get_mut(0) {
            *o = self.low.clamp(-10.0, 10.0);
        }
        if let Some(o) = outputs.get_mut(1) {
            *o = self.band.clamp(-10.0, 10.0);
        }
        if let Some(o) = outputs.get_mut(2) {
            *o = high.clamp(-10.0, 10.0);
        }
    }

    fn reset(&mut self) {
        self.low = 0.0;
        self.band = 0.0;
    }
}
