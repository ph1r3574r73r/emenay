//! Erica Synths DIY Modulator — LFO + noise + sample-and-hold.
//!
//! Attribution: schematics CC-BY-SA-3.0 (Erica Synths DIY Eurorack). Software model © emenay.

use emenay_engine::module::{Module, ModuleInfo, ParamDesc, PortDesc, PortId, SignalKind};
use emenay_engine::Voltage;
use std::f32::consts::TAU;

pub struct EricaModulator {
    info: ModuleInfo,
    rate: f32,
    shape: f32,
    noise_lvl: f32,
    slew: f32,
    sample_rate: f32,
    phase: f32,
    reset_prev: bool,
    clock_prev: bool,
    held: f32,
    sh_out: f32,
    seed: u32,
}

impl EricaModulator {
    pub fn new() -> Self {
        Self {
            info: ModuleInfo {
                type_id: "erica_modulator".into(),
                name: "Modulator".into(),
                hp: 12,
                inputs: vec![
                    PortDesc {
                        name: "rate_cv".into(),
                        kind: PortId::Input,
                        signal: SignalKind::Cv,
                    },
                    PortDesc {
                        name: "reset".into(),
                        kind: PortId::Input,
                        signal: SignalKind::Gate,
                    },
                    PortDesc {
                        name: "sh_in".into(),
                        kind: PortId::Input,
                        signal: SignalKind::Cv,
                    },
                    PortDesc {
                        name: "clock".into(),
                        kind: PortId::Input,
                        signal: SignalKind::Gate,
                    },
                ],
                outputs: vec![
                    PortDesc {
                        name: "lfo".into(),
                        kind: PortId::Output,
                        signal: SignalKind::Cv,
                    },
                    PortDesc {
                        name: "noise".into(),
                        kind: PortId::Output,
                        signal: SignalKind::Audio,
                    },
                    PortDesc {
                        name: "sh".into(),
                        kind: PortId::Output,
                        signal: SignalKind::Cv,
                    },
                ],
                params: vec![
                    ParamDesc {
                        name: "rate".into(),
                        min: 0.05,
                        max: 30.0,
                        default: 1.2,
                        unit: "Hz".into(),
                    },
                    ParamDesc {
                        name: "shape".into(),
                        min: 0.0,
                        max: 1.0,
                        default: 0.0,
                        unit: "".into(),
                    },
                    ParamDesc {
                        name: "noise_lvl".into(),
                        min: 0.0,
                        max: 1.0,
                        default: 0.6,
                        unit: "".into(),
                    },
                    ParamDesc {
                        name: "slew".into(),
                        min: 0.0,
                        max: 1.0,
                        default: 0.1,
                        unit: "".into(),
                    },
                ],
            },
            rate: 1.2,
            shape: 0.0,
            noise_lvl: 0.6,
            slew: 0.1,
            sample_rate: 48_000.0,
            phase: 0.0,
            reset_prev: false,
            clock_prev: false,
            held: 0.0,
            sh_out: 0.0,
            seed: 0xC0FF_EE42,
        }
    }

    fn next_noise(&mut self) -> f32 {
        self.seed = self.seed.wrapping_mul(1664525).wrapping_add(1013904223);
        (self.seed as f32 / u32::MAX as f32) * 2.0 - 1.0
    }

    fn wave(t: f32, shape: f32) -> f32 {
        let sine = (TAU * t).sin();
        let tri = if t < 0.5 {
            4.0 * t - 1.0
        } else {
            3.0 - 4.0 * t
        };
        let saw = 2.0 * t - 1.0;
        let sq = if t < 0.5 { 1.0 } else { -1.0 };
        let s = shape.clamp(0.0, 1.0);
        if s < 0.33 {
            let u = s / 0.33;
            sine * (1.0 - u) + tri * u
        } else if s < 0.66 {
            let u = (s - 0.33) / 0.33;
            tri * (1.0 - u) + saw * u
        } else {
            let u = (s - 0.66) / 0.34;
            saw * (1.0 - u) + sq * u
        }
    }
}

impl Default for EricaModulator {
    fn default() -> Self {
        Self::new()
    }
}

impl Module for EricaModulator {
    fn info(&self) -> &ModuleInfo {
        &self.info
    }

    fn set_sample_rate(&mut self, sample_rate: f32) {
        self.sample_rate = sample_rate.max(1.0);
    }

    fn set_param(&mut self, name: &str, value: f32) {
        match name {
            "rate" => self.rate = value.clamp(0.05, 30.0),
            "shape" => self.shape = value.clamp(0.0, 1.0),
            "noise_lvl" => self.noise_lvl = value.clamp(0.0, 1.0),
            "slew" => self.slew = value.clamp(0.0, 1.0),
            _ => {}
        }
    }

    fn get_param(&self, name: &str) -> Option<f32> {
        match name {
            "rate" => Some(self.rate),
            "shape" => Some(self.shape),
            "noise_lvl" => Some(self.noise_lvl),
            "slew" => Some(self.slew),
            _ => None,
        }
    }

    fn process(&mut self, inputs: &[Voltage], outputs: &mut [Voltage]) {
        let rate_cv = inputs.first().copied().unwrap_or(0.0);
        let reset = inputs.get(1).copied().unwrap_or(0.0) > 1.0;
        let sh_ext = inputs.get(2).copied().unwrap_or(0.0);
        let clock = inputs.get(3).copied().unwrap_or(0.0) > 1.0;

        if reset && !self.reset_prev {
            self.phase = 0.0;
        }
        self.reset_prev = reset;

        let hz = (self.rate * 2f32.powf(rate_cv * 0.2)).clamp(0.01, 80.0);
        let prev_phase = self.phase;
        self.phase = (self.phase + hz / self.sample_rate).fract();
        let lfo = Self::wave(self.phase, self.shape) * 5.0;

        let n = self.next_noise();
        let noise = n * self.noise_lvl * 5.0;

        // S&H: external clock, else LFO wrap samples sh_in (normalled to noise).
        let rising = clock && !self.clock_prev;
        let wrap = self.phase < prev_phase;
        self.clock_prev = clock;
        if rising || (!clock && wrap) {
            self.held = sh_ext;
            if self.held.abs() < 1e-6 {
                self.held = n * 5.0;
            }
        }
        let a = 1.0 - self.slew.clamp(0.0, 0.999);
        self.sh_out += (self.held - self.sh_out) * a;

        if let Some(o) = outputs.get_mut(0) {
            *o = lfo;
        }
        if let Some(o) = outputs.get_mut(1) {
            *o = noise;
        }
        if let Some(o) = outputs.get_mut(2) {
            *o = self.sh_out;
        }
    }

    fn reset(&mut self) {
        self.phase = 0.0;
        self.reset_prev = false;
        self.clock_prev = false;
        self.held = 0.0;
        self.sh_out = 0.0;
    }
}
