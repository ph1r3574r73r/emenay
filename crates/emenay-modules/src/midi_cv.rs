//! 8-channel MIDI → CV/Gate interface (USB / class-compliant MIDI devices).
//!
//! - **Mono / channel mode** (default): `cv1`/`gate1` omni (or ch1); `cv2`…`cv8` = MIDI ch 2–8
//! - **Poly mode**: `cv1`…`cvN` / `gate1`…`gateN` are a voice-allocated chord pool
//!   (press multiple keys on one channel). `voices` sets N (2…8).
//! - `bend`: pitch-wheel CV (±`bend_range` semitones at 1V/oct); also added into pitch outs
//! - `mod`: mod-wheel (CC1) as 0…5 V
//! - `at`: channel aftertouch as 0…5 V
//! - `sustain`: sustain pedal (CC64) gate-style 0/5 V
//! - Pitch: 1V/oct, C4 = 0 V · Gate: 5 V while held (not a trigger pulse)

use emenay_engine::midi::global_midi_bus;
use emenay_engine::module::{
    Module, ModuleInfo, ModuleLights, ParamDesc, PortDesc, PortId, SignalKind,
};
use emenay_engine::{MidiBus, Voltage};
use std::sync::Arc;

const VOICES: usize = 8;
/// Output indices after the 8×(cv,gate) pairs.
const OUT_BEND: usize = VOICES * 2;
const OUT_MOD: usize = VOICES * 2 + 1;
const OUT_AT: usize = VOICES * 2 + 2;
const OUT_SUSTAIN: usize = VOICES * 2 + 3;

pub struct MidiCv {
    info: ModuleInfo,
    bus: Arc<MidiBus>,
    sample_rate: f32,
    /// When true (and not poly), voice 1 follows notes on any MIDI channel.
    omni: bool,
    /// Chord mode: cv/gate outs come from the poly voice allocator.
    poly: bool,
    /// Active poly voice count when `poly` is on.
    voices: f32,
    /// Pitch-bend range in semitones (±).
    bend_range: f32,
    activity: f32,
    gate_leds: [f32; VOICES],
    bend_led: f32,
    mod_led: f32,
    at_led: f32,
    sustain_led: f32,
}

impl MidiCv {
    pub fn new() -> Self {
        let mut outputs = Vec::with_capacity(VOICES * 2 + 4);
        for i in 1..=VOICES {
            outputs.push(PortDesc {
                name: format!("cv{i}"),
                kind: PortId::Output,
                signal: SignalKind::Cv,
            });
            outputs.push(PortDesc {
                name: format!("gate{i}"),
                kind: PortId::Output,
                signal: SignalKind::Gate,
            });
        }
        outputs.push(PortDesc {
            name: "bend".into(),
            kind: PortId::Output,
            signal: SignalKind::Cv,
        });
        outputs.push(PortDesc {
            name: "mod".into(),
            kind: PortId::Output,
            signal: SignalKind::Cv,
        });
        outputs.push(PortDesc {
            name: "at".into(),
            kind: PortId::Output,
            signal: SignalKind::Cv,
        });
        outputs.push(PortDesc {
            name: "sustain".into(),
            kind: PortId::Output,
            signal: SignalKind::Gate,
        });
        Self {
            info: ModuleInfo {
                type_id: "midi_cv".into(),
                name: "MIDI→CV".into(),
                hp: 12,
                inputs: vec![],
                outputs,
                params: vec![
                    ParamDesc {
                        name: "omni".into(),
                        min: 0.0,
                        max: 1.0,
                        default: 1.0,
                        unit: "bool".into(),
                    },
                    ParamDesc {
                        name: "poly".into(),
                        min: 0.0,
                        max: 1.0,
                        default: 0.0,
                        unit: "bool".into(),
                    },
                    ParamDesc {
                        name: "voices".into(),
                        min: 2.0,
                        max: 8.0,
                        default: 4.0,
                        unit: "int".into(),
                    },
                    ParamDesc {
                        name: "bend_range".into(),
                        min: 1.0,
                        max: 24.0,
                        default: 2.0,
                        unit: "st".into(),
                    },
                ],
            },
            bus: global_midi_bus(),
            sample_rate: 48_000.0,
            omni: true,
            poly: false,
            voices: 4.0,
            bend_range: 2.0,
            activity: 0.06,
            gate_leds: [0.05; VOICES],
            bend_led: 0.05,
            mod_led: 0.05,
            at_led: 0.05,
            sustain_led: 0.05,
        }
    }
}

impl Default for MidiCv {
    fn default() -> Self {
        Self::new()
    }
}

impl Module for MidiCv {
    fn info(&self) -> &ModuleInfo {
        &self.info
    }

    fn set_sample_rate(&mut self, sample_rate: f32) {
        self.sample_rate = sample_rate.max(1.0);
    }

    fn set_param(&mut self, name: &str, value: f32) {
        match name {
            "omni" => self.omni = value >= 0.5,
            "poly" => self.poly = value >= 0.5,
            "voices" => self.voices = value.clamp(2.0, 8.0).round(),
            "bend_range" => self.bend_range = value.clamp(1.0, 24.0).round(),
            _ => {}
        }
    }

    fn get_param(&self, name: &str) -> Option<f32> {
        match name {
            "omni" => Some(if self.omni { 1.0 } else { 0.0 }),
            "poly" => Some(if self.poly { 1.0 } else { 0.0 }),
            "voices" => Some(self.voices),
            "bend_range" => Some(self.bend_range),
            _ => None,
        }
    }

    fn process(&mut self, _inputs: &[Voltage], outputs: &mut [Voltage]) {
        if self.poly {
            self.bus.set_poly_voices(self.voices as u8);
        }
        self.activity = self.bus.activity_led(self.sample_rate);
        let bend_v = self.bus.pitch_bend_volts(self.bend_range);
        let mod_v = self.bus.mod_wheel_volts();
        let at_v = self.bus.aftertouch_volts();
        let sus_v = self.bus.sustain_volts();
        self.bend_led = (bend_v.abs() / (self.bend_range / 12.0).max(0.01)).clamp(0.05, 1.0);
        self.mod_led = (mod_v / 5.0).clamp(0.05, 1.0);
        self.at_led = (at_v / 5.0).clamp(0.05, 1.0);
        self.sustain_led = if sus_v > 1.0 { 1.0 } else { 0.05 };

        let n_poly = self.voices as usize;
        for i in 0..VOICES {
            let (cv, gate, _) = if self.poly {
                if i < n_poly {
                    self.bus.poly_voice(i)
                } else {
                    (0.0, 0.0, 0.0)
                }
            } else if i == 0 && self.omni {
                self.bus.omni_voice()
            } else {
                self.bus.voice(i)
            };
            self.gate_leds[i] = if self.poly {
                if i < n_poly {
                    self.bus.poly_gate_led(i)
                } else {
                    0.05
                }
            } else if i == 0 && self.omni {
                self.bus.omni_gate_led()
            } else {
                self.bus.gate_led(i)
            };
            let base = i * 2;
            if let Some(o) = outputs.get_mut(base) {
                *o = cv + bend_v;
            }
            if let Some(o) = outputs.get_mut(base + 1) {
                *o = gate;
            }
        }
        if let Some(o) = outputs.get_mut(OUT_BEND) {
            *o = bend_v;
        }
        if let Some(o) = outputs.get_mut(OUT_MOD) {
            *o = mod_v;
        }
        if let Some(o) = outputs.get_mut(OUT_AT) {
            *o = at_v;
        }
        if let Some(o) = outputs.get_mut(OUT_SUSTAIN) {
            *o = sus_v;
        }
    }

    fn reset(&mut self) {
        self.activity = 0.06;
        self.gate_leds = [0.05; VOICES];
        self.bend_led = 0.05;
        self.mod_led = 0.05;
        self.at_led = 0.05;
        self.sustain_led = 0.05;
    }

    fn lights(&self) -> ModuleLights {
        let mut l = ModuleLights::new();
        l.set("midi", self.activity);
        l.set("bend", self.bend_led);
        l.set("mod", self.mod_led);
        l.set("at", self.at_led);
        l.set("sustain", self.sustain_led);
        l.set("poly", if self.poly { 1.0 } else { 0.05 });
        for i in 0..VOICES {
            l.set(format!("gate{}", i + 1), self.gate_leds[i]);
        }
        l
    }
}
