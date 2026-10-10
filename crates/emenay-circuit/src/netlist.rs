//! Lightweight netlist helpers for documenting circuits and exporting SPICE.

use std::fmt::Write;

/// Circuit node index in the MNA system (ground is not allocated).
pub type NodeId = usize;

#[derive(Clone, Debug, Default)]
pub struct Netlist {
    pub title: String,
    pub elements: Vec<NetElement>,
}

#[derive(Clone, Debug)]
pub enum NetElement {
    Resistor { name: String, n1: i32, n2: i32, ohms: f64 },
    Capacitor { name: String, n1: i32, n2: i32, farads: f64 },
    VoltageSource { name: String, n_pos: i32, n_neg: i32, volts: f64 },
    /// Behavioral note for documentation / SPICE .model references
    Comment(String),
}

impl Netlist {
    pub fn new(title: impl Into<String>) -> Self {
        Self {
            title: title.into(),
            elements: Vec::new(),
        }
    }

    pub fn to_spice(&self) -> String {
        let mut out = String::new();
        let _ = writeln!(out, "* {}", self.title);
        for el in &self.elements {
            match el {
                NetElement::Resistor { name, n1, n2, ohms } => {
                    let _ = writeln!(out, "{name} {n1} {n2} {ohms}");
                }
                NetElement::Capacitor {
                    name,
                    n1,
                    n2,
                    farads,
                } => {
                    let _ = writeln!(out, "{name} {n1} {n2} {farads}");
                }
                NetElement::VoltageSource {
                    name,
                    n_pos,
                    n_neg,
                    volts,
                } => {
                    let _ = writeln!(out, "{name} {n_pos} {n_neg} DC {volts}");
                }
                NetElement::Comment(c) => {
                    let _ = writeln!(out, "* {c}");
                }
            }
        }
        let _ = writeln!(out, ".end");
        out
    }
}
