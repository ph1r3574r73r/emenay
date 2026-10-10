# Voltage standards (emenay)

Internal signals are floating-point voltages approximating Eurorack practice:

| Signal | Nominal range |
|--------|----------------|
| Audio | ±5 V typical, soft clip near ±12 V rails |
| CV | 1 V/octave for pitch |
| Gate / trigger | Off ~0 V, on ≥ ~1–5 V |
| Device output | Speaker pads by ÷5 into [-1, 1] float samples |

Sample rate follows the selected audio device (prefer 48 kHz).
