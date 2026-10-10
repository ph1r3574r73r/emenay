use serde::{Deserialize, Serialize};

/// Voltage in the virtual Eurorack (±12 V soft rails).
pub type Voltage = f32;

#[derive(Clone, Copy, Debug, PartialEq, Eq, Hash, Serialize, Deserialize)]
#[serde(transparent)]
pub struct ModuleId(pub u64);

#[derive(Clone, Debug, PartialEq, Eq, Hash, Serialize, Deserialize)]
pub struct PortRef {
    pub module: ModuleId,
    pub port: String,
}
