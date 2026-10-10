//! 8-channel MIDI → CV/Gate interface (USB / class-compliant MIDI devices).
//!
//! - `cv1`/`gate1`: omni by default (any MIDI channel) — flip `omni` off for ch1-only
//! - `cv2`…`cv8` / `gate2`…`gate8`: MIDI channels 2–8
//! - `bend`: pitch-wheel CV (±`bend_range` semitones at 1V/oct); also added into pitch outs
//! - `mod`: mod-wheel (CC1) as 0…5 V
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

pub struct MidiCv {
    info: ModuleInfo,
    bus: Arc<MidiBus>,
    sample_rate: f32,
    /// When true, voice 1 follows notes on any MIDI channel.
    omni: bool,
    /// Pitch-bend range in semitones (±).
    bend_range: f32,
    activity: f32,
    gate_leds: [f32; VOICES],
    bend_led: f32,
    mod_led: f32,
}

impl MidiCv {
    pub fn new() -> Self {
        let mut outputs = Vec::with_capacity(VOICES * 2 + 2);
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
            bend_range: 2.0,
            activity: 0.06,
            gate_leds: [0.05; VOICES],
            bend_led: 0.05,
            mod_led: 0.05,
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
            "bend_range" => self.bend_range = value.clamp(1.0, 24.0).round(),
            _ => {}
        }
    }

    fn get_param(&self, name: &str) -> Option<f32> {
        match name {
            "omni" => Some(if self.omni { 1.0 } else { 0.0 }),
            "bend_range" => Some(self.bend_range),
            _ => None,
        }
    }

    fn process(&mut self, _inputs: &[Voltage], outputs: &mut [Voltage]) {
        self.activity = self.bus.activity_led(self.sample_rate);
        let bend_v = self.bus.pitch_bend_volts(self.bend_range);
        let mod_v = self.bus.mod_wheel_volts();
        self.bend_led = (bend_v.abs() / (self.bend_range / 12.0).max(0.01)).clamp(0.05, 1.0);
        self.mod_led = (mod_v / 5.0).clamp(0.05, 1.0);

        for i in 0..VOICES {
            let (cv, gate, _) = if i == 0 && self.omni {
                self.bus.omni_voice()
            } else {
                self.bus.voice(i)
            };
            self.gate_leds[i] = if i == 0 && self.omni {
                self.bus.omni_gate_led()
            } else {
                self.bus.gate_led(i)
            };
            let base = i * 2;
            if let Some(o) = outputs.get_mut(base) {
                // Pitch outs track the pitch wheel (1V/oct).
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
    }

    fn reset(&mut self) {
        self.activity = 0.06;
        self.gate_leds = [0.05; VOICES];
        self.bend_led = 0.05;
        self.mod_led = 0.05;
    }

    fn lights(&self) -> ModuleLights {
        let mut l = ModuleLights::new();
        l.set("midi", self.activity);
        l.set("bend", self.bend_led);
        l.set("mod", self.mod_led);
        for i in 0..VOICES {
            l.set(format!("gate{}", i + 1), self.gate_leds[i]);
        }
        l
    }
}
