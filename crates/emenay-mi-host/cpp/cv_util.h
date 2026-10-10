#pragma once

#include <algorithm>
#include <cmath>

namespace emenay {

inline float clampf(float x, float lo, float hi) {
  return std::max(lo, std::min(hi, x));
}

/// 1 V/oct CV offset (emenay volts) added to panel frequency.
inline float hz_with_v_oct(float base_hz, float v_oct) {
  return base_hz * std::pow(2.0f, v_oct);
}

inline float hz_to_midi_note(float hz) {
  return 69.0f + 12.0f * std::log2(std::max(hz, 0.1f) / 440.0f);
}

inline bool gate_high(float v) { return v > 1.0f; }

/// CV input 0–5 V → 0–1 (with headroom).
inline float cv01(float v) { return clampf(v / 5.0f, 0.0f, 1.0f); }

/// Audio sample emenay volts (~±8) → int16 scale for MI ShortFrame paths.
inline int16_t audio_to_short(float v) {
  return static_cast<int16_t>(clampf(v / 8.0f, -1.0f, 1.0f) * 32767.0f);
}

inline float short_to_audio(int16_t s) {
  return static_cast<float>(s) / 32767.0f * 8.0f;
}

}  // namespace emenay
