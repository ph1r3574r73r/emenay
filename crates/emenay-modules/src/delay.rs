//! Analog-flavored delay with feedback, mix, and optional ping-pong.

use emenay_engine::module::{Module, ModuleInfo, ParamDesc, PortDesc, PortId, SignalKind};
use emenay_engine::Voltage;

const MAX_SEC: f32 = 2.0;
const MAX_CAP: usize = 96_000;

pub struct Delay {
    info: ModuleInfo,
    buf_l: Vec<f32>,
    buf_r: Vec<f32>,
    w: usize,
    time_s: f32,
    feedback: f32,
    mix: f32,
    pingpong: bool,
    sample_rate: f32,
    lp: f32,
}

impl Delay {
    pub fn new() -> Self {
        Self {
            info: ModuleInfo {
                type_id: "delay".into(),
                name: "Delay".into(),
                hp: 8,
                inputs: vec![
                    PortDesc {
                        name: "in".into(),
                        kind: PortId::Input,
                        signal: SignalKind::Audio,
                    },
                    PortDesc {
                        name: "time_cv".into(),
                        kind: PortId::Input,
                        signal: SignalKind::Cv,
                    },
                    PortDesc {
                        name: "fb_cv".into(),
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
                    PortDesc {
                        name: "mix".into(),
                        kind: PortId::Output,
                        signal: SignalKind::Audio,
                    },
                ],
                params: vec![
                    ParamDesc {
                        name: "time".into(),
                        min: 0.01,
                        max: MAX_SEC,
                        default: 0.35,
                        unit: "s".into(),
                    },
                    ParamDesc {
                        name: "feedback".into(),
                        min: 0.0,
                        max: 0.95,
                        default: 0.45,
                        unit: "".into(),
                    },
                    ParamDesc {
                        name: "mix".into(),
                        min: 0.0,
                        max: 1.0,
                        default: 0.35,
                        unit: "".into(),
                    },
                    ParamDesc {
                        name: "pingpong".into(),
                        min: 0.0,
                        max: 1.0,
                        default: 0.0,
                        unit: "bool".into(),
                    },
                ],
            },
            buf_l: vec![0.0; MAX_CAP],
            buf_r: vec![0.0; MAX_CAP],
            w: 0,
            time_s: 0.35,
            feedback: 0.45,
            mix: 0.35,
            pingpong: false,
            sample_rate: 48_000.0,
            lp: 0.0,
        }
    }

    fn cap(&self) -> usize {
        ((self.sample_rate * MAX_SEC) as usize).clamp(1024, MAX_CAP)
    }

    fn read(buf: &[f32], w: usize, delay_samp: f32, cap: usize) -> f32 {
        let d = delay_samp.clamp(1.0, (cap - 2) as f32);
        let r = w as f32 - d;
        let r0 = ((r.floor() as i32).rem_euclid(cap as i32)) as usize;
        let r1 = (r0 + 1) % cap;
        let frac = r.fract();
        buf[r0] + (buf[r1] - buf[r0]) * frac
    }
}

impl Default for Delay {
    fn default() -> Self {
        Self::new()
    }
}

impl Module for Delay {
    fn info(&self) -> &ModuleInfo {
        &self.info
    }

    fn set_sample_rate(&mut self, sample_rate: f32) {
        self.sample_rate = sample_rate.max(1.0);
        let cap = self.cap();
        if self.buf_l.len() != cap {
            self.buf_l.resize(cap, 0.0);
            self.buf_r.resize(cap, 0.0);
            self.w = 0;
        }
    }

    fn set_param(&mut self, name: &str, value: f32) {
        match name {
            "time" => self.time_s = value.clamp(0.01, MAX_SEC),
            "feedback" => self.feedback = value.clamp(0.0, 0.95),
            "mix" => self.mix = value.clamp(0.0, 1.0),
            "pingpong" => self.pingpong = value >= 0.5,
            _ => {}
        }
    }

    fn get_param(&self, name: &str) -> Option<f32> {
        match name {
            "time" => Some(self.time_s),
            "feedback" => Some(self.feedback),
            "mix" => Some(self.mix),
            "pingpong" => Some(if self.pingpong { 1.0 } else { 0.0 }),
            _ => None,
        }
    }

    fn process(&mut self, inputs: &[Voltage], outputs: &mut [Voltage]) {
        let x = inputs.first().copied().unwrap_or(0.0);
        let time_cv = inputs.get(1).copied().unwrap_or(0.0);
        let fb_cv = inputs.get(2).copied().unwrap_or(0.0);
        let cap = self.cap();

        let time = (self.time_s * (2.0_f32).powf(time_cv * 0.2)).clamp(0.01, MAX_SEC);
        let fb = (self.feedback + fb_cv * 0.1).clamp(0.0, 0.95);
        let delay_samp = time * self.sample_rate;

        let wet_l = Self::read(&self.buf_l, self.w, delay_samp, cap);
        let wet_r = Self::read(&self.buf_r, self.w, delay_samp, cap);

        // Mild loft damping in the feedback path.
        let fb_src = if self.pingpong { wet_r } else { wet_l };
        self.lp += (fb_src - self.lp) * 0.18;
        let damped = self.lp;

        let write_l = (x * 0.2 + damped * fb).clamp(-1.2, 1.2);
        let write_r = if self.pingpong {
            (wet_l * fb).clamp(-1.2, 1.2)
        } else {
            write_l
        };

        self.buf_l[self.w] = write_l;
        self.buf_r[self.w] = write_r;
        self.w = (self.w + 1) % cap;

        let dry = x;
        let wl = wet_l * 5.0;
        let wr = wet_r * 5.0;
        let out_l = dry * (1.0 - self.mix) + wl * self.mix;
        let out_r = dry * (1.0 - self.mix) + wr * self.mix;

        if let Some(o) = outputs.get_mut(0) {
            *o = out_l;
        }
        if let Some(o) = outputs.get_mut(1) {
            *o = out_r;
        }
        if let Some(o) = outputs.get_mut(2) {
            *o = 0.5 * (out_l + out_r);
        }
    }

    fn reset(&mut self) {
        self.buf_l.fill(0.0);
        self.buf_r.fill(0.0);
        self.w = 0;
        self.lp = 0.0;
    }
}
