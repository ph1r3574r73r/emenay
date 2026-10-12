# Erica DIY VCO3 — modelling notes

Source: [erica-synths/diy-eurorack VCO3 DIY.zip](https://github.com/erica-synths/diy-eurorack) (CC-BY-SA-3.0).

emenay module: `erica_vco3` (`crates/emenay-modules/src/erica_vco3.rs`).

Phase-accumulator core with hard sync (rising gate → phase 0), 1V/oct + fine (semitones), FM amount, PWM. Outputs: saw, pulse, triangle, sine at ±5 V. Not a transistor-level MNA of the Polivoks core — real-time-safe waveshaping aligned to the DIY panel I/O.
