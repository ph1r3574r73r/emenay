//! MIDI note → drum gates (Oxygen / GM pad map).
//!
//! Four outs fire 5 V while the assigned MIDI note is held. Defaults follow
//! General MIDI drum map: BD=36, SD=38, CH=42, OH=46.

use emenay_engine::midi::global_midi_bus;
use emenay_engine::module::{
    Module, ModuleInfo, ModuleLights, ParamDesc, PortDesc, PortId, SignalKind,
};
use emenay_engine::{MidiBus, Voltage};
use std::sync::Arc;

const OUTS: usize = 4;
const OUT_NAMES: [&str; OUTS] = ["bd", "sd", "ch", "oh"];
const DEFAULT_NOTES: [u8; OUTS] = [36, 38, 42, 46];

pub struct MidiPads {
    info: ModuleInfo,
    bus: Arc<MidiBus>,
    notes: [u8; OUTS],
    leds: [f32; OUTS],
}

impl MidiPads {
    pub fn new() -> Self {
        let mut outputs = Vec::with_capacity(OUTS);
        let mut params = Vec::with_capacity(OUTS);
        for (i, name) in OUT_NAMES.iter().enumerate() {
            outputs.push(PortDesc {
                name: (*name).into(),
                kind: PortId::Output,
                signal: SignalKind::Gate,
            });
            params.push(ParamDesc {
                name: format!("note_{}", i + 1),
                min: 0.0,
                max: 127.0,
                default: DEFAULT_NOTES[i] as f32,
                unit: "int".into(),
            });
        }
        Self {
            info: ModuleInfo {
                type_id: "midi_pads".into(),
                name: "MIDI Pads".into(),
                hp: 8,
                inputs: vec![],
                outputs,
                params,
            },
            bus: global_midi_bus(),
            notes: DEFAULT_NOTES,
            leds: [0.05; OUTS],
        }
    }
}

impl Default for MidiPads {
    fn default() -> Self {
        Self::new()
    }
}

impl Module for MidiPads {
    fn info(&self) -> &ModuleInfo {
        &self.info
    }

    fn set_sample_rate(&mut self, _sample_rate: f32) {}

    fn set_param(&mut self, name: &str, value: f32) {
        if let Some(rest) = name.strip_prefix("note_") {
            if let Ok(i) = rest.parse::<usize>() {
                if (1..=OUTS).contains(&i) {
                    self.notes[i - 1] = value.clamp(0.0, 127.0).round() as u8;
                }
            }
        }
    }

    fn get_param(&self, name: &str) -> Option<f32> {
        if let Some(rest) = name.strip_prefix("note_") {
            if let Ok(i) = rest.parse::<usize>() {
                if (1..=OUTS).contains(&i) {
                    return Some(self.notes[i - 1] as f32);
                }
            }
        }
        None
    }

    fn process(&mut self, _inputs: &[Voltage], outputs: &mut [Voltage]) {
        for i in 0..OUTS {
            let v = self.bus.note_gate_volts(self.notes[i]);
            self.leds[i] = if v > 1.0 { 1.0 } else { 0.05 };
            if let Some(o) = outputs.get_mut(i) {
                *o = v;
            }
        }
    }

    fn reset(&mut self) {
        self.leds = [0.05; OUTS];
    }

    fn lights(&self) -> ModuleLights {
        let mut l = ModuleLights::new();
        for i in 0..OUTS {
            l.set(OUT_NAMES[i], self.leds[i]);
        }
        l
    }
}
