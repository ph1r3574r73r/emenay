//! Lightweight Twin stand-in when Peaks firmware is not linked.

use emenay_engine::module::{
    Module, ModuleInfo, ModuleLights, ParamDesc, PortDesc, PortId, SignalKind,
};
use emenay_engine::Voltage;

struct Voice {
    env: f32,
    phase: f32,
    freq: f32,
    noise: u32,
}

impl Voice {
    fn new() -> Self {
        Self {
            env: 0.0,
            phase: 0.0,
            freq: 80.0,
            noise: 0xACE1,
        }
    }
}

pub struct Twin {
    info: ModuleInfo,
    mode_a: f32,
    mode_b: f32,
    p1: f32,
    p2: f32,
    p3: f32,
    p4: f32,
    split: f32,
    level: f32,
    sample_rate: f32,
    a: Voice,
    b: Voice,
    trig_prev: [bool; 2],
    led_a: f32,
    led_b: f32,
}

impl Twin {
    pub fn new() -> Self {
        Self {
            info: ModuleInfo {
                type_id: "twin".into(),
                name: "Twin".into(),
                hp: 8,
                inputs: vec![
                    PortDesc {
                        name: "trig_a".into(),
                        kind: PortId::Input,
                        signal: SignalKind::Gate,
                    },
                    PortDesc {
                        name: "trig_b".into(),
                        kind: PortId::Input,
                        signal: SignalKind::Gate,
                    },
                ],
                outputs: vec![
                    PortDesc {
                        name: "out_a".into(),
                        kind: PortId::Output,
                        signal: SignalKind::Audio,
                    },
                    PortDesc {
                        name: "out_b".into(),
                        kind: PortId::Output,
                        signal: SignalKind::Audio,
                    },
                    PortDesc {
                        name: "mix".into(),
                        kind: PortId::Output,
                        signal: SignalKind::Audio,
                    },
                ],
                params: vec![
                    ParamDesc {
                        name: "mode_a".into(),
                        min: 0.0,
                        max: 11.0,
                        default: 3.0,
                        unit: "int".into(),
                    },
                    ParamDesc {
                        name: "mode_b".into(),
                        min: 0.0,
                        max: 11.0,
                        default: 4.0,
                        unit: "int".into(),
                    },
                    ParamDesc {
                        name: "p1".into(),
                        min: 0.0,
                        max: 1.0,
                        default: 0.45,
                        unit: "".into(),
                    },
                    ParamDesc {
                        name: "p2".into(),
                        min: 0.0,
                        max: 1.0,
                        default: 0.55,
                        unit: "".into(),
                    },
                    ParamDesc {
                        name: "p3".into(),
                        min: 0.0,
                        max: 1.0,
                        default: 0.5,
                        unit: "".into(),
                    },
                    ParamDesc {
                        name: "p4".into(),
                        min: 0.0,
                        max: 1.0,
                        default: 0.45,
                        unit: "".into(),
                    },
                    ParamDesc {
                        name: "split".into(),
                        min: 0.0,
                        max: 1.0,
                        default: 1.0,
                        unit: "bool".into(),
                    },
                    ParamDesc {
                        name: "level".into(),
                        min: 0.0,
                        max: 1.0,
                        default: 0.9,
                        unit: "".into(),
                    },
                ],
            },
            mode_a: 3.0,
            mode_b: 4.0,
            p1: 0.45,
            p2: 0.55,
            p3: 0.5,
            p4: 0.45,
            split: 1.0,
            level: 0.9,
            sample_rate: 48_000.0,
            a: Voice::new(),
            b: Voice::new(),
            trig_prev: [false; 2],
            led_a: 0.0,
            led_b: 0.0,
        }
    }

    fn render(
        &self,
        v: &mut Voice,
        mode: u32,
        p_lo: f32,
        p_hi: f32,
        edge: bool,
        dt: f32,
    ) -> f32 {
        let decay = 0.002 + (1.0 - p_hi) * 0.04;
        if edge {
            v.env = 1.0;
            v.phase = 0.0;
            v.freq = match mode {
                3 => 40.0 + p_lo * 80.0,   // BD
                4 => 160.0 + p_lo * 200.0, // SD
                5 => 0.0,                  // HH noise
                6 => 80.0 + p_lo * 400.0,  // FM-ish
                _ => 2.0 + p_lo * 20.0,    // LFO/env-ish
            };
        }
        v.env *= (-dt / decay).exp();
        if v.env < 1e-4 {
            v.env = 0.0;
            return 0.0;
        }
        match mode {
            3 | 6 => {
                v.phase = (v.phase + v.freq * dt) % 1.0;
                let pitch_env = v.env * p_hi * 2.0;
                let ph = (v.phase + pitch_env * 0.02) % 1.0;
                (ph * std::f32::consts::TAU).sin() * v.env * 4.0
            }
            4 | 5 => {
                v.noise = v.noise.wrapping_mul(1664525).wrapping_add(1013904223);
                let n = (v.noise >> 16) as f32 / 32768.0 - 1.0;
                if mode == 4 {
                    v.phase = (v.phase + v.freq * dt) % 1.0;
                    let body = (v.phase * std::f32::consts::TAU).sin() * v.env * 0.6;
                    body + n * v.env * (0.3 + p_lo * 0.5) * 3.0
                } else {
                    n * v.env * 3.5
                }
            }
            _ => {
                // Crude AD / LFO-ish CV
                v.phase = (v.phase + (0.5 + p_lo * 8.0) * dt) % 1.0;
                let shape = if v.phase < p_hi { v.phase / p_hi.max(0.01) } else { 0.0 };
                shape * 5.0 * if mode <= 2 { 1.0 } else { v.env }
            }
        }
    }
}

impl Default for Twin {
    fn default() -> Self {
        Self::new()
    }
}

impl Module for Twin {
    fn info(&self) -> &ModuleInfo {
        &self.info
    }

    fn set_sample_rate(&mut self, sample_rate: f32) {
        self.sample_rate = sample_rate.max(1.0);
    }

    fn set_param(&mut self, name: &str, value: f32) {
        match name {
            "mode_a" => self.mode_a = value.clamp(0.0, 11.0).round(),
            "mode_b" => self.mode_b = value.clamp(0.0, 11.0).round(),
            "p1" => self.p1 = value.clamp(0.0, 1.0),
            "p2" => self.p2 = value.clamp(0.0, 1.0),
            "p3" => self.p3 = value.clamp(0.0, 1.0),
            "p4" => self.p4 = value.clamp(0.0, 1.0),
            "split" => self.split = if value >= 0.5 { 1.0 } else { 0.0 },
            "level" => self.level = value.clamp(0.0, 1.0),
            _ => {}
        }
    }

    fn get_param(&self, name: &str) -> Option<f32> {
        match name {
            "mode_a" => Some(self.mode_a),
            "mode_b" => Some(self.mode_b),
            "p1" => Some(self.p1),
            "p2" => Some(self.p2),
            "p3" => Some(self.p3),
            "p4" => Some(self.p4),
            "split" => Some(self.split),
            "level" => Some(self.level),
            _ => None,
        }
    }

    fn process(&mut self, inputs: &[Voltage], outputs: &mut [Voltage]) {
        let trig_a = inputs.first().copied().unwrap_or(0.0) > 1.0;
        let trig_b = inputs.get(1).copied().unwrap_or(0.0) > 1.0;
        let edge_a = trig_a && !self.trig_prev[0];
        let edge_b = trig_b && !self.trig_prev[1];
        self.trig_prev = [trig_a, trig_b];
        let dt = 1.0 / self.sample_rate;
        let split = self.split >= 0.5;
        let (a_lo, a_hi, b_lo, b_hi) = if split {
            (self.p1, self.p2, self.p3, self.p4)
        } else {
            (self.p1, self.p2, self.p1, self.p2)
        };
        let oa = self.render(
            &mut self.a,
            self.mode_a as u32,
            a_lo,
            a_hi,
            edge_a,
            dt,
        ) * self.level;
        let ob = self.render(
            &mut self.b,
            self.mode_b as u32,
            b_lo,
            b_hi,
            edge_b,
            dt,
        ) * self.level;
        self.led_a = oa.abs().clamp(0.0, 1.0);
        self.led_b = ob.abs().clamp(0.0, 1.0);
        if let Some(o) = outputs.get_mut(0) {
            *o = oa;
        }
        if let Some(o) = outputs.get_mut(1) {
            *o = ob;
        }
        if let Some(o) = outputs.get_mut(2) {
            *o = (oa + ob) * 0.5;
        }
    }

    fn lights(&self) -> ModuleLights {
        let mut l = ModuleLights::new();
        l.set("mode_a", self.mode_a);
        l.set("mode_b", self.mode_b);
        l.set("a", self.led_a);
        l.set("b", self.led_b);
        l
    }
}
