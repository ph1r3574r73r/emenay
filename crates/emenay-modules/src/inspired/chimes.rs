//! Chimes — resonator (inspired by MI rings; orthogonal DSP — not a firmware port).
//!
//! Modal / sympathetic string-ish resonators excited by IN or TRIG.

use emenay_engine::module::{Module, ModuleInfo, ParamDesc, PortDesc, PortId, SignalKind};
use emenay_engine::Voltage;
use std::f32::consts::{PI, TAU};

const PARTIALS: usize = 8;

pub struct Chimes {
    info: ModuleInfo,
    freq: f32,
    structure: f32,
    brightness: f32,
    damping: f32,
    position: f32,
    sample_rate: f32,
    amp: [f32; PARTIALS],
    ph: [f32; PARTIALS],
    trig_prev: bool,
    exciter: f32,
}

impl Chimes {
    pub fn new() -> Self {
        Self {
            info: ModuleInfo {
                type_id: "chimes".into(),
                name: "Chimes".into(),
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
                        name: "in".into(),
                        kind: PortId::Input,
                        signal: SignalKind::Audio,
                    },
                    PortDesc {
                        name: "structure_cv".into(),
                        kind: PortId::Input,
                        signal: SignalKind::Cv,
                    },
                    PortDesc {
                        name: "brightness_cv".into(),
                        kind: PortId::Input,
                        signal: SignalKind::Cv,
                    },
                    PortDesc {
                        name: "damping_cv".into(),
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
                        name: "odd".into(),
                        kind: PortId::Output,
                        signal: SignalKind::Audio,
                    },
                    PortDesc {
                        name: "even".into(),
                        kind: PortId::Output,
                        signal: SignalKind::Audio,
                    },
                ],
                params: vec![
                    ParamDesc {
                        name: "freq".into(),
                        min: 20.0,
                        max: 1500.0,
                        default: 110.0,
                        unit: "Hz".into(),
                    },
                    ParamDesc {
                        name: "structure".into(),
                        min: 0.0,
                        max: 1.0,
                        default: 0.4,
                        unit: "".into(),
                    },
                    ParamDesc {
                        name: "brightness".into(),
                        min: 0.0,
                        max: 1.0,
                        default: 0.55,
                        unit: "".into(),
                    },
                    ParamDesc {
                        name: "damping".into(),
                        min: 0.0,
                        max: 1.0,
                        default: 0.45,
                        unit: "".into(),
                    },
                    ParamDesc {
                        name: "position".into(),
                        min: 0.0,
                        max: 1.0,
                        default: 0.3,
                        unit: "".into(),
                    },
                ],
            },
            freq: 110.0,
            structure: 0.4,
            brightness: 0.55,
            damping: 0.45,
            position: 0.3,
            sample_rate: 48_000.0,
            amp: [0.0; PARTIALS],
            ph: [0.0; PARTIALS],
            trig_prev: false,
            exciter: 0.0,
        }
    }

    fn ratio(&self, i: usize, structure: f32) -> f32 {
        let k = (i + 1) as f32;
        // structure 0 ≈ harmonic string, 1 ≈ inharmonic / stiff / membrane-ish
        let stretch = 1.0 + structure * structure * 0.35 * k;
        let membrane = 1.0 + structure * (k * 0.7).sqrt();
        let a = 1.0 - structure;
        k * (a * stretch + (1.0 - a) * membrane / k.max(1.0) * k)
    }
}

impl Default for Chimes {
    fn default() -> Self {
        Self::new()
    }
}

impl Module for Chimes {
    fn info(&self) -> &ModuleInfo {
        &self.info
    }

    fn set_sample_rate(&mut self, sample_rate: f32) {
        self.sample_rate = sample_rate.max(1.0);
    }

    fn set_param(&mut self, name: &str, value: f32) {
        match name {
            "freq" => self.freq = value.clamp(20.0, 1500.0),
            "structure" => self.structure = value.clamp(0.0, 1.0),
            "brightness" => self.brightness = value.clamp(0.0, 1.0),
            "damping" => self.damping = value.clamp(0.0, 1.0),
            "position" => self.position = value.clamp(0.0, 1.0),
            _ => {}
        }
    }

    fn get_param(&self, name: &str) -> Option<f32> {
        match name {
            "freq" => Some(self.freq),
            "structure" => Some(self.structure),
            "brightness" => Some(self.brightness),
            "damping" => Some(self.damping),
            "position" => Some(self.position),
            _ => None,
        }
    }

    fn process(&mut self, inputs: &[Voltage], outputs: &mut [Voltage]) {
        let v_oct = inputs.first().copied().unwrap_or(0.0);
        let trig = inputs.get(1).copied().unwrap_or(0.0) > 1.0;
        let audio_in = inputs.get(2).copied().unwrap_or(0.0);
        let struct_cv = inputs.get(3).copied().unwrap_or(0.0);
        let bright_cv = inputs.get(4).copied().unwrap_or(0.0);
        let damp_cv = inputs.get(5).copied().unwrap_or(0.0);

        let structure = (self.structure + struct_cv * 0.1).clamp(0.0, 1.0);
        let brightness = (self.brightness + bright_cv * 0.1).clamp(0.0, 1.0);
        let damping = (self.damping + damp_cv * 0.1).clamp(0.0, 1.0);

        if trig && !self.trig_prev {
            for i in 0..PARTIALS {
                // Position shapes which partials get struck.
                let pos = (i as f32 / (PARTIALS as f32 - 1.0) - self.position).abs();
                let strike = (1.0 - pos).max(0.0).powf(1.2 + brightness);
                self.amp[i] = strike * (0.6 + brightness * 0.8);
                self.ph[i] = 0.0;
            }
            self.exciter = 1.0;
        }
        self.trig_prev = trig;

        // Soft internal noise / input as continuous excitation.
        self.exciter *= 0.999;
        let excite = audio_in * 0.15 + self.exciter * 0.02;

        let hz = (self.freq * 2f32.powf(v_oct)).clamp(20.0, self.sample_rate * 0.25);
        // Higher damping pot = longer ring (more Chimes-like).
        let decay = (0.998 + damping * 0.0018).clamp(0.995, 0.99995);

        let mut odd = 0.0;
        let mut even = 0.0;
        for i in 0..PARTIALS {
            let ratio = self.ratio(i, structure);
            let f = (hz * ratio).min(self.sample_rate * 0.45);
            self.ph[i] = (self.ph[i] + f / self.sample_rate).fract();
            // Brightness tilts partial amplitudes.
            let tilt = (1.0 - (i as f32) / PARTIALS as f32 * (1.0 - brightness)).max(0.05);
            self.amp[i] = self.amp[i] * decay + excite.abs() * tilt * 0.08;
            let s = (TAU * self.ph[i]).sin() * self.amp[i] * tilt;
            if i % 2 == 0 {
                odd += s;
            } else {
                even += s;
            }
        }

        let _ = PI;
        let o_odd = (odd * 2.5).tanh() * 5.0;
        let o_even = (even * 2.5).tanh() * 5.0;
        if let Some(o) = outputs.get_mut(0) {
            *o = ((o_odd + o_even) * 0.5).clamp(-8.0, 8.0);
        }
        if let Some(o) = outputs.get_mut(1) {
            *o = o_odd;
        }
        if let Some(o) = outputs.get_mut(2) {
            *o = o_even;
        }
    }

    fn reset(&mut self) {
        self.amp = [0.0; PARTIALS];
        self.ph = [0.0; PARTIALS];
        self.trig_prev = false;
        self.exciter = 0.0;
    }
}
