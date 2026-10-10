#include "emenay_mi_host.h"

#include <cmath>
#include <cstring>
#include <new>

#include "cv_util.h"
#include "warps/dsp/modulator.h"

struct EmenayTwist {
  warps::Modulator modulator;
  warps::ShortFrame in_block[warps::kMaxBlockSize];
  warps::ShortFrame out_block[warps::kMaxBlockSize];
  size_t block_fill = 0;
  size_t block_pos = 0;
};

extern "C" {

EmenayTwist *emenay_twist_new(void) {
  auto *p = new (std::nothrow) EmenayTwist();
  if (!p) {
    return nullptr;
  }
  p->modulator.Init(48000.0f);
  emenay_twist_reset(p);
  return p;
}

void emenay_twist_delete(EmenayTwist *p) { delete p; }

void emenay_twist_reset(EmenayTwist *p) {
  if (!p) {
    return;
  }
  p->block_fill = 0;
  p->block_pos = 0;
}

static void render_block(EmenayTwist *p) {
  p->modulator.Process(p->in_block, p->out_block, warps::kMaxBlockSize);
  p->block_fill = warps::kMaxBlockSize;
  p->block_pos = 0;
}

void emenay_twist_process(
    EmenayTwist *p,
    const float *inputs,
    const int *connected,
    float *outputs,
    float algorithm,
    float timbre,
    float level1,
    float level2,
    float internal_freq_hz,
    int carrier_shape) {
  if (!p || !outputs) {
    return;
  }

  const float carrier = inputs ? inputs[0] : 0.0f;
  const float modulator_in = inputs ? inputs[1] : 0.0f;
  const float algo_cv = inputs ? inputs[2] : 0.0f;
  const float timbre_cv = inputs ? inputs[3] : 0.0f;
  const float level1_cv = inputs ? inputs[4] : 0.0f;
  const float level2_cv = inputs ? inputs[5] : 0.0f;

  const bool carrier_connected = connected && connected[0];
  const bool mod_connected = connected && connected[1];
  const bool level1_cv_connected = connected && connected[4];
  const bool level2_cv_connected = connected && connected[5];

  warps::Parameters *params = p->modulator.mutable_parameters();
  // Firmware morphs algorithm 0…1 across ~8 algorithms.
  params->modulation_algorithm =
      emenay::clampf(algorithm + algo_cv * 0.1f, 0.0f, 1.0f) * 8.0f;
  params->modulation_parameter =
      emenay::clampf(timbre + timbre_cv * 0.1f, 0.0f, 1.0f);
  params->channel_drive[0] = emenay::clampf(
      level1_cv_connected ? level1 * (level1_cv / 5.0f) : level1, 0.0f, 1.0f);
  params->channel_drive[1] = emenay::clampf(
      level2_cv_connected ? level2 * (level2_cv / 5.0f) : level2, 0.0f, 1.0f);
  if (carrier_connected) {
    params->carrier_shape = 0;
  } else {
    const int shape = carrier_shape < 0 ? 0 : (carrier_shape > 4 ? 4 : carrier_shape);
    params->carrier_shape = shape == 0 ? warps::OSCILLATOR_SHAPE_SINE : shape;
  }
  params->note = emenay::hz_to_midi_note(internal_freq_hz);

  if (p->block_pos >= p->block_fill) {
    const float c = carrier_connected ? carrier : 0.0f;
    const float m = mod_connected ? modulator_in : 0.0f;
    for (size_t i = 0; i < warps::kMaxBlockSize; ++i) {
      p->in_block[i].l = emenay::audio_to_short(c);
      p->in_block[i].r = emenay::audio_to_short(m);
    }
    render_block(p);
  }

  const warps::ShortFrame &frame = p->out_block[p->block_pos++];
  outputs[0] = emenay::short_to_audio(frame.l);
  outputs[1] = emenay::short_to_audio(frame.r);
}

}  // extern "C"
