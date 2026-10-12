//! MIDI CC → CV: eight assignable continuous-controller outputs (0…5 V).

use emenay_engine::midi::global_midi_bus;
use emenay_engine::module::{
    Module, ModuleInfo, ModuleLights, ParamDesc, PortDesc, PortId, SignalKind,
};
use emenay_engine::{MidiBus, Voltage};
use std::sync::Arc;

const OUTS: usize = 8;

/// Default CC numbers (Oxygen-friendly knobs: 16–23).
const DEFAULT_CCS: [u8; OUTS] = [16, 17, 18, 19, 20, 21, 22, 23];

pub struct MidiCc {
    info: ModuleInfo,
    bus: Arc<MidiBus>,
    cc_num: [u8; OUTS],
    leds: [f32; OUTS],
}

impl MidiCc {
    pub fn new() -> Self {
        let mut outputs = Vec::with_capacity(OUTS);
        let mut params = Vec::with_capacity(OUTS);
        for i in 1..=OUTS {
            outputs.push(PortDesc {
                name: format!("cc{i}"),
                kind: PortId::Output,
                signal: SignalKind::Cv,
            });
            params.push(ParamDesc {
                name: format!("cc_num_{i}"),
                min: 0.0,
                max: 127.0,
                default: DEFAULT_CCS[i - 1] as f32,
                unit: "int".into(),
            });
        }
        Self {
            info: ModuleInfo {
                type_id: "midi_cc".into(),
                name: "MIDI CC".into(),
                hp: 8,
                inputs: vec![],
                outputs,
                params,
            },
            bus: global_midi_bus(),
            cc_num: DEFAULT_CCS,
            leds: [0.05; OUTS],
        }
    }
}

impl Default for MidiCc {
    fn default() -> Self {
        Self::new()
    }
}

impl Module for MidiCc {
    fn info(&self) -> &ModuleInfo {
        &self.info
    }

    fn set_sample_rate(&mut self, _sample_rate: f32) {}

    fn set_param(&mut self, name: &str, value: f32) {
        if let Some(rest) = name.strip_prefix("cc_num_") {
            if let Ok(i) = rest.parse::<usize>() {
                if (1..=OUTS).contains(&i) {
                    self.cc_num[i - 1] = value.clamp(0.0, 127.0).round() as u8;
                }
            }
        }
    }

    fn get_param(&self, name: &str) -> Option<f32> {
        if let Some(rest) = name.strip_prefix("cc_num_") {
            if let Ok(i) = rest.parse::<usize>() {
                if (1..=OUTS).contains(&i) {
                    return Some(self.cc_num[i - 1] as f32);
                }
            }
        }
        None
    }

    fn process(&mut self, _inputs: &[Voltage], outputs: &mut [Voltage]) {
        for i in 0..OUTS {
            let v = self.bus.cc_volts(self.cc_num[i]);
            self.leds[i] = (v / 5.0).clamp(0.05, 1.0);
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
            l.set(format!("cc{}", i + 1), self.leds[i]);
        }
        l
    }
}
