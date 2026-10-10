# Erica DIY Mixer — modelling notes

Hardware: 3-channel active mixer (Erica Synths DIY, CC-BY-SA-3.0).

emenay ships `InvertingMixer3` / `erica_mixer` module:

- Per-channel series resistance + pot attenuation
- Shared feedback resistor around a finite-gain op-amp MNA stamp
- Master level after polarity flip (hardware is inverting; UI path is non-inverting for musical patching)

Validate DC channel gains with `emenay-spice-check` (mixer report).
