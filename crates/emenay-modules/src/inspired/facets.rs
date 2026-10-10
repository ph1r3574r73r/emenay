//! Facets — multi-model macro oscillator (inspired by MI plaits; not a port).
//! (orthogonal DSP — not a firmware port).
//!
//! Models (stepped via `model` 0…7):
//! 0 VA · 1 FM · 2 Additive · 3 Chord · 4 Formant · 5 Modal · 6 Grain · 7 Kick

use emenay_engine::module::{Module, ModuleInfo, ParamDesc, PortDesc, PortId, SignalKind};
use emenay_engine::Voltage;
use std::f32::consts::{PI, TAU};

const MODEL_COUNT: f32 = 8.0;

pub struct Facets {
    info: ModuleInfo,
    model: f32,
    freq: f32,
    harmonics: f32,
    timbre: f32,
    morph: f32,
    level: f32,
    sample_rate: f32,
    phase: f32,
    phase2: f32,
    // Modal / grain / kick state
    env: f32,
    env2: f32,
    /// Internal LPG envelope (Facets-style), opened by TRIG.
    lpg: f32,
    trig_prev: bool,
    seed: u32,
    partials: [f32; 6],
    partial_ph: [f32; 6],
}

impl Facets {
    pub fn new() -> Self {
        Self {
            info: ModuleInfo {
                type_id: "facets".into(),
                name: "Facets".into(),
                hp: 12,
                inputs: vec![
                    PortDesc {
                        name: "v_oct".into(),
                        kind: PortId::Input,
                        signal: SignalKind::Cv,
                    },
                    PortDesc {
                        name: "trig".into(),
                        kind: PortId::Input,
                        signal: SignalKind::Gate,
                    },
                    PortDesc {
                        name: "level_cv".into(),
                        kind: PortId::Input,
                        signal: SignalKind::Cv,
                    },
                    PortDesc {
                        name: "model_cv".into(),
                        kind: PortId::Input,
                        signal: SignalKind::Cv,
                    },
                    PortDesc {
                        name: "timbre_cv".into(),
                        kind: PortId::Input,
                        signal: SignalKind::Cv,
                    },
                    PortDesc {
                        name: "morph_cv".into(),
                        kind: PortId::Input,
                        signal: SignalKind::Cv,
                    },
                    PortDesc {
                        name: "fm".into(),
                        kind: PortId::Input,
                        signal: SignalKind::Cv,
                    },
                    PortDesc {
                        name: "harmonics_cv".into(),
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
                        name: "aux".into(),
                        kind: PortId::Output,
                        signal: SignalKind::Audio,
                    },
                ],
                params: vec![
                    ParamDesc {
                        name: "model".into(),
                        min: 0.0,
                        max: 7.0,
                        default: 0.0,
                        unit: "int".into(),
                    },
                    ParamDesc {
                        name: "freq".into(),
                        min: 20.0,
                        max: 2000.0,
                        default: 110.0,
                        unit: "Hz".into(),
                    },
                    ParamDesc {
                        name: "harmonics".into(),
                        min: 0.0,
                        max: 1.0,
                        default: 0.5,
                        unit: "".into(),
                    },
                    ParamDesc {
                        name: "timbre".into(),
                        min: 0.0,
                        max: 1.0,
                        default: 0.5,
                        unit: "".into(),
                    },
                    ParamDesc {
                        name: "morph".into(),
                        min: 0.0,
                        max: 1.0,
                        default: 0.5,
                        unit: "".into(),
                    },
                    ParamDesc {
                        name: "level".into(),
                        min: 0.0,
                        max: 1.0,
                        default: 0.8,
                        unit: "".into(),
                    },
                ],
            },
            model: 0.0,
            freq: 110.0,
            harmonics: 0.5,
            timbre: 0.5,
            morph: 0.5,
            level: 0.8,
            sample_rate: 48_000.0,
            phase: 0.0,
            phase2: 0.0,
            env: 0.0,
            env2: 0.0,
            lpg: 1.0,
            trig_prev: false,
            seed: 0xC0DEC0DE,
            partials: [0.0; 6],
            partial_ph: [0.0; 6],
        }
    }

    fn rand01(&mut self) -> f32 {
        self.seed = self.seed.wrapping_mul(1664525).wrapping_add(1013904223);
        self.seed as f32 / u32::MAX as f32
    }

    fn hz(&self, v_oct: f32, fm: f32) -> f32 {
        (self.freq * 2f32.powf(v_oct + fm * 0.4)).clamp(0.1, self.sample_rate * 0.45)
    }

    fn advance(&mut self, hz: f32) -> f32 {
        self.phase = (self.phase + hz / self.sample_rate).fract();
        self.phase
    }

    fn polyblep(t: f32, dt: f32) -> f32 {
        if t < dt {
            let x = t / dt;
            x + x - x * x - 1.0
        } else if t > 1.0 - dt {
            let x = (t - 1.0) / dt;
            x * x + x + x + 1.0
        } else {
            0.0
        }
    }

    /// 0 — virtual analog: morph saw → square → triangle; harmonics = PW / brightness.
    fn model_va(&mut self, hz: f32, harm: f32, timbre: f32, morph: f32) -> (f32, f32) {
        let t = self.advance(hz);
        let dt = (hz / self.sample_rate).clamp(1e-6, 0.5);
        let pw = (0.05 + harm * 0.9).clamp(0.05, 0.95);

        let mut saw = 2.0 * t - 1.0;
        saw -= Self::polyblep(t, dt);

        let mut sq = if t < pw { 1.0 } else { -1.0 };
        sq += Self::polyblep(t, dt);
        sq -= Self::polyblep((t + (1.0 - pw)).fract(), dt);

        let tri = {
            // Integrate square-ish for triangle feel.
            let mut x = if t < 0.5 { 4.0 * t - 1.0 } else { 3.0 - 4.0 * t };
            x -= Self::polyblep(t, dt) * 0.5;
            x
        };

        // Morph: 0 saw, 0.5 square, 1 triangle; timbre crossfades brightness via mild tanh.
        let main = if morph < 0.5 {
            let a = morph * 2.0;
            saw * (1.0 - a) + sq * a
        } else {
            let a = (morph - 0.5) * 2.0;
            sq * (1.0 - a) + tri * a
        };
        let bright = (main * (1.0 + timbre * 2.5)).tanh();
        let aux = saw * 0.7 + tri * 0.3;
        (bright, aux)
    }

    /// 1 — 2-op FM: harmonics = carrier/mod ratio, timbre = index, morph = feedback.
    fn model_fm(&mut self, hz: f32, harm: f32, timbre: f32, morph: f32) -> (f32, f32) {
        let ratio = 0.25 + harm * harm * 7.75;
        let index = timbre * timbre * 8.0;
        let fb = morph * 2.5;

        let mod_hz = hz * ratio;
        self.phase2 = (self.phase2 + mod_hz / self.sample_rate).fract();
        let modulator = (TAU * self.phase2).sin();
        let feed = (modulator + self.env * fb).sin(); // reuse env as FB state light
        self.env = feed * 0.5;

        let t = self.advance(hz);
        let carrier = (TAU * t + feed * index).sin();
        let aux = modulator;
        (carrier, aux)
    }

    /// 2 — additive: stack of sines; harmonics = partial count, timbre = tilt, morph = stretch.
    fn model_additive(&mut self, hz: f32, harm: f32, timbre: f32, morph: f32) -> (f32, f32) {
        let n = 1 + (harm * 7.0).round() as usize;
        let stretch = 1.0 + morph * 0.8;
        let mut sum = 0.0;
        let mut odd = 0.0;
        for i in 1..=n {
            let k = i as f32;
            let ph = (self.phase * k * stretch).fract();
            let amp = 1.0 / (k.powf(0.5 + timbre * 1.5));
            let s = (TAU * ph).sin() * amp;
            sum += s;
            if i % 2 == 1 {
                odd += s;
            }
        }
        self.advance(hz);
        let norm = (n as f32).sqrt().max(1.0);
        (sum / norm, odd / norm)
    }

    /// 3 — chord: root + intervals; harmonics = inversion/spread, morph = voicing.
    fn model_chord(&mut self, hz: f32, harm: f32, timbre: f32, morph: f32) -> (f32, f32) {
        // Voicings: maj, min, sus2, 7, maj7, dim, aug, stack5
        let intervals: [[f32; 3]; 8] = [
            [0.0, 4.0, 7.0],
            [0.0, 3.0, 7.0],
            [0.0, 2.0, 7.0],
            [0.0, 4.0, 10.0],
            [0.0, 4.0, 11.0],
            [0.0, 3.0, 6.0],
            [0.0, 4.0, 8.0],
            [0.0, 7.0, 14.0],
        ];
        let vi = ((morph * 7.99) as usize).min(7);
        let inv = (harm * 2.99) as i32;
        let mut sum = 0.0;
        let mut root = 0.0;
        for (n, &semi) in intervals[vi].iter().enumerate() {
            let mut s = semi + if n as i32 <= inv { 12.0 } else { 0.0 };
            s += timbre * 0.15 * n as f32; // slight stretch
            let f = hz * 2f32.powf(s / 12.0);
            let ph = (self.phase * (f / hz).max(0.01)).fract();
            let s_wave = (TAU * ph).sin();
            sum += s_wave;
            if n == 0 {
                root = s_wave;
            }
        }
        self.advance(hz);
        (sum / 2.2, root)
    }

    /// 4 — formant / vowel: morph sweeps A→E→I→O→U; timbre = formant Q / brightness.
    fn model_formant(&mut self, hz: f32, harm: f32, timbre: f32, morph: f32) -> (f32, f32) {
        // Two formant centers interpolating through classic vowel charts (Hz).
        const F1: [f32; 5] = [800.0, 400.0, 300.0, 450.0, 350.0];
        const F2: [f32; 5] = [1200.0, 2200.0, 2800.0, 800.0, 700.0];
        let pos = morph * 4.0;
        let i = pos.floor() as usize;
        let frac = pos.fract();
        let i1 = i.min(4);
        let i2 = (i + 1).min(4);
        let f1 = F1[i1] * (1.0 - frac) + F1[i2] * frac;
        let f2 = F2[i1] * (1.0 - frac) + F2[i2] * frac;

        let t = self.advance(hz);
        let buzz = if t < 0.08 + harm * 0.2 { 1.0 } else { -0.2 };
        let q = (0.2 + timbre * 0.65).clamp(0.05, 0.95);
        let sr = self.sample_rate;

        // Two Chamberlin bandpasses (states in partials[0..4]).
        let f_a = (2.0 * PI * f1 / sr).sin().clamp(0.001, 0.95);
        self.partials[0] += f_a * self.partials[1];
        let high_a = buzz - self.partials[0] - q * self.partials[1];
        self.partials[1] += f_a * high_a;
        let b0 = self.partials[1];

        let f_b = (2.0 * PI * f2 / sr).sin().clamp(0.001, 0.95);
        self.partials[2] += f_b * self.partials[3];
        let high_b = buzz - self.partials[2] - q * self.partials[3];
        self.partials[3] += f_b * high_b;
        let b1 = self.partials[3];

        let out = (b0 * 0.7 + b1 * 0.5).tanh();
        (out, buzz * 0.5)
    }

    /// 5 — modal: impulse on trig → decaying inharmonic partials.
    fn model_modal(&mut self, hz: f32, harm: f32, timbre: f32, morph: f32, trig: bool) -> (f32, f32) {
        if trig {
            for i in 0..6 {
                self.partial_ph[i] = 0.0;
                self.partials[i] = (1.0 / (i as f32 + 1.0)) * (0.4 + harm);
            }
            self.env = 1.0;
        }
        let damp = (0.9992 - morph * 0.004).clamp(0.99, 0.99995);
        let mut sum = 0.0;
        for i in 0..6 {
            let ratio = 1.0 + i as f32 * (0.55 + morph * 1.6) + harm * 0.3 * i as f32;
            let f = (hz * ratio).min(self.sample_rate * 0.45);
            self.partial_ph[i] = (self.partial_ph[i] + f / self.sample_rate).fract();
            self.partials[i] *= damp;
            // Soft strike brightness
            let bright = 1.0 - timbre * 0.5 * (i as f32 / 5.0);
            sum += (TAU * self.partial_ph[i]).sin() * self.partials[i] * bright;
        }
        // Free-run drone when no energy left (gentle sustain from phase)
        if self.partials.iter().all(|p| *p < 0.001) {
            let t = self.advance(hz);
            sum += (TAU * t).sin() * 0.15 * (1.0 - harm);
        } else {
            self.advance(hz);
        }
        (sum.tanh(), self.partials[0] * 2.0)
    }

    /// 6 — grain / particle: clocked noise bursts through morphing filter.
    fn model_grain(&mut self, hz: f32, harm: f32, timbre: f32, morph: f32, trig: bool) -> (f32, f32) {
        let density = 4.0 + harm * 40.0;
        self.phase2 += density / self.sample_rate;
        let fire = if self.phase2 >= 1.0 || trig {
            self.phase2 = self.phase2.fract();
            true
        } else {
            false
        };
        if fire {
            self.env = 1.0;
            self.env2 = self.rand01() * 2.0 - 1.0;
        }
        let decay = (0.985 - morph * 0.08).clamp(0.9, 0.999);
        self.env *= decay;
        let noise = self.rand01() * 2.0 - 1.0;
        let grain = noise * self.env + self.env2 * self.env * 0.3;

        // Timbre = cutoff of one-pole
        let cutoff = 200.0 + timbre * timbre * 10_000.0;
        let a = 1.0 - (-2.0 * PI * cutoff / self.sample_rate).exp();
        self.partials[0] += (grain - self.partials[0]) * a;
        let out = self.partials[0];
        let _ = hz;
        let _ = self.advance(hz.max(1.0) * 0.25);
        (out, noise * self.env)
    }

    /// 7 — kick / bass drum: pitch envelope on sine + click.
    fn model_kick(&mut self, hz: f32, harm: f32, timbre: f32, morph: f32, trig: bool) -> (f32, f32) {
        if trig {
            self.env = 1.0;
            self.env2 = 1.0;
            self.phase = 0.0;
        }
        let body_decay = (0.9994 - morph * 0.0015).clamp(0.997, 0.9999);
        let click_decay = (0.96 - harm * 0.1).clamp(0.85, 0.99);
        self.env *= body_decay;
        self.env2 *= click_decay;

        let pitch_env = self.env.powf(1.5 + timbre * 2.0);
        let f = hz * (1.0 + pitch_env * (4.0 + harm * 12.0));
        self.phase = (self.phase + f / self.sample_rate).fract();
        let body = (TAU * self.phase).sin() * self.env;
        let click = (self.rand01() * 2.0 - 1.0) * self.env2 * (0.2 + timbre * 0.5);
        ((body + click).tanh(), self.env)
    }

    fn render(
        &mut self,
        model: usize,
        hz: f32,
        harm: f32,
        timbre: f32,
        morph: f32,
        trig: bool,
    ) -> (f32, f32) {
        match model {
            0 => self.model_va(hz, harm, timbre, morph),
            1 => self.model_fm(hz, harm, timbre, morph),
            2 => self.model_additive(hz, harm, timbre, morph),
            3 => self.model_chord(hz, harm, timbre, morph),
            4 => self.model_formant(hz, harm, timbre, morph),
            5 => self.model_modal(hz, harm, timbre, morph, trig),
            6 => self.model_grain(hz, harm, timbre, morph, trig),
            _ => self.model_kick(hz, harm, timbre, morph, trig),
        }
    }
}

impl Default for Facets {
    fn default() -> Self {
        Self::new()
    }
}

impl Module for Facets {
    fn info(&self) -> &ModuleInfo {
        &self.info
    }

    fn set_sample_rate(&mut self, sample_rate: f32) {
        self.sample_rate = sample_rate.max(1.0);
    }

    fn set_param(&mut self, name: &str, value: f32) {
        match name {
            "model" => self.model = value.clamp(0.0, 7.0).round(),
            "freq" => self.freq = value.clamp(20.0, 2000.0),
            "harmonics" => self.harmonics = value.clamp(0.0, 1.0),
            "timbre" => self.timbre = value.clamp(0.0, 1.0),
            "morph" => self.morph = value.clamp(0.0, 1.0),
            "level" => self.level = value.clamp(0.0, 1.0),
            _ => {}
        }
    }

    fn get_param(&self, name: &str) -> Option<f32> {
        match name {
            "model" => Some(self.model),
            "freq" => Some(self.freq),
            "harmonics" => Some(self.harmonics),
            "timbre" => Some(self.timbre),
            "morph" => Some(self.morph),
            "level" => Some(self.level),
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
        let v_oct = inputs.first().copied().unwrap_or(0.0);
        let trig_v = inputs.get(1).copied().unwrap_or(0.0);
        let level_cv = inputs.get(2).copied().unwrap_or(0.0);
        let model_cv = inputs.get(3).copied().unwrap_or(0.0);
        let timbre_cv = inputs.get(4).copied().unwrap_or(0.0);
        let morph_cv = inputs.get(5).copied().unwrap_or(0.0);
        let fm = inputs.get(6).copied().unwrap_or(0.0);
        let harm_cv = inputs.get(7).copied().unwrap_or(0.0);

        let trig_connected = connected.get(1).copied().unwrap_or(false);
        let level_cv_connected = connected.get(2).copied().unwrap_or(false);

        let trig = trig_v > 1.0 && !self.trig_prev;
        self.trig_prev = trig_v > 1.0;

        // Internal LPG: TRIG opens; LEVEL sets decay. Unpatched LEVEL CV → LPG path.
        if trig {
            self.lpg = 1.0;
        }
        let decay = 0.992 + self.level * 0.0075;
        if trig_connected {
            self.lpg *= decay;
        } else {
            self.lpg = 1.0;
        }

        let model_f = (self.model + model_cv * 0.4).clamp(0.0, MODEL_COUNT - 0.001);
        let model = model_f as usize;
        let harm = (self.harmonics + harm_cv * 0.1).clamp(0.0, 1.0);
        let timbre = (self.timbre + timbre_cv * 0.1).clamp(0.0, 1.0);
        let morph = (self.morph + morph_cv * 0.1).clamp(0.0, 1.0);

        let amp = if level_cv_connected {
            // External VCA / LEVEL CV replaces internal LPG.
            (self.level * (level_cv / 5.0).clamp(0.0, 1.5)).clamp(0.0, 1.5)
        } else if trig_connected {
            (self.level * self.lpg).clamp(0.0, 1.5)
        } else {
            self.level.clamp(0.0, 1.5)
        };

        let hz = self.hz(v_oct, fm);
        let (main, aux) = self.render(model, hz, harm, timbre, morph, trig);

        if let Some(o) = outputs.get_mut(0) {
            *o = (main * amp * 5.0).clamp(-8.0, 8.0);
        }
        if let Some(o) = outputs.get_mut(1) {
            *o = (aux * amp * 4.0).clamp(-8.0, 8.0);
        }
    }

    fn reset(&mut self) {
        self.phase = 0.0;
        self.phase2 = 0.0;
        self.env = 0.0;
        self.env2 = 0.0;
        self.lpg = 1.0;
        self.trig_prev = false;
        self.partials = [0.0; 6];
        self.partial_ph = [0.0; 6];
    }
}
