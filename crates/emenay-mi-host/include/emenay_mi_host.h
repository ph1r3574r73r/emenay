#pragma once

#include <stddef.h>
#include <stdint.h>

#ifdef __cplusplus
extern "C" {
#endif

// --- Facets (48 kHz) ---

typedef struct EmenayFacets EmenayFacets;

EmenayFacets *emenay_facets_new(void);
void emenay_facets_delete(EmenayFacets *p);
void emenay_facets_reset(EmenayFacets *p);

/// Inputs: v_oct, trig, level_cv, model_cv, timbre_cv, morph_cv, fm, harmonics_cv
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
    float level);

// --- Chimes (48 kHz) ---

typedef struct EmenayChimes EmenayChimes;

EmenayChimes *emenay_chimes_new(void);
void emenay_chimes_delete(EmenayChimes *p);
void emenay_chimes_reset(EmenayChimes *p);

/// Inputs: v_oct, trig, in, freq_cv, structure_cv, brightness_cv, damping_cv, position_cv
/// Outputs: out, aux
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
    float polyphony);

// --- Twist (48 kHz host; internal oversampling) ---

typedef struct EmenayTwist EmenayTwist;

EmenayTwist *emenay_twist_new(void);
void emenay_twist_delete(EmenayTwist *p);
void emenay_twist_reset(EmenayTwist *p);

/// Inputs: carrier, modulator, algo_cv, timbre_cv, level1_cv, level2_cv
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
    int carrier_shape);

// --- Swell (48 kHz) ---

typedef struct EmenaySwell EmenaySwell;

EmenaySwell *emenay_swell_new(void);
void emenay_swell_delete(EmenaySwell *p);
void emenay_swell_reset(EmenaySwell *p);

/// Inputs: v_oct, trig, clock, freeze, shape_cv, slope_cv, smooth_cv, fm
/// Outputs: uni, bi, eoa, eor
/// mode: 0=AD, 1=loop, 2=AR · range: 0=high, 1=med, 2=low
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
    int range);

// --- Lots (firmware 32 kHz; host resamples I/O at 48 kHz) ---

typedef struct EmenayLots EmenayLots;

EmenayLots *emenay_lots_new(void);
void emenay_lots_delete(EmenayLots *p);
void emenay_lots_reset(EmenayLots *p);

/// Inputs: t_clock, x_clock, rate_cv, bias_cv, jitter_cv, spread_cv, x_bias_cv, steps_cv
/// Outputs: t1, t2, t3, x1, x2, x3, y
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
    float *lights_t);

#ifdef __cplusplus
}
#endif
