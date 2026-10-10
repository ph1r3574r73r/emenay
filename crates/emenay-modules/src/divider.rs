//! Clock divider — opposite of Clk Mult: ÷1 / ÷2 / ÷4 / ÷8 from an incoming clock.
//!
//! On the first beat (and every common multiple), all outputs that land there
//! fire together. ÷1 mirrors the input; ÷2 / ÷4 / ÷8 are integer divisions.

use emenay_engine::module::{
    Module, ModuleInfo, ModuleLights, ParamDesc, PortDesc, PortId, SignalKind,
};
use emenay_engine::Voltage;

const DIVS: [u32; 4] = [1, 2, 4, 8];

pub struct Divider {
    info: ModuleInfo,
    pw: f32,
    clock_prev: bool,
    reset_prev: bool,
    count: u32,
    led: [f32; 4],
}

impl Divider {
    pub fn new() -> Self {
        Self {
            info: ModuleInfo {
                type_id: "divider".into(),
                name: "Divider".into(),
                hp: 4,
                inputs: vec![
                    PortDesc {
                        name: "clock".into(),
                        kind: PortId::Input,
                        signal: SignalKind::Gate,
                    },
                    PortDesc {
                        name: "reset".into(),
                        kind: PortId::Input,
                        signal: SignalKind::Gate,
                    },
                ],
                outputs: DIVS
                    .iter()
                    .map(|d| PortDesc {
                        name: format!("d{d}"),
                        kind: PortId::Output,
                        signal: SignalKind::Gate,
                    })
                    .collect(),
                params: vec![ParamDesc {
                    name: "pw".into(),
                    min: 0.1,
                    max: 0.9,
                    default: 0.5,
                    unit: "".into(),
                }],
            },
            pw: 0.5,
            clock_prev: false,
            reset_prev: false,
            count: 0,
            led: [0.0; 4],
        }
    }
}

impl Default for Divider {
    fn default() -> Self {
        Self::new()
    }
}

impl Module for Divider {
    fn info(&self) -> &ModuleInfo {
        &self.info
    }

    fn set_sample_rate(&mut self, _sample_rate: f32) {}

    fn set_param(&mut self, name: &str, value: f32) {
        if name == "pw" {
            self.pw = value.clamp(0.1, 0.9);
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
        let clock = inputs.first().copied().unwrap_or(0.0) > 1.0;
        let reset = inputs.get(1).copied().unwrap_or(0.0) > 1.0;

        if reset && !self.reset_prev {
            self.count = 0;
        }
        self.reset_prev = reset;

        if clock && !self.clock_prev {
            self.count = self.count.wrapping_add(1);
        }
        self.clock_prev = clock;

        for (i, div) in DIVS.iter().enumerate() {
            let gate = if *div == 1 {
                // ÷1 mirrors the input gate (count%1 is always 0).
                if clock { 5.0 } else { 0.0 }
            } else {
                // Musical divider: high for `pw` fraction of each division cycle.
                let phase = self.count % *div;
                let high_ticks = ((*div as f32) * self.pw).max(1.0).ceil() as u32;
                let high_ticks = high_ticks.min(*div);
                if phase < high_ticks { 5.0 } else { 0.0 }
            };
            self.led[i] = if gate > 0.0 { 1.0 } else { 0.08 };
            if let Some(o) = outputs.get_mut(i) {
                *o = gate;
            }
        }
    }

    fn reset(&mut self) {
        self.count = 0;
        self.clock_prev = false;
        self.reset_prev = false;
        self.led = [0.0; 4];
    }

    fn lights(&self) -> ModuleLights {
        let mut l = ModuleLights::new();
        for (i, div) in DIVS.iter().enumerate() {
            l.set(format!("d{div}"), self.led[i]);
        }
        l
    }
}
