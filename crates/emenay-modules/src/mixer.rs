//! 4-channel mixer (Free Modular faceplate / Erica DIY Mixer DSP lineage).
//!
//! Attribution: Erica Synths DIY Eurorack (CC-BY-SA-3.0). Software model © emenay.
//!
//! Faceplate: 4× (IN + mute toggle + gain), master level LED, dual buffered MIX outs.

use emenay_engine::module::{
    Module, ModuleInfo, ModuleLights, ParamDesc, PortDesc, PortId, SignalKind,
};
use emenay_engine::Voltage;

pub struct EricaMixer {
    info: ModuleInfo,
    gains: [f32; 4],
    mutes: [bool; 4],
    /// Bottom rocker between MIX outs — mute both outputs.
    mute_mix: bool,
    master: f32,
    /// Smoothed |mix| for faceplate master LED (0..1).
    level_led: f32,
    mix: f32,
}

impl EricaMixer {
    pub fn new() -> Self {
        Self {
            info: ModuleInfo {
                type_id: "erica_mixer".into(),
                name: "Mixer".into(),
                hp: 8,
                inputs: vec![
                    port_in("in1"),
                    port_in("in2"),
                    port_in("in3"),
                    port_in("in4"),
                ],
                outputs: vec![
                    PortDesc {
                        name: "out".into(),
                        kind: PortId::Output,
                        signal: SignalKind::Audio,
                    },
                    // Second MIX jack on Free Modular plate (buffered multiple).
                    PortDesc {
                        name: "out2".into(),
                        kind: PortId::Output,
                        signal: SignalKind::Audio,
                    },
                ],
                params: vec![
                    param("ch1", 1.0),
                    param("ch2", 1.0),
                    param("ch3", 1.0),
                    param("ch4", 1.0),
                    bool_param("mute1"),
                    bool_param("mute2"),
                    bool_param("mute3"),
                    bool_param("mute4"),
                    bool_param("mute_mix"),
                ],
            },
            gains: [1.0, 1.0, 1.0, 1.0],
            mutes: [false; 4],
            mute_mix: false,
            master: 1.0,
            level_led: 0.0,
            mix: 0.0,
        }
    }
}

fn port_in(name: &str) -> PortDesc {
    PortDesc {
        name: name.into(),
        kind: PortId::Input,
        signal: SignalKind::Audio,
    }
}

fn param(name: &str, default: f32) -> ParamDesc {
    ParamDesc {
        name: name.into(),
        min: 0.0,
        max: 1.0,
        default,
        unit: "".into(),
    }
}

fn bool_param(name: &str) -> ParamDesc {
    ParamDesc {
        name: name.into(),
        min: 0.0,
        max: 1.0,
        default: 0.0,
        unit: "bool".into(),
    }
}

impl Default for EricaMixer {
    fn default() -> Self {
        Self::new()
    }
}

impl Module for EricaMixer {
    fn info(&self) -> &ModuleInfo {
        &self.info
    }

    fn set_sample_rate(&mut self, _sample_rate: f32) {}

    fn set_param(&mut self, name: &str, value: f32) {
        let v = value.clamp(0.0, 1.0);
        match name {
            "ch1" => self.gains[0] = v,
            "ch2" => self.gains[1] = v,
            "ch3" => self.gains[2] = v,
            "ch4" => self.gains[3] = v,
            "mute1" => self.mutes[0] = v >= 0.5,
            "mute2" => self.mutes[1] = v >= 0.5,
            "mute3" => self.mutes[2] = v >= 0.5,
            "mute4" => self.mutes[3] = v >= 0.5,
            "mute_mix" => self.mute_mix = v >= 0.5,
            _ => {}
        }
    }

    fn get_param(&self, name: &str) -> Option<f32> {
        match name {
            "ch1" => Some(self.gains[0]),
            "ch2" => Some(self.gains[1]),
            "ch3" => Some(self.gains[2]),
            "ch4" => Some(self.gains[3]),
            "mute1" => Some(if self.mutes[0] { 1.0 } else { 0.0 }),
            "mute2" => Some(if self.mutes[1] { 1.0 } else { 0.0 }),
            "mute3" => Some(if self.mutes[2] { 1.0 } else { 0.0 }),
            "mute4" => Some(if self.mutes[3] { 1.0 } else { 0.0 }),
            "mute_mix" => Some(if self.mute_mix { 1.0 } else { 0.0 }),
            _ => None,
        }
    }

    fn process(&mut self, inputs: &[Voltage], outputs: &mut [Voltage]) {
        let mut sum = 0.0f32;
        for i in 0..4 {
            if self.mutes[i] {
                continue;
            }
            let s = inputs.get(i).copied().unwrap_or(0.0) * self.gains[i];
            sum += s;
        }
        let mix = (sum * self.master).clamp(-10.0, 10.0);
        self.mix = mix;
        let target = (mix.abs() / 5.0).clamp(0.0, 1.0);
        self.level_led = self.level_led * 0.995 + target * 0.005;
        let out = if self.mute_mix { 0.0 } else { mix };
        if let Some(o) = outputs.get_mut(0) {
            *o = out;
        }
        if let Some(o) = outputs.get_mut(1) {
            *o = out;
        }
    }

    fn reset(&mut self) {
        self.level_led = 0.0;
        self.mix = 0.0;
    }

    fn lights(&self) -> ModuleLights {
        let mut l = ModuleLights::new();
        l.set("level", self.level_led);
        for (i, m) in self.mutes.iter().enumerate() {
            // Light the mute toggle when engaged.
            l.set(format!("mute{}", i + 1), if *m { 1.0 } else { 0.0 });
        }
        l.set("mute_mix", if self.mute_mix { 1.0 } else { 0.0 });
        l
    }
}
