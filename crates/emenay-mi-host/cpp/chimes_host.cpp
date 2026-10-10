#include "emenay_mi_host.h"

#include <cmath>
#include <cstring>
#include <new>

#include "cv_util.h"
#include "rings/dsp/dsp.h"
#include "rings/dsp/part.h"
#include "rings/dsp/patch.h"
#include "rings/dsp/performance_state.h"

namespace {
constexpr size_t kBlock = rings::kMaxBlockSize; // 24
} // namespace

struct EmenayChimes {
  rings::Part part;
  uint16_t reverb_buffer[65536];
  bool trig_prev = false;
  bool strum_latched = false;
  rings::Patch patch{};
  rings::PerformanceState performance{};
  int model = rings::RESONATOR_MODEL_MODAL;
  int polyphony = 1;

  // Double-buffer: accumulate inputs while playing the previous block.
  float in_acc[kBlock]{};
  float out_buf[kBlock]{};
  float aux_buf[kBlock]{};
  size_t pos = 0;
  bool primed = false;
};

extern "C" {

EmenayChimes *emenay_chimes_new(void) {
  auto *p = new (std::nothrow) EmenayChimes();
  if (!p) {
    return nullptr;
  }
  p->part.Init(p->reverb_buffer);
  emenay_chimes_reset(p);
  return p;
}

void emenay_chimes_delete(EmenayChimes *p) { delete p; }

void emenay_chimes_reset(EmenayChimes *p) {
  if (!p) {
    return;
  }
  p->trig_prev = false;
  p->strum_latched = false;
  p->pos = 0;
  p->primed = false;
  std::memset(&p->patch, 0, sizeof(p->patch));
  std::memset(&p->performance, 0, sizeof(p->performance));
  std::memset(p->in_acc, 0, sizeof(p->in_acc));
  std::memset(p->out_buf, 0, sizeof(p->out_buf));
  std::memset(p->aux_buf, 0, sizeof(p->aux_buf));
}

void emenay_chimes_process(
    EmenayChimes *p,
    const float *inputs,
    const int *connected,
    float *outputs,
    float freq_hz,
    float structure,
    float brightness,
    float damping,
    float position,
    float model,
    float polyphony) {
  if (!p || !outputs) {
    return;
  }

  const float v_oct = inputs ? inputs[0] : 0.0f;
  const float trig_v = inputs ? inputs[1] : 0.0f;
  const float exciter = inputs ? inputs[2] : 0.0f;
  const float freq_cv = inputs ? inputs[3] : 0.0f;
  const float structure_cv = inputs ? inputs[4] : 0.0f;
  const float brightness_cv = inputs ? inputs[5] : 0.0f;
  const float damping_cv = inputs ? inputs[6] : 0.0f;
  const float position_cv = inputs ? inputs[7] : 0.0f;

  const bool exciter_connected = connected && connected[2];
  const float hz = emenay::hz_with_v_oct(freq_hz, v_oct + freq_cv * 0.2f);

  p->model = static_cast<int>(emenay::clampf(model * 5.0f, 0.0f, 5.99f));
  p->polyphony = static_cast<int>(emenay::clampf(polyphony, 1.0f, 4.0f));

  p->patch.structure =
      emenay::clampf(structure + structure_cv * 0.1f, 0.0f, 1.0f);
  p->patch.brightness =
      emenay::clampf(brightness + brightness_cv * 0.1f, 0.0f, 1.0f);
  p->patch.damping = emenay::clampf(damping + damping_cv * 0.1f, 0.0f, 1.0f);
  p->patch.position =
      emenay::clampf(position + position_cv * 0.1f, 0.0f, 1.0f);

  p->performance.note = emenay::hz_to_midi_note(hz);
  p->performance.fm = freq_cv / 5.0f;
  p->performance.internal_exciter = !exciter_connected;
  p->performance.internal_strum = false;

  const bool trig = emenay::gate_high(trig_v) && !p->trig_prev;
  p->trig_prev = emenay::gate_high(trig_v);
  if (trig) {
    p->strum_latched = true;
  }

  // Normalize exciter into a Chimes-friendly range (~±1), with a pluck impulse.
  float in_sample = 0.0f;
  if (exciter_connected) {
    in_sample = emenay::clampf(exciter / 8.0f, -1.0f, 1.0f);
  }
  if (trig) {
    in_sample += 1.0f;
  }

  p->in_acc[p->pos] = in_sample;
  if (p->primed) {
    outputs[0] = p->out_buf[p->pos];
    outputs[1] = p->aux_buf[p->pos];
  } else {
    outputs[0] = 0.0f;
    outputs[1] = 0.0f;
  }

  p->pos++;
  if (p->pos >= kBlock) {
    p->part.set_model(static_cast<rings::ResonatorModel>(p->model));
    p->part.set_polyphony(p->polyphony);
    p->performance.strum = p->strum_latched;
    p->strum_latched = false;
    p->part.Process(
        p->performance, p->patch, p->in_acc, p->out_buf, p->aux_buf, kBlock);
    // Scale firmware float (~±1) back to emenay volts.
    for (size_t i = 0; i < kBlock; ++i) {
      p->out_buf[i] *= 5.0f;
      p->aux_buf[i] *= 5.0f;
    }
    p->pos = 0;
    p->primed = true;
  }
}

}  // extern "C"
