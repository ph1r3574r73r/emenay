# MIDI

emenay takes class-compliant USB MIDI. Mackie/HUI surface ports are hidden from the picker.

## Setup

Put the keyboard in **Preset mode** (DAW/Preset button — Preset LED, **not** DAW lit). In DAW mode knobs only speak Mackie/HUI, which emenay ignores, so the MIDI monitor stays blank.

emenay opens every non-Mackie MIDI port at once and reopens them if macOS drops the
connection (sleep, unplug, hotplug) — focus the window or wait a couple seconds.
Picking a device in the MIDI menu force-reconnects. On the MIDI settings page, the
**MIDI monitor** line should show `CC…` when you turn a knob and `N…` when you press a key.

Open **MIDI** in the toolbar for the settings page:

1. Name your controller profile and pick the MIDI input.
2. Click **Learn** on an action or knob slot — the banner shows **last MIDI** (`CC16=90` / `N60`) so you can confirm the host is receiving.
3. **App actions** — preloaded with generic CCs (Start 115, Stop 116, Rest 117, Bank 110/111, Save 112, Panic 118). Learn or type new bindings.
4. **Knob CC bank** — preloaded CC 16–23. Learn each slot from your hardware once. **Select a module** to auto-map knobs 1–8 onto its faceplate params (cleared on deselect / Esc / click empty bay). Changing the bank also updates every **MIDI CC** module already on the rack.
5. **Param learns** — persistent maps: right-click a faceplate knob → Learn → turn a knob (CC). Focus knobs temporarily override the same CCs while a module is selected.

You do **not** need a blank preset — any Preset-mode patch that actually transmits CCs when you move controls is fine. Factory presets usually work.

Maps live in `localStorage` (`emenay.midi.*`) and are pushed to the engine.

## Modules

| Module | Role |
|---|---|
| **MIDI→CV** | Notes → pitch/gate (+ bend, mod, aftertouch, sustain) |
| **MIDI CC** | Eight assignable CC → CV outs (uses your knob bank) |
| **MIDI Pads** | Note → drum gates (default GM 36/38/42/46) |
| **PolySynth** | Reads poly notes + mod/AT/velocity from the bus |

## Presets

- **MIDI Poly + CC** — PolySynth with CC1/CC2 → cutoff/shape
- **MIDI Pads + Drums** — pads → kick/snare/hats
