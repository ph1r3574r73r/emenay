//! PolySynth — 4-voice MIDI polysynth (saw/square + AR + mild filter).
//!
//! Reads the global MIDI bus poly allocator directly — drop it in, press chords.
//! No MidiCv patching required (though MidiCv POLY mode shares the same pool).

use emenay_engine::midi::global_midi_bus;
use emenay_engine::module::{
    Module, ModuleInfo, ModuleLights, ParamDesc, PortDesc, PortId, SignalKind,
};
use emenay_engine::{MidiBus, Voltage};
use std::f32::consts::TAU;
use std::sync::Arc;

const VOICES: usize = 4;

struct Voice {
    phase: f32,
    env: f32,
    gate_prev: bool,
    lp: f32,
}

impl Default for Voice {
    fn default() -> Self {
        Self {
            phase: 0.0,
            env: 0.0,
            gate_prev: false,
            lp: 0.0,
        }
    }
}

pub struct PolySynth {
    info: ModuleInfo,
    bus: Arc<MidiBus>,
    sample_rate: f32,
    tune: f32,
    shape: f32,
    cutoff: f32,
    attack: f32,
    release: f32,
    level: f32,
    detune: f32,
    /// Velocity → cutoff amount (0…1).
    vel_cutoff: f32,
    /// Aftertouch → cutoff amount (0…1).
    at_cutoff: f32,
    /// Aftertouch → level amount (0…1).
    at_level: f32,
    /// Mod wheel → cutoff amount (0…1).
    mod_cutoff: f32,
    voices: [Voice; VOICES],
    gate_leds: [f32; VOICES],
    audio: f32,
}

impl PolySynth {
    pub fn new() -> Self {
        Self {
            info: ModuleInfo {
                type_id: "polysynth".into(),
                name: "PolySynth".into(),
                hp: 12,
                inputs: vec![
                    PortDesc {
                        name: "cutoff_cv".into(),
                        kind: PortId::Input,
                        signal: SignalKind::Cv,
                    },
                    PortDesc {
                        name: "shape_cv".into(),
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
                        name: "out_r".into(),
                        kind: PortId::Output,
                        signal: SignalKind::Audio,
                    },
                ],
                params: vec![
                    ParamDesc {
                        name: "tune".into(),
                        min: -2.0,
                        max: 2.0,
                        default: 0.0,
                        unit: "V".into(),
                    },
                    ParamDesc {
                        name: "shape".into(),
                        min: 0.0,
                        max: 1.0,
                        default: 0.15,
                        unit: "".into(),
                    },
                    ParamDesc {
                        name: "cutoff".into(),
                        min: 0.0,
                        max: 1.0,
                        default: 0.72,
                        unit: "".into(),
                    },
                    ParamDesc {
                        name: "attack".into(),
                        min: 0.001,
                        max: 2.0,
                        default: 0.01,
                        unit: "s".into(),
                    },
                    ParamDesc {
                        name: "release".into(),
                        min: 0.01,
                        max: 4.0,
                        default: 0.35,
                        unit: "s".into(),
                    },
                    ParamDesc {
                        name: "detune".into(),
                        min: 0.0,
                        max: 1.0,
                        default: 0.12,
                        unit: "".into(),
                    },
                    ParamDesc {
                        name: "level".into(),
                        min: 0.0,
                        max: 1.0,
                        default: 0.75,
                        unit: "".into(),
                    },
                    ParamDesc {
                        name: "vel_cutoff".into(),
                        min: 0.0,
                        max: 1.0,
                        default: 0.25,
                        unit: "".into(),
                    },
                    ParamDesc {
                        name: "at_cutoff".into(),
                        min: 0.0,
                        max: 1.0,
                        default: 0.35,
                        unit: "".into(),
                    },
                    ParamDesc {
                        name: "at_level".into(),
                        min: 0.0,
                        max: 1.0,
                        default: 0.0,
                        unit: "".into(),
                    },
                    ParamDesc {
                        name: "mod_cutoff".into(),
                        min: 0.0,
                        max: 1.0,
                        default: 0.2,
                        unit: "".into(),
                    },
                ],
            },
            bus: global_midi_bus(),
            sample_rate: 48_000.0,
            tune: 0.0,
            shape: 0.15,
            cutoff: 0.72,
            attack: 0.01,
            release: 0.35,
            level: 0.75,
            detune: 0.12,
            vel_cutoff: 0.25,
            at_cutoff: 0.35,
            at_level: 0.0,
            mod_cutoff: 0.2,
            voices: Default::default(),
            gate_leds: [0.05; VOICES],
            audio: 0.0,
        }
    }

    fn hz(cv: f32, tune: f32, bend: f32, detune_st: f32) -> f32 {
        // C4 = 0 V → 261.63 Hz
        261.63 * (2.0_f32).powf(cv + tune + bend + detune_st / 12.0)
    }
}

impl Default for PolySynth {
    fn default() -> Self {
        Self::new()
    }
}

impl Module for PolySynth {
    fn info(&self) -> &ModuleInfo {
        &self.info
    }

    fn set_sample_rate(&mut self, sample_rate: f32) {
        self.sample_rate = sample_rate.max(1.0);
    }

    fn set_param(&mut self, name: &str, value: f32) {
        match name {
            "tune" => self.tune = value.clamp(-2.0, 2.0),
            "shape" => self.shape = value.clamp(0.0, 1.0),
            "cutoff" => self.cutoff = value.clamp(0.0, 1.0),
            "attack" => self.attack = value.clamp(0.001, 2.0),
            "release" => self.release = value.clamp(0.01, 4.0),
            "detune" => self.detune = value.clamp(0.0, 1.0),
            "level" => self.level = value.clamp(0.0, 1.0),
            "vel_cutoff" => self.vel_cutoff = value.clamp(0.0, 1.0),
            "at_cutoff" => self.at_cutoff = value.clamp(0.0, 1.0),
            "at_level" => self.at_level = value.clamp(0.0, 1.0),
            "mod_cutoff" => self.mod_cutoff = value.clamp(0.0, 1.0),
            _ => {}
        }
    }

    fn get_param(&self, name: &str) -> Option<f32> {
        match name {
            "tune" => Some(self.tune),
            "shape" => Some(self.shape),
            "cutoff" => Some(self.cutoff),
            "attack" => Some(self.attack),
            "release" => Some(self.release),
            "detune" => Some(self.detune),
            "level" => Some(self.level),
            "vel_cutoff" => Some(self.vel_cutoff),
            "at_cutoff" => Some(self.at_cutoff),
            "at_level" => Some(self.at_level),
            "mod_cutoff" => Some(self.mod_cutoff),
            _ => None,
        }
    }

    fn process(&mut self, inputs: &[Voltage], outputs: &mut [Voltage]) {
        // Claim 4 poly slots so chords land on voices we actually render.
        self.bus.set_poly_voices(VOICES as u8);

        let cutoff_cv = inputs.first().copied().unwrap_or(0.0);
        let shape_cv = inputs.get(1).copied().unwrap_or(0.0);
        let shape = (self.shape + shape_cv * 0.1).clamp(0.0, 1.0);
        let at_norm = self.bus.aftertouch_volts() / 5.0;
        let mod_norm = self.bus.mod_wheel_volts() / 5.0;
        let level_expr = (self.level * (1.0 + at_norm * self.at_level)).clamp(0.0, 1.0);
        let bend = self.bus.pitch_bend_volts(2.0);
        let dt = 1.0 / self.sample_rate;
        let atk_step = dt / self.attack;
        let rel_step = dt / self.release;

        let mut left = 0.0_f32;
        let mut right = 0.0_f32;

        for (i, v) in self.voices.iter_mut().enumerate() {
            let (cv, gate_v, vel) = self.bus.poly_voice(i);
            let gate = gate_v > 1.0;
            self.gate_leds[i] = if gate { 1.0 } else { 0.05 };

            if gate && !v.gate_prev {
                // Soft retrigger — keep some phase continuity, lift env a bit.
                v.env = v.env.max(0.15);
            }
            v.gate_prev = gate;

            if gate {
                v.env = (v.env + atk_step).min(1.0);
            } else {
                v.env = (v.env - rel_step).max(0.0);
            }

            if v.env <= 1e-5 && !gate {
                continue;
            }

            let cutoff = (self.cutoff
                + cutoff_cv * 0.1
                + vel * self.vel_cutoff
                + at_norm * self.at_cutoff
                + mod_norm * self.mod_cutoff)
                .clamp(0.0, 1.0);
            // One-pole cutoff: map 0…1 → ~200 Hz … ~12 kHz
            let fc = 200.0 * (2.0_f32).powf(cutoff * 6.0);
            let coeff = (TAU * fc / self.sample_rate).clamp(0.0, 1.0);

            // Spread voices ±detune cents-ish (up to ~±15 cents * knob).
            let spread = (i as f32 - 1.5) * self.detune * 0.25;
            let hz = Self::hz(cv, self.tune, bend, spread).clamp(20.0, 12_000.0);
            let advance = hz / self.sample_rate;
            v.phase = (v.phase + advance).fract();

            let saw = v.phase * 2.0 - 1.0;
            let pw = 0.5 - shape * 0.35;
            let square = if v.phase < pw { 1.0 } else { -1.0 };
            let osc = saw * (1.0 - shape) + square * shape;

            v.lp += (osc - v.lp) * coeff;
            let amp = v.env * (0.35 + 0.65 * vel) * level_expr;
            let sample = v.lp * amp * 3.2;
            // Mild stereo: odd voices left-biased, even right-biased.
            if i % 2 == 0 {
                left += sample * 0.7;
                right += sample * 0.35;
            } else {
                left += sample * 0.35;
                right += sample * 0.7;
            }
        }

        self.audio = (left + right) * 0.5;
        if let Some(o) = outputs.get_mut(0) {
            *o = left;
        }
        if let Some(o) = outputs.get_mut(1) {
            *o = right;
        }
    }

    fn reset(&mut self) {
        self.voices = Default::default();
        self.gate_leds = [0.05; VOICES];
        self.audio = 0.0;
    }

    fn lights(&self) -> ModuleLights {
        let mut l = ModuleLights::new();
        l.set("level", self.audio.abs().clamp(0.0, 1.0));
        for i in 0..VOICES {
            l.set(format!("v{}", i + 1), self.gate_leds[i]);
        }
        l
    }
}
