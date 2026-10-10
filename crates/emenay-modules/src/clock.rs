//! Free Modular–style multi-output master clock / gate generator.
//!
//! Every output is the **same** master tempo clock, phase-aligned and in sync.
//! Use Divider (/2 /4 /8) or Clk Mult (×2 ×4 ×8) for related rates.

use emenay_engine::module::{
    Module, ModuleInfo, ModuleLights, ParamDesc, PortDesc, PortId, SignalKind,
};
use emenay_engine::Voltage;

const OUTS: usize = 8;

pub struct Clock {
    info: ModuleInfo,
    /// Continuous beat phase (increments by 1.0 each beat).
    beats: f64,
    bpm: f32,
    pw: f32,
    sample_rate: f32,
    led: f32,
}

impl Clock {
    pub fn new() -> Self {
        Self {
            info: ModuleInfo {
                type_id: "fm_clock".into(),
                name: "Clock".into(),
                hp: 8,
                inputs: vec![],
                outputs: (1..=OUTS)
                    .map(|i| PortDesc {
                        name: format!("clk{i}"),
                        kind: PortId::Output,
                        signal: SignalKind::Gate,
                    })
                    .collect(),
                params: vec![
                    ParamDesc {
                        name: "bpm".into(),
                        min: 30.0,
                        max: 240.0,
                        default: 120.0,
                        unit: "int".into(),
                    },
                    ParamDesc {
                        name: "pw".into(),
                        min: 0.05,
                        max: 0.9,
                        default: 0.2,
                        unit: "".into(),
                    },
                ],
            },
            beats: 0.0,
            bpm: 120.0,
            pw: 0.2,
            sample_rate: 48_000.0,
            led: 0.0,
        }
    }
}

impl Default for Clock {
    fn default() -> Self {
        Self::new()
    }
}

impl Module for Clock {
    fn info(&self) -> &ModuleInfo {
        &self.info
    }

    fn set_sample_rate(&mut self, sample_rate: f32) {
        self.sample_rate = sample_rate.max(1.0);
    }

    fn set_param(&mut self, name: &str, value: f32) {
        match name {
            "bpm" => self.bpm = value.clamp(30.0, 240.0).round(),
            "pw" => self.pw = value.clamp(0.05, 0.9),
            _ => {}
        }
    }

    fn get_param(&self, name: &str) -> Option<f32> {
        match name {
            "bpm" => Some(self.bpm),
            "pw" => Some(self.pw),
            _ => None,
        }
    }

    fn process(&mut self, _inputs: &[Voltage], outputs: &mut [Voltage]) {
        let hz = self.bpm as f64 / 60.0;
        self.beats += hz / self.sample_rate as f64;

        let frac = self.beats.fract();
        let high = frac < self.pw as f64;
        let gate = if high { 5.0 } else { 0.0 };
        self.led = if high { 1.0 } else { 0.08 };

        // Identical gate on every jack — same sample, same phase.
        for o in outputs.iter_mut().take(OUTS) {
            *o = gate;
        }
    }

    fn reset(&mut self) {
        self.beats = 0.0;
        self.led = 0.0;
    }

    fn lights(&self) -> ModuleLights {
        let mut l = ModuleLights::new();
        for i in 1..=OUTS {
            l.set(format!("clk{i}"), self.led);
        }
        l.set("bpm", self.bpm);
        l
    }
}
