//! Simple sample recorder / player — record from IN, trigger playback with pitch & loop.

use emenay_engine::module::{
    Module, ModuleInfo, ModuleLights, ParamDesc, PortDesc, PortId, SignalKind,
};
use emenay_engine::Voltage;

const MAX_SECONDS: f32 = 2.0;
const MAX_CAP: usize = 96_000; // 2s @ 48k

pub struct Sampler {
    info: ModuleInfo,
    buffer: Vec<f32>,
    write_pos: usize,
    length: usize,
    play_pos: f32,
    playing: bool,
    recording: bool,
    start: f32,
    end: f32,
    pitch: f32,
    level: f32,
    loop_on: bool,
    sample_rate: f32,
    rec_prev: bool,
    trig_prev: bool,
    has_sample: bool,
}

impl Sampler {
    pub fn new() -> Self {
        Self {
            info: ModuleInfo {
                type_id: "sampler".into(),
                name: "Sampler".into(),
                hp: 12,
                inputs: vec![
                    PortDesc {
                        name: "in".into(),
                        kind: PortId::Input,
                        signal: SignalKind::Audio,
                    },
                    PortDesc {
                        name: "trig".into(),
                        kind: PortId::Input,
                        signal: SignalKind::Gate,
                    },
                    PortDesc {
                        name: "rec".into(),
                        kind: PortId::Input,
                        signal: SignalKind::Gate,
                    },
                    PortDesc {
                        name: "v_oct".into(),
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
                        name: "eoc".into(),
                        kind: PortId::Output,
                        signal: SignalKind::Gate,
                    },
                    PortDesc {
                        name: "busy".into(),
                        kind: PortId::Output,
                        signal: SignalKind::Gate,
                    },
                ],
                params: vec![
                    ParamDesc {
                        name: "start".into(),
                        min: 0.0,
                        max: 1.0,
                        default: 0.0,
                        unit: "".into(),
                    },
                    ParamDesc {
                        name: "length".into(),
                        min: 0.02,
                        max: 1.0,
                        default: 1.0,
                        unit: "".into(),
                    },
                    ParamDesc {
                        name: "pitch".into(),
                        min: -2.0,
                        max: 2.0,
                        default: 0.0,
                        unit: "V".into(),
                    },
                    ParamDesc {
                        name: "level".into(),
                        min: 0.0,
                        max: 1.0,
                        default: 0.85,
                        unit: "".into(),
                    },
                    ParamDesc {
                        name: "loop".into(),
                        min: 0.0,
                        max: 1.0,
                        default: 0.0,
                        unit: "bool".into(),
                    },
                ],
            },
            buffer: vec![0.0; MAX_CAP],
            write_pos: 0,
            length: 0,
            play_pos: 0.0,
            playing: false,
            recording: false,
            start: 0.0,
            end: 1.0,
            pitch: 0.0,
            level: 0.85,
            loop_on: false,
            sample_rate: 48_000.0,
            rec_prev: false,
            trig_prev: false,
            has_sample: false,
        }
    }

    fn capacity(&self) -> usize {
        ((self.sample_rate * MAX_SECONDS) as usize).clamp(1024, MAX_CAP)
    }

    fn ensure_demo_hit(&mut self) {
        if self.has_sample {
            return;
        }
        // Short decaying click so the module is usable before first record.
        let n = (self.sample_rate * 0.08) as usize;
        let n = n.min(self.capacity());
        for i in 0..n {
            let t = i as f32 / self.sample_rate;
            let env = (-t * 40.0).exp();
            let click = (t * 420.0 * std::f32::consts::TAU).sin() * env;
            self.buffer[i] = click * 0.7;
        }
        self.length = n;
        self.has_sample = true;
    }

    fn play_range(&self) -> (usize, usize) {
        let len = self.length.max(1);
        let s = (self.start * len as f32) as usize;
        let span = ((self.end - self.start).max(0.02) * len as f32) as usize;
        let e = (s + span).min(len);
        (s.min(len.saturating_sub(1)), e.max(s + 1))
    }
}

impl Default for Sampler {
    fn default() -> Self {
        Self::new()
    }
}

impl Module for Sampler {
    fn info(&self) -> &ModuleInfo {
        &self.info
    }

    fn set_sample_rate(&mut self, sample_rate: f32) {
        self.sample_rate = sample_rate.max(1.0);
        let cap = self.capacity();
        if self.buffer.len() != cap {
            self.buffer.resize(cap, 0.0);
            self.length = self.length.min(cap);
            self.write_pos = self.write_pos.min(cap.saturating_sub(1));
        }
    }

    fn set_param(&mut self, name: &str, value: f32) {
        match name {
            "start" => {
                self.start = value.clamp(0.0, 0.98);
                if self.end <= self.start + 0.02 {
                    self.end = (self.start + 0.02).min(1.0);
                }
            }
            "length" => {
                let span = value.clamp(0.02, 1.0);
                self.end = (self.start + span).min(1.0);
            }
            "pitch" => self.pitch = value.clamp(-2.0, 2.0),
            "level" => self.level = value.clamp(0.0, 1.0),
            "loop" => self.loop_on = value >= 0.5,
            _ => {}
        }
    }

    fn get_param(&self, name: &str) -> Option<f32> {
        match name {
            "start" => Some(self.start),
            "length" => Some((self.end - self.start).clamp(0.02, 1.0)),
            "pitch" => Some(self.pitch),
            "level" => Some(self.level),
            "loop" => Some(if self.loop_on { 1.0 } else { 0.0 }),
            _ => None,
        }
    }

    fn process(&mut self, inputs: &[Voltage], outputs: &mut [Voltage]) {
        let audio_in = inputs.first().copied().unwrap_or(0.0);
        let trig = inputs.get(1).copied().unwrap_or(0.0) > 1.0;
        let rec = inputs.get(2).copied().unwrap_or(0.0) > 1.0;
        let v_oct = inputs.get(3).copied().unwrap_or(0.0);

        let trig_edge = trig && !self.trig_prev;
        self.trig_prev = trig;
        let rec_edge = rec && !self.rec_prev;
        let rec_release = !rec && self.rec_prev;
        self.rec_prev = rec;

        if rec_edge {
            self.recording = true;
            self.write_pos = 0;
            self.length = 0;
            self.playing = false;
            self.has_sample = false;
        }
        if self.recording {
            let cap = self.capacity();
            if self.write_pos < cap {
                self.buffer[self.write_pos] = (audio_in / 5.0).clamp(-1.0, 1.0);
                self.write_pos += 1;
                self.length = self.write_pos;
            }
            if rec_release || self.write_pos >= cap {
                self.recording = false;
                self.has_sample = self.length > 32;
            }
        }

        if trig_edge && !self.recording {
            self.ensure_demo_hit();
            let (s, _) = self.play_range();
            self.play_pos = s as f32;
            self.playing = true;
        }

        let mut out = 0.0;
        let mut eoc = 0.0;
        if self.playing && self.has_sample && !self.recording {
            let (s, e) = self.play_range();
            let rate = (2.0_f32).powf(self.pitch + v_oct);
            let i0 = self.play_pos.floor() as usize;
            let frac = self.play_pos.fract();
            let i1 = (i0 + 1).min(e.saturating_sub(1));
            let a = self.buffer.get(i0).copied().unwrap_or(0.0);
            let b = self.buffer.get(i1).copied().unwrap_or(0.0);
            out = (a + (b - a) * frac) * self.level * 5.0;

            self.play_pos += rate;
            if self.play_pos >= e as f32 {
                if self.loop_on {
                    self.play_pos = s as f32;
                } else {
                    self.playing = false;
                    self.play_pos = s as f32;
                    eoc = 5.0;
                }
            }
        }

        if let Some(o) = outputs.get_mut(0) {
            *o = out;
        }
        if let Some(o) = outputs.get_mut(1) {
            *o = eoc;
        }
        if let Some(o) = outputs.get_mut(2) {
            *o = if self.recording || self.playing {
                5.0
            } else {
                0.0
            };
        }
    }

    fn reset(&mut self) {
        self.playing = false;
        self.recording = false;
        self.play_pos = 0.0;
        self.rec_prev = false;
        self.trig_prev = false;
    }

    fn lights(&self) -> ModuleLights {
        let mut l = ModuleLights::new();
        l.set("rec", if self.recording { 1.0 } else { 0.0 });
        l.set("play", if self.playing { 1.0 } else { 0.0 });
        l.set(
            "sample",
            if self.has_sample {
                0.55
            } else {
                0.08
            },
        );
        let (s, e) = self.play_range();
        let span = (e - s).max(1) as f32;
        let pos = if self.playing {
            ((self.play_pos - s as f32) / span).clamp(0.0, 1.0)
        } else {
            0.0
        };
        l.set("pos", pos);
        l
    }
}
