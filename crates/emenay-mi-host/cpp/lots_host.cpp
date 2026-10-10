#include "emenay_mi_host.h"

#include <algorithm>
#include <cmath>
#include <cstring>
#include <new>

#include "cv_util.h"
#include "marbles/random/quantizer.h"
#include "marbles/random/random_generator.h"
#include "marbles/random/random_stream.h"
#include "marbles/random/t_generator.h"
#include "marbles/random/x_y_generator.h"
#include "marbles/ramp/ramp_divider.h"
#include "marbles/ramp/ramp_extractor.h"
#include "stmlib/stmlib.h"

namespace {

constexpr float kMarblesSr = 32000.0f;
constexpr size_t kBlock = 8;

}  // namespace

struct EmenayLots {
  marbles::RandomGenerator random_generator;
  marbles::RandomStream random_stream;
  marbles::TGenerator t_generator;
  marbles::XYGenerator xy_generator;
  marbles::RampExtractor ramp_extractor;
  marbles::RampDivider ramp_divider[2];
  float external_ramp[kBlock];
  float master_ramp[kBlock];
  float slave_ramp_1[kBlock];
  float slave_ramp_2[kBlock];
  marbles::Ramps ramps{};
  bool gate_buffer[kBlock * 2];
  float sample_buffer[kBlock * 4];
  float decim_phase = 0.0f;
  float hold_t1 = 0.0f;
  float hold_t2 = 0.0f;
  float hold_t3 = 0.0f;
  float hold_x1 = 0.0f;
  float hold_x2 = 0.0f;
  float hold_x3 = 0.0f;
  float hold_y = 0.0f;
  bool t_clock_prev = false;
  bool x_clock_prev = false;
  marbles::GroupSettings x_settings{};
  marbles::GroupSettings y_settings{};
};

extern "C" {

EmenayLots *emenay_lots_new(void) {
  auto *p = new (std::nothrow) EmenayLots();
  if (!p) {
    return nullptr;
  }
  p->random_generator.Init(32);
  p->random_stream.Init(&p->random_generator);
  p->t_generator.Init(&p->random_stream, kMarblesSr);
  p->xy_generator.Init(&p->random_stream, kMarblesSr);
  marbles::Scale major;
  major.InitMajor();
  p->xy_generator.LoadScale(0, major);
  p->ramp_extractor.Init(4000.0f / kMarblesSr);
  p->ramp_divider[0].Init();
  p->ramp_divider[1].Init();
  emenay_lots_reset(p);
  return p;
}

void emenay_lots_delete(EmenayLots *p) { delete p; }

void emenay_lots_reset(EmenayLots *p) {
  if (!p) {
    return;
  }
  p->decim_phase = 0.0f;
  p->t_clock_prev = false;
  p->x_clock_prev = false;
}

void emenay_lots_process(
    EmenayLots *p,
    const float *inputs,
    const int *connected,
    float *outputs,
    float rate,
    float bias,
    float jitter,
    float spread,
    float x_bias,
    float steps,
    float deja_vu,
    float deja_vu_length,
    int t_mode,
    int x_mode,
    float *lights_t) {
  if (!p || !outputs) {
    return;
  }

  const float t_clock_v = inputs ? inputs[0] : 0.0f;
  const float x_clock_v = inputs ? inputs[1] : 0.0f;
  const float rate_cv = inputs ? inputs[2] : 0.0f;
  const float bias_cv = inputs ? inputs[3] : 0.0f;
  const float jitter_cv = inputs ? inputs[4] : 0.0f;
  const float spread_cv = inputs ? inputs[5] : 0.0f;
  const float x_bias_cv = inputs ? inputs[6] : 0.0f;
  const float steps_cv = inputs ? inputs[7] : 0.0f;

  const bool t_clock_patched = connected && connected[0];
  const bool x_clock_patched = connected && connected[1];

  // Firmware rate is in semitones around 1 Hz (see t_generator.cc).
  const float rate_01 = emenay::clampf(rate + rate_cv * 0.1f, 0.0f, 1.0f);
  const float rate_n = rate_01 * 96.0f - 48.0f;
  const float bias_n = emenay::clampf(bias + bias_cv * 0.1f, 0.0f, 1.0f);
  const float jitter_n = emenay::clampf(jitter + jitter_cv * 0.1f, 0.0f, 1.0f);
  const float spread_n = emenay::clampf(spread + spread_cv * 0.1f, 0.0f, 1.0f);
  const float x_bias_n = emenay::clampf(x_bias + x_bias_cv * 0.1f, 0.0f, 1.0f);
  const float steps_n = emenay::clampf(steps + steps_cv * 0.1f, 0.0f, 1.0f);
  const float deja = emenay::clampf(deja_vu, 0.0f, 1.0f);
  const int length = 1 + static_cast<int>(emenay::clampf(deja_vu_length, 0.0f, 1.0f) * 15.0f);

  p->t_generator.set_model(static_cast<marbles::TGeneratorModel>(t_mode % 6));
  p->t_generator.set_rate(rate_n);
  p->t_generator.set_bias(bias_n);
  p->t_generator.set_jitter(jitter_n);
  p->t_generator.set_deja_vu(deja);
  p->t_generator.set_length(length);
  p->t_generator.set_range(marbles::T_GENERATOR_RANGE_1X);

  p->x_settings.control_mode = static_cast<marbles::ControlMode>(
      x_mode < 0 ? 0 : (x_mode > 2 ? 2 : x_mode));
  p->x_settings.voltage_range = marbles::VOLTAGE_RANGE_FULL;
  p->x_settings.register_mode = false;
  p->x_settings.register_value = 0.0f;
  p->x_settings.spread = spread_n;
  p->x_settings.bias = x_bias_n;
  p->x_settings.steps = steps_n;
  p->x_settings.deja_vu = deja;
  p->x_settings.length = length;
  p->x_settings.ratio.p = 1;
  p->x_settings.ratio.q = 1;
  p->x_settings.scale_index = 0;

  p->y_settings = p->x_settings;
  p->y_settings.steps = steps_n * 0.5f;
  p->y_settings.ratio.q = 8;

  auto emit_held = [&]() {
    outputs[0] = p->hold_t1;
    outputs[1] = p->hold_t2;
    outputs[2] = p->hold_t3;
    outputs[3] = p->hold_x1;
    outputs[4] = p->hold_x2;
    outputs[5] = p->hold_x3;
    outputs[6] = p->hold_y;
    if (lights_t) {
      lights_t[0] = p->hold_t1 > 1.0f ? 1.0f : 0.0f;
      lights_t[1] = p->hold_t2 > 1.0f ? 1.0f : 0.0f;
      lights_t[2] = p->hold_t3 > 1.0f ? 1.0f : 0.0f;
    }
  };

  p->decim_phase += kMarblesSr / 48000.0f;
  if (p->decim_phase < 1.0f) {
    emit_held();
    return;
  }
  p->decim_phase -= 1.0f;

  stmlib::GateFlags t_clock_flags[kBlock];
  stmlib::GateFlags x_clock_flags[kBlock];

  if (t_clock_patched) {
    const bool high = emenay::gate_high(t_clock_v);
    for (size_t i = 0; i < kBlock; ++i) {
      t_clock_flags[i] = stmlib::ExtractGateFlags(
          p->t_clock_prev ? stmlib::GATE_FLAG_HIGH : stmlib::GATE_FLAG_LOW, high);
      p->t_clock_prev = high;
    }
  } else {
    static float int_phase = 0.0f;
    const float hz = 0.25f + rate_01 * 24.0f;
    for (size_t i = 0; i < kBlock; ++i) {
      int_phase += hz / 48000.0f;
      bool high = false;
      if (int_phase >= 1.0f) {
        int_phase -= 1.0f;
        high = true;
      }
      t_clock_flags[i] = stmlib::ExtractGateFlags(
          p->t_clock_prev ? stmlib::GATE_FLAG_HIGH : stmlib::GATE_FLAG_LOW, high);
      p->t_clock_prev = high;
    }
  }

  if (x_clock_patched) {
    const bool high = emenay::gate_high(x_clock_v);
    for (size_t i = 0; i < kBlock; ++i) {
      x_clock_flags[i] = stmlib::ExtractGateFlags(
          p->x_clock_prev ? stmlib::GATE_FLAG_HIGH : stmlib::GATE_FLAG_LOW, high);
      p->x_clock_prev = high;
    }
  } else {
    std::memcpy(x_clock_flags, t_clock_flags, sizeof(x_clock_flags));
  }

  marbles::Ratio r{};
  r.p = 1;
  r.q = 1;
  p->ramp_extractor.Process(r, true, t_clock_flags, p->master_ramp, kBlock);
  std::memcpy(p->external_ramp, p->master_ramp, sizeof(p->external_ramp));
  r.q = 2;
  p->ramp_divider[0].Process(r, p->master_ramp, p->slave_ramp_1, kBlock);
  r.p = 1;
  r.q = 2;
  p->ramp_divider[1].Process(r, p->master_ramp, p->slave_ramp_2, kBlock);

  p->ramps.external = p->external_ramp;
  p->ramps.master = p->master_ramp;
  p->ramps.slave[0] = p->slave_ramp_1;
  p->ramps.slave[1] = p->slave_ramp_2;

  p->t_generator.Process(
      t_clock_patched, t_clock_flags, p->ramps, p->gate_buffer, kBlock);

  const marbles::ClockSource xy_src = x_clock_patched
      ? marbles::CLOCK_SOURCE_EXTERNAL
      : marbles::CLOCK_SOURCE_INTERNAL_T1_T2_T3;

  p->xy_generator.Process(
      xy_src,
      p->x_settings,
      p->y_settings,
      x_clock_flags,
      p->ramps,
      p->sample_buffer,
      kBlock);

  const size_t last = kBlock - 1;
  p->hold_t1 = p->gate_buffer[last * 2] ? 5.0f : 0.0f;
  p->hold_t2 = p->gate_buffer[last * 2 + 1] ? 5.0f : 0.0f;
  // t3 mirrors t1 XOR t2 style pulse from slave ramp (divider path).
  p->hold_t3 = (p->hold_t1 > 1.0f) != (p->hold_t2 > 1.0f) ? 5.0f : 0.0f;
  p->hold_x1 = p->sample_buffer[0 + last * 4];
  p->hold_x2 = p->sample_buffer[1 + last * 4];
  p->hold_x3 = p->sample_buffer[2 + last * 4];
  p->hold_y = p->sample_buffer[3 + last * 4];

  emit_held();
}

}  // extern "C"
