/** Named patch presets — built-ins + user saves in localStorage. */

export type PresetCable = {
  id: number
  from: { module: number; port: string }
  to: { module: number; port: string }
}

/** Module layout stored in HP units so zoom changes don't break presets. */
export type PresetModule = {
  id: number
  type_id: string
  /** Horizontal position in HP (pixels = xHp * hpPx). Speaker ignores layout. */
  xHp: number
  y: number
  params: Record<string, number>
}

export type PresetGraph = {
  modules: PresetModule[]
  cables: PresetCable[]
  next_module_id: number
  next_cable_id: number
}

export type Preset = {
  id: string
  name: string
  builtin?: boolean
  updatedAt: number
  graph: PresetGraph
}

/** Live engine graph shape (subset used by pack/unpack). */
export type LiveGraph = {
  modules: Array<{
    id: number
    type_id: string
    x: number
    y: number
    params: Record<string, number>
  }>
  cables: PresetCable[]
  next_module_id: number
  next_cable_id: number
}

const STORAGE_KEY = 'emenay.presets.v1'
const PRESET_VERSION = 1

type StoredBlob = { version: number; presets: Preset[] }

function uid() {
  return `p_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`
}

function m(
  id: number,
  type_id: string,
  xHp: number,
  y: number,
  params: Record<string, number> = {},
): PresetModule {
  return { id, type_id, xHp, y, params }
}

function cable(
  id: number,
  fromMod: number,
  fromPort: string,
  toMod: number,
  toPort: string,
): PresetCable {
  return {
    id,
    from: { module: fromMod, port: fromPort },
    to: { module: toMod, port: toPort },
  }
}

const SPEAKER = 1

/** Semitones → 1V/oct (0 = oscillator root / C on the panel). */
function deg(...semis: number[]): number[] {
  return semis.map((s) => s / 12)
}

/** Sequencer sN / gN params. Pitches are 1V/oct degrees; gates mute rests. */
function seqParams(
  pitches: number[],
  gates: Array<0 | 1>,
  extra: Record<string, number> = {},
): Record<string, number> {
  const n = Math.max(pitches.length, gates.length)
  const p: Record<string, number> = {
    length: n,
    glide: 0,
    ...extra,
  }
  for (let i = 0; i < n; i++) {
    p[`s${i + 1}`] = pitches[i] ?? pitches[pitches.length - 1] ?? 0
    p[`g${i + 1}`] = gates[i] ?? 1
  }
  return p
}

function graph(
  modules: PresetModule[],
  cables: PresetCable[],
  nextModule: number,
  nextCable: number,
): PresetGraph {
  return {
    modules: [m(SPEAKER, 'speaker', 0, 0, { channels: 2 }), ...modules],
    cables,
    next_module_id: nextModule,
    next_cable_id: nextCable,
  }
}

function mixerParams(
  g1: number,
  g2: number,
  g3: number,
  g4: number,
): Record<string, number> {
  return {
    ch1: g1,
    ch2: g2,
    ch3: g3,
    ch4: g4,
    mute1: g1 > 0.01 ? 0 : 1,
    mute2: g2 > 0.01 ? 0 : 1,
    mute3: g3 > 0.01 ? 0 : 1,
    mute4: g4 > 0.01 ? 0 : 1,
    mute_mix: 0,
  }
}

/** Built-in melody & beat patches (module positions in HP). */
export const BUILTIN_PRESETS: Preset[] = [
  {
    id: 'builtin-empty',
    name: 'Empty rack',
    builtin: true,
    updatedAt: 0,
    graph: graph([], [], 2, 1),
  },

  // ── Starters / single-voice ───────────────────────────────
  {
    id: 'builtin-voice',
    name: 'Clocked voice',
    builtin: true,
    updatedAt: 0,
    graph: graph(
      [
        m(2, 'fm_clock', 0, 0, { bpm: 110, pw: 0.2 }),
        m(3, 'envelope', 8, 0, {
          attack: 0.01,
          decay: 0.25,
          sustain: 0.35,
          release: 0.35,
        }),
        m(4, 'vco', 16, 0, { freq: 110, fm_amt: 0, pwm_amt: 0.4 }),
        m(5, 'dual_vca', 28, 0, { bias_a: 0, bias_b: 0, exp_a: 0, exp_b: 0 }),
      ],
      [
        cable(1, 2, 'clk1', 3, 'gate'),
        cable(2, 4, 'saw', 5, 'in_a'),
        cable(3, 3, 'env', 5, 'cv_a'),
        cable(4, 5, 'out_a', SPEAKER, 'ch1'),
      ],
      6,
      5,
    ),
  },
  {
    id: 'builtin-facets-solo',
    name: 'Facets',
    builtin: true,
    updatedAt: 0,
    // One module → speaker
    graph: graph(
      [
        m(2, 'facets', 0, 0, {
          model: 0,
          freq: 110,
          harmonics: 0.5,
          timbre: 0.5,
          morph: 0.5,
          level: 0.85,
        }),
      ],
      [cable(1, 2, 'out', SPEAKER, 'ch1')],
      3,
      2,
    ),
  },

  // ── MIDI → CV ─────────────────────────────────────────────
  {
    id: 'builtin-midi-keys',
    name: 'MIDI keys',
    builtin: true,
    updatedAt: 0,
    // Ch1 → Facets voice (play MIDI channel 1)
    graph: graph(
      [
        m(2, 'midi_cv', 0, 0, { omni: 1, bend_range: 2 }),
        m(3, 'facets', 12, 0, {
          model: 0,
          freq: 261.63,
          harmonics: 0.45,
          timbre: 0.35,
          morph: 0.55,
          level: 0.9,
        }),
        m(4, 'envelope', 24, 0, {
          attack: 0.005,
          decay: 0.2,
          sustain: 0.65,
          release: 0.28,
        }),
        m(5, 'dual_vca', 32, 0, { bias_a: 0, bias_b: 0, exp_a: 0, exp_b: 0 }),
        m(6, 'erica_output', 42, 0, { level: 0.7 }),
      ],
      [
        cable(1, 2, 'cv1', 3, 'v_oct'),
        cable(2, 2, 'gate1', 4, 'gate'),
        cable(3, 2, 'mod', 3, 'timbre_cv'),
        cable(4, 3, 'out', 5, 'in_a'),
        cable(5, 4, 'env', 5, 'cv_a'),
        cable(6, 5, 'out_a', 6, 'in_l'),
        cable(7, 5, 'out_a', 6, 'in_r'),
        cable(8, 6, 'line_l', SPEAKER, 'ch1'),
        cable(9, 6, 'line_r', SPEAKER, 'ch2'),
      ],
      7,
      10,
    ),
  },
  {
    id: 'builtin-midi-bass-lead',
    name: 'MIDI bass + lead',
    builtin: true,
    updatedAt: 0,
    // Ch1 bass (Facets), Ch2 lead (VCO) — set keyboard to split / two channels
    graph: graph(
      [
        m(2, 'midi_cv', 0, 0, { omni: 0 }),
        m(3, 'facets', 12, 0, {
          model: 8,
          freq: 55,
          harmonics: 0.55,
          timbre: 0.5,
          morph: 0.4,
          level: 0.95,
        }),
        m(4, 'envelope', 24, 0, {
          attack: 0.01,
          decay: 0.35,
          sustain: 0.7,
          release: 0.4,
        }),
        m(5, 'dual_vca', 32, 0, { bias_a: 0, bias_b: 0, exp_a: 0, exp_b: 0 }),
        m(6, 'vco', 42, 0, { freq: 220, fm_amt: 0, pwm_amt: 0.35 }),
        m(7, 'envelope', 54, 0, {
          attack: 0.002,
          decay: 0.15,
          sustain: 0.4,
          release: 0.2,
        }),
        m(8, 'dual_vca', 62, 0, { bias_a: 0, bias_b: 0, exp_a: 0, exp_b: 0 }),
        m(9, 'erica_mixer', 72, 0, mixerParams(0.7, 0.45, 0, 0)),
        m(10, 'erica_output', 80, 0, { level: 0.65 }),
      ],
      [
        cable(1, 2, 'cv1', 3, 'v_oct'),
        cable(2, 2, 'gate1', 4, 'gate'),
        cable(3, 3, 'out', 5, 'in_a'),
        cable(4, 4, 'env', 5, 'cv_a'),
        cable(5, 2, 'cv2', 6, 'v_oct'),
        cable(6, 2, 'gate2', 7, 'gate'),
        cable(7, 6, 'saw', 8, 'in_a'),
        cable(8, 7, 'env', 8, 'cv_a'),
        cable(9, 5, 'out_a', 9, 'in1'),
        cable(10, 8, 'out_a', 9, 'in2'),
        cable(11, 9, 'out', 10, 'in_l'),
        cable(12, 9, 'out', 10, 'in_r'),
        cable(13, 10, 'line_l', SPEAKER, 'ch1'),
        cable(14, 10, 'line_r', SPEAKER, 'ch2'),
      ],
      11,
      15,
    ),
  },
  {
    id: 'builtin-midi-duo',
    name: 'MIDI duo',
    builtin: true,
    updatedAt: 0,
    // Two equal Facets voices on MIDI ch 1–2
    graph: graph(
      [
        m(2, 'midi_cv', 0, 0, { omni: 0 }),
        m(3, 'facets', 12, 0, {
          model: 0,
          freq: 220,
          harmonics: 0.4,
          timbre: 0.45,
          morph: 0.5,
          level: 0.85,
        }),
        m(4, 'ar', 24, 0, { attack: 0.005, release: 0.22 }),
        m(5, 'dual_vca', 32, 0, { bias_a: 0, bias_b: 0, exp_a: 0, exp_b: 0 }),
        m(6, 'facets', 42, 0, {
          model: 9,
          freq: 220,
          harmonics: 0.55,
          timbre: 0.55,
          morph: 0.45,
          level: 0.85,
        }),
        m(7, 'ar', 54, 0, { attack: 0.008, release: 0.28 }),
        m(8, 'dual_vca', 62, 0, { bias_a: 0, bias_b: 0, exp_a: 0, exp_b: 0 }),
        m(9, 'erica_mixer', 72, 0, mixerParams(0.55, 0.55, 0, 0)),
        m(10, 'reverb', 80, 0, { size: 0.45, decay: 0.55, damp: 0.4, mix: 0.22 }),
        m(11, 'erica_output', 88, 0, { level: 0.65 }),
      ],
      [
        cable(1, 2, 'cv1', 3, 'v_oct'),
        cable(2, 2, 'gate1', 4, 'gate'),
        cable(3, 3, 'out', 5, 'in_a'),
        cable(4, 4, 'env', 5, 'cv_a'),
        cable(5, 2, 'cv2', 6, 'v_oct'),
        cable(6, 2, 'gate2', 7, 'gate'),
        cable(7, 6, 'out', 8, 'in_a'),
        cable(8, 7, 'env', 8, 'cv_a'),
        cable(9, 5, 'out_a', 9, 'in1'),
        cable(10, 8, 'out_a', 9, 'in2'),
        cable(11, 9, 'out', 10, 'in_l'),
        cable(12, 9, 'out', 10, 'in_r'),
        cable(13, 10, 'out_l', 11, 'in_l'),
        cable(14, 10, 'out_r', 11, 'in_r'),
        cable(15, 11, 'line_l', SPEAKER, 'ch1'),
        cable(16, 11, 'line_r', SPEAKER, 'ch2'),
      ],
      12,
      17,
    ),
  },
  {
    id: 'builtin-midi-poly4',
    name: 'MIDI poly 4',
    builtin: true,
    updatedAt: 0,
    // Four monophonic voices on MIDI ch 1–4 (use a multi-channel / MPE host, or
    // a DAW that spreads notes across channels)
    graph: graph(
      [
        m(2, 'midi_cv', 0, 0, { omni: 0 }),
        m(3, 'facets', 12, 0, {
          model: 0,
          freq: 261.63,
          harmonics: 0.4,
          timbre: 0.4,
          morph: 0.5,
          level: 0.9,
        }),
        m(4, 'ar', 24, 0, { attack: 0.004, release: 0.2 }),
        m(5, 'facets', 32, 0, {
          model: 0,
          freq: 261.63,
          harmonics: 0.42,
          timbre: 0.42,
          morph: 0.52,
          level: 0.9,
        }),
        m(6, 'ar', 44, 0, { attack: 0.004, release: 0.2 }),
        m(7, 'facets', 52, 0, {
          model: 0,
          freq: 261.63,
          harmonics: 0.38,
          timbre: 0.45,
          morph: 0.48,
          level: 0.9,
        }),
        m(8, 'ar', 64, 0, { attack: 0.004, release: 0.2 }),
        m(9, 'facets', 72, 0, {
          model: 0,
          freq: 261.63,
          harmonics: 0.45,
          timbre: 0.38,
          morph: 0.55,
          level: 0.9,
        }),
        m(10, 'ar', 84, 0, { attack: 0.004, release: 0.2 }),
        // Row 2: VCAs + mix + out
        m(11, 'dual_vca', 0, 1, { bias_a: 0, bias_b: 0, exp_a: 0, exp_b: 0 }),
        m(12, 'dual_vca', 10, 1, { bias_a: 0, bias_b: 0, exp_a: 0, exp_b: 0 }),
        m(13, 'erica_mixer', 20, 1, mixerParams(0.45, 0.45, 0.45, 0.45)),
        m(14, 'delay', 28, 1, { time: 0.28, feedback: 0.25, mix: 0.15 }),
        m(15, 'erica_output', 36, 1, { level: 0.6 }),
      ],
      [
        cable(1, 2, 'cv1', 3, 'v_oct'),
        cable(2, 2, 'gate1', 4, 'gate'),
        cable(3, 3, 'out', 11, 'in_a'),
        cable(4, 4, 'env', 11, 'cv_a'),
        cable(5, 2, 'cv2', 5, 'v_oct'),
        cable(6, 2, 'gate2', 6, 'gate'),
        cable(7, 5, 'out', 11, 'in_b'),
        cable(8, 6, 'env', 11, 'cv_b'),
        cable(9, 2, 'cv3', 7, 'v_oct'),
        cable(10, 2, 'gate3', 8, 'gate'),
        cable(11, 7, 'out', 12, 'in_a'),
        cable(12, 8, 'env', 12, 'cv_a'),
        cable(13, 2, 'cv4', 9, 'v_oct'),
        cable(14, 2, 'gate4', 10, 'gate'),
        cable(15, 9, 'out', 12, 'in_b'),
        cable(16, 10, 'env', 12, 'cv_b'),
        cable(17, 11, 'out_a', 13, 'in1'),
        cable(18, 11, 'out_b', 13, 'in2'),
        cable(19, 12, 'out_a', 13, 'in3'),
        cable(20, 12, 'out_b', 13, 'in4'),
        cable(21, 13, 'out', 14, 'in'),
        cable(22, 14, 'out_l', 15, 'in_l'),
        cable(23, 14, 'out_r', 15, 'in_r'),
        cable(24, 15, 'line_l', SPEAKER, 'ch1'),
        cable(25, 15, 'line_r', SPEAKER, 'ch2'),
      ],
      16,
      26,
    ),
  },
  {
    id: 'builtin-midi-pad',
    name: 'MIDI pad',
    builtin: true,
    updatedAt: 0,
    // Slow envelopes + chimes/reverb — hold notes on any MIDI channel (omni)
    graph: graph(
      [
        m(2, 'midi_cv', 0, 0, { omni: 1 }),
        m(3, 'facets', 12, 0, {
          model: 6,
          freq: 110,
          harmonics: 0.5,
          timbre: 0.35,
          morph: 0.6,
          level: 0.85,
        }),
        m(4, 'envelope', 24, 0, {
          attack: 0.35,
          decay: 0.5,
          sustain: 0.85,
          release: 0.9,
        }),
        m(5, 'dual_vca', 32, 0, { bias_a: 0, bias_b: 0, exp_a: 0, exp_b: 0 }),
        m(6, 'chimes', 42, 0, {
          freq: 220,
          structure: 0.45,
          brightness: 0.4,
          damping: 0.55,
          position: 0.5,
          model: 0,
          polyphony: 2,
        }),
        m(7, 'reverb', 54, 0, { size: 0.7, decay: 0.75, damp: 0.35, mix: 0.4 }),
        m(8, 'erica_output', 62, 0, { level: 0.55 }),
      ],
      [
        cable(1, 2, 'cv1', 3, 'v_oct'),
        cable(2, 2, 'gate1', 4, 'gate'),
        cable(3, 3, 'out', 5, 'in_a'),
        cable(4, 4, 'env', 5, 'cv_a'),
        cable(5, 5, 'out_a', 6, 'in'),
        cable(6, 2, 'cv1', 6, 'v_oct'),
        cable(7, 2, 'gate1', 6, 'trig'),
        cable(8, 6, 'out', 7, 'in_l'),
        cable(9, 6, 'aux', 7, 'in_r'),
        cable(10, 7, 'out_l', 8, 'in_l'),
        cable(11, 7, 'out_r', 8, 'in_r'),
        cable(12, 8, 'line_l', SPEAKER, 'ch1'),
        cable(13, 8, 'line_r', SPEAKER, 'ch2'),
      ],
      9,
      14,
    ),
  },
  {
    id: 'builtin-midi-facets-drums',
    name: 'MIDI Facets + drums',
    builtin: true,
    updatedAt: 0,
    // Row0: MIDI→Facets voice. Row1: same clock→drums recipe as “Four on the floor”.
    graph: graph(
      [
        // --- voice ---
        m(2, 'midi_cv', 0, 0, { omni: 1, bend_range: 2 }),
        m(3, 'facets', 12, 0, {
          model: 0,
          freq: 220,
          harmonics: 0.45,
          timbre: 0.35,
          morph: 0.5,
          level: 0.95,
        }),
        m(4, 'envelope', 24, 0, {
          attack: 0.005,
          decay: 0.2,
          sustain: 0.6,
          release: 0.28,
        }),
        m(5, 'dual_vca', 32, 0, { bias_a: 0, bias_b: 0, exp_a: 0, exp_b: 0 }),
        m(6, 'erica_mixer', 42, 0, {
          ch1: 0.85,
          ch2: 0.8,
          ch3: 0,
          ch4: 0,
          mute1: 0,
          mute2: 0,
          mute3: 1,
          mute4: 1,
          mute_mix: 0,
        }),
        // --- beat (proven four-on-floor wiring) ---
        m(7, 'fm_clock', 0, 1, { bpm: 120, pw: 0.12 }),
        m(8, 'clk_mult', 8, 1, { pw: 0.18 }),
        m(9, 'divider', 12, 1, { pw: 0.35 }),
        m(10, 'drums', 16, 1, {
          tone: 0.42,
          snappy: 0.55,
          decay: 0.4,
          level: 0.95,
        }),
      ],
      [
        // MIDI keys → Facets → env VCA (pitch wheel on cv1; mod → timbre)
        cable(1, 2, 'cv1', 3, 'v_oct'),
        cable(2, 2, 'gate1', 4, 'gate'),
        cable(3, 2, 'mod', 3, 'timbre_cv'),
        cable(4, 3, 'out', 5, 'in_a'),
        cable(5, 4, 'env', 5, 'cv_a'),
        // Clock → mult / divider → drums (x1 kick, d2 snare, x4 hats)
        cable(6, 7, 'clk1', 8, 'clock'),
        cable(7, 7, 'clk2', 9, 'clock'),
        cable(8, 8, 'x1', 10, 'bd'),
        cable(9, 9, 'd2', 10, 'sd'),
        cable(10, 8, 'x4', 10, 'ch'),
        cable(11, 8, 'x2', 10, 'oh'),
        // Mix lead + drums → speaker
        cable(12, 5, 'out_a', 6, 'in1'),
        cable(13, 10, 'mix', 6, 'in2'),
        cable(14, 6, 'out', SPEAKER, 'ch1'),
        cable(15, 6, 'out2', SPEAKER, 'ch2'),
      ],
      11,
      16,
    ),
  },
  {
    id: 'builtin-facets',
    name: 'Facets drone',
    builtin: true,
    updatedAt: 0,
    graph: graph(
      [
        m(2, 'facets', 0, 0, {
          model: 2,
          freq: 55,
          harmonics: 0.55,
          timbre: 0.45,
          morph: 0.5,
          level: 0.85,
        }),
        m(3, 'lfo', 12, 0, { rate: 0.35, shape: 0.5, level: 0.4 }),
      ],
      [
        cable(1, 3, 'out', 2, 'timbre_cv'),
        cable(2, 2, 'out', SPEAKER, 'ch1'),
      ],
      4,
      3,
    ),
  },
  {
    id: 'builtin-wobble',
    name: 'LFO wobble',
    builtin: true,
    updatedAt: 0,
    graph: graph(
      [
        m(2, 'lfo', 0, 0, { rate: 0.45, shape: 0.5, level: 0.55 }),
        m(3, 'vco', 8, 0, { freq: 110, fm_amt: 0.55, pwm_amt: 0.3 }),
        m(4, 'dual_vca', 20, 0, { bias_a: 0.55, bias_b: 0, exp_a: 0, exp_b: 0 }),
      ],
      [
        cable(1, 2, 'out', 3, 'fm'),
        cable(2, 3, 'saw', 4, 'in_a'),
        cable(3, 4, 'out_a', SPEAKER, 'ch1'),
      ],
      5,
      4,
    ),
  },
  {
    id: 'builtin-seq',
    name: 'Seq melody',
    builtin: true,
    updatedAt: 0,
    graph: graph(
      [
        m(2, 'fm_clock', 0, 0, { bpm: 128, pw: 0.18 }),
        m(
          3,
          'sequencer',
          8,
          0,
          seqParams(deg(0, 2, 4, 6, 4, 2, 1, 3), [1, 1, 1, 1, 0, 1, 1, 0], {
            glide: 0.08,
          }),
        ),
        m(4, 'envelope', 20, 0, {
          attack: 0.005,
          decay: 0.18,
          sustain: 0.25,
          release: 0.22,
        }),
        m(5, 'vco', 28, 0, { freq: 130.81, fm_amt: 0, pwm_amt: 0.45 }),
        m(6, 'dual_vca', 40, 0, { bias_a: 0, bias_b: 0, exp_a: 0, exp_b: 0 }),
      ],
      [
        cable(1, 2, 'clk1', 3, 'clock'),
        cable(2, 3, 'gate', 4, 'gate'),
        cable(3, 3, 'cv', 5, 'v_oct'),
        cable(4, 5, 'saw', 6, 'in_a'),
        cable(5, 4, 'env', 6, 'cv_a'),
        cable(6, 6, 'out_a', SPEAKER, 'ch1'),
      ],
      7,
      7,
    ),
  },
  {
    id: 'builtin-drums',
    name: 'Beat box',
    builtin: true,
    updatedAt: 0,
    graph: graph(
      [
        m(2, 'fm_clock', 0, 0, { bpm: 120, pw: 0.12 }),
        m(3, 'divider', 8, 0, { pw: 0.45 }),
        m(4, 'drums', 12, 0, {
          tone: 0.4,
          snappy: 0.6,
          decay: 0.45,
          level: 0.9,
        }),
        m(5, 'delay', 24, 0, {
          time: 0.28,
          feedback: 0.25,
          mix: 0.22,
          pingpong: 1,
        }),
      ],
      [
        cable(1, 2, 'clk1', 3, 'clock'),
        cable(2, 3, 'd1', 4, 'bd'),
        cable(3, 3, 'd2', 4, 'sd'),
        cable(4, 3, 'd4', 4, 'ch'),
        cable(5, 3, 'd8', 4, 'oh'),
        cable(6, 4, 'mix', 5, 'in'),
        cable(7, 5, 'out_l', SPEAKER, 'ch1'),
        cable(8, 5, 'out_r', SPEAKER, 'ch2'),
      ],
      6,
      9,
    ),
  },
  {
    id: 'builtin-random',
    name: 'Random walk',
    builtin: true,
    updatedAt: 0,
    graph: graph(
      [
        m(2, 'fm_clock', 0, 0, { bpm: 95, pw: 0.2 }),
        m(3, 'noise', 8, 0, { level: 0.8, color: 0.35 }),
        m(4, 'sample_hold', 14, 0, { slew: 0.15, noise: 0 }),
        m(5, 'vco', 18, 0, { freq: 110, fm_amt: 0, pwm_amt: 0.5 }),
        m(6, 'ar', 30, 0, { attack: 0.01, release: 0.35 }),
        m(7, 'dual_vca', 34, 0, { bias_a: 0, bias_b: 0, exp_a: 0, exp_b: 0 }),
      ],
      [
        cable(1, 2, 'clk1', 4, 'clock'),
        cable(2, 2, 'clk1', 6, 'trig'),
        cable(3, 3, 'slow', 4, 'in'),
        cable(4, 4, 'out', 5, 'v_oct'),
        cable(5, 5, 'tri', 7, 'in_a'),
        cable(6, 6, 'env', 7, 'cv_a'),
        cable(7, 7, 'out_a', SPEAKER, 'ch1'),
      ],
      8,
      8,
    ),
  },
  {
    id: 'builtin-chimes',
    name: 'Chimes space',
    builtin: true,
    updatedAt: 0,
    graph: graph(
      [
        m(2, 'fm_clock', 0, 0, { bpm: 72, pw: 0.15 }),
        m(3, 'chimes', 8, 0, {
          freq: 220,
          structure: 0.45,
          brightness: 0.6,
          damping: 0.35,
          position: 0.4,
          model: 0,
          polyphony: 2,
        }),
        m(4, 'lfo', 20, 0, { rate: 0.2, shape: 0.5, level: 0.35 }),
        m(5, 'reverb', 28, 0, {
          size: 0.7,
          decay: 0.85,
          damp: 0.3,
          mix: 0.4,
        }),
      ],
      [
        cable(1, 2, 'clk1', 3, 'trig'),
        cable(2, 4, 'out', 3, 'structure_cv'),
        cable(3, 3, 'out', 5, 'in_l'),
        cable(4, 3, 'aux', 5, 'in_r'),
        cable(5, 5, 'out_l', SPEAKER, 'ch1'),
        cable(6, 5, 'out_r', SPEAKER, 'ch2'),
      ],
      6,
      7,
    ),
  },
  {
    id: 'builtin-bass',
    name: 'Filter bass',
    builtin: true,
    updatedAt: 0,
    graph: graph(
      [
        m(2, 'fm_clock', 0, 0, { bpm: 100, pw: 0.2 }),
        m(3, 'ar', 8, 0, { attack: 0.005, release: 0.28 }),
        m(4, 'vco', 12, 0, { freq: 55, fm_amt: 0, pwm_amt: 0.55 }),
        m(5, 'wasp', 24, 0, { cutoff: 420, res: 0.55, drive: 0.5 }),
        m(6, 'dual_vca', 32, 0, { bias_a: 0, bias_b: 0, exp_a: 1, exp_b: 0 }),
      ],
      [
        cable(1, 2, 'clk1', 3, 'trig'),
        cable(2, 4, 'saw', 5, 'in'),
        cable(3, 3, 'env', 5, 'cv'),
        cable(4, 5, 'lp', 6, 'in_a'),
        cable(5, 3, 'env', 6, 'cv_a'),
        cable(6, 6, 'out_a', SPEAKER, 'ch1'),
      ],
      7,
      7,
    ),
  },
  {
    id: 'builtin-twist',
    name: 'Twist fold',
    builtin: true,
    updatedAt: 0,
    graph: graph(
      [
        m(2, 'vco', 0, 0, { freq: 110, fm_amt: 0, pwm_amt: 0.4 }),
        m(3, 'lfo', 12, 0, { rate: 0.55, shape: 0.3, level: 0.7 }),
        m(4, 'twist', 20, 0, {
          algorithm: 0.25,
          timbre: 0.55,
          level1: 0.85,
          level2: 0.7,
          freq: 220,
          carrier_shape: 1,
        }),
      ],
      [
        cable(1, 2, 'saw', 4, 'carrier'),
        cable(2, 3, 'out', 4, 'modulator'),
        cable(3, 4, 'out', SPEAKER, 'ch1'),
      ],
      5,
      4,
    ),
  },
  {
    id: 'builtin-delay',
    name: 'Delay wash',
    builtin: true,
    updatedAt: 0,
    graph: graph(
      [
        m(2, 'facets', 0, 0, {
          model: 8,
          freq: 80,
          harmonics: 0.5,
          timbre: 0.4,
          morph: 0.6,
          level: 0.7,
        }),
        m(3, 'lfo', 12, 0, { rate: 0.18, shape: 0.5, level: 0.4 }),
        m(4, 'delay', 20, 0, {
          time: 0.42,
          feedback: 0.55,
          mix: 0.45,
          pingpong: 1,
        }),
        m(5, 'stereo', 28, 0, { pan: 0, width: 1, level: 0.85 }),
      ],
      [
        cable(1, 3, 'out', 2, 'morph_cv'),
        cable(2, 2, 'out', 4, 'in'),
        cable(3, 4, 'out_l', 5, 'in_l'),
        cable(4, 4, 'out_r', 5, 'in_r'),
        cable(5, 5, 'out_l', SPEAKER, 'ch1'),
        cable(6, 5, 'out_r', SPEAKER, 'ch2'),
      ],
      6,
      7,
    ),
  },
  {
    id: 'builtin-bitboy',
    name: 'BitBoy chiptune',
    builtin: true,
    updatedAt: 0,
    graph: graph(
      [
        m(2, 'fm_clock', 0, 0, { bpm: 140, pw: 0.2 }),
        m(
          3,
          'sequencer',
          8,
          0,
          seqParams(deg(0, 1, 2, 3, 4, 3, 2, 0), [1, 1, 1, 1, 1, 1, 1, 0]),
        ),
        m(4, 'bitboy', 20, 0, {
          mode: 1,
          tune: 0,
          frame: 0.35,
          morph: 0.45,
          level: 0.85,
        }),
      ],
      [
        cable(1, 2, 'clk1', 3, 'clock'),
        cable(2, 3, 'cv', 4, 'v_oct'),
        cable(3, 3, 'gate', 4, 'gate'),
        cable(4, 4, 'out', SPEAKER, 'ch1'),
      ],
      5,
      5,
    ),
  },
  {
    id: 'builtin-swell',
    name: 'Swell waves',
    builtin: true,
    updatedAt: 0,
    graph: graph(
      [
        m(2, 'swell', 0, 0, {
          freq: 0.4,
          shape: 0.35,
          slope: 0.55,
          smoothness: 0.4,
          mode: 1,
          range: 2,
        }),
        m(3, 'facets', 12, 0, {
          model: 1,
          freq: 65.41,
          harmonics: 0.6,
          timbre: 0.5,
          morph: 0.5,
          level: 0.75,
        }),
        m(4, 'dual_vca', 24, 0, { bias_a: 0.15, bias_b: 0, exp_a: 0, exp_b: 0 }),
        m(5, 'reverb', 34, 0, {
          size: 0.6,
          decay: 0.8,
          damp: 0.35,
          mix: 0.35,
        }),
      ],
      [
        cable(1, 2, 'uni', 3, 'level_cv'),
        cable(2, 2, 'bi', 3, 'fm'),
        cable(3, 3, 'out', 4, 'in_a'),
        cable(4, 2, 'uni', 4, 'cv_a'),
        cable(5, 4, 'out_a', 5, 'in_l'),
        cable(6, 5, 'out_l', SPEAKER, 'ch1'),
        cable(7, 5, 'out_r', SPEAKER, 'ch2'),
      ],
      6,
      8,
    ),
  },
  {
    id: 'builtin-noise-filter',
    name: 'Noise filter',
    builtin: true,
    updatedAt: 0,
    graph: graph(
      [
        m(2, 'noise', 0, 0, { level: 0.75, color: 0.5 }),
        m(3, 'lfo', 6, 0, { rate: 0.3, shape: 0.5, level: 0.6 }),
        m(4, 'vcf', 14, 0, { cutoff: 600, res: 0.45, fm_amt: 0.7 }),
        m(5, 'dual_vca', 24, 0, { bias_a: 0.5, bias_b: 0, exp_a: 0, exp_b: 0 }),
      ],
      [
        cable(1, 2, 'white', 4, 'in'),
        cable(2, 3, 'out', 4, 'fm'),
        cable(3, 4, 'bp', 5, 'in_a'),
        cable(4, 5, 'out_a', SPEAKER, 'ch1'),
      ],
      6,
      5,
    ),
  },

  // ── Melodies ──────────────────────────────────────────────
  {
    id: 'builtin-arp',
    name: 'Major arp',
    builtin: true,
    updatedAt: 0,
    // C E G C′ E′ G E C — VCO root C3
    graph: graph(
      [
        m(2, 'fm_clock', 0, 0, { bpm: 132, pw: 0.18 }),
        m(
          3,
          'sequencer',
          8,
          0,
          seqParams(deg(0, 4, 7, 12, 16, 19, 16, 12), [1, 1, 1, 1, 1, 1, 1, 1]),
        ),
        m(4, 'envelope', 20, 0, {
          attack: 0.005,
          decay: 0.2,
          sustain: 0.15,
          release: 0.18,
        }),
        m(5, 'vco', 28, 0, { freq: 130.81, fm_amt: 0, pwm_amt: 0.4 }),
        m(6, 'dual_vca', 40, 0, { bias_a: 0, bias_b: 0, exp_a: 0, exp_b: 0 }),
      ],
      [
        cable(1, 2, 'clk1', 3, 'clock'),
        cable(2, 3, 'gate', 4, 'gate'),
        cable(3, 3, 'cv', 5, 'v_oct'),
        cable(4, 5, 'tri', 6, 'in_a'),
        cable(5, 4, 'env', 6, 'cv_a'),
        cable(6, 6, 'out_a', SPEAKER, 'ch1'),
      ],
      7,
      7,
    ),
  },
  {
    id: 'builtin-blues',
    name: 'Blues riff',
    builtin: true,
    updatedAt: 0,
    // C Eb F F# G Bb G Eb with rests
    graph: graph(
      [
        m(2, 'fm_clock', 0, 0, { bpm: 98, pw: 0.2 }),
        m(
          3,
          'sequencer',
          8,
          0,
          seqParams(
            deg(0, 3, 5, 6, 7, 10, 7, 3),
            [1, 1, 1, 1, 1, 1, 0, 1],
            { glide: 0.12 },
          ),
        ),
        m(4, 'envelope', 20, 0, {
          attack: 0.01,
          decay: 0.22,
          sustain: 0.4,
          release: 0.3,
        }),
        m(5, 'vco', 28, 0, { freq: 110, fm_amt: 0, pwm_amt: 0.55 }),
        m(6, 'wasp', 40, 0, { cutoff: 900, res: 0.4, drive: 0.35 }),
        m(7, 'dual_vca', 48, 0, { bias_a: 0, bias_b: 0, exp_a: 0, exp_b: 0 }),
      ],
      [
        cable(1, 2, 'clk1', 3, 'clock'),
        cable(2, 3, 'gate', 4, 'gate'),
        cable(3, 3, 'cv', 5, 'v_oct'),
        cable(4, 5, 'saw', 6, 'in'),
        cable(5, 4, 'env', 6, 'cv'),
        cable(6, 6, 'lp', 7, 'in_a'),
        cable(7, 4, 'env', 7, 'cv_a'),
        cable(8, 7, 'out_a', SPEAKER, 'ch1'),
      ],
      8,
      9,
    ),
  },
  {
    id: 'builtin-acid',
    name: 'Acid line',
    builtin: true,
    updatedAt: 0,
    // 16-step 303-ish C minor with slides + rests
    graph: graph(
      [
        m(2, 'fm_clock', 0, 0, { bpm: 128, pw: 0.16 }),
        m(3, 'clk_mult', 8, 0, { pw: 0.2 }),
        m(
          4,
          'sequencer16',
          12,
          0,
          seqParams(
            deg(0, 0, 12, 0, 3, 0, 7, 10, 0, 3, 5, 6, 7, 7, 10, 12),
            [1, 0, 1, 1, 1, 0, 1, 1, 0, 1, 1, 1, 1, 0, 1, 1],
            { glide: 0.35 },
          ),
        ),
        m(5, 'envelope', 28, 0, {
          attack: 0.001,
          decay: 0.28,
          sustain: 0.05,
          release: 0.15,
        }),
        m(6, 'vco', 36, 0, { freq: 55, fm_amt: 0, pwm_amt: 0.5 }),
        m(7, 'wasp', 48, 0, { cutoff: 380, res: 0.72, drive: 0.55 }),
        m(8, 'dual_vca', 56, 0, { bias_a: 0, bias_b: 0, exp_a: 1, exp_b: 0 }),
      ],
      [
        cable(1, 2, 'clk1', 3, 'clock'),
        cable(2, 3, 'x2', 4, 'clock'),
        cable(3, 4, 'gate', 5, 'gate'),
        cable(4, 4, 'cv', 6, 'v_oct'),
        cable(5, 6, 'saw', 7, 'in'),
        cable(6, 5, 'env', 7, 'cv'),
        cable(7, 7, 'lp', 8, 'in_a'),
        cable(8, 5, 'env', 8, 'cv_a'),
        cable(9, 8, 'out_a', SPEAKER, 'ch1'),
      ],
      9,
      10,
    ),
  },
  {
    id: 'builtin-ostinato',
    name: 'Ostinato',
    builtin: true,
    updatedAt: 0,
    // C G A F — looping four-note figure
    graph: graph(
      [
        m(2, 'fm_clock', 0, 0, { bpm: 108, pw: 0.22 }),
        m(
          3,
          'sequencer',
          8,
          0,
          seqParams(deg(0, 7, 9, 5, 0, 7, 9, 5), [1, 1, 1, 1, 1, 1, 1, 1]),
        ),
        m(4, 'envelope', 20, 0, {
          attack: 0.02,
          decay: 0.35,
          sustain: 0.55,
          release: 0.4,
        }),
        m(5, 'facets', 28, 0, {
          model: 0,
          freq: 130.81,
          harmonics: 0.35,
          timbre: 0.4,
          morph: 0.45,
          level: 0.8,
        }),
        m(6, 'reverb', 40, 0, { size: 0.45, decay: 0.55, damp: 0.45, mix: 0.25 }),
      ],
      [
        cable(1, 2, 'clk1', 3, 'clock'),
        cable(2, 3, 'gate', 4, 'gate'),
        cable(3, 3, 'cv', 5, 'v_oct'),
        cable(4, 4, 'env', 5, 'level_cv'),
        cable(5, 5, 'out', 6, 'in_l'),
        cable(6, 6, 'out_l', SPEAKER, 'ch1'),
        cable(7, 6, 'out_r', SPEAKER, 'ch2'),
      ],
      7,
      8,
    ),
  },
  {
    id: 'builtin-chiptune',
    name: 'Chiptune hook',
    builtin: true,
    updatedAt: 0,
    // C E G A G E D C — BitBoy lead
    graph: graph(
      [
        m(2, 'fm_clock', 0, 0, { bpm: 150, pw: 0.18 }),
        m(
          3,
          'sequencer',
          8,
          0,
          seqParams(deg(0, 4, 7, 9, 7, 4, 2, 0), [1, 1, 1, 1, 1, 1, 1, 1]),
        ),
        m(4, 'bitboy', 20, 0, {
          mode: 1,
          tune: 0,
          frame: 0.4,
          morph: 0.35,
          level: 0.9,
        }),
      ],
      [
        cable(1, 2, 'clk1', 3, 'clock'),
        cable(2, 3, 'cv', 4, 'v_oct'),
        cable(3, 3, 'gate', 4, 'gate'),
        cable(4, 4, 'out', SPEAKER, 'ch1'),
      ],
      5,
      5,
    ),
  },
  {
    id: 'builtin-pentatonic',
    name: 'Pentatonic lead',
    builtin: true,
    updatedAt: 0,
    // 16-step C minor pentatonic phrase
    graph: graph(
      [
        m(2, 'fm_clock', 0, 0, { bpm: 118, pw: 0.18 }),
        m(3, 'clk_mult', 8, 0, { pw: 0.2 }),
        m(
          4,
          'sequencer16',
          12,
          0,
          seqParams(
            deg(0, 3, 5, 7, 10, 12, 10, 7, 5, 3, 0, 3, 7, 10, 12, 15),
            [1, 1, 1, 1, 1, 1, 0, 1, 1, 1, 0, 1, 1, 1, 1, 0],
            { glide: 0.05 },
          ),
        ),
        m(5, 'envelope', 28, 0, {
          attack: 0.008,
          decay: 0.2,
          sustain: 0.3,
          release: 0.25,
        }),
        m(6, 'facets', 36, 0, {
          model: 4,
          freq: 130.81,
          harmonics: 0.5,
          timbre: 0.55,
          morph: 0.4,
          level: 0.75,
        }),
        m(7, 'delay', 48, 0, {
          time: 0.32,
          feedback: 0.35,
          mix: 0.3,
          pingpong: 1,
        }),
      ],
      [
        cable(1, 2, 'clk1', 3, 'clock'),
        cable(2, 3, 'x2', 4, 'clock'),
        cable(3, 4, 'gate', 5, 'gate'),
        cable(4, 4, 'cv', 6, 'v_oct'),
        cable(5, 5, 'env', 6, 'level_cv'),
        cable(6, 6, 'out', 7, 'in'),
        cable(7, 7, 'out_l', SPEAKER, 'ch1'),
        cable(8, 7, 'out_r', SPEAKER, 'ch2'),
      ],
      8,
      9,
    ),
  },

  // ── Beats (clock → clk_mult / divider → drums; no drum sequencers) ──
  {
    id: 'builtin-house',
    name: 'House beat',
    builtin: true,
    updatedAt: 0,
    // Quarters→kick, ÷2→snare (2&4), ×4→hats, ×2→oh
    graph: graph(
      [
        m(2, 'fm_clock', 0, 0, { bpm: 124, pw: 0.12 }),
        m(3, 'clk_mult', 8, 0, { pw: 0.18 }),
        m(4, 'divider', 12, 0, { pw: 0.35 }),
        m(5, 'drums', 16, 0, {
          tone: 0.42,
          snappy: 0.55,
          decay: 0.4,
          level: 0.9,
        }),
      ],
      [
        cable(1, 2, 'clk1', 3, 'clock'),
        cable(2, 2, 'clk2', 4, 'clock'),
        cable(3, 3, 'x1', 5, 'bd'),
        cable(4, 4, 'd2', 5, 'sd'),
        cable(5, 3, 'x4', 5, 'ch'),
        cable(6, 3, 'x2', 5, 'oh'),
        cable(7, 5, 'mix', SPEAKER, 'ch1'),
      ],
      6,
      8,
    ),
  },
  {
    id: 'builtin-breakbeat',
    name: 'Breakbeat',
    builtin: true,
    updatedAt: 0,
    // Busier divisions: ×2 kicks/toms, ÷2 snare, ×4 hats, ÷4 clap
    graph: graph(
      [
        m(2, 'fm_clock', 0, 0, { bpm: 136, pw: 0.12 }),
        m(3, 'clk_mult', 8, 0, { pw: 0.16 }),
        m(4, 'divider', 12, 0, { pw: 0.4 }),
        m(5, 'mult', 16, 0, {}),
        m(6, 'drums', 18, 0, {
          tone: 0.35,
          snappy: 0.7,
          decay: 0.35,
          level: 0.88,
        }),
        m(7, 'delay', 30, 0, {
          time: 0.22,
          feedback: 0.2,
          mix: 0.18,
          pingpong: 0,
        }),
      ],
      [
        cable(1, 2, 'clk1', 3, 'clock'),
        cable(2, 2, 'clk2', 4, 'clock'),
        cable(3, 3, 'x2', 6, 'bd'),
        cable(4, 4, 'd2', 5, 'in'),
        cable(5, 5, 'out1', 6, 'sd'),
        cable(6, 5, 'out2', 6, 'cp'),
        cable(7, 3, 'x4', 6, 'ch'),
        cable(8, 3, 'x1', 6, 'tom'),
        cable(9, 6, 'mix', 7, 'in'),
        cable(10, 7, 'mix', SPEAKER, 'ch1'),
      ],
      8,
      11,
    ),
  },
  {
    id: 'builtin-techno',
    name: 'Techno pulse',
    builtin: true,
    updatedAt: 0,
    // Four-on-floor, half-time snare, 16th hats
    graph: graph(
      [
        m(2, 'fm_clock', 0, 0, { bpm: 130, pw: 0.1 }),
        m(3, 'clk_mult', 8, 0, { pw: 0.15 }),
        m(4, 'divider', 12, 0, { pw: 0.3 }),
        m(5, 'drums', 16, 0, {
          tone: 0.5,
          snappy: 0.45,
          decay: 0.55,
          level: 0.92,
        }),
        m(6, 'reverb', 28, 0, { size: 0.35, decay: 0.4, damp: 0.55, mix: 0.15 }),
      ],
      [
        cable(1, 2, 'clk1', 3, 'clock'),
        cable(2, 2, 'clk2', 4, 'clock'),
        cable(3, 3, 'x1', 5, 'bd'),
        cable(4, 4, 'd2', 5, 'sd'),
        cable(5, 3, 'x4', 5, 'ch'),
        cable(6, 3, 'x2', 5, 'oh'),
        cable(7, 5, 'mix', 6, 'in_l'),
        cable(8, 6, 'out_l', SPEAKER, 'ch1'),
        cable(9, 6, 'out_r', SPEAKER, 'ch2'),
      ],
      7,
      10,
    ),
  },
  {
    id: 'builtin-hiphop',
    name: 'Boom bap',
    builtin: true,
    updatedAt: 0,
    // Slower quarters→kick, ÷2→snare+clap via mult, ×4 hats
    graph: graph(
      [
        m(2, 'fm_clock', 0, 0, { bpm: 88, pw: 0.14 }),
        m(3, 'clk_mult', 8, 0, { pw: 0.2 }),
        m(4, 'divider', 12, 0, { pw: 0.35 }),
        m(5, 'mult', 16, 0, {}),
        m(6, 'drums', 18, 0, {
          tone: 0.3,
          snappy: 0.65,
          decay: 0.6,
          level: 0.9,
        }),
      ],
      [
        cable(1, 2, 'clk1', 3, 'clock'),
        cable(2, 2, 'clk2', 4, 'clock'),
        cable(3, 3, 'x1', 6, 'bd'),
        cable(4, 4, 'd2', 5, 'in'),
        cable(5, 5, 'out1', 6, 'sd'),
        cable(6, 5, 'out2', 6, 'cp'),
        cable(7, 3, 'x4', 6, 'ch'),
        cable(8, 6, 'mix', SPEAKER, 'ch1'),
      ],
      7,
      9,
    ),
  },

  // ── Melody + beat (one seq for notes; clock math for drums) ──
  {
    id: 'builtin-jam',
    name: 'Melody + drums',
    builtin: true,
    updatedAt: 0,
    graph: graph(
      [
        m(2, 'fm_clock', 0, 0, { bpm: 120, pw: 0.14 }),
        m(3, 'clk_mult', 8, 0, { pw: 0.18 }),
        m(4, 'divider', 12, 0, { pw: 0.35 }),
        m(
          5,
          'sequencer',
          16,
          0,
          seqParams(deg(0, 3, 7, 10, 12, 10, 7, 5), [1, 1, 1, 1, 1, 1, 1, 0]),
        ),
        m(6, 'envelope', 28, 0, {
          attack: 0.005,
          decay: 0.18,
          sustain: 0.2,
          release: 0.2,
        }),
        m(7, 'vco', 36, 0, { freq: 130.81, fm_amt: 0, pwm_amt: 0.4 }),
        m(8, 'dual_vca', 48, 0, { bias_a: 0, bias_b: 0, exp_a: 0, exp_b: 0 }),
        m(9, 'drums', 0, 1, {
          tone: 0.4,
          snappy: 0.55,
          decay: 0.45,
          level: 0.85,
        }),
        m(10, 'erica_mixer', 12, 1, {
          ch1: 0.85,
          ch2: 0.7,
          ch3: 0,
          ch4: 0,
          mute1: 0,
          mute2: 0,
          mute3: 1,
          mute4: 1,
          mute_mix: 0,
        }),
        m(11, 'delay', 20, 1, {
          time: 0.28,
          feedback: 0.25,
          mix: 0.2,
          pingpong: 1,
        }),
      ],
      [
        cable(1, 2, 'clk1', 3, 'clock'),
        cable(2, 2, 'clk2', 4, 'clock'),
        cable(3, 3, 'x2', 5, 'clock'),
        cable(4, 5, 'gate', 6, 'gate'),
        cable(5, 5, 'cv', 7, 'v_oct'),
        cable(6, 7, 'saw', 8, 'in_a'),
        cable(7, 6, 'env', 8, 'cv_a'),
        cable(8, 3, 'x1', 9, 'bd'),
        cable(9, 4, 'd2', 9, 'sd'),
        cable(10, 3, 'x4', 9, 'ch'),
        cable(11, 8, 'out_a', 10, 'in1'),
        cable(12, 9, 'mix', 10, 'in2'),
        cable(13, 10, 'out', 11, 'in'),
        cable(14, 11, 'out_l', SPEAKER, 'ch1'),
        cable(15, 11, 'out_r', SPEAKER, 'ch2'),
      ],
      12,
      16,
    ),
  },
  {
    id: 'builtin-bassbeat',
    name: 'Bass + beat',
    builtin: true,
    updatedAt: 0,
    graph: graph(
      [
        m(2, 'fm_clock', 0, 0, { bpm: 115, pw: 0.14 }),
        m(3, 'clk_mult', 8, 0, { pw: 0.18 }),
        m(4, 'divider', 12, 0, { pw: 0.35 }),
        m(
          5,
          'sequencer',
          16,
          0,
          seqParams(
            deg(0, 0, 7, 0, 3, 0, 5, 7),
            [1, 0, 1, 1, 1, 0, 1, 1],
            { glide: 0.2 },
          ),
        ),
        m(6, 'ar', 28, 0, { attack: 0.005, release: 0.22 }),
        m(7, 'vco', 32, 0, { freq: 55, fm_amt: 0, pwm_amt: 0.5 }),
        m(8, 'wasp', 44, 0, { cutoff: 450, res: 0.6, drive: 0.5 }),
        m(9, 'dual_vca', 52, 0, { bias_a: 0, bias_b: 0, exp_a: 1, exp_b: 0 }),
        m(10, 'drums', 0, 1, {
          tone: 0.38,
          snappy: 0.5,
          decay: 0.4,
          level: 0.8,
        }),
        m(11, 'erica_mixer', 12, 1, {
          ch1: 0.9,
          ch2: 0.75,
          ch3: 0,
          ch4: 0,
          mute1: 0,
          mute2: 0,
          mute3: 1,
          mute4: 1,
          mute_mix: 0,
        }),
      ],
      [
        cable(1, 2, 'clk1', 3, 'clock'),
        cable(2, 2, 'clk2', 4, 'clock'),
        cable(3, 3, 'x2', 5, 'clock'),
        cable(4, 5, 'gate', 6, 'trig'),
        cable(5, 5, 'cv', 7, 'v_oct'),
        cable(6, 7, 'saw', 8, 'in'),
        cable(7, 6, 'env', 8, 'cv'),
        cable(8, 8, 'lp', 9, 'in_a'),
        cable(9, 6, 'env', 9, 'cv_a'),
        cable(10, 3, 'x1', 10, 'bd'),
        cable(11, 4, 'd2', 10, 'sd'),
        cable(12, 3, 'x4', 10, 'ch'),
        cable(13, 9, 'out_a', 11, 'in1'),
        cable(14, 10, 'mix', 11, 'in2'),
        cable(15, 11, 'out', SPEAKER, 'ch1'),
      ],
      12,
      16,
    ),
  },

  // ── Longer sequences ──────────────────────────────────────
  {
    id: 'builtin-seq32',
    name: 'Long phrase 32',
    builtin: true,
    updatedAt: 0,
    // 32-step C-minor story over facets + delay
    graph: graph(
      [
        m(2, 'fm_clock', 0, 0, { bpm: 112, pw: 0.16 }),
        m(3, 'clk_mult', 8, 0, { pw: 0.18 }),
        m(
          4,
          'sequencer32',
          12,
          0,
          seqParams(
            deg(
              // A section
              0, 3, 5, 7, 10, 12, 10, 7, 5, 3, 0, 3, 7, 10, 12, 15,
              // B section (answer, more rests)
              12, 10, 7, 5, 3, 0, 3, 5, 7, 10, 7, 3, 0, 5, 10, 12,
            ),
            [
              1, 1, 1, 1, 1, 1, 0, 1, 1, 1, 0, 1, 1, 1, 1, 0, 1, 1, 1, 0, 1, 0, 1,
              1, 1, 1, 0, 1, 0, 1, 1, 1,
            ],
            { glide: 0.06 },
          ),
        ),
        m(5, 'envelope', 38, 0, {
          attack: 0.01,
          decay: 0.22,
          sustain: 0.35,
          release: 0.3,
        }),
        m(6, 'facets', 46, 0, {
          model: 3,
          freq: 130.81,
          harmonics: 0.45,
          timbre: 0.5,
          morph: 0.4,
          level: 0.8,
        }),
        m(7, 'delay', 58, 0, {
          time: 0.38,
          feedback: 0.4,
          mix: 0.32,
          pingpong: 1,
        }),
      ],
      [
        cable(1, 2, 'clk1', 3, 'clock'),
        cable(2, 3, 'x2', 4, 'clock'),
        cable(3, 4, 'gate', 5, 'gate'),
        cable(4, 4, 'cv', 6, 'v_oct'),
        cable(5, 5, 'env', 6, 'level_cv'),
        cable(6, 6, 'out', 7, 'in'),
        cable(7, 7, 'out_l', SPEAKER, 'ch1'),
        cable(8, 7, 'out_r', SPEAKER, 'ch2'),
      ],
      8,
      9,
    ),
  },
  {
    id: 'builtin-seq64',
    name: 'Long phrase 64',
    builtin: true,
    updatedAt: 0,
    // 64-step journey — two 32-bar halves tiled with a lift in the second
    graph: graph(
      [
        m(2, 'fm_clock', 0, 0, { bpm: 100, pw: 0.16 }),
        m(3, 'clk_mult', 8, 0, { pw: 0.18 }),
        m(
          4,
          'sequencer64',
          12,
          0,
          seqParams(
            [
              ...deg(
                0, 0, 3, 5, 7, 7, 10, 12, 10, 7, 5, 3, 0, 3, 5, 7, 8, 7, 5, 3, 0,
                5, 7, 10, 12, 15, 12, 10, 7, 5, 3, 0,
              ),
              ...deg(
                3, 5, 7, 10, 12, 12, 15, 17, 15, 12, 10, 7, 5, 7, 10, 12, 14, 12,
                10, 7, 5, 8, 10, 12, 15, 17, 19, 17, 15, 12, 10, 7,
              ),
            ],
            [
              // half A
              1, 0, 1, 1, 1, 0, 1, 1, 1, 1, 0, 1, 0, 1, 1, 1, 1, 0, 1, 1, 0, 1,
              1, 1, 1, 1, 0, 1, 1, 1, 0, 1,
              // half B
              1, 1, 1, 1, 1, 0, 1, 1, 1, 1, 0, 1, 1, 1, 1, 1, 1, 0, 1, 1, 0, 1,
              1, 1, 1, 1, 1, 1, 0, 1, 1, 0,
            ],
            { glide: 0.1 },
          ),
        ),
        m(5, 'envelope', 44, 0, {
          attack: 0.015,
          decay: 0.28,
          sustain: 0.4,
          release: 0.4,
        }),
        m(6, 'facets', 52, 0, {
          model: 7,
          freq: 110,
          harmonics: 0.5,
          timbre: 0.45,
          morph: 0.55,
          level: 0.75,
        }),
        m(7, 'reverb', 64, 0, { size: 0.65, decay: 0.8, damp: 0.35, mix: 0.4 }),
      ],
      [
        cable(1, 2, 'clk1', 3, 'clock'),
        cable(2, 3, 'x2', 4, 'clock'),
        cable(3, 4, 'gate', 5, 'gate'),
        cable(4, 4, 'cv', 6, 'v_oct'),
        cable(5, 5, 'env', 6, 'level_cv'),
        cable(6, 6, 'out', 7, 'in_l'),
        cable(7, 7, 'out_l', SPEAKER, 'ch1'),
        cable(8, 7, 'out_r', SPEAKER, 'ch2'),
      ],
      8,
      9,
    ),
  },

  // ── Full songs ────────────────────────────────────────────
  {
    id: 'builtin-song-dusk',
    name: 'Song: dusk',
    builtin: true,
    updatedAt: 0,
    // Kick/snare, bass ostinato, roomy lead + soft pad
    graph: graph(
      [
        m(2, 'fm_clock', 0, 0, { bpm: 108, pw: 0.14 }),
        m(3, 'clk_mult', 8, 0, { pw: 0.18 }),
        m(4, 'divider', 12, 0, { pw: 0.35 }),
        m(5, 'drums', 16, 0, {
          tone: 0.4,
          snappy: 0.4,
          decay: 0.5,
          level: 0.42,
        }),
        m(
          6,
          'sequencer',
          28,
          0,
          seqParams(
            deg(0, 0, 3, 5, 0, 0, 5, 7),
            [1, 0, 1, 1, 1, 0, 1, 0],
            { glide: 0.08 },
          ),
        ),
        m(7, 'ar', 40, 0, { attack: 0.01, release: 0.28 }),
        m(8, 'vco', 44, 0, { freq: 55, fm_amt: 0, pwm_amt: 0.4 }),
        m(9, 'wasp', 56, 0, { cutoff: 520, res: 0.35, drive: 0.25 }),
        m(10, 'dual_vca', 64, 0, { bias_a: 0, bias_b: 0, exp_a: 0, exp_b: 0 }),
        m(
          11,
          'sequencer16',
          0,
          1,
          seqParams(
            deg(12, 12, 15, 17, 15, 12, 10, 12, 15, 17, 19, 17, 15, 12, 10, 7),
            [1, 0, 1, 1, 0, 1, 0, 1, 1, 0, 1, 1, 0, 1, 0, 1],
            { glide: 0.05 },
          ),
        ),
        m(12, 'envelope', 16, 1, {
          attack: 0.03,
          decay: 0.3,
          sustain: 0.4,
          release: 0.4,
        }),
        m(13, 'facets', 24, 1, {
          model: 0,
          freq: 130.81,
          harmonics: 0.35,
          timbre: 0.4,
          morph: 0.45,
          level: 0.55,
        }),
        m(14, 'lfo', 36, 1, { rate: 0.12, shape: 0.4, level: 0.4 }),
        m(15, 'erica_mixer', 44, 1, mixerParams(0.34, 0.38, 0.36, 0)),
        m(16, 'reverb', 52, 1, { size: 0.45, decay: 0.55, damp: 0.5, mix: 0.22 }),
      ],
      [
        cable(1, 2, 'clk1', 3, 'clock'),
        cable(2, 2, 'clk2', 4, 'clock'),
        cable(3, 3, 'x2', 6, 'clock'),
        cable(4, 3, 'x2', 11, 'clock'),
        cable(5, 3, 'x1', 5, 'bd'),
        cable(6, 4, 'd2', 5, 'sd'),
        cable(7, 3, 'x2', 5, 'ch'),
        cable(8, 6, 'gate', 7, 'trig'),
        cable(9, 6, 'cv', 8, 'v_oct'),
        cable(10, 8, 'saw', 9, 'in'),
        cable(11, 7, 'env', 9, 'cv'),
        cable(12, 9, 'lp', 10, 'in_a'),
        cable(13, 7, 'env', 10, 'cv_a'),
        cable(14, 11, 'gate', 12, 'gate'),
        cable(15, 11, 'cv', 13, 'v_oct'),
        cable(16, 12, 'env', 13, 'level_cv'),
        cable(17, 14, 'out', 13, 'morph_cv'),
        cable(18, 5, 'mix', 15, 'in1'),
        cable(19, 10, 'out_a', 15, 'in2'),
        cable(20, 13, 'out', 15, 'in3'),
        cable(21, 15, 'out', 16, 'in_l'),
        cable(22, 15, 'out2', 16, 'in_r'),
        cable(23, 16, 'out_l', SPEAKER, 'ch1'),
        cable(24, 16, 'out_r', SPEAKER, 'ch2'),
      ],
      17,
      25,
    ),
  },
  {
    id: 'builtin-song-neon',
    name: 'Song: neon',
    builtin: true,
    updatedAt: 0,
    // Four-on-floor, bass, lead, counter — ping-pong tails
    graph: graph(
      [
        m(2, 'fm_clock', 0, 0, { bpm: 120, pw: 0.12 }),
        m(3, 'clk_mult', 8, 0, { pw: 0.16 }),
        m(4, 'divider', 12, 0, { pw: 0.3 }),
        m(5, 'drums', 16, 0, {
          tone: 0.45,
          snappy: 0.45,
          decay: 0.45,
          level: 0.45,
        }),
        m(
          6,
          'sequencer',
          28,
          0,
          seqParams(
            deg(0, 0, 0, 7, 0, 3, 5, 0),
            [1, 0, 1, 1, 1, 0, 1, 0],
            { glide: 0.1 },
          ),
        ),
        m(7, 'ar', 40, 0, { attack: 0.008, release: 0.22 }),
        m(8, 'vco', 44, 0, { freq: 55, fm_amt: 0, pwm_amt: 0.4 }),
        m(9, 'wasp', 56, 0, { cutoff: 450, res: 0.4, drive: 0.3 }),
        m(10, 'dual_vca', 64, 0, { bias_a: 0, bias_b: 0, exp_a: 0, exp_b: 0 }),
        m(
          11,
          'sequencer16',
          0,
          1,
          seqParams(
            deg(7, 10, 12, 10, 7, 5, 7, 10, 12, 15, 12, 10, 7, 5, 3, 5),
            [1, 1, 1, 0, 1, 0, 1, 1, 1, 1, 0, 1, 1, 0, 1, 0],
          ),
        ),
        m(12, 'envelope', 16, 1, {
          attack: 0.015,
          decay: 0.22,
          sustain: 0.3,
          release: 0.28,
        }),
        m(13, 'facets', 24, 1, {
          model: 1,
          freq: 130.81,
          harmonics: 0.4,
          timbre: 0.4,
          morph: 0.45,
          level: 0.55,
        }),
        m(
          14,
          'sequencer',
          36,
          1,
          seqParams(
            deg(19, 17, 15, 12, 15, 17, 19, 22),
            [0, 1, 0, 1, 1, 0, 1, 0],
            { glide: 0.04 },
          ),
        ),
        m(15, 'ar', 48, 1, { attack: 0.005, release: 0.18 }),
        m(16, 'vco', 52, 1, { freq: 220, fm_amt: 0, pwm_amt: 0.35 }),
        m(17, 'dual_vca', 64, 1, { bias_a: 0, bias_b: 0, exp_a: 0, exp_b: 0 }),
        m(18, 'erica_mixer', 72, 1, mixerParams(0.3, 0.34, 0.32, 0.22)),
        m(19, 'delay', 80, 1, {
          time: 0.3,
          feedback: 0.28,
          mix: 0.2,
          pingpong: 1,
        }),
      ],
      [
        cable(1, 2, 'clk1', 3, 'clock'),
        cable(2, 2, 'clk2', 4, 'clock'),
        cable(3, 3, 'x2', 6, 'clock'),
        cable(4, 3, 'x2', 11, 'clock'),
        cable(5, 3, 'x4', 14, 'clock'),
        cable(6, 3, 'x1', 5, 'bd'),
        cable(7, 4, 'd2', 5, 'sd'),
        cable(8, 3, 'x2', 5, 'ch'),
        cable(9, 6, 'gate', 7, 'trig'),
        cable(10, 6, 'cv', 8, 'v_oct'),
        cable(11, 8, 'saw', 9, 'in'),
        cable(12, 7, 'env', 9, 'cv'),
        cable(13, 9, 'lp', 10, 'in_a'),
        cable(14, 7, 'env', 10, 'cv_a'),
        cable(15, 11, 'gate', 12, 'gate'),
        cable(16, 11, 'cv', 13, 'v_oct'),
        cable(17, 12, 'env', 13, 'level_cv'),
        cable(18, 14, 'gate', 15, 'trig'),
        cable(19, 14, 'cv', 16, 'v_oct'),
        cable(20, 16, 'tri', 17, 'in_a'),
        cable(21, 15, 'env', 17, 'cv_a'),
        cable(22, 5, 'mix', 18, 'in1'),
        cable(23, 10, 'out_a', 18, 'in2'),
        cable(24, 13, 'out', 18, 'in3'),
        cable(25, 17, 'out_a', 18, 'in4'),
        cable(26, 18, 'out', 19, 'in'),
        cable(27, 19, 'out_l', SPEAKER, 'ch1'),
        cable(28, 19, 'out_r', SPEAKER, 'ch2'),
      ],
      20,
      29,
    ),
  },
  {
    id: 'builtin-song-tide',
    name: 'Song: low tide',
    builtin: true,
    updatedAt: 0,
    // Slow & sparse — soft kick, held bass, long lead + chimes wash
    graph: graph(
      [
        m(2, 'fm_clock', 0, 0, { bpm: 84, pw: 0.16 }),
        m(3, 'clk_mult', 8, 0, { pw: 0.2 }),
        m(4, 'divider', 12, 0, { pw: 0.4 }),
        m(5, 'drums', 16, 0, {
          tone: 0.35,
          snappy: 0.3,
          decay: 0.6,
          level: 0.35,
        }),
        m(
          6,
          'sequencer',
          28,
          0,
          seqParams(
            deg(0, 0, 0, 0, 5, 5, 3, 3),
            [1, 0, 0, 0, 1, 0, 0, 0],
            { glide: 0.2 },
          ),
        ),
        m(7, 'ar', 40, 0, { attack: 0.05, release: 0.7 }),
        m(8, 'vco', 44, 0, { freq: 55, fm_amt: 0, pwm_amt: 0.35 }),
        m(9, 'dual_vca', 56, 0, { bias_a: 0, bias_b: 0, exp_a: 0, exp_b: 0 }),
        m(
          10,
          'sequencer16',
          0,
          1,
          seqParams(
            deg(12, 12, 10, 7, 5, 5, 7, 10, 12, 15, 12, 10, 7, 5, 3, 0),
            [1, 0, 0, 1, 0, 0, 1, 0, 1, 0, 0, 1, 0, 0, 1, 0],
            { glide: 0.15 },
          ),
        ),
        m(11, 'envelope', 16, 1, {
          attack: 0.08,
          decay: 0.5,
          sustain: 0.55,
          release: 0.7,
        }),
        m(12, 'facets', 24, 1, {
          model: 2,
          freq: 130.81,
          harmonics: 0.3,
          timbre: 0.35,
          morph: 0.45,
          level: 0.5,
        }),
        m(13, 'chimes', 36, 1, {
          freq: 110,
          structure: 0.45,
          brightness: 0.4,
          damping: 0.7,
          position: 0.4,
          model: 0.2,
          polyphony: 1,
        }),
        m(14, 'erica_mixer', 48, 1, mixerParams(0.28, 0.34, 0.32, 0.24)),
        m(15, 'reverb', 56, 1, { size: 0.6, decay: 0.7, damp: 0.4, mix: 0.28 }),
      ],
      [
        cable(1, 2, 'clk1', 3, 'clock'),
        cable(2, 2, 'clk2', 4, 'clock'),
        cable(3, 3, 'x1', 6, 'clock'),
        cable(4, 3, 'x1', 10, 'clock'),
        cable(5, 3, 'x1', 5, 'bd'),
        cable(6, 4, 'd2', 5, 'sd'),
        cable(7, 6, 'gate', 7, 'trig'),
        cable(8, 6, 'cv', 8, 'v_oct'),
        cable(9, 8, 'tri', 9, 'in_a'),
        cable(10, 7, 'env', 9, 'cv_a'),
        cable(11, 10, 'gate', 11, 'gate'),
        cable(12, 10, 'cv', 12, 'v_oct'),
        cable(13, 11, 'env', 12, 'level_cv'),
        cable(14, 4, 'd4', 13, 'trig'),
        cable(15, 10, 'cv', 13, 'v_oct'),
        cable(16, 5, 'mix', 14, 'in1'),
        cable(17, 9, 'out_a', 14, 'in2'),
        cable(18, 12, 'out', 14, 'in3'),
        cable(19, 13, 'out', 14, 'in4'),
        cable(20, 14, 'out', 15, 'in_l'),
        cable(21, 14, 'out2', 15, 'in_r'),
        cable(22, 15, 'out_l', SPEAKER, 'ch1'),
        cable(23, 15, 'out_r', SPEAKER, 'ch2'),
      ],
      16,
      24,
    ),
  },
  {
    id: 'builtin-song-orbit',
    name: 'Song: orbit',
    builtin: true,
    updatedAt: 0,
    // 32-step lead, busy drums, bass, twist color, delay+verb
    graph: graph(
      [
        m(2, 'fm_clock', 0, 0, { bpm: 128, pw: 0.12 }),
        m(3, 'clk_mult', 8, 0, { pw: 0.15 }),
        m(4, 'divider', 12, 0, { pw: 0.28 }),
        m(5, 'drums', 16, 0, {
          tone: 0.5,
          snappy: 0.55,
          decay: 0.4,
          level: 0.48,
        }),
        m(
          6,
          'sequencer16',
          28,
          0,
          seqParams(
            deg(0, 0, 7, 0, 3, 0, 5, 7, 0, 0, 10, 7, 5, 3, 0, 5),
            [1, 0, 1, 0, 1, 0, 1, 1, 1, 0, 1, 0, 1, 1, 0, 1],
            { glide: 0.06 },
          ),
        ),
        m(7, 'ar', 44, 0, { attack: 0.006, release: 0.2 }),
        m(8, 'vco', 48, 0, { freq: 55, fm_amt: 0, pwm_amt: 0.45 }),
        m(9, 'wasp', 60, 0, { cutoff: 480, res: 0.42, drive: 0.32 }),
        m(10, 'dual_vca', 68, 0, { bias_a: 0, bias_b: 0, exp_a: 0, exp_b: 0 }),
        m(
          11,
          'sequencer32',
          0,
          1,
          seqParams(
            deg(
              12,
              12,
              15,
              17,
              19,
              17,
              15,
              12,
              10,
              12,
              15,
              17,
              15,
              12,
              10,
              7,
              12,
              15,
              17,
              19,
              22,
              19,
              17,
              15,
              12,
              10,
              7,
              10,
              12,
              15,
              12,
              10,
            ),
            [
              1, 0, 1, 1, 0, 1, 0, 1, 1, 0, 1, 1, 0, 1, 0, 1, 1, 0, 1, 1, 1, 0, 1,
              0, 1, 0, 1, 1, 0, 1, 0, 1,
            ],
            { glide: 0.03 },
          ),
        ),
        // Seq32 is 26HP — keep everything after it past HP 26.
        m(12, 'envelope', 26, 1, {
          attack: 0.01,
          decay: 0.18,
          sustain: 0.25,
          release: 0.22,
        }),
        m(13, 'facets', 34, 1, {
          model: 4,
          freq: 130.81,
          harmonics: 0.45,
          timbre: 0.5,
          morph: 0.4,
          level: 0.55,
        }),
        m(14, 'lfo', 46, 1, { rate: 0.2, shape: 0.3, level: 0.5 }),
        m(15, 'erica_mixer', 54, 1, mixerParams(0.32, 0.36, 0.34, 0)),
        m(16, 'delay', 62, 1, {
          time: 0.22,
          feedback: 0.35,
          mix: 0.22,
          pingpong: 1,
        }),
        m(17, 'reverb', 70, 1, { size: 0.4, decay: 0.5, damp: 0.5, mix: 0.18 }),
      ],
      [
        cable(1, 2, 'clk1', 3, 'clock'),
        cable(2, 2, 'clk2', 4, 'clock'),
        cable(3, 3, 'x2', 6, 'clock'),
        cable(4, 3, 'x2', 11, 'clock'),
        cable(5, 3, 'x1', 5, 'bd'),
        cable(6, 4, 'd2', 5, 'sd'),
        cable(7, 3, 'x2', 5, 'ch'),
        cable(8, 4, 'd4', 5, 'oh'),
        cable(9, 6, 'gate', 7, 'trig'),
        cable(10, 6, 'cv', 8, 'v_oct'),
        cable(11, 8, 'saw', 9, 'in'),
        cable(12, 7, 'env', 9, 'cv'),
        cable(13, 9, 'lp', 10, 'in_a'),
        cable(14, 7, 'env', 10, 'cv_a'),
        cable(15, 11, 'gate', 12, 'gate'),
        cable(16, 11, 'cv', 13, 'v_oct'),
        cable(17, 12, 'env', 13, 'level_cv'),
        cable(18, 14, 'out', 13, 'timbre_cv'),
        cable(19, 5, 'mix', 15, 'in1'),
        cable(20, 10, 'out_a', 15, 'in2'),
        cable(21, 13, 'out', 15, 'in3'),
        cable(22, 15, 'out', 16, 'in'),
        cable(23, 16, 'out_l', 17, 'in_l'),
        cable(24, 16, 'out_r', 17, 'in_r'),
        cable(25, 17, 'out_l', SPEAKER, 'ch1'),
        cable(26, 17, 'out_r', SPEAKER, 'ch2'),
      ],
      18,
      27,
    ),
  },
  {
    id: 'builtin-song-wire',
    name: 'Song: wireframe',
    builtin: true,
    updatedAt: 0,
    // Acid-ish bass, 16-step stab, hats, bitboy grit, stereo delay
    graph: graph(
      [
        m(2, 'fm_clock', 0, 0, { bpm: 136, pw: 0.1 }),
        m(3, 'clk_mult', 8, 0, { pw: 0.14 }),
        m(4, 'divider', 12, 0, { pw: 0.25 }),
        m(5, 'drums', 16, 0, {
          tone: 0.55,
          snappy: 0.6,
          decay: 0.35,
          level: 0.5,
        }),
        m(
          6,
          'sequencer16',
          28,
          0,
          seqParams(
            deg(0, 0, 0, 12, 0, 3, 0, 7, 0, 0, 5, 0, 7, 10, 7, 5),
            [1, 0, 1, 1, 1, 0, 1, 0, 1, 0, 1, 1, 0, 1, 1, 0],
            { glide: 0.18 },
          ),
        ),
        m(7, 'envelope', 44, 0, {
          attack: 0.005,
          decay: 0.12,
          sustain: 0.15,
          release: 0.1,
        }),
        m(8, 'vco', 52, 0, { freq: 55, fm_amt: 0, pwm_amt: 0.6 }),
        m(9, 'wasp', 64, 0, { cutoff: 380, res: 0.7, drive: 0.45 }),
        m(10, 'dual_vca', 72, 0, { bias_a: 0, bias_b: 0, exp_a: 0, exp_b: 0 }),
        m(
          11,
          'sequencer16',
          0,
          1,
          seqParams(
            deg(19, 19, 22, 19, 17, 15, 17, 19, 22, 24, 22, 19, 17, 15, 12, 15),
            [1, 0, 1, 0, 1, 1, 0, 1, 1, 0, 1, 0, 1, 0, 1, 0],
          ),
        ),
        m(12, 'ar', 16, 1, { attack: 0.004, release: 0.14 }),
        m(13, 'facets', 20, 1, {
          model: 7,
          freq: 220,
          harmonics: 0.55,
          timbre: 0.55,
          morph: 0.35,
          level: 0.5,
        }),
        m(14, 'bitboy', 32, 1, {
          mode: 2,
          tune: 0,
          frame: 4,
          morph: 0.55,
          level: 0.45,
        }),
        m(15, 'erica_mixer', 40, 1, mixerParams(0.34, 0.36, 0.28, 0.22)),
        m(16, 'delay', 48, 1, {
          time: 0.18,
          feedback: 0.4,
          mix: 0.25,
          pingpong: 1,
        }),
        m(17, 'reverb', 56, 1, { size: 0.35, decay: 0.4, damp: 0.55, mix: 0.15 }),
      ],
      [
        cable(1, 2, 'clk1', 3, 'clock'),
        cable(2, 2, 'clk2', 4, 'clock'),
        cable(3, 3, 'x2', 6, 'clock'),
        cable(4, 3, 'x2', 11, 'clock'),
        cable(5, 3, 'x1', 5, 'bd'),
        cable(6, 4, 'd2', 5, 'sd'),
        cable(7, 3, 'x4', 5, 'ch'),
        cable(8, 4, 'd4', 5, 'oh'),
        cable(9, 6, 'gate', 7, 'gate'),
        cable(10, 6, 'cv', 8, 'v_oct'),
        cable(11, 8, 'saw', 9, 'in'),
        cable(12, 7, 'env', 9, 'cv'),
        cable(13, 9, 'lp', 10, 'in_a'),
        cable(14, 7, 'env', 10, 'cv_a'),
        cable(15, 11, 'gate', 12, 'trig'),
        cable(16, 11, 'cv', 13, 'v_oct'),
        cable(17, 12, 'env', 13, 'level_cv'),
        cable(18, 11, 'cv', 14, 'v_oct'),
        cable(19, 11, 'gate', 14, 'gate'),
        cable(20, 5, 'mix', 15, 'in1'),
        cable(21, 10, 'out_a', 15, 'in2'),
        cable(22, 13, 'out', 15, 'in3'),
        cable(23, 14, 'out', 15, 'in4'),
        cable(24, 15, 'out', 16, 'in'),
        cable(25, 16, 'out_l', 17, 'in_l'),
        cable(26, 16, 'out_r', 17, 'in_r'),
        cable(27, 17, 'out_l', SPEAKER, 'ch1'),
        cable(28, 17, 'out_r', SPEAKER, 'ch2'),
      ],
      18,
      29,
    ),
  },

  // ── Textures / generative ────────────────────────────────
  {
    id: 'builtin-lots',
    name: 'Lots generative',
    builtin: true,
    updatedAt: 0,
    graph: graph(
      [
        m(2, 'lots', 0, 0, {
          rate: 0.4,
          bias: 0.55,
          jitter: 0.12,
          spread: 0.4,
          x_bias: 0.5,
          steps: 0.7,
          deja_vu: 0.4,
          deja_vu_length: 0.55,
          t_mode: 0,
          x_mode: 0,
        }),
        m(3, 'facets', 18, 0, {
          model: 5,
          freq: 130.81,
          harmonics: 0.4,
          timbre: 0.5,
          morph: 0.45,
          level: 0.8,
        }),
        m(4, 'drums', 30, 0, {
          tone: 0.4,
          snappy: 0.5,
          decay: 0.4,
          level: 0.7,
        }),
        m(5, 'erica_mixer', 42, 0, mixerParams(0.85, 0.55, 0, 0)),
        m(6, 'reverb', 50, 0, { size: 0.5, decay: 0.6, damp: 0.4, mix: 0.25 }),
      ],
      [
        cable(1, 2, 't1', 3, 'trig'),
        cable(2, 2, 'x1', 3, 'v_oct'),
        cable(3, 2, 't2', 4, 'bd'),
        cable(4, 2, 't3', 4, 'sd'),
        cable(5, 3, 'out', 5, 'in1'),
        cable(6, 4, 'mix', 5, 'in2'),
        cable(7, 5, 'out', 6, 'in_l'),
        cable(8, 6, 'out_l', SPEAKER, 'ch1'),
        cable(9, 6, 'out_r', SPEAKER, 'ch2'),
      ],
      7,
      10,
    ),
  },
  {
    id: 'builtin-texture-dust',
    name: 'Texture: dust',
    builtin: true,
    updatedAt: 0,
    // Filtered noise bed + Chimes internal plucks (external exciter was near-silent)
    graph: graph(
      [
        m(2, 'noise', 0, 0, { level: 0.55, color: 0.65 }),
        m(3, 'sample_hold', 6, 0, { slew: 0.45, noise: 0.15 }),
        m(4, 'lfo', 10, 0, { rate: 0.18, shape: 0.35, level: 0.7 }),
        m(5, 'fm_clock', 18, 0, { bpm: 72, pw: 0.18 }),
        m(6, 'vcf', 26, 0, { cutoff: 900, res: 0.4, fm_amt: 0.7 }),
        m(7, 'chimes', 36, 0, {
          freq: 146.83,
          structure: 0.5,
          brightness: 0.45,
          damping: 0.6,
          position: 0.4,
          model: 0.15,
          polyphony: 2,
        }),
        m(8, 'erica_mixer', 48, 0, mixerParams(0.35, 0.7, 0, 0)),
        m(9, 'reverb', 56, 0, { size: 0.75, decay: 0.85, damp: 0.3, mix: 0.4 }),
      ],
      [
        cable(1, 5, 'clk1', 3, 'clock'),
        cable(2, 2, 'slow', 3, 'in'),
        cable(3, 2, 'pink', 6, 'in'),
        cable(4, 4, 'out', 6, 'fm'),
        cable(5, 3, 'out', 7, 'v_oct'),
        cable(6, 5, 'clk1', 7, 'trig'),
        cable(7, 6, 'lp', 8, 'in1'),
        cable(8, 7, 'out', 8, 'in2'),
        cable(9, 8, 'out', 9, 'in_l'),
        cable(10, 7, 'aux', 9, 'in_r'),
        cable(11, 9, 'out_l', SPEAKER, 'ch1'),
        cable(12, 9, 'out_r', SPEAKER, 'ch2'),
      ],
      10,
      13,
    ),
  },
  {
    id: 'builtin-texture-bloom',
    name: 'Texture: bloom',
    builtin: true,
    updatedAt: 0,
    // Free-running Facets drone; Swell/LFO morph — was silent when level_cv gated it off
    graph: graph(
      [
        m(2, 'swell', 0, 0, {
          freq: 0.18,
          shape: 0.55,
          slope: 0.4,
          smoothness: 0.7,
          mode: 1,
          range: 2,
        }),
        m(3, 'lfo', 12, 0, { rate: 0.07, shape: 0.5, level: 0.55 }),
        m(4, 'facets', 20, 0, {
          model: 9,
          freq: 55,
          harmonics: 0.55,
          timbre: 0.4,
          morph: 0.5,
          level: 0.75,
        }),
        m(5, 'facets', 32, 0, {
          model: 2,
          freq: 82.41,
          harmonics: 0.4,
          timbre: 0.45,
          morph: 0.55,
          level: 0.55,
        }),
        m(6, 'twist', 44, 0, {
          algorithm: 0.2,
          timbre: 0.4,
          level1: 0.8,
          level2: 0.65,
          freq: 110,
          carrier_shape: 1,
        }),
        m(7, 'delay', 54, 0, {
          time: 0.5,
          feedback: 0.45,
          mix: 0.35,
          pingpong: 1,
        }),
        m(8, 'reverb', 62, 0, { size: 0.7, decay: 0.8, damp: 0.3, mix: 0.4 }),
      ],
      [
        cable(1, 2, 'bi', 4, 'fm'),
        cable(2, 2, 'uni', 4, 'morph_cv'),
        cable(3, 3, 'out', 4, 'timbre_cv'),
        cable(4, 2, 'bi', 5, 'morph_cv'),
        cable(5, 3, 'uni', 5, 'timbre_cv'),
        cable(6, 4, 'out', 6, 'carrier'),
        cable(7, 5, 'out', 6, 'modulator'),
        cable(8, 2, 'uni', 6, 'timbre_cv'),
        cable(9, 6, 'out', 7, 'in'),
        cable(10, 7, 'out_l', 8, 'in_l'),
        cable(11, 7, 'out_r', 8, 'in_r'),
        cable(12, 8, 'out_l', SPEAKER, 'ch1'),
        cable(13, 8, 'out_r', SPEAKER, 'ch2'),
      ],
      9,
      14,
    ),
  },
  {
    id: 'builtin-texture-static',
    name: 'Texture: static choir',
    builtin: true,
    updatedAt: 0,
    // Dual Facets on Lots — both out buses, louder, continuous-ish
    graph: graph(
      [
        m(2, 'lots', 0, 0, {
          rate: 0.35,
          bias: 0.5,
          jitter: 0.2,
          spread: 0.55,
          x_bias: 0.5,
          steps: 0.45,
          deja_vu: 0.5,
          deja_vu_length: 0.65,
          t_mode: 0,
          x_mode: 1,
        }),
        m(3, 'facets', 18, 0, {
          model: 6,
          freq: 110,
          harmonics: 0.65,
          timbre: 0.4,
          morph: 0.55,
          level: 0.85,
        }),
        m(4, 'facets', 30, 0, {
          model: 6,
          freq: 138.59,
          harmonics: 0.5,
          timbre: 0.5,
          morph: 0.45,
          level: 0.75,
        }),
        m(5, 'lfo', 42, 0, { rate: 0.11, shape: 0.4, level: 0.4 }),
        m(6, 'erica_mixer', 50, 0, mixerParams(0.75, 0.7, 0, 0)),
        m(7, 'reverb', 58, 0, { size: 0.8, decay: 0.9, damp: 0.25, mix: 0.45 }),
      ],
      [
        cable(1, 2, 't1', 3, 'trig'),
        cable(2, 2, 'x1', 3, 'v_oct'),
        cable(3, 2, 't2', 4, 'trig'),
        cable(4, 2, 'x2', 4, 'v_oct'),
        cable(5, 2, 'y', 3, 'timbre_cv'),
        cable(6, 5, 'out', 4, 'morph_cv'),
        cable(7, 3, 'out', 6, 'in1'),
        cable(8, 4, 'out', 6, 'in2'),
        cable(9, 6, 'out', 7, 'in_l'),
        cable(10, 6, 'out2', 7, 'in_r'),
        cable(11, 7, 'out_l', SPEAKER, 'ch1'),
        cable(12, 7, 'out_r', SPEAKER, 'ch2'),
      ],
      8,
      13,
    ),
  },
]

function readUserPresets(): Preset[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw) as StoredBlob
    if (!parsed || parsed.version !== PRESET_VERSION || !Array.isArray(parsed.presets)) {
      return []
    }
    return parsed.presets.filter(
      (p) =>
        p &&
        typeof p.id === 'string' &&
        typeof p.name === 'string' &&
        p.graph &&
        Array.isArray(p.graph.modules),
    )
  } catch {
    return []
  }
}

function writeUserPresets(presets: Preset[]) {
  const blob: StoredBlob = { version: PRESET_VERSION, presets }
  localStorage.setItem(STORAGE_KEY, JSON.stringify(blob))
}

/** Built-ins first, then user presets (newest first). */
export function listPresets(): Preset[] {
  const users = readUserPresets().slice().sort((a, b) => b.updatedAt - a.updatedAt)
  return [...BUILTIN_PRESETS, ...users]
}

export function getPreset(id: string): Preset | undefined {
  return listPresets().find((p) => p.id === id)
}

/** Snapshot live graph → zoom-independent preset graph. */
export function packGraph(graph: LiveGraph, hpPx: number): PresetGraph {
  const scale = Math.max(1, hpPx)
  return {
    modules: graph.modules.map((mod) => ({
      id: mod.id,
      type_id: mod.type_id,
      xHp: mod.type_id === 'speaker' ? 0 : mod.x / scale,
      y: mod.y,
      params: { ...mod.params },
    })),
    cables: graph.cables.map((c) => ({
      id: c.id,
      from: { ...c.from },
      to: { ...c.to },
    })),
    next_module_id: graph.next_module_id,
    next_cable_id: graph.next_cable_id,
  }
}

/** Preset graph → live engine graph at current zoom. */
export function unpackGraph(graph: PresetGraph, hpPx: number): LiveGraph {
  const scale = Math.max(1, hpPx)
  return {
    modules: graph.modules.map((mod) => ({
      id: mod.id,
      type_id: mod.type_id,
      x: mod.type_id === 'speaker' ? 0 : mod.xHp * scale,
      y: mod.y,
      params: { ...mod.params },
    })),
    cables: graph.cables.map((c) => ({
      id: c.id,
      from: { ...c.from },
      to: { ...c.to },
    })),
    next_module_id: graph.next_module_id,
    next_cable_id: graph.next_cable_id,
  }
}

/** Create or overwrite a user preset by name. Returns the saved preset. */
export function saveUserPreset(name: string, graph: PresetGraph, replaceId?: string): Preset {
  const trimmed = name.trim() || 'Untitled'
  const users = readUserPresets()
  const now = Date.now()

  if (replaceId) {
    const idx = users.findIndex((p) => p.id === replaceId && !p.builtin)
    if (idx >= 0) {
      const updated: Preset = {
        ...users[idx]!,
        name: trimmed,
        updatedAt: now,
        graph,
        builtin: false,
      }
      users[idx] = updated
      writeUserPresets(users)
      return updated
    }
  }

  const sameName = users.findIndex(
    (p) => !p.builtin && p.name.toLowerCase() === trimmed.toLowerCase(),
  )
  if (sameName >= 0) {
    const updated: Preset = {
      ...users[sameName]!,
      name: trimmed,
      updatedAt: now,
      graph,
      builtin: false,
    }
    users[sameName] = updated
    writeUserPresets(users)
    return updated
  }

  const created: Preset = {
    id: uid(),
    name: trimmed,
    builtin: false,
    updatedAt: now,
    graph,
  }
  users.push(created)
  writeUserPresets(users)
  return created
}

export function deleteUserPreset(id: string): boolean {
  const users = readUserPresets()
  const next = users.filter((p) => p.id !== id)
  if (next.length === users.length) return false
  writeUserPresets(next)
  return true
}
