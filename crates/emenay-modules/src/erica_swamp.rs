//! Erica Synths DIY Swamp — Wogglebug-style chaotic random CV.
//!
//! Attribution: schematics CC-BY-SA-3.0 (Erica Synths DIY). Software model © emenay.
//! Stepped / smooth random, burst, and noisy clock influenced by rate + chaos.

use emenay_engine::module::{Module, ModuleInfo, ParamDesc, PortDesc, PortId, SignalKind};
use emenay_engine::Voltage;
use std::f32::consts::TAU;

pub struct EricaSwamp {
    info: ModuleInfo,
    rate: f32,
    chaos: f32,
    lag: f32,
    sample_rate: f32,
    phase: f32,
    clock_prev: bool,
    stepped: f32,
    smooth: f32,
    burst: f32,
    seed: u32,
}

impl EricaSwamp {
    pub fn new() -> Self {
        Self {
            info: ModuleInfo {
                type_id: "erica_swamp".into(),
                name: "Swamp".into(),
                hp: 12,
                inputs: vec![
                    PortDesc {
                        name: "rate_cv".into(),
                        kind: PortId::Input,
                        signal: SignalKind::Cv,
                    },
                    PortDesc {
                        name: "chaos_cv".into(),
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
                        name: "stepped".into(),
                        kind: PortId::Output,
                        signal: SignalKind::Cv,
                    },
                    PortDesc {
                        name: "smooth".into(),
                        kind: PortId::Output,
                        signal: SignalKind::Cv,
                    },
                    PortDesc {
                        name: "burst".into(),
                        kind: PortId::Output,
                        signal: SignalKind::Gate,
                    },
                    PortDesc {
                        name: "noise".into(),
                        kind: PortId::Output,
                        signal: SignalKind::Audio,
                    },
                ],
                params: vec![
                    ParamDesc {
                        name: "rate".into(),
                        min: 0.1,
                        max: 40.0,
                        default: 4.0,
                        unit: "Hz".into(),
                    },
                    ParamDesc {
                        name: "chaos".into(),
                        min: 0.0,
                        max: 1.0,
                        default: 0.45,
                        unit: "".into(),
                    },
                    ParamDesc {
                        name: "lag".into(),
                        min: 0.0,
                        max: 1.0,
                        default: 0.35,
                        unit: "".into(),
                    },
                ],
            },
            rate: 4.0,
            chaos: 0.45,
            lag: 0.35,
            sample_rate: 48_000.0,
            phase: 0.0,
            clock_prev: false,
            stepped: 0.0,
            smooth: 0.0,
            burst: 0.0,
            seed: 0x5A17_B007,
        }
    }

    fn next_u(&mut self) -> f32 {
        self.seed = self.seed.wrapping_mul(1664525).wrapping_add(1013904223);
        self.seed as f32 / u32::MAX as f32
    }

    fn next_bipolar(&mut self) -> f32 {
        self.next_u() * 2.0 - 1.0
    }
}

impl Default for EricaSwamp {
    fn default() -> Self {
        Self::new()
    }
}

impl Module for EricaSwamp {
    fn info(&self) -> &ModuleInfo {
        &self.info
    }

    fn set_sample_rate(&mut self, sample_rate: f32) {
        self.sample_rate = sample_rate.max(1.0);
    }

    fn set_param(&mut self, name: &str, value: f32) {
        match name {
            "rate" => self.rate = value.clamp(0.1, 40.0),
            "chaos" => self.chaos = value.clamp(0.0, 1.0),
            "lag" => self.lag = value.clamp(0.0, 1.0),
            _ => {}
        }
    }

    fn get_param(&self, name: &str) -> Option<f32> {
        match name {
            "rate" => Some(self.rate),
            "chaos" => Some(self.chaos),
            "lag" => Some(self.lag),
            _ => None,
        }
    }

    fn process(&mut self, inputs: &[Voltage], outputs: &mut [Voltage]) {
        let rate_cv = inputs.first().copied().unwrap_or(0.0);
        let chaos_cv = inputs.get(1).copied().unwrap_or(0.0);
        let clock = inputs.get(2).copied().unwrap_or(0.0) > 1.0;

        let chaos = (self.chaos + chaos_cv * 0.15).clamp(0.0, 1.0);
        // Mild rate jitter from last step value (no per-sample RNG).
        let hz = (self.rate
            * 2f32.powf(rate_cv * 0.25 + chaos * 0.08 * (self.stepped * 0.2)))
        .clamp(0.05, 80.0);

        let prev = self.phase;
        self.phase = (self.phase + hz / self.sample_rate).fract();
        let wrap = self.phase < prev;
        let rising = clock && !self.clock_prev;
        self.clock_prev = clock;

        if rising || (!clock && wrap) {
            // Woggle-ish: blend random walk with jumps
            let jump = self.next_bipolar() * 5.0;
            let walk = self.stepped + self.next_bipolar() * (1.0 + chaos * 4.0);
            self.stepped = (jump * chaos + walk * (1.0 - chaos * 0.65)).clamp(-5.0, 5.0);
            self.burst = if self.next_u() < 0.15 + chaos * 0.55 {
                5.0
            } else {
                0.0
            };
        } else {
            self.burst *= 0.995;
        }

        let lag_hz = 0.5 + (1.0 - self.lag) * 40.0;
        let a = 1.0 - (-TAU * lag_hz / self.sample_rate).exp();
        self.smooth += a * (self.stepped - self.smooth);

        let noise = self.next_bipolar() * (0.5 + chaos) * 5.0;

        if let Some(o) = outputs.get_mut(0) {
            *o = self.stepped;
        }
        if let Some(o) = outputs.get_mut(1) {
            *o = self.smooth;
        }
        if let Some(o) = outputs.get_mut(2) {
            *o = self.burst;
        }
        if let Some(o) = outputs.get_mut(3) {
            *o = noise;
        }
    }

    fn reset(&mut self) {
        self.phase = 0.0;
        self.clock_prev = false;
        self.stepped = 0.0;
        self.smooth = 0.0;
        self.burst = 0.0;
    }
}
