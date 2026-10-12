# Erica DIY BBD — modelling notes

Source: [erica-synths EDU DIY BBD](https://www.ericasynths.lv/edu-diy-bbd-3208/) / diy-eurorack (CC-BY-SA-3.0).

emenay module: `erica_bbd` (`crates/emenay-modules/src/erica_bbd.rs`).

Variable-rate delay line with colour LPF, feedback soft-clip, internal LFO time mod (disengaged when TIME CV present), and inhibit (clock hold). Wet + mix outs. Not a transistor-level MN3005/3205 sim — real-time BBD-character DSP aligned to the DIY panel I/O.
