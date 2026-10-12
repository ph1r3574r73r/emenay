#include "emenay_mi_host.h"

#include <cmath>
#include <cstring>
#include <new>

#include "cv_util.h"
#include "peaks/processors.h"

struct EmenayTwin {
  peaks::Processors channel[2];
  peaks::GateFlags gate_prev[2] = {0, 0};
  int mode[2] = {-1, -1};
  bool split = true;
};

extern "C" {

EmenayTwin *emenay_twin_new(void) {
  auto *p = new (std::nothrow) EmenayTwin();
  if (!p) {
    return nullptr;
  }
  p->channel[0].Init(0);
  p->channel[1].Init(1);
  p->channel[0].set_control_mode(peaks::CONTROL_MODE_HALF);
  p->channel[1].set_control_mode(peaks::CONTROL_MODE_HALF);
  p->split = true;
  emenay_twin_reset(p);
  return p;
}

void emenay_twin_delete(EmenayTwin *p) { delete p; }

void emenay_twin_reset(EmenayTwin *p) {
  if (!p) {
    return;
  }
  p->gate_prev[0] = 0;
  p->gate_prev[1] = 0;
  p->mode[0] = -1;
  p->mode[1] = -1;
  p->channel[0].Init(0);
  p->channel[1].Init(1);
  p->channel[0].set_control_mode(
      p->split ? peaks::CONTROL_MODE_HALF : peaks::CONTROL_MODE_FULL);
  p->channel[1].set_control_mode(
      p->split ? peaks::CONTROL_MODE_HALF : peaks::CONTROL_MODE_FULL);
}

static uint16_t param01(float x) {
  return static_cast<uint16_t>(emenay::clampf(x, 0.0f, 1.0f) * 65535.0f);
}

static peaks::ProcessorFunction clamp_fn(int mode) {
  if (mode < 0) {
    return peaks::PROCESSOR_FUNCTION_ENVELOPE;
  }
  if (mode >= peaks::PROCESSOR_FUNCTION_LAST) {
    return static_cast<peaks::ProcessorFunction>(peaks::PROCESSOR_FUNCTION_LAST - 1);
  }
  return static_cast<peaks::ProcessorFunction>(mode);
}

void emenay_twin_process(
    EmenayTwin *p,
    const float *inputs,
    const int *connected,
    float *outputs,
    int mode_a,
    int mode_b,
    float p1,
    float p2,
    float p3,
    float p4,
    int split,
    float level) {
  if (!p || !outputs) {
    return;
  }

  const float trig_a = inputs ? inputs[0] : 0.0f;
  const float trig_b = inputs ? inputs[1] : 0.0f;
  (void)connected;

  const bool want_split = split != 0;
  if (want_split != p->split) {
    p->split = want_split;
    p->channel[0].set_control_mode(
        want_split ? peaks::CONTROL_MODE_HALF : peaks::CONTROL_MODE_FULL);
    p->channel[1].set_control_mode(
        want_split ? peaks::CONTROL_MODE_HALF : peaks::CONTROL_MODE_FULL);
  }

  const int modes[2] = {mode_a, mode_b};
  const float trigs[2] = {trig_a, trig_b};
  float outs[2] = {0.0f, 0.0f};

  for (int i = 0; i < 2; ++i) {
    const peaks::ProcessorFunction fn = clamp_fn(modes[i]);
    if (p->mode[i] != static_cast<int>(fn)) {
      p->mode[i] = static_cast<int>(fn);
      p->channel[i].set_function(fn);
    }

    // Split (Peaks half): knobs 1–2 → A, 3–4 → B. Twin (full): all four → both.
    uint16_t params[4];
    if (want_split) {
      if (i == 0) {
        params[0] = param01(p1);
        params[1] = param01(p2);
        params[2] = 32768;
        params[3] = 32768;
      } else {
        params[0] = param01(p3);
        params[1] = param01(p4);
        params[2] = 32768;
        params[3] = 32768;
      }
    } else {
      params[0] = param01(p1);
      params[1] = param01(p2);
      params[2] = param01(p3);
      params[3] = param01(p4);
    }
    p->channel[i].CopyParameters(params, 4);
    // Touch one param to run Configure() with the full copied set.
    p->channel[i].set_parameter(0, params[0]);

    const bool high = emenay::gate_high(trigs[i]);
    const peaks::GateFlags flags =
        peaks::ExtractGateFlags(p->gate_prev[i], high);
    p->gate_prev[i] = flags;

    int16_t s = 0;
    p->channel[i].Process(&flags, &s, 1);
    outs[i] = emenay::short_to_audio(s);
  }

  const float amp = emenay::clampf(level, 0.0f, 1.5f);
  outputs[0] = outs[0] * amp;
  outputs[1] = outs[1] * amp;
  outputs[2] = (outs[0] + outs[1]) * 0.5f * amp;
}

}  // extern "C"
