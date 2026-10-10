//! Analog-ish drum voice bank — kick, snare, closed/open hat, clap, tom.
//!
//! Individual trigger inputs + mix out (and per-voice outs for the main three).

use emenay_engine::module::{
    Module, ModuleInfo, ModuleLights, ParamDesc, PortDesc, PortId, SignalKind,
};
use emenay_engine::Voltage;

struct Voice {
    env: f32,
    phase: f32,
    freq: f32,
    /// Secondary state (noise filter, clap delay, etc.).
    aux: f32,
    aux2: f32,
    active: bool,
}

impl Voice {
    fn new() -> Self {
        Self {
            env: 0.0,
            phase: 0.0,
            freq: 0.0,
            aux: 0.0,
            aux2: 0.0,
            active: false,
        }
    }
}

pub struct Drums {
    info: ModuleInfo,
    kick: Voice,
    snare: Voice,
    ch: Voice,
    oh: Voice,
    clap: Voice,
    tom: Voice,
    tone: f32,
    snappy: f32,
    decay: f32,
    level: f32,
    sample_rate: f32,
    noise_seed: u32,
    trig_prev: [bool; 6],
    led: [f32; 6],
}

impl Drums {
    pub fn new() -> Self {
        Self {
            info: ModuleInfo {
                type_id: "drums".into(),
                name: "Drums".into(),
                hp: 12,
                inputs: vec![
                    PortDesc {
                        name: "bd".into(),
                        kind: PortId::Input,
                        signal: SignalKind::Gate,
                    },
                    PortDesc {
                        name: "sd".into(),
                        kind: PortId::Input,
                        signal: SignalKind::Gate,
                    },
                    PortDesc {
                        name: "ch".into(),
                        kind: PortId::Input,
                        signal: SignalKind::Gate,
                    },
                    PortDesc {
                        name: "oh".into(),
                        kind: PortId::Input,
                        signal: SignalKind::Gate,
                    },
                    PortDesc {
                        name: "cp".into(),
                        kind: PortId::Input,
                        signal: SignalKind::Gate,
                    },
                    PortDesc {
                        name: "tom".into(),
                        kind: PortId::Input,
                        signal: SignalKind::Gate,
                    },
                ],
                outputs: vec![
                    PortDesc {
                        name: "mix".into(),
                        kind: PortId::Output,
                        signal: SignalKind::Audio,
                    },
                    PortDesc {
                        name: "bd".into(),
                        kind: PortId::Output,
                        signal: SignalKind::Audio,
                    },
                    PortDesc {
                        name: "sd".into(),
                        kind: PortId::Output,
                        signal: SignalKind::Audio,
                    },
                    PortDesc {
                        name: "hh".into(),
                        kind: PortId::Output,
                        signal: SignalKind::Audio,
                    },
                ],
                params: vec![
                    ParamDesc {
                        name: "tone".into(),
                        min: 0.0,
                        max: 1.0,
                        default: 0.45,
                        unit: "".into(),
                    },
                    ParamDesc {
                        name: "snappy".into(),
                        min: 0.0,
                        max: 1.0,
                        default: 0.55,
                        unit: "".into(),
                    },
                    ParamDesc {
                        name: "decay".into(),
                        min: 0.0,
                        max: 1.0,
                        default: 0.5,
                        unit: "".into(),
                    },
                    ParamDesc {
                        name: "level".into(),
                        min: 0.0,
                        max: 1.0,
                        default: 0.85,
                        unit: "".into(),
                    },
                ],
            },
            kick: Voice::new(),
            snare: Voice::new(),
            ch: Voice::new(),
            oh: Voice::new(),
            clap: Voice::new(),
            tom: Voice::new(),
            tone: 0.45,
            snappy: 0.55,
            decay: 0.5,
            level: 0.85,
            sample_rate: 48_000.0,
            noise_seed: 0xC0FF_EE11,
            trig_prev: [false; 6],
            led: [0.0; 6],
        }
    }

    fn noise(&mut self) -> f32 {
        self.noise_seed = self
            .noise_seed
            .wrapping_mul(1664525)
            .wrapping_add(1013904223);
        (self.noise_seed as f32 / u32::MAX as f32) * 2.0 - 1.0
    }

    fn edge(trigs: &mut [bool; 6], i: usize, high: bool) -> bool {
        let e = high && !trigs[i];
        trigs[i] = high;
        e
    }
}

impl Default for Drums {
    fn default() -> Self {
        Self::new()
    }
}

impl Module for Drums {
    fn info(&self) -> &ModuleInfo {
        &self.info
    }

    fn set_sample_rate(&mut self, sample_rate: f32) {
        self.sample_rate = sample_rate.max(1.0);
    }

    fn set_param(&mut self, name: &str, value: f32) {
        match name {
            "tone" => self.tone = value.clamp(0.0, 1.0),
            "snappy" => self.snappy = value.clamp(0.0, 1.0),
            "decay" => self.decay = value.clamp(0.0, 1.0),
            "level" => self.level = value.clamp(0.0, 1.0),
            _ => {}
        }
    }

    fn get_param(&self, name: &str) -> Option<f32> {
        match name {
            "tone" => Some(self.tone),
            "snappy" => Some(self.snappy),
            "decay" => Some(self.decay),
            "level" => Some(self.level),
            _ => None,
        }
    }

    fn process(&mut self, inputs: &[Voltage], outputs: &mut [Voltage]) {
        let sr = self.sample_rate;
        let dt = 1.0 / sr;

        let bd_t = Self::edge(&mut self.trig_prev, 0, inputs.first().copied().unwrap_or(0.0) > 1.0);
        let sd_t = Self::edge(&mut self.trig_prev, 1, inputs.get(1).copied().unwrap_or(0.0) > 1.0);
        let ch_t = Self::edge(&mut self.trig_prev, 2, inputs.get(2).copied().unwrap_or(0.0) > 1.0);
        let oh_t = Self::edge(&mut self.trig_prev, 3, inputs.get(3).copied().unwrap_or(0.0) > 1.0);
        let cp_t = Self::edge(&mut self.trig_prev, 4, inputs.get(4).copied().unwrap_or(0.0) > 1.0);
        let tm_t = Self::edge(&mut self.trig_prev, 5, inputs.get(5).copied().unwrap_or(0.0) > 1.0);

        if bd_t {
            self.kick.active = true;
            self.kick.env = 1.0;
            self.kick.phase = 0.0;
            self.kick.freq = 55.0 + self.tone * 80.0;
            self.kick.aux = self.kick.freq * 3.5; // pitch sweep start
        }
        if sd_t {
            self.snare.active = true;
            self.snare.env = 1.0;
            self.snare.phase = 0.0;
            self.snare.freq = 180.0 + self.tone * 120.0;
            self.snare.aux = 1.0; // noise env
        }
        if ch_t {
            self.ch.active = true;
            self.ch.env = 1.0;
            self.oh.env *= 0.15; // choke open hat
        }
        if oh_t {
            self.oh.active = true;
            self.oh.env = 1.0;
        }
        if cp_t {
            self.clap.active = true;
            self.clap.env = 1.0;
            self.clap.aux = 0.0; // clap burst timer
            self.clap.aux2 = 3.0; // remaining bursts
        }
        if tm_t {
            self.tom.active = true;
            self.tom.env = 1.0;
            self.tom.phase = 0.0;
            self.tom.freq = 110.0 + self.tone * 90.0;
            self.tom.aux = self.tom.freq * 2.2;
        }

        // --- Kick ---
        let mut bd = 0.0;
        if self.kick.active {
            let sweep = self.kick.aux;
            self.kick.aux = (self.kick.aux - dt * (900.0 + self.decay * 400.0)).max(self.kick.freq);
            self.kick.phase = (self.kick.phase + sweep / sr).fract();
            let sine = (self.kick.phase * std::f32::consts::TAU).sin();
            let click = if self.kick.env > 0.92 { self.noise() * 0.35 } else { 0.0 };
            bd = (sine * 1.1 + click).tanh() * self.kick.env;
            let dec = 6.0 + (1.0 - self.decay) * 14.0;
            self.kick.env *= (-dec * dt).exp();
            if self.kick.env < 0.001 {
                self.kick.active = false;
                self.kick.env = 0.0;
            }
        }

        // --- Snare ---
        let mut sd = 0.0;
        if self.snare.active {
            self.snare.phase = (self.snare.phase + self.snare.freq / sr).fract();
            let body = (self.snare.phase * std::f32::consts::TAU).sin() * 0.45;
            let n = self.noise();
            self.snare.aux *= (-(18.0 + (1.0 - self.snappy) * 25.0) * dt).exp();
            let noise = n * self.snare.aux * (0.4 + self.snappy * 0.9);
            sd = (body * self.snare.env + noise).tanh();
            let dec = 8.0 + (1.0 - self.decay) * 16.0;
            self.snare.env *= (-dec * dt).exp();
            if self.snare.env < 0.001 && self.snare.aux < 0.001 {
                self.snare.active = false;
            }
        }

        // --- Hats (metallic filtered noise) ---
        let mut ch = 0.0;
        if self.ch.active {
            let n = self.noise();
            self.ch.aux += (n - self.ch.aux) * 0.35; // bright HP-ish
            ch = (n - self.ch.aux) * self.ch.env * 1.4;
            let dec = 35.0 + (1.0 - self.decay) * 55.0;
            self.ch.env *= (-dec * dt).exp();
            if self.ch.env < 0.001 {
                self.ch.active = false;
            }
        }
        let mut oh = 0.0;
        if self.oh.active {
            let n = self.noise();
            self.oh.aux += (n - self.oh.aux) * 0.28;
            oh = (n - self.oh.aux) * self.oh.env * 1.15;
            let dec = 6.0 + (1.0 - self.decay) * 10.0;
            self.oh.env *= (-dec * dt).exp();
            if self.oh.env < 0.001 {
                self.oh.active = false;
            }
        }
        let hh = (ch + oh).tanh();

        // --- Clap ---
        let mut cp = 0.0;
        if self.clap.active {
            self.clap.aux += dt;
            let burst = if self.clap.aux2 > 0.0 && self.clap.aux < 0.012 {
                1.0
            } else if self.clap.aux2 > 0.0 && self.clap.aux >= 0.018 {
                self.clap.aux = 0.0;
                self.clap.aux2 -= 1.0;
                1.0
            } else {
                0.35
            };
            let n = self.noise();
            self.clap.phase += (n - self.clap.phase) * 0.4;
            cp = (n - self.clap.phase) * self.clap.env * burst * 1.3;
            let dec = 10.0 + (1.0 - self.decay) * 14.0;
            self.clap.env *= (-dec * dt).exp();
            if self.clap.env < 0.001 {
                self.clap.active = false;
            }
        }

        // --- Tom ---
        let mut tm = 0.0;
        if self.tom.active {
            let sweep = self.tom.aux;
            self.tom.aux = (self.tom.aux - dt * 500.0).max(self.tom.freq);
            self.tom.phase = (self.tom.phase + sweep / sr).fract();
            tm = (self.tom.phase * std::f32::consts::TAU).sin() * self.tom.env;
            let dec = 7.0 + (1.0 - self.decay) * 12.0;
            self.tom.env *= (-dec * dt).exp();
            if self.tom.env < 0.001 {
                self.tom.active = false;
            }
        }

        let g = self.level * 4.2;
        let mix = (bd + sd + hh + cp * 0.9 + tm * 0.85).tanh() * g;
        self.led = [
            self.kick.env,
            self.snare.env.max(self.snare.aux),
            self.ch.env,
            self.oh.env,
            self.clap.env,
            self.tom.env,
        ];

        if let Some(o) = outputs.get_mut(0) {
            *o = mix;
        }
        if let Some(o) = outputs.get_mut(1) {
            *o = bd.tanh() * g;
        }
        if let Some(o) = outputs.get_mut(2) {
            *o = sd.tanh() * g;
        }
        if let Some(o) = outputs.get_mut(3) {
            *o = hh.tanh() * g;
        }
    }

    fn reset(&mut self) {
        self.kick = Voice::new();
        self.snare = Voice::new();
        self.ch = Voice::new();
        self.oh = Voice::new();
        self.clap = Voice::new();
        self.tom = Voice::new();
        self.trig_prev = [false; 6];
        self.led = [0.0; 6];
    }

    fn lights(&self) -> ModuleLights {
        let mut l = ModuleLights::new();
        for (name, v) in [
            ("bd", self.led[0]),
            ("sd", self.led[1]),
            ("ch", self.led[2]),
            ("oh", self.led[3]),
            ("cp", self.led[4]),
            ("tom", self.led[5]),
        ] {
            l.set(name, v.clamp(0.0, 1.0));
        }
        l
    }
}
