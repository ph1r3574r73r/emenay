//! Lots — random sampler (inspired by MI marbles; not a firmware port).
//!
//! t section: bernoulli / biased gates · X section: stepped / smooth random CV.

use emenay_engine::module::{
    Module, ModuleInfo, ModuleLights, ParamDesc, PortDesc, PortId, SignalKind,
};
use emenay_engine::Voltage;

pub struct Lots {
    info: ModuleInfo,
    rate: f32,
    bias: f32,
    jitter: f32,
    spread: f32,
    steps: f32,
    /// 0 = bernoulli, 1 = complementary branch, 2 = divider.
    t_mode: u32,
    /// 0 = independent, 1 = related+spread, 2 = locked.
    x_mode: u32,
    sample_rate: f32,
    phase: f32,
    clock_prev: bool,
    gate_t1: bool,
    gate_t2: bool,
    div_count: u32,
    gate_age: u32,
    x1: f32,
    x2: f32,
    x3: f32,
    x1_slew: f32,
    x2_slew: f32,
    x3_slew: f32,
    seed: u32,
    lit_t1: f32,
    lit_t2: f32,
    lit_t3: f32,
}

impl Lots {
    pub fn new() -> Self {
        Self {
            info: ModuleInfo {
                type_id: "lots".into(),
                name: "Lots".into(),
                hp: 12,
                inputs: vec![
                    PortDesc {
                        name: "clock".into(),
                        kind: PortId::Input,
                        signal: SignalKind::Gate,
                    },
                    PortDesc {
                        name: "rate_cv".into(),
                        kind: PortId::Input,
                        signal: SignalKind::Cv,
                    },
                    PortDesc {
                        name: "spread_cv".into(),
                        kind: PortId::Input,
                        signal: SignalKind::Cv,
                    },
                ],
                outputs: vec![
                    PortDesc {
                        name: "t1".into(),
                        kind: PortId::Output,
                        signal: SignalKind::Gate,
                    },
                    PortDesc {
                        name: "t2".into(),
                        kind: PortId::Output,
                        signal: SignalKind::Gate,
                    },
                    PortDesc {
                        name: "t3".into(),
                        kind: PortId::Output,
                        signal: SignalKind::Gate,
                    },
                    PortDesc {
                        name: "x1".into(),
                        kind: PortId::Output,
                        signal: SignalKind::Cv,
                    },
                    PortDesc {
                        name: "x2".into(),
                        kind: PortId::Output,
                        signal: SignalKind::Cv,
                    },
                    PortDesc {
                        name: "x3".into(),
                        kind: PortId::Output,
                        signal: SignalKind::Cv,
                    },
                ],
                params: vec![
                    ParamDesc {
                        name: "rate".into(),
                        min: 0.05,
                        max: 20.0,
                        default: 2.0,
                        unit: "Hz".into(),
                    },
                    ParamDesc {
                        name: "bias".into(),
                        min: 0.0,
                        max: 1.0,
                        default: 0.5,
                        unit: "".into(),
                    },
                    ParamDesc {
                        name: "jitter".into(),
                        min: 0.0,
                        max: 1.0,
                        default: 0.15,
                        unit: "".into(),
                    },
                    ParamDesc {
                        name: "spread".into(),
                        min: 0.0,
                        max: 1.0,
                        default: 0.5,
                        unit: "".into(),
                    },
                    ParamDesc {
                        name: "steps".into(),
                        min: 0.0,
                        max: 1.0,
                        default: 0.35,
                        unit: "".into(),
                    },
                    ParamDesc {
                        name: "t_mode".into(),
                        min: 0.0,
                        max: 2.0,
                        default: 0.0,
                        unit: "int".into(),
                    },
                    ParamDesc {
                        name: "x_mode".into(),
                        min: 0.0,
                        max: 2.0,
                        default: 0.0,
                        unit: "int".into(),
                    },
                ],
            },
            rate: 2.0,
            bias: 0.5,
            jitter: 0.15,
            spread: 0.5,
            steps: 0.35,
            t_mode: 0,
            x_mode: 0,
            sample_rate: 48_000.0,
            phase: 0.0,
            clock_prev: false,
            gate_t1: false,
            gate_t2: false,
            div_count: 0,
            gate_age: 0,
            x1: 0.0,
            x2: 1.0,
            x3: -0.5,
            x1_slew: 0.0,
            x2_slew: 0.0,
            x3_slew: 0.0,
            seed: 0x4B1E_5A17,
            lit_t1: 0.0,
            lit_t2: 0.0,
            lit_t3: 0.0,
        }
    }

    fn rand01(&mut self) -> f32 {
        self.seed = self.seed.wrapping_mul(1664525).wrapping_add(1013904223);
        self.seed as f32 / u32::MAX as f32
    }

    fn tick(&mut self) {
        let p = self.bias.clamp(0.05, 0.95);
        match self.t_mode {
            1 => {
                // Complementary branch: t1 OR t2, never both.
                let coin = self.rand01() < p;
                self.gate_t1 = coin;
                self.gate_t2 = !coin;
            }
            2 => {
                // Divider: t1 every tick, t2 every other.
                self.div_count = self.div_count.wrapping_add(1);
                self.gate_t1 = true;
                self.gate_t2 = self.div_count % 2 == 0;
            }
            _ => {
                // Bernoulli: independent biased coins.
                self.gate_t1 = self.rand01() < p;
                self.gate_t2 = self.rand01() < (1.0 - p * 0.7);
            }
        }
        self.gate_age = (self.sample_rate * 0.01) as u32;

        let span = 0.5 + self.spread * 4.5;
        let raw1 = (self.rand01() * 2.0 - 1.0) * span;
        let (raw2, raw3) = match self.x_mode {
            1 => {
                // Related: x2/x3 = x1 ± spread jitter.
                let j = span * 0.35;
                (raw1 + (self.rand01() * 2.0 - 1.0) * j, raw1 - (self.rand01() * 2.0 - 1.0) * j)
            }
            2 => (raw1, raw1), // Locked
            _ => (
                (self.rand01() * 2.0 - 1.0) * span,
                (self.rand01() * 2.0 - 1.0) * span,
            ),
        };
        if self.steps < 0.05 {
            self.x1 = raw1;
            self.x2 = raw2;
            self.x3 = raw3;
        } else {
            let n = 2.0 + (1.0 - self.steps) * 30.0;
            self.x1 = (raw1 * n).round() / n;
            self.x2 = (raw2 * n).round() / n;
            self.x3 = (raw3 * n).round() / n;
        }
    }
}

impl Default for Lots {
    fn default() -> Self {
        Self::new()
    }
}

impl Module for Lots {
    fn info(&self) -> &ModuleInfo {
        &self.info
    }

    fn set_sample_rate(&mut self, sample_rate: f32) {
        self.sample_rate = sample_rate.max(1.0);
    }

    fn set_param(&mut self, name: &str, value: f32) {
        match name {
            "rate" => self.rate = value.clamp(0.05, 20.0),
            "bias" => self.bias = value.clamp(0.0, 1.0),
            "jitter" => self.jitter = value.clamp(0.0, 1.0),
            "spread" => self.spread = value.clamp(0.0, 1.0),
            "steps" => self.steps = value.clamp(0.0, 1.0),
            "t_mode" => self.t_mode = value.clamp(0.0, 2.0).round() as u32,
            "x_mode" => self.x_mode = value.clamp(0.0, 2.0).round() as u32,
            _ => {}
        }
    }

    fn get_param(&self, name: &str) -> Option<f32> {
        match name {
            "rate" => Some(self.rate),
            "bias" => Some(self.bias),
            "jitter" => Some(self.jitter),
            "spread" => Some(self.spread),
            "steps" => Some(self.steps),
            "t_mode" => Some(self.t_mode as f32),
            "x_mode" => Some(self.x_mode as f32),
            _ => None,
        }
    }

    fn process(&mut self, inputs: &[Voltage], outputs: &mut [Voltage]) {
        let ext_clock = inputs.first().copied().unwrap_or(0.0) > 1.0;
        let rate_cv = inputs.get(1).copied().unwrap_or(0.0);
        let spread_cv = inputs.get(2).copied().unwrap_or(0.0);
        let spread = (self.spread + spread_cv * 0.1).clamp(0.0, 1.0);
        // Temporarily apply CV spread for this tick path.
        let saved_spread = self.spread;
        self.spread = spread;

        let mut do_tick = false;
        if ext_clock && !self.clock_prev {
            do_tick = true;
        } else if !ext_clock {
            let hz = (self.rate * 2f32.powf(rate_cv * 0.4)).clamp(0.02, 40.0);
            let jitter_scale = 1.0 + (self.rand01() - 0.5) * self.jitter * 0.8;
            self.phase += (hz * jitter_scale) / self.sample_rate;
            if self.phase >= 1.0 {
                self.phase -= 1.0;
                do_tick = true;
            }
        }
        self.clock_prev = ext_clock;

        if do_tick {
            self.tick();
        }
        self.spread = saved_spread;

        if self.gate_age > 0 {
            self.gate_age -= 1;
        }

        // Smooth X slightly unless steps is high (more stepped).
        let slew_hz = 2.0 + (1.0 - self.steps) * 80.0;
        let a = 1.0 - (-2.0 * std::f32::consts::PI * slew_hz / self.sample_rate).exp();
        self.x1_slew += (self.x1 - self.x1_slew) * a;
        self.x2_slew += (self.x2 - self.x2_slew) * a;
        self.x3_slew += (self.x3 - self.x3_slew) * a;

        let t_pulse = self.gate_age > 0 || ext_clock;
        let t1 = if self.gate_t1 && t_pulse { 5.0 } else { 0.0 };
        let t2 = if self.gate_t2 && t_pulse { 5.0 } else { 0.0 };
        let t3 = if (self.gate_t1 || self.gate_t2) && t_pulse {
            5.0
        } else {
            0.0
        };

        self.lit_t1 = if t1 > 0.0 { 1.0 } else { (self.lit_t1 - 0.002).max(0.0) };
        self.lit_t2 = if t2 > 0.0 { 1.0 } else { (self.lit_t2 - 0.002).max(0.0) };
        self.lit_t3 = if t3 > 0.0 { 1.0 } else { (self.lit_t3 - 0.002).max(0.0) };

        if let Some(o) = outputs.get_mut(0) {
            *o = t1;
        }
        if let Some(o) = outputs.get_mut(1) {
            *o = t2;
        }
        if let Some(o) = outputs.get_mut(2) {
            *o = t3;
        }
        if let Some(o) = outputs.get_mut(3) {
            *o = self.x1_slew;
        }
        if let Some(o) = outputs.get_mut(4) {
            *o = self.x2_slew;
        }
        if let Some(o) = outputs.get_mut(5) {
            *o = self.x3_slew;
        }
    }

    fn reset(&mut self) {
        self.phase = 0.0;
        self.clock_prev = false;
        self.gate_t1 = false;
        self.gate_t2 = false;
        self.gate_age = 0;
        self.lit_t1 = 0.0;
        self.lit_t2 = 0.0;
        self.lit_t3 = 0.0;
    }

    fn lights(&self) -> ModuleLights {
        let mut l = ModuleLights::new();
        l.set("t1", self.lit_t1);
        l.set("t2", self.lit_t2);
        l.set("t3", self.lit_t3);
        l
    }
}
