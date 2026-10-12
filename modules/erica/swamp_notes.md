# Erica DIY Swamp — modelling notes

Source: [erica-synths/diy-eurorack Swamp](https://github.com/erica-synths/diy-eurorack) (CC-BY-SA-3.0).

emenay module: `erica_swamp` (`crates/emenay-modules/src/erica_swamp.rs`).

Wogglebug-style chaos: stepped + lagged smooth CV, probabilistic burst gates, and noise. Rate / chaos / lag with CV and external clock. Software model of the random-CV behaviour, not a full analog netlist.
