//! Fixed-step modified nodal analysis (MNA) for real-time analog modeling.
//!
//! emenay stamps linear companion models each sample and solves Gx = b.
//! Capacitors use backward Euler; ideal op-amps use a large open-loop gain model.

mod mna;
mod netlist;
mod components;

pub use components::{
    BufferedOutput, Component, InvertingMixer3, OpAmpIdeal, PassiveRcLowpass,
};
pub use mna::{MnaSolver, SolveError};
pub use netlist::{Netlist, NodeId};

/// Sample a circuit once and return selected probe voltages.
pub trait CircuitModel: Send {
    fn reset(&mut self);
    fn set_sample_rate(&mut self, sample_rate: f32);
    /// Drive named inputs (volts) then advance one sample; return probe voltages.
    fn process(&mut self, inputs: &[f32], outputs: &mut [f32]);
    fn num_inputs(&self) -> usize;
    fn num_outputs(&self) -> usize;
}
