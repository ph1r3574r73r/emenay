//! WASP-inspired CMOS multimode filter — aggressive, nasal, self-oscillates hard.
//!
//! Soft-clipped state-variable core with asymmetric drive (nod to the EDP Wasp).

use emenay_engine::module::{
    Module, ModuleInfo, ModuleLights, ParamDesc, PortDesc, PortId, SignalKind,
};
use emenay_engine::Voltage;

pub struct Wasp {
    info: ModuleInfo,
    cutoff: f32,
    res: f32,
    drive: f32,
    sample_rate: f32,
    low: f32,
    band: f32,
}

impl Wasp {
    pub fn new() -> Self {
        Self {
            info: ModuleInfo {
                type_id: "wasp".into(),
                name: "WASP".into(),
                hp: 8,
                inputs: vec![
                    PortDesc {
                        name: "in".into(),
                        kind: PortId::Input,
                        signal: SignalKind::Audio,
                    },
                    PortDesc {
                        name: "cv".into(),
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
                        min: 40.0,
                        max: 10_000.0,
                        default: 600.0,
                        unit: "Hz".into(),
                    },
                    ParamDesc {
                        name: "res".into(),
                        min: 0.0,
                        max: 1.0,
                        default: 0.35,
                        unit: "".into(),
                    },
                    ParamDesc {
                        name: "drive".into(),
                        min: 0.0,
                        max: 1.0,
                        default: 0.4,
                        unit: "".into(),
                    },
                ],
            },
            cutoff: 600.0,
            res: 0.35,
            drive: 0.4,
            sample_rate: 48_000.0,
            low: 0.0,
            band: 0.0,
        }
    }

    #[inline]
    fn soft(x: f32) -> f32 {
        // Asymmetric CMOS-ish soft clip.
        let y = x + 0.08 * x * x;
        y.tanh()
    }
}

impl Default for Wasp {
    fn default() -> Self {
        Self::new()
    }
}

impl Module for Wasp {
    fn info(&self) -> &ModuleInfo {
        &self.info
    }

    fn set_sample_rate(&mut self, sample_rate: f32) {
        self.sample_rate = sample_rate.max(1.0);
    }

    fn set_param(&mut self, name: &str, value: f32) {
        match name {
            "cutoff" => self.cutoff = value.clamp(40.0, 10_000.0),
            "res" => self.res = value.clamp(0.0, 1.0),
            "drive" => self.drive = value.clamp(0.0, 1.0),
            _ => {}
        }
    }

    fn get_param(&self, name: &str) -> Option<f32> {
        match name {
            "cutoff" => Some(self.cutoff),
            "res" => Some(self.res),
            "drive" => Some(self.drive),
            _ => None,
        }
    }

    fn process(&mut self, inputs: &[Voltage], outputs: &mut [Voltage]) {
        let x_in = inputs.first().copied().unwrap_or(0.0);
        let cv = inputs.get(1).copied().unwrap_or(0.0);
        let drive_g = 1.0 + self.drive * 4.0;
        let x = Self::soft(x_in * 0.2 * drive_g);

        let cut = (self.cutoff * (2.0_f32).powf(cv * 0.2)).clamp(40.0, self.sample_rate * 0.45);
        let f = (2.0 * std::f32::consts::PI * cut / self.sample_rate).sin().clamp(0.001, 0.95);
        // High resonance; allow near self-oscillation.
        let q = (1.0 - self.res * 0.97).max(0.02);

        self.low += f * self.band;
        let high = x - self.low - q * self.band;
        self.band += f * high;
        // Soft limit state to keep wild Q stable-ish.
        self.low = Self::soft(self.low * 1.15) * 0.92;
        self.band = Self::soft(self.band * 1.1) * 0.9;

        let out_scale = 5.0 * (0.55 + self.drive * 0.35);
        if let Some(o) = outputs.get_mut(0) {
            *o = self.low * out_scale;
        }
        if let Some(o) = outputs.get_mut(1) {
            *o = self.band * out_scale;
        }
        if let Some(o) = outputs.get_mut(2) {
            *o = high * out_scale;
        }
    }

    fn reset(&mut self) {
        self.low = 0.0;
        self.band = 0.0;
    }

    fn lights(&self) -> ModuleLights {
        let mut l = ModuleLights::new();
        let energy = (self.low.abs() + self.band.abs()) * 0.5;
        l.set("level", energy.clamp(0.0, 1.0));
        l
    }
}
