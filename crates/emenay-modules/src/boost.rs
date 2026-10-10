//! Soft-clipping boost / drive (Free Modular Boost–inspired).

use emenay_engine::module::{Module, ModuleInfo, ParamDesc, PortDesc, PortId, SignalKind};
use emenay_engine::Voltage;

pub struct Boost {
    info: ModuleInfo,
    gain: f32,
    tone: f32,
    lp: f32,
    sample_rate: f32,
}

impl Boost {
    pub fn new() -> Self {
        Self {
            info: ModuleInfo {
                type_id: "fm_boost".into(),
                name: "Boost".into(),
                hp: 4,
                inputs: vec![PortDesc {
                    name: "in".into(),
                    kind: PortId::Input,
                    signal: SignalKind::Audio,
                }],
                outputs: vec![PortDesc {
                    name: "out".into(),
                    kind: PortId::Output,
                    signal: SignalKind::Audio,
                }],
                params: vec![
                    ParamDesc {
                        name: "gain".into(),
                        min: 0.0,
                        max: 1.0,
                        default: 0.45,
                        unit: "".into(),
                    },
                    ParamDesc {
                        name: "tone".into(),
                        min: 0.0,
                        max: 1.0,
                        default: 0.6,
                        unit: "".into(),
                    },
                ],
            },
            gain: 0.45,
            tone: 0.6,
            lp: 0.0,
            sample_rate: 48_000.0,
        }
    }
}

impl Default for Boost {
    fn default() -> Self {
        Self::new()
    }
}

impl Module for Boost {
    fn info(&self) -> &ModuleInfo {
        &self.info
    }

    fn set_sample_rate(&mut self, sample_rate: f32) {
        self.sample_rate = sample_rate.max(1.0);
    }

    fn set_param(&mut self, name: &str, value: f32) {
        match name {
            "gain" => self.gain = value.clamp(0.0, 1.0),
            "tone" => self.tone = value.clamp(0.0, 1.0),
            _ => {}
        }
    }

    fn get_param(&self, name: &str) -> Option<f32> {
        match name {
            "gain" => Some(self.gain),
            "tone" => Some(self.tone),
            _ => None,
        }
    }

    fn process(&mut self, inputs: &[Voltage], outputs: &mut [Voltage]) {
        let x = inputs.first().copied().unwrap_or(0.0);
        // ~0..26 dB-ish drive into soft tanh clip.
        let drive = 1.0 + self.gain * self.gain * 24.0;
        let driven = (x * drive).tanh() * 5.0;
        // Simple one-pole tone (brighter when tone↑).
        let cutoff = 400.0 + self.tone * self.tone * 12_000.0;
        let a = 1.0 - (-2.0 * std::f32::consts::PI * cutoff / self.sample_rate).exp();
        self.lp += (driven - self.lp) * a;
        let bright = driven - self.lp;
        let y = self.lp + bright * self.tone;
        if let Some(o) = outputs.get_mut(0) {
            *o = y.clamp(-8.0, 8.0);
        }
    }

    fn reset(&mut self) {
        self.lp = 0.0;
    }
}
