//! Stereo utility — dual VCA / pan / width for mono→stereo or L/R balancing.

use emenay_engine::module::{Module, ModuleInfo, ParamDesc, PortDesc, PortId, SignalKind};
use emenay_engine::Voltage;

pub struct Stereo {
    info: ModuleInfo,
    pan: f32,
    width: f32,
    level: f32,
}

impl Stereo {
    pub fn new() -> Self {
        Self {
            info: ModuleInfo {
                type_id: "stereo".into(),
                name: "Stereo".into(),
                hp: 6,
                inputs: vec![
                    PortDesc {
                        name: "in_l".into(),
                        kind: PortId::Input,
                        signal: SignalKind::Audio,
                    },
                    PortDesc {
                        name: "in_r".into(),
                        kind: PortId::Input,
                        signal: SignalKind::Audio,
                    },
                    PortDesc {
                        name: "pan_cv".into(),
                        kind: PortId::Input,
                        signal: SignalKind::Cv,
                    },
                ],
                outputs: vec![
                    PortDesc {
                        name: "out_l".into(),
                        kind: PortId::Output,
                        signal: SignalKind::Audio,
                    },
                    PortDesc {
                        name: "out_r".into(),
                        kind: PortId::Output,
                        signal: SignalKind::Audio,
                    },
                ],
                params: vec![
                    ParamDesc {
                        name: "pan".into(),
                        min: -1.0,
                        max: 1.0,
                        default: 0.0,
                        unit: "".into(),
                    },
                    ParamDesc {
                        name: "width".into(),
                        min: 0.0,
                        max: 2.0,
                        default: 1.0,
                        unit: "".into(),
                    },
                    ParamDesc {
                        name: "level".into(),
                        min: 0.0,
                        max: 1.0,
                        default: 0.85,
                        unit: "".into(),
                    },
                ],
            },
            pan: 0.0,
            width: 1.0,
            level: 0.85,
        }
    }
}

impl Default for Stereo {
    fn default() -> Self {
        Self::new()
    }
}

impl Module for Stereo {
    fn info(&self) -> &ModuleInfo {
        &self.info
    }

    fn set_sample_rate(&mut self, _sample_rate: f32) {}

    fn set_param(&mut self, name: &str, value: f32) {
        match name {
            "pan" => self.pan = value.clamp(-1.0, 1.0),
            "width" => self.width = value.clamp(0.0, 2.0),
            "level" => self.level = value.clamp(0.0, 1.0),
            _ => {}
        }
    }

    fn get_param(&self, name: &str) -> Option<f32> {
        match name {
            "pan" => Some(self.pan),
            "width" => Some(self.width),
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
        let mut l = inputs.first().copied().unwrap_or(0.0);
        let mut r = inputs.get(1).copied().unwrap_or(0.0);
        // Mono normal only when R is unpatched (not when R is intentionally quiet).
        if connected.is_empty() {
            if r.abs() < 1e-6 && l.abs() > 1e-6 {
                r = l;
            }
        } else if connected.get(0).copied().unwrap_or(false)
            && !connected.get(1).copied().unwrap_or(false)
        {
            r = l;
        }
        let pan_cv = inputs.get(2).copied().unwrap_or(0.0);
        let pan = (self.pan + pan_cv * 0.2).clamp(-1.0, 1.0);

        // Mid/side width.
        let mid = 0.5 * (l + r);
        let side = 0.5 * (l - r) * self.width;
        l = mid + side;
        r = mid - side;

        // Equal-power pan.
        let angle = (pan + 1.0) * 0.25 * std::f32::consts::PI; // -1→0, +1→π/2
        let g_l = angle.cos() * self.level;
        let g_r = angle.sin() * self.level;

        if let Some(o) = outputs.get_mut(0) {
            *o = l * g_l;
        }
        if let Some(o) = outputs.get_mut(1) {
            *o = r * g_r;
        }
    }

    fn reset(&mut self) {}
}
