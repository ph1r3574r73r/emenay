//! Compact stereo reverb (Schroeder-style comb + allpass network).

use emenay_engine::module::{Module, ModuleInfo, ParamDesc, PortDesc, PortId, SignalKind};
use emenay_engine::Voltage;

struct Comb {
    buf: Vec<f32>,
    w: usize,
    filter: f32,
}

impl Comb {
    fn new(len: usize) -> Self {
        Self {
            buf: vec![0.0; len.max(2)],
            w: 0,
            filter: 0.0,
        }
    }

    fn process(&mut self, x: f32, feedback: f32, damp: f32) -> f32 {
        let y = self.buf[self.w];
        self.filter += (y - self.filter) * damp;
        self.buf[self.w] = x + self.filter * feedback;
        self.w = (self.w + 1) % self.buf.len();
        y
    }

    fn resize(&mut self, len: usize) {
        let len = len.max(2);
        if self.buf.len() != len {
            self.buf = vec![0.0; len];
            self.w = 0;
            self.filter = 0.0;
        }
    }
}

struct Allpass {
    buf: Vec<f32>,
    w: usize,
}

impl Allpass {
    fn new(len: usize) -> Self {
        Self {
            buf: vec![0.0; len.max(2)],
            w: 0,
        }
    }

    fn process(&mut self, x: f32) -> f32 {
        let buf_out = self.buf[self.w];
        let y = -x + buf_out;
        self.buf[self.w] = x + buf_out * 0.5;
        self.w = (self.w + 1) % self.buf.len();
        y
    }

    fn resize(&mut self, len: usize) {
        let len = len.max(2);
        if self.buf.len() != len {
            self.buf = vec![0.0; len];
            self.w = 0;
        }
    }
}

pub struct Reverb {
    info: ModuleInfo,
    combs_l: [Comb; 4],
    combs_r: [Comb; 4],
    ap_l: [Allpass; 2],
    ap_r: [Allpass; 2],
    size: f32,
    decay: f32,
    damp: f32,
    mix: f32,
    sample_rate: f32,
    primed: bool,
}

impl Reverb {
    // Base comb/allpass lengths at 48k (Freeverb-ish ratios).
    const COMB_BASE: [usize; 4] = [1116, 1188, 1277, 1356];
    const AP_BASE: [usize; 2] = [556, 441];

    pub fn new() -> Self {
        Self {
            info: ModuleInfo {
                type_id: "reverb".into(),
                name: "Reverb".into(),
                hp: 8,
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
                        name: "size_cv".into(),
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
                        name: "size".into(),
                        min: 0.0,
                        max: 1.0,
                        default: 0.55,
                        unit: "".into(),
                    },
                    ParamDesc {
                        name: "decay".into(),
                        min: 0.0,
                        max: 0.97,
                        default: 0.75,
                        unit: "".into(),
                    },
                    ParamDesc {
                        name: "damp".into(),
                        min: 0.05,
                        max: 0.95,
                        default: 0.35,
                        unit: "".into(),
                    },
                    ParamDesc {
                        name: "mix".into(),
                        min: 0.0,
                        max: 1.0,
                        default: 0.3,
                        unit: "".into(),
                    },
                ],
            },
            combs_l: [
                Comb::new(1116),
                Comb::new(1188),
                Comb::new(1277),
                Comb::new(1356),
            ],
            combs_r: [
                Comb::new(1116 + 23),
                Comb::new(1188 + 23),
                Comb::new(1277 + 23),
                Comb::new(1356 + 23),
            ],
            ap_l: [Allpass::new(556), Allpass::new(441)],
            ap_r: [Allpass::new(556 + 17), Allpass::new(441 + 17)],
            size: 0.55,
            decay: 0.75,
            damp: 0.35,
            mix: 0.3,
            sample_rate: 48_000.0,
            primed: false,
        }
    }

    fn rebuild(&mut self) {
        let scale = (self.sample_rate / 48_000.0) * (0.55 + self.size * 0.9);
        for (i, c) in self.combs_l.iter_mut().enumerate() {
            c.resize(((Self::COMB_BASE[i] as f32) * scale) as usize);
        }
        for (i, c) in self.combs_r.iter_mut().enumerate() {
            c.resize((((Self::COMB_BASE[i] + 23) as f32) * scale) as usize);
        }
        for (i, a) in self.ap_l.iter_mut().enumerate() {
            a.resize(((Self::AP_BASE[i] as f32) * scale) as usize);
        }
        for (i, a) in self.ap_r.iter_mut().enumerate() {
            a.resize((((Self::AP_BASE[i] + 17) as f32) * scale) as usize);
        }
        self.primed = true;
    }
}

impl Default for Reverb {
    fn default() -> Self {
        Self::new()
    }
}

impl Module for Reverb {
    fn info(&self) -> &ModuleInfo {
        &self.info
    }

    fn set_sample_rate(&mut self, sample_rate: f32) {
        self.sample_rate = sample_rate.max(1.0);
        self.primed = false;
    }

    fn set_param(&mut self, name: &str, value: f32) {
        match name {
            "size" => {
                let v = value.clamp(0.0, 1.0);
                if (v - self.size).abs() > 0.02 {
                    self.size = v;
                    self.primed = false;
                } else {
                    self.size = v;
                }
            }
            "decay" => self.decay = value.clamp(0.0, 0.97),
            "damp" => self.damp = value.clamp(0.05, 0.95),
            "mix" => self.mix = value.clamp(0.0, 1.0),
            _ => {}
        }
    }

    fn get_param(&self, name: &str) -> Option<f32> {
        match name {
            "size" => Some(self.size),
            "decay" => Some(self.decay),
            "damp" => Some(self.damp),
            "mix" => Some(self.mix),
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
        if !self.primed {
            self.rebuild();
        }

        let l = inputs.first().copied().unwrap_or(0.0);
        let mut r = inputs.get(1).copied().unwrap_or(0.0);
        let r_patched = connected.get(1).copied().unwrap_or(false);
        if connected.is_empty() {
            if r.abs() < 1e-6 && l.abs() > 1e-6 {
                r = l;
            }
        } else if !r_patched {
            r = l;
        }
        let size_cv = inputs.get(2).copied().unwrap_or(0.0);
        // Light CV on decay/size without constant rebuilds.
        let decay = (self.decay + size_cv * 0.05).clamp(0.0, 0.97);
        let damp = self.damp;

        let xin_l = l * 0.15;
        let xin_r = r * 0.15;

        let mut sum_l = 0.0;
        let mut sum_r = 0.0;
        for c in &mut self.combs_l {
            sum_l += c.process(xin_l, decay, damp);
        }
        for c in &mut self.combs_r {
            sum_r += c.process(xin_r, decay, damp);
        }
        sum_l *= 0.25;
        sum_r *= 0.25;

        for a in &mut self.ap_l {
            sum_l = a.process(sum_l);
        }
        for a in &mut self.ap_r {
            sum_r = a.process(sum_r);
        }

        let wet_l = sum_l * 5.0;
        let wet_r = sum_r * 5.0;
        let out_l = l * (1.0 - self.mix) + wet_l * self.mix;
        let out_r = r * (1.0 - self.mix) + wet_r * self.mix;

        if let Some(o) = outputs.get_mut(0) {
            *o = out_l.clamp(-8.0, 8.0);
        }
        if let Some(o) = outputs.get_mut(1) {
            *o = out_r.clamp(-8.0, 8.0);
        }
    }

    fn reset(&mut self) {
        self.primed = false;
    }
}
