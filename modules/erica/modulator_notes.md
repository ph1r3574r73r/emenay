# Erica DIY Modulator — modelling notes

Source: [erica-synths/diy-eurorack Modulator DIY](https://github.com/erica-synths/diy-eurorack) (CC-BY-SA-3.0).

emenay module: `erica_modulator` (`crates/emenay-modules/src/erica_modulator.rs`).

Multi-shape LFO (sine→tri→saw→square), white noise, and sample-and-hold with slew. Clock jack samples on rising edge; without clock, LFO wrap triggers hold. Unpatched S&H input normals to noise. Not a transistor-level MNA — real-time DSP aligned to the DIY panel I/O.
