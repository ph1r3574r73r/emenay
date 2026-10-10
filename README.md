# emenay

**Modified nodal analysis, made playable.**

Open-source Eurorack emulator — Tauri/React rack, circuit-derived DSP, ngspice checks.

```bash
git submodule update --init --recursive third-party/eurorack
cd third-party/eurorack && git submodule update --init stm_audio_bootloader && cd ../..
source "$HOME/.cargo/env"   # if needed
cd apps/web-ui && npm install && cd ../..
make check && make desktop-dev
```

Needs Rust 1.75+, C++17, Node 20+. Optional: [ngspice](https://ngspice.sourceforge.io/).

MIDI→CV, sequencers, drums, Facets/Lots/Swell/Chimes/Twist (MIT firmware DSP), Erica-inspired mixer/output, and more. Code in `crates/`, `apps/`, firmware in `third-party/eurorack`.

GPL-3.0-or-later. Erica DIY: CC-BY-SA-3.0. Not affiliated with Mutable Instruments.
