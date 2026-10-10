# Modelling pipeline

Industry hardware plugins (Waves, Softube, UAD, etc.) generally do **not** run SPICE inside the audio callback. They:

1. Match schematics / hardware
2. Derive component or stage equations (often with PSpice / MATLAB)
3. Discretize into real-time DSP
4. Validate against measurements

emenay mirrors that:

1. Author / simplify a netlist (`emenay-circuit`, `modules/`)
2. Validate offline with **ngspice** (`emenay-spice`)
3. Run a fixed-step **MNA** (or specialized) model in the rack at audio rate

## First circuits

- Passive RC low-pass — teaches capacitor companion models
- Inverting 3-channel mixer — Erica DIY Mixer inspired
- Buffered output — Erica DIY Output inspired soft-rail stage

## Mutable Instruments firmware modules

Facets, Lots, Swell, Chimes, and Twist use **official MIT firmware DSP** from [pichenettes/eurorack](https://github.com/pichenettes/eurorack), hosted in `crates/emenay-mi-host` at **48 kHz**. Inspired Rust backends: `emenay-modules` feature `inspired-fallback`.

**Parity checklist (manual):**

- Facets: sweep `model` 0–15; TRIG opens LPG when patched; FM / LEVEL CV when patched
- Chimes: IN vs internal exciter; TRIG strum; `model` / `polyphony`; OUT / AUX; position_cv / freq_cv
- Twist: carrier unpatched → internal osc (`carrier_shape`); LVL1 / LVL2 + CVs; algorithm morph
- Swell: MODE (AD / loop / AR) + RANGE; TRIG / CLOCK / FREEZE; UNI / BI / EOA / EOR
- Lots (18HP): t CLK + X CLK; déjà vu amount/length; t1–t3 + X1–X3 + Y; t_mode / x_mode
