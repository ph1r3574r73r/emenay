use crate::types::Voltage;
use serde::{Deserialize, Serialize};

#[derive(Clone, Copy, Debug, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum PortId {
    Input,
    Output,
}

#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct PortDesc {
    pub name: String,
    pub kind: PortId,
    /// Hint for UI cable colouring.
    pub signal: SignalKind,
}

#[derive(Clone, Copy, Debug, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum SignalKind {
    Audio,
    Cv,
    Gate,
}

#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct ParamDesc {
    pub name: String,
    pub min: f32,
    pub max: f32,
    pub default: f32,
    pub unit: String,
}

#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct ModuleInfo {
    pub type_id: String,
    pub name: String,
    pub hp: u32,
    pub inputs: Vec<PortDesc>,
    pub outputs: Vec<PortDesc>,
    pub params: Vec<ParamDesc>,
}

/// Panel indicator values for the UI (LEDs, digits, meters).
///
/// Convention:
/// - LED ids → brightness `0.0…1.0`
/// - Digit ids → numeric readout (e.g. `0…9` or BPM)
#[derive(Clone, Debug, Default, Serialize, Deserialize)]
pub struct ModuleLights {
    pub values: std::collections::HashMap<String, f32>,
}

impl ModuleLights {
    pub fn new() -> Self {
        Self::default()
    }

    pub fn set(&mut self, id: impl Into<String>, value: f32) {
        self.values.insert(id.into(), value);
    }
}

/// Real-time module DSP. Must be `Send` and avoid allocations in `process`.
pub trait Module: Send {
    fn info(&self) -> &ModuleInfo;
    fn set_sample_rate(&mut self, sample_rate: f32);
    fn set_param(&mut self, name: &str, value: f32);
    fn get_param(&self, name: &str) -> Option<f32>;
    /// Read input voltages (by input index), write output voltages (by output index).
    fn process(&mut self, inputs: &[Voltage], outputs: &mut [Voltage]);
    /// Like [`process`], with per-input patch state (`connected[i]` = cable present).
    /// Default ignores connection flags and calls [`process`].
    fn process_connected(
        &mut self,
        inputs: &[Voltage],
        connected: &[bool],
        outputs: &mut [Voltage],
    ) {
        let _ = connected;
        self.process(inputs, outputs);
    }
    fn reset(&mut self) {}
    /// Panel lights / digits for the UI. Default: none.
    fn lights(&self) -> ModuleLights {
        ModuleLights::default()
    }
}

/// Factory used by the patch graph.
pub type ModuleFactory = fn() -> Box<dyn Module>;
