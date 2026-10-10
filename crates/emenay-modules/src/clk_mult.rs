//! Clock multiplier — derives ×1 / ×2 / ×4 / ×8 from an incoming clock.
//!
//! Patch Clock **clk1** (master tempo) into IN; use ×1 to fan out quarters,
//! ×2 for 8ths, ×4 for 16ths, etc. Opposite of Divider (/1 /2 /4 /8).

use emenay_engine::module::{
    Module, ModuleInfo, ModuleLights, ParamDesc, PortDesc, PortId, SignalKind,
};
use emenay_engine::Voltage;

const MULTS: [u32; 4] = [1, 2, 4, 8];

pub struct ClkMult {
    info: ModuleInfo,
    pw: f32,
    sample_rate: f32,
    prev_in: bool,
    samples_since: u32,
    period: u32,
    phase: f64,
    led: [f32; 4],
}

impl ClkMult {
    pub fn new() -> Self {
        Self {
            info: ModuleInfo {
                type_id: "clk_mult".into(),
                name: "Clk Mult".into(),
                hp: 4,
                inputs: vec![PortDesc {
                    name: "clock".into(),
                    kind: PortId::Input,
                    signal: SignalKind::Gate,
                }],
                outputs: MULTS
                    .iter()
                    .map(|m| PortDesc {
                        name: format!("x{m}"),
                        kind: PortId::Output,
                        signal: SignalKind::Gate,
                    })
                    .collect(),
                params: vec![ParamDesc {
                    name: "pw".into(),
                    min: 0.05,
                    max: 0.5,
                    default: 0.2,
                    unit: "".into(),
                }],
            },
            pw: 0.2,
            sample_rate: 48_000.0,
            prev_in: false,
            samples_since: 0,
            period: 24_000, // ~120bpm quarters @ 48k until first edge
            phase: 0.0,
            led: [0.0; 4],
        }
    }
}

impl Default for ClkMult {
    fn default() -> Self {
        Self::new()
    }
}

impl Module for ClkMult {
    fn info(&self) -> &ModuleInfo {
        &self.info
    }

    fn set_sample_rate(&mut self, sample_rate: f32) {
        self.sample_rate = sample_rate.max(1.0);
    }

    fn set_param(&mut self, name: &str, value: f32) {
        if name == "pw" {
            self.pw = value.clamp(0.05, 0.5);
        }
    }

    fn get_param(&self, name: &str) -> Option<f32> {
        if name == "pw" {
            Some(self.pw)
        } else {
            None
        }
    }

    fn process(&mut self, inputs: &[Voltage], outputs: &mut [Voltage]) {
        let high = inputs.first().copied().unwrap_or(0.0) > 1.0;
        let edge = high && !self.prev_in;
        self.prev_in = high;

        self.samples_since = self.samples_since.saturating_add(1);
        if edge {
            // Learn period between rising edges (quarter-note spacing if fed d1).
            if self.samples_since > 32 {
                self.period = self.samples_since.clamp(64, (self.sample_rate * 4.0) as u32);
            }
            self.samples_since = 0;
            self.phase = 0.0;
        }

        // Advance 0..1 across the learned period.
        self.phase += 1.0 / self.period.max(1) as f64;
        if self.phase >= 1.0 {
            self.phase -= 1.0;
        }

        for (i, m) in MULTS.iter().enumerate() {
            let cycle = (self.phase * *m as f64).fract();
            let gate = if cycle < self.pw as f64 { 5.0 } else { 0.0 };
            self.led[i] = if gate > 0.0 { 1.0 } else { 0.08 };
            if let Some(o) = outputs.get_mut(i) {
                *o = gate;
            }
        }
    }

    fn reset(&mut self) {
        self.prev_in = false;
        self.samples_since = 0;
        self.phase = 0.0;
        self.led = [0.0; 4];
    }

    fn lights(&self) -> ModuleLights {
        let mut l = ModuleLights::new();
        for (i, m) in MULTS.iter().enumerate() {
            l.set(format!("x{m}"), self.led[i]);
        }
        l
    }
}
