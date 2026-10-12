# Erica DIY Polivoks VCF — modelling notes

Source: [erica-synths/diy-eurorack Polivoks VCF DIY.zip](https://github.com/erica-synths/diy-eurorack) (CC-BY-SA-3.0).

emenay module: `erica_polivoks_vcf` (`crates/emenay-modules/src/erica_polivoks_vcf.rs`).

Four soft-clipped integrator stages with nonlinear resonance feedback (OTA/ladder-inspired). Drive + RES give the characteristic growl. Outputs LP and BP. Future work: companion netlist + ngspice AC sweep vs this DSP.
