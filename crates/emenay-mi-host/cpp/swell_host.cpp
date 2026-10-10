#include "emenay_mi_host.h"

#include <cmath>
#include <cstring>
#include <new>

#include "cv_util.h"
#include "tides/generator.h"

struct EmenaySwell {
  tides::Generator generator;
  bool trig_prev = false;
  bool clock_prev = false;
};

extern "C" {

EmenaySwell *emenay_swell_new(void) {
  auto *p = new (std::nothrow) EmenaySwell();
  if (!p) {
    return nullptr;
  }
  p->generator.Init();
  p->generator.set_range(tides::GENERATOR_RANGE_HIGH);
  p->generator.set_mode(tides::GENERATOR_MODE_LOOPING);
  p->generator.set_sync(false);
  emenay_swell_reset(p);
  return p;
}

void emenay_swell_delete(EmenaySwell *p) { delete p; }

void emenay_swell_reset(EmenaySwell *p) {
  if (!p) {
    return;
  }
  p->trig_prev = false;
  p->clock_prev = false;
}

static int16_t param_to_fixed(float x) {
  return static_cast<int16_t>(emenay::clampf(x, 0.0f, 1.0f) * 32767.0f);
}

void emenay_swell_process(
    EmenaySwell *p,
    const float *inputs,
    const int *connected,
    float *outputs,
    float freq_hz,
    float shape,
    float slope,
    float smoothness,
    int mode,
    int range) {
  if (!p || !outputs) {
    return;
  }

  const float v_oct = inputs ? inputs[0] : 0.0f;
  const float trig_v = inputs ? inputs[1] : 0.0f;
  const float clock_v = inputs ? inputs[2] : 0.0f;
  const float freeze_v = inputs ? inputs[3] : 0.0f;
  const float shape_cv = inputs ? inputs[4] : 0.0f;
  const float slope_cv = inputs ? inputs[5] : 0.0f;
  const float smooth_cv = inputs ? inputs[6] : 0.0f;
  const float fm = inputs ? inputs[7] : 0.0f;

  const bool clock_connected = connected && connected[2];

  const float hz = emenay::hz_with_v_oct(freq_hz, v_oct + fm * 0.1f);
  const int16_t pitch =
      static_cast<int16_t>(emenay::hz_to_midi_note(hz) * 128.0f);

  static const tides::GeneratorMode kModes[] = {
      tides::GENERATOR_MODE_AD,
      tides::GENERATOR_MODE_LOOPING,
      tides::GENERATOR_MODE_AR,
  };
  static const tides::GeneratorRange kRanges[] = {
      tides::GENERATOR_RANGE_HIGH,
      tides::GENERATOR_RANGE_MEDIUM,
      tides::GENERATOR_RANGE_LOW,
  };
  const int mode_i = mode < 0 ? 0 : (mode > 2 ? 2 : mode);
  const int range_i = range < 0 ? 0 : (range > 2 ? 2 : range);
  p->generator.set_mode(kModes[mode_i]);
  p->generator.set_range(kRanges[range_i]);
  p->generator.set_sync(clock_connected);
  p->generator.set_pitch(pitch);
  p->generator.set_shape(param_to_fixed(shape + shape_cv * 0.1f));
  p->generator.set_slope(
      static_cast<int16_t>((slope + slope_cv * 0.1f - 0.5f) * 65534.0f));
  p->generator.set_smoothness(param_to_fixed(smoothness + smooth_cv * 0.1f));

  uint8_t control = 0;
  if (emenay::gate_high(freeze_v)) {
    control |= tides::CONTROL_FREEZE;
  }

  const bool trig_high = emenay::gate_high(trig_v);
  if (trig_high && !p->trig_prev) {
    control |= tides::CONTROL_GATE_RISING;
  }
  if (!trig_high && p->trig_prev) {
    control |= tides::CONTROL_GATE_FALLING;
  }
  if (trig_high) {
    control |= tides::CONTROL_GATE;
  }
  p->trig_prev = trig_high;

  const bool clock_high = emenay::gate_high(clock_v);
  if (clock_connected && clock_high && !p->clock_prev) {
    control |= tides::CONTROL_CLOCK_RISING;
  }
  if (clock_connected && clock_high) {
    control |= tides::CONTROL_CLOCK;
  }
  p->clock_prev = clock_high;

  const tides::GeneratorSample &sample = p->generator.Process(control);
  p->generator.Process();

  outputs[0] = static_cast<float>(sample.unipolar) / 65535.0f * 5.0f;
  outputs[1] = static_cast<float>(sample.bipolar) / 32768.0f * 5.0f;
  outputs[2] = (sample.flags & tides::FLAG_END_OF_ATTACK) ? 5.0f : 0.0f;
  outputs[3] = (sample.flags & tides::FLAG_END_OF_RELEASE) ? 5.0f : 0.0f;
}

}  // extern "C"
