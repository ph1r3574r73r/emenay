# Erica DIY Bassline — modelling notes

Source: [erica-synths/diy-eurorack Bassline DIY](https://github.com/erica-synths/diy-eurorack) (CC-BY-SA-3.0).

emenay module: `erica_bassline` (`crates/emenay-modules/src/erica_bassline.rs`).

Acid voice: saw core + Polivoks-character 4-pole ladder + percussive decay envelope. Gate triggers envelope; accent gate boosts amp/cutoff. Cutoff CV and tune (1V/oct). Composes the same circuit-inspired building blocks as VCO3 / Polivoks VCF rather than a full schematic netlist.
