#include "emenay_mi_host.h"

#include <cmath>
#include <cstring>
#include <new>

#include "cv_util.h"
#include "plaits/dsp/dsp.h"
#include "plaits/dsp/voice.h"
#include "stmlib/utils/buffer_allocator.h"

struct EmenayFacets {
  plaits::Voice voice;
  stmlib::BufferAllocator allocator;
  char ram_block[16 * 1024];
  plaits::Patch patch{};
  plaits::Modulations modulations{};
  plaits::Voice::Frame block[plaits::kMaxBlockSize];
  size_t block_fill = 0;
  size_t block_pos = 0;
  bool trig_prev = false;
};

extern "C" {

EmenayFacets *emenay_facets_new(void) {
  auto *p = new (std::nothrow) EmenayFacets();
  if (!p) {
    return nullptr;
  }
  p->allocator.Init(p->ram_block, sizeof(p->ram_block));
  p->voice.Init(&p->allocator);
  emenay_facets_reset(p);
  return p;
}

void emenay_facets_delete(EmenayFacets *p) { delete p; }

void emenay_facets_reset(EmenayFacets *p) {
  if (!p) {
    return;
  }
  p->block_fill = 0;
  p->block_pos = 0;
  p->trig_prev = false;
  std::memset(&p->patch, 0, sizeof(p->patch));
  std::memset(&p->modulations, 0, sizeof(p->modulations));
  p->patch.decay = 0.2f;
  p->modulations.level = 1.0f;
}

static void render_block(EmenayFacets *p) {
  p->voice.Render(p->patch, p->modulations, p->block, plaits::kMaxBlockSize);
  p->block_fill = plaits::kMaxBlockSize;
  p->block_pos = 0;
}

void emenay_facets_process(
    EmenayFacets *p,
    const float *inputs,
    const int *connected,
    float *outputs,
    float model,
    float freq_hz,
    float harmonics,
    float timbre,
    float morph,
    float level) {
  if (!p || !outputs) {
    return;
  }

  auto finite_or = [](float v, float fallback) -> float {
    return std::isfinite(v) ? v : fallback;
  };

  const float v_oct = finite_or(inputs ? inputs[0] : 0.0f, 0.0f);
  const float trig_v = finite_or(inputs ? inputs[1] : 0.0f, 0.0f);
  const float level_cv = finite_or(inputs ? inputs[2] : 0.0f, 0.0f);
  const float model_cv = finite_or(inputs ? inputs[3] : 0.0f, 0.0f);
  const float timbre_cv = finite_or(inputs ? inputs[4] : 0.0f, 0.0f);
  const float morph_cv = finite_or(inputs ? inputs[5] : 0.0f, 0.0f);
  const float fm = finite_or(inputs ? inputs[6] : 0.0f, 0.0f);
  const float harm_cv = finite_or(inputs ? inputs[7] : 0.0f, 0.0f);

  const bool trig_connected = connected && connected[1];
  const bool level_connected = connected && connected[2];
  const bool fm_connected = connected && connected[6];

  // Keep pitch in a range MI oscillators tolerate (avoids NaN LUTs).
  const float safe_v_oct = emenay::clampf(v_oct, -5.0f, 5.0f);
  const float safe_freq = emenay::clampf(finite_or(freq_hz, 110.0f), 8.0f, 4000.0f);
  const float hz = emenay::clampf(
      emenay::hz_with_v_oct(safe_freq, safe_v_oct)
          + emenay::clampf(fm, -10.0f, 10.0f) * (fm_connected ? 40.0f : 0.0f),
      8.0f,
      8000.0f);

  // Voice registers 24 engines (8 bank-2 + 16 classic).
  const int engine =
      static_cast<int>(emenay::clampf(finite_or(model, 0.0f) + model_cv * 4.0f, 0.0f, 23.99f));

  p->patch.engine = engine;
  p->patch.note = emenay::clampf(emenay::hz_to_midi_note(hz), 0.0f, 120.0f);
  p->patch.harmonics = emenay::clampf(harmonics + harm_cv * 0.1f, 0.0f, 1.0f);
  p->patch.timbre = emenay::clampf(timbre + timbre_cv * 0.1f, 0.0f, 1.0f);
  p->patch.morph = emenay::clampf(morph + morph_cv * 0.1f, 0.0f, 1.0f);
  p->patch.frequency_modulation_amount = fm_connected ? 1.0f : 0.0f;
  p->patch.timbre_modulation_amount = 0.0f;
  p->patch.morph_modulation_amount = 0.0f;
  p->patch.decay = emenay::clampf(1.0f - level * 0.95f, 0.01f, 1.0f);
  p->patch.lpg_colour = 0.0f;

  p->modulations.engine = 0.0f;
  p->modulations.note = 0.0f;
  p->modulations.frequency = fm_connected ? fm / 5.0f : 0.0f;
  p->modulations.harmonics = 0.0f;
  p->modulations.timbre = 0.0f;
  p->modulations.morph = 0.0f;
  p->modulations.level =
      level_connected ? emenay::clampf(level_cv / 5.0f, 0.0f, 1.5f) : level;
  p->modulations.frequency_patched = fm_connected;
  p->modulations.timbre_patched = false;
  p->modulations.morph_patched = false;
  p->modulations.trigger_patched = trig_connected;
  p->modulations.level_patched = level_connected;

  const bool trig = emenay::gate_high(trig_v) && !p->trig_prev;
  p->trig_prev = emenay::gate_high(trig_v);
  p->modulations.trigger = trig ? 1.0f : 0.0f;

  if (p->block_pos >= p->block_fill) {
    render_block(p);
  }

  const plaits::Voice::Frame &frame = p->block[p->block_pos++];
  outputs[0] = emenay::short_to_audio(frame.out);
  if (outputs + 1) {
    outputs[1] = emenay::short_to_audio(frame.aux);
  }
}

}  // extern "C"
