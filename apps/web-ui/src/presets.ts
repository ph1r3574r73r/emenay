/** Named patch presets — built-ins + user saves in localStorage. */

import {
  groupForPreset,
  PRESET_GROUPS,
  type PresetGroup,
  type PresetGroupId,
} from './presetGroups'

export type { PresetGroup, PresetGroupId }
export { PRESET_GROUPS, groupForPreset }

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
    id: 'builtin-erica-polivoks-voice',
    name: 'Polivoks voice',
    builtin: true,
    updatedAt: 0,
    graph: graph(
      [
        m(2, 'fm_clock', 0, 0, { bpm: 100, pw: 0.18 }),
        m(3, 'envelope', 8, 0, {
          attack: 0.005,
          decay: 0.35,
          sustain: 0.2,
          release: 0.25,
        }),
        m(4, 'erica_vco3', 16, 0, { freq: 55, fine: 0, fm_amt: 0, pwm_amt: 0.45 }),
        m(5, 'erica_polivoks_vcf', 28, 0, {
          cutoff: 480,
          res: 0.62,
          drive: 0.45,
          fm_amt: 0.75,
        }),
        m(6, 'dual_vca', 38, 0, { bias_a: 0, bias_b: 0, exp_a: 0, exp_b: 0 }),
      ],
      [
        cable(1, 2, 'clk1', 3, 'gate'),
        cable(2, 4, 'saw', 5, 'in'),
        cable(3, 3, 'env', 5, 'fm'),
        cable(4, 5, 'lp', 6, 'in_a'),
        cable(5, 3, 'env', 6, 'cv_a'),
        cable(6, 6, 'out_a', SPEAKER, 'ch1'),
      ],
      7,
      7,
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
    id: 'builtin-midi-vco3',
    name: 'MIDI VCO3',
    builtin: true,
    updatedAt: 0,
    // Quick test: keys → VCO3 → env VCA
    graph: graph(
      [
        m(2, 'midi_cv', 0, 0, { omni: 1, bend_range: 2 }),
        m(3, 'erica_vco3', 12, 0, { freq: 110, fine: 0, fm_amt: 0, pwm_amt: 0.4 }),
        m(4, 'envelope', 24, 0, {
          attack: 0.005,
          decay: 0.22,
          sustain: 0.55,
          release: 0.3,
        }),
        m(5, 'dual_vca', 32, 0, { bias_a: 0, bias_b: 0, exp_a: 0, exp_b: 0 }),
        m(6, 'erica_output', 42, 0, { level: 0.7 }),
      ],
      [
        cable(1, 2, 'cv1', 3, 'v_oct'),
        cable(2, 2, 'gate1', 4, 'gate'),
        cable(3, 2, 'mod', 3, 'pwm'),
        cable(4, 3, 'saw', 5, 'in_a'),
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
    id: 'builtin-midi-polivoks',
    name: 'MIDI Polivoks',
    builtin: true,
    updatedAt: 0,
    // Quick test: keys → VCO3 → Polivoks VCF (env opens filter) → VCA
    graph: graph(
      [
        m(2, 'midi_cv', 0, 0, { omni: 1, bend_range: 2 }),
        m(3, 'erica_vco3', 12, 0, { freq: 55, fine: 0, fm_amt: 0, pwm_amt: 0.5 }),
        m(4, 'erica_polivoks_vcf', 24, 0, {
          cutoff: 420,
          res: 0.65,
          drive: 0.45,
          fm_amt: 0.8,
        }),
        m(5, 'envelope', 34, 0, {
          attack: 0.005,
          decay: 0.4,
          sustain: 0.15,
          release: 0.25,
        }),
        m(6, 'dual_vca', 42, 0, { bias_a: 0, bias_b: 0, exp_a: 0, exp_b: 0 }),
        m(7, 'erica_output', 52, 0, { level: 0.7 }),
      ],
      [
        cable(1, 2, 'cv1', 3, 'v_oct'),
        cable(2, 2, 'gate1', 5, 'gate'),
        cable(3, 2, 'mod', 4, 'res_cv'),
        cable(4, 3, 'saw', 4, 'in'),
        cable(5, 5, 'env', 4, 'fm'),
        cable(6, 4, 'lp', 6, 'in_a'),
        cable(7, 5, 'env', 6, 'cv_a'),
        cable(8, 6, 'out_a', 7, 'in_l'),
        cable(9, 6, 'out_a', 7, 'in_r'),
        cable(10, 7, 'line_l', SPEAKER, 'ch1'),
        cable(11, 7, 'line_r', SPEAKER, 'ch2'),
      ],
      8,
      12,
    ),
  },
  {
    id: 'builtin-midi-modulator',
    name: 'MIDI Modulator',
    builtin: true,
    updatedAt: 0,
    // Keys → VCO3; Modulator LFO → PWM so you hear rate/shape
    graph: graph(
      [
        m(2, 'midi_cv', 0, 0, { omni: 1, bend_range: 2 }),
        m(3, 'erica_vco3', 12, 0, { freq: 110, fine: 0, fm_amt: 0.35, pwm_amt: 0.85 }),
        m(4, 'erica_modulator', 24, 0, {
          rate: 2.5,
          shape: 0.2,
          noise_lvl: 0.5,
          slew: 0.15,
        }),
        m(5, 'envelope', 36, 0, {
          attack: 0.005,
          decay: 0.2,
          sustain: 0.6,
          release: 0.28,
        }),
        m(6, 'dual_vca', 44, 0, { bias_a: 0, bias_b: 0, exp_a: 0, exp_b: 0 }),
        m(7, 'erica_output', 54, 0, { level: 0.7 }),
      ],
      [
        cable(1, 2, 'cv1', 3, 'v_oct'),
        cable(2, 2, 'gate1', 5, 'gate'),
        cable(3, 4, 'lfo', 3, 'pwm'),
        cable(4, 4, 'lfo', 3, 'fm'),
        cable(5, 3, 'sq', 6, 'in_a'),
        cable(6, 5, 'env', 6, 'cv_a'),
        cable(7, 6, 'out_a', 7, 'in_l'),
        cable(8, 6, 'out_a', 7, 'in_r'),
        cable(9, 7, 'line_l', SPEAKER, 'ch1'),
        cable(10, 7, 'line_r', SPEAKER, 'ch2'),
      ],
      8,
      11,
    ),
  },
  {
    id: 'builtin-midi-bassline',
    name: 'MIDI Bassline',
    builtin: true,
    updatedAt: 0,
    // Keys → Bassline voice → out
    graph: graph(
      [
        m(2, 'midi_cv', 0, 0, { omni: 1, bend_range: 2 }),
        m(3, 'erica_bassline', 12, 0, {
          tune: 55,
          cutoff: 420,
          res: 0.7,
          decay: 0.4,
          accent: 0.65,
          drive: 0.45,
        }),
        m(4, 'erica_output', 28, 0, { level: 0.75 }),
      ],
      [
        cable(1, 2, 'cv1', 3, 'v_oct'),
        cable(2, 2, 'gate1', 3, 'gate'),
        cable(3, 2, 'mod', 3, 'cutoff_cv'),
        cable(4, 3, 'out', 4, 'in_l'),
        cable(5, 3, 'out', 4, 'in_r'),
        cable(6, 4, 'line_l', SPEAKER, 'ch1'),
        cable(7, 4, 'line_r', SPEAKER, 'ch2'),
      ],
      5,
      8,
    ),
  },
  {
    id: 'builtin-midi-bbd',
    name: 'MIDI BBD',
    builtin: true,
    updatedAt: 0,
    // Keys → VCO3 → BBD → out
    graph: graph(
      [
        m(2, 'midi_cv', 0, 0, { omni: 1, bend_range: 2 }),
        m(3, 'erica_vco3', 12, 0, { freq: 110, fine: 0, fm_amt: 0, pwm_amt: 0.4 }),
        m(4, 'envelope', 24, 0, {
          attack: 0.005,
          decay: 0.18,
          sustain: 0.5,
          release: 0.35,
        }),
        m(5, 'dual_vca', 32, 0, { bias_a: 0, bias_b: 0, exp_a: 0, exp_b: 0 }),
        m(6, 'erica_bbd', 42, 0, {
          time: 180,
          feedback: 0.55,
          mix: 0.45,
          colour: 0.4,
          mod_rate: 0.6,
          mod_amt: 0.25,
        }),
        m(7, 'erica_output', 52, 0, { level: 0.7 }),
      ],
      [
        cable(1, 2, 'cv1', 3, 'v_oct'),
        cable(2, 2, 'gate1', 4, 'gate'),
        cable(3, 3, 'saw', 5, 'in_a'),
        cable(4, 4, 'env', 5, 'cv_a'),
        cable(5, 5, 'out_a', 6, 'in'),
        cable(6, 2, 'mod', 6, 'time_cv'),
        cable(7, 6, 'mix_out', 7, 'in_l'),
        cable(8, 6, 'mix_out', 7, 'in_r'),
        cable(9, 7, 'line_l', SPEAKER, 'ch1'),
        cable(10, 7, 'line_r', SPEAKER, 'ch2'),
      ],
      8,
      11,
    ),
  },
  {
    id: 'builtin-midi-swamp',
    name: 'MIDI Swamp',
    builtin: true,
    updatedAt: 0,
    // Keys → VCO3; Swamp smooth → FM, stepped → PWM
    graph: graph(
      [
        m(2, 'midi_cv', 0, 0, { omni: 1, bend_range: 2 }),
        m(3, 'erica_vco3', 12, 0, { freq: 110, fine: 0, fm_amt: 0.5, pwm_amt: 0.7 }),
        m(4, 'erica_swamp', 24, 0, { rate: 6, chaos: 0.55, lag: 0.4 }),
        m(5, 'envelope', 36, 0, {
          attack: 0.005,
          decay: 0.2,
          sustain: 0.55,
          release: 0.3,
        }),
        m(6, 'dual_vca', 44, 0, { bias_a: 0, bias_b: 0, exp_a: 0, exp_b: 0 }),
        m(7, 'erica_output', 54, 0, { level: 0.7 }),
      ],
      [
        cable(1, 2, 'cv1', 3, 'v_oct'),
        cable(2, 2, 'gate1', 5, 'gate'),
        cable(3, 2, 'gate1', 4, 'clock'),
        cable(4, 4, 'smooth', 3, 'fm'),
        cable(5, 4, 'stepped', 3, 'pwm'),
        cable(6, 3, 'saw', 6, 'in_a'),
        cable(7, 5, 'env', 6, 'cv_a'),
        cable(8, 6, 'out_a', 7, 'in_l'),
        cable(9, 6, 'out_a', 7, 'in_r'),
        cable(10, 7, 'line_l', SPEAKER, 'ch1'),
        cable(11, 7, 'line_r', SPEAKER, 'ch2'),
      ],
      8,
      12,
    ),
  },
  {
    id: 'builtin-midi-polysynth',
    name: 'MIDI PolySynth',
    builtin: true,
    updatedAt: 0,
    // Self-contained 4-voice — press chords on any channel
    graph: graph(
      [
        m(2, 'polysynth', 0, 0, {
          tune: 0,
          shape: 0.2,
          cutoff: 0.68,
          attack: 0.008,
          release: 0.4,
          detune: 0.15,
          level: 0.8,
        }),
        m(3, 'reverb', 12, 0, { size: 0.4, decay: 0.5, damp: 0.45, mix: 0.18 }),
        m(4, 'erica_output', 20, 0, { level: 0.7 }),
      ],
      [
        cable(1, 2, 'out', 3, 'in_l'),
        cable(2, 2, 'out_r', 3, 'in_r'),
        cable(3, 3, 'out_l', 4, 'in_l'),
        cable(4, 3, 'out_r', 4, 'in_r'),
        cable(5, 4, 'line_l', SPEAKER, 'ch1'),
        cable(6, 4, 'line_r', SPEAKER, 'ch2'),
      ],
      5,
      7,
    ),
  },
  {
    id: 'builtin-midi-poly-cc',
    name: 'MIDI Poly + CC',
    builtin: true,
    updatedAt: 0,
    // PolySynth + MIDI CC knobs → cutoff/shape (+ reverb). Knob CCs from MIDI settings.
    graph: graph(
      [
        m(2, 'polysynth', 0, 0, {
          tune: 0,
          shape: 0.22,
          cutoff: 0.62,
          attack: 0.01,
          release: 0.45,
          detune: 0.18,
          level: 0.78,
          vel_cutoff: 0.3,
          at_cutoff: 0.4,
          mod_cutoff: 0.25,
        }),
        m(3, 'midi_cc', 12, 0, {
          cc_num_1: 16,
          cc_num_2: 17,
          cc_num_3: 18,
          cc_num_4: 19,
        }),
        m(4, 'reverb', 20, 0, { size: 0.42, decay: 0.55, damp: 0.4, mix: 0.2 }),
        m(5, 'erica_output', 28, 0, { level: 0.68 }),
      ],
      [
        cable(1, 3, 'cc1', 2, 'cutoff_cv'),
        cable(2, 3, 'cc2', 2, 'shape_cv'),
        cable(3, 2, 'out', 4, 'in_l'),
        cable(4, 2, 'out_r', 4, 'in_r'),
        cable(5, 4, 'out_l', 5, 'in_l'),
        cable(6, 4, 'out_r', 5, 'in_r'),
        cable(7, 5, 'line_l', SPEAKER, 'ch1'),
        cable(8, 5, 'line_r', SPEAKER, 'ch2'),
      ],
      6,
      9,
    ),
  },
  {
    id: 'builtin-midi-pads-drums',
    name: 'MIDI Pads + Drums',
    builtin: true,
    updatedAt: 0,
    // Pads → GM notes 36/38/42/46 → drums.
    graph: graph(
      [
        m(2, 'midi_pads', 0, 0, {
          note_1: 36,
          note_2: 38,
          note_3: 42,
          note_4: 46,
        }),
        m(3, 'drums', 8, 0, {
          tone: 0.45,
          snappy: 0.55,
          decay: 0.4,
          level: 0.85,
        }),
        m(4, 'reverb', 20, 0, { size: 0.3, decay: 0.35, damp: 0.55, mix: 0.12 }),
        m(5, 'erica_output', 28, 0, { level: 0.72 }),
      ],
      [
        cable(1, 2, 'bd', 3, 'bd'),
        cable(2, 2, 'sd', 3, 'sd'),
        cable(3, 2, 'ch', 3, 'ch'),
        cable(4, 2, 'oh', 3, 'oh'),
        cable(5, 3, 'mix', 4, 'in_l'),
        cable(6, 3, 'mix', 4, 'in_r'),
        cable(7, 4, 'out_l', 5, 'in_l'),
        cable(8, 4, 'out_r', 5, 'in_r'),
        cable(9, 5, 'line_l', SPEAKER, 'ch1'),
        cable(10, 5, 'line_r', SPEAKER, 'ch2'),
      ],
      6,
      11,
    ),
  },
  {
    id: 'builtin-midi-chiptune',
    name: 'MIDI Chiptune',
    builtin: true,
    updatedAt: 0,
    // Keys → BitBoy CH3 wave; mod wheel → FRAME CV (wavetable bank 0…15)
    graph: graph(
      [
        m(2, 'midi_cv', 0, 0, { omni: 1, bend_range: 2 }),
        m(3, 'bitboy', 12, 0, {
          mode: 3,
          tune: 0,
          frame: 0,
          morph: 0.35,
          level: 0.9,
        }),
        m(4, 'erica_output', 20, 0, { level: 0.72 }),
      ],
      [
        cable(1, 2, 'cv1', 3, 'v_oct'),
        cable(2, 2, 'gate1', 3, 'gate'),
        cable(3, 2, 'mod', 3, 'frame_cv'),
        cable(4, 3, 'out', 4, 'in_l'),
        cable(5, 3, 'out', 4, 'in_r'),
        cable(6, 4, 'line_l', SPEAKER, 'ch1'),
        cable(7, 4, 'line_r', SPEAKER, 'ch2'),
      ],
      5,
      8,
    ),
  },
  {
    id: 'builtin-midi-bitboy-adsr',
    name: 'MIDI BitBoy ADSR',
    builtin: true,
    updatedAt: 0,
    // Keys → pitch; gate → ADSR → BitBoy LVL; mod → frame (CH3 wave)
    graph: graph(
      [
        m(2, 'midi_cv', 0, 0, { omni: 1, bend_range: 2 }),
        m(3, 'bitboy', 12, 0, {
          mode: 3,
          tune: 0,
          frame: 2,
          morph: 0.4,
          level: 0.95,
        }),
        m(4, 'adsr', 20, 0, {
          attack: 0.005,
          decay: 0.18,
          sustain: 0.55,
          release: 0.35,
        }),
        m(5, 'erica_output', 26, 0, { level: 0.72 }),
      ],
      [
        cable(1, 2, 'cv1', 3, 'v_oct'),
        cable(2, 2, 'gate1', 4, 'gate'),
        cable(3, 4, 'env', 3, 'level_cv'),
        cable(4, 2, 'mod', 3, 'frame_cv'),
        cable(5, 3, 'out', 5, 'in_l'),
        cable(6, 3, 'out', 5, 'in_r'),
        cable(7, 5, 'line_l', SPEAKER, 'ch1'),
        cable(8, 5, 'line_r', SPEAKER, 'ch2'),
      ],
      6,
      9,
    ),
  },
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
    // AR is 4HP — pack flush (older layout left 4HP holes after each AR).
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
        m(5, 'dual_vca', 28, 0, { bias_a: 0, bias_b: 0, exp_a: 0, exp_b: 0 }),
        m(6, 'facets', 38, 0, {
          model: 9,
          freq: 220,
          harmonics: 0.55,
          timbre: 0.55,
          morph: 0.45,
          level: 0.85,
        }),
        m(7, 'ar', 50, 0, { attack: 0.008, release: 0.28 }),
        m(8, 'dual_vca', 54, 0, { bias_a: 0, bias_b: 0, exp_a: 0, exp_b: 0 }),
        m(9, 'erica_mixer', 64, 0, mixerParams(0.55, 0.55, 0, 0)),
        m(10, 'reverb', 72, 0, { size: 0.45, decay: 0.55, damp: 0.4, mix: 0.22 }),
        m(11, 'erica_output', 80, 0, { level: 0.65 }),
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
    // Four voice-allocated outs from MidiCv POLY — chords on one MIDI channel.
    // AR is 4HP — pack flush after each envelope.
    graph: graph(
      [
        m(2, 'midi_cv', 0, 0, { omni: 0, poly: 1, voices: 4 }),
        m(3, 'facets', 12, 0, {
          model: 0,
          freq: 261.63,
          harmonics: 0.4,
          timbre: 0.4,
          morph: 0.5,
          level: 0.9,
        }),
        m(4, 'ar', 24, 0, { attack: 0.004, release: 0.2 }),
        m(5, 'facets', 28, 0, {
          model: 0,
          freq: 261.63,
          harmonics: 0.42,
          timbre: 0.42,
          morph: 0.52,
          level: 0.9,
        }),
        m(6, 'ar', 40, 0, { attack: 0.004, release: 0.2 }),
        m(7, 'facets', 44, 0, {
          model: 0,
          freq: 261.63,
          harmonics: 0.38,
          timbre: 0.45,
          morph: 0.48,
          level: 0.9,
        }),
        m(8, 'ar', 56, 0, { attack: 0.004, release: 0.2 }),
        m(9, 'facets', 60, 0, {
          model: 0,
          freq: 261.63,
          harmonics: 0.45,
          timbre: 0.38,
          morph: 0.55,
          level: 0.9,
        }),
        m(10, 'ar', 72, 0, { attack: 0.004, release: 0.2 }),
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
    id: 'builtin-midi-poly-twin',
    name: 'MIDI Poly + Twin',
    builtin: true,
    updatedAt: 0,
    // PolySynth reads the MIDI bus directly (no midi_cv). Twin = Peaks 808 kit.
    graph: graph(
      [
        m(2, 'polysynth', 0, 0, {
          tune: 0,
          shape: 0.18,
          cutoff: 0.62,
          attack: 0.01,
          release: 0.42,
          detune: 0.14,
          level: 0.78,
          vel_cutoff: 0.28,
          mod_cutoff: 0.22,
        }),
        m(3, 'erica_mixer', 14, 0, {
          ch1: 0.82,
          ch2: 0.72,
          ch3: 0.55,
          ch4: 0,
          mute1: 0,
          mute2: 0,
          mute3: 0,
          mute4: 1,
          mute_mix: 0,
        }),
        m(4, 'reverb', 28, 0, {
          size: 0.32,
          decay: 0.42,
          damp: 0.5,
          mix: 0.16,
        }),
        m(5, 'erica_output', 40, 0, { level: 0.68 }),
        // --- beat: Twin BD+SD, Twin HH+FM ---
        m(6, 'fm_clock', 0, 1, { bpm: 118, pw: 0.12 }),
        m(7, 'clk_mult', 8, 1, { pw: 0.18 }),
        m(8, 'divider', 14, 1, { pw: 0.35 }),
        m(9, 'twin', 20, 1, {
          mode_a: 3, // BD
          mode_b: 4, // SD
          p1: 0.42,
          p2: 0.58,
          p3: 0.48,
          p4: 0.5,
          split: 1,
          level: 0.95,
        }),
        m(10, 'twin', 30, 1, {
          mode_a: 5, // HH
          mode_b: 6, // FM
          p1: 0.55,
          p2: 0.35,
          p3: 0.4,
          p4: 0.55,
          split: 1,
          level: 0.7,
        }),
      ],
      [
        cable(1, 2, 'out', 3, 'in1'),
        cable(2, 6, 'clk1', 7, 'clock'),
        cable(3, 6, 'clk2', 8, 'clock'),
        cable(4, 7, 'x1', 9, 'trig_a'),
        cable(5, 8, 'd2', 9, 'trig_b'),
        cable(6, 7, 'x4', 10, 'trig_a'),
        cable(7, 7, 'x2', 10, 'trig_b'),
        cable(8, 9, 'mix', 3, 'in2'),
        cable(9, 10, 'mix', 3, 'in3'),
        cable(10, 3, 'out', 4, 'in_l'),
        cable(11, 3, 'out2', 4, 'in_r'),
        cable(12, 4, 'out_l', 5, 'in_l'),
        cable(13, 4, 'out_r', 5, 'in_r'),
        cable(14, 5, 'line_l', SPEAKER, 'ch1'),
        cable(15, 5, 'line_r', SPEAKER, 'ch2'),
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
          mode: 3,
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
        m(4, 'dual_vca', 24, 0, { bias_a: 0.35, bias_b: 0, exp_a: 0, exp_b: 0 }),
        m(5, 'reverb', 34, 0, {
          size: 0.6,
          decay: 0.8,
          damp: 0.35,
          mix: 0.35,
        }),
      ],
      [
        // Don't patch swell into Facets level_cv — that ducks the oscillator to silence.
        cable(1, 2, 'bi', 3, 'fm'),
        cable(2, 2, 'uni', 3, 'morph_cv'),
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
          mode: 3,
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
    id: 'builtin-bitboy-nes',
    name: 'BitBoy Game Boy loop',
    builtin: true,
    updatedAt: 0,
    // Original LSDJ-style loop (not a Nintendo tune). Each voice has its own AR →
    // BitBoy level_cv so notes pluck/decay instead of hard-gating.
    graph: graph(
      [
        // --- row 0: clock + PU1/PU2 with envelopes ---
        m(2, 'fm_clock', 0, 0, { bpm: 152, pw: 0.2 }),
        m(3, 'clk_mult', 8, 0, { pw: 0.22 }),
        m(
          4,
          'sequencer16',
          12,
          0,
          seqParams(
            // PU1 lead — call / answer hook
            deg(28, 28, 31, 31, 33, 31, 28, 28, 29, 29, 33, 33, 31, 28, 26, 24),
            [1, 0, 1, 0, 1, 1, 1, 0, 1, 0, 1, 0, 1, 1, 1, 1],
          ),
        ),
        m(5, 'ar', 28, 0, { attack: 0.001, release: 0.11 }),
        m(6, 'bitboy', 32, 0, {
          mode: 1, // CH1 sweep pulse
          tune: 0.04,
          frame: 7, // sweep depth (semitones)
          morph: 0.1, // 12.5% duty
          level: 0.88,
        }),
        m(
          7,
          'sequencer16',
          40,
          0,
          seqParams(
            // PU2 — open 5ths answering the lead
            deg(19, 19, 24, 24, 21, 21, 24, 24, 17, 17, 21, 21, 19, 19, 16, 16),
            [0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 1, 0, 1, 1],
          ),
        ),
        m(8, 'ar', 56, 0, { attack: 0.004, release: 0.2 }),
        m(9, 'bitboy', 60, 0, {
          mode: 2, // CH2 pulse
          tune: 0,
          frame: 0,
          morph: 0.58, // ~50% duty
          level: 0.7,
        }),
        // --- row 1: WAV + NOI + mix/space ---
        m(
          10,
          'sequencer16',
          0,
          1,
          seqParams(
            // WAV bass (BitBoy tune −1)
            deg(0, 0, 7, 0, 5, 5, 12, 7, 0, 4, 7, 12, 5, 7, 7, 0),
            [1, 1, 1, 1, 1, 1, 1, 0, 1, 1, 1, 1, 1, 1, 1, 1],
          ),
        ),
        m(11, 'ar', 16, 1, { attack: 0.001, release: 0.16 }),
        m(12, 'bitboy', 20, 1, {
          mode: 3, // CH3 wave
          tune: -1,
          frame: 1,
          morph: 0.45,
          level: 1,
        }),
        m(
          13,
          'sequencer16',
          28,
          1,
          seqParams(
            // NOI kit: K · H S | H · H K | · H S H | K H S H
            deg(8, 8, 40, 19, 38, 38, 36, 9, 40, 40, 19, 38, 8, 40, 17, 42),
            [1, 0, 1, 1, 1, 0, 1, 1, 0, 1, 1, 1, 1, 1, 1, 1],
          ),
        ),
        m(14, 'ar', 44, 1, { attack: 0.001, release: 0.055 }),
        m(15, 'bitboy', 48, 1, {
          mode: 4, // CH4 noise
          tune: 0.4,
          frame: 0,
          morph: 0.75, // short LFSR
          level: 0.7,
        }),
        m(16, 'erica_mixer', 56, 1, mixerParams(0.74, 0.46, 0.9, 0.36)),
        m(17, 'reverb', 64, 1, {
          size: 0.28,
          decay: 0.35,
          damp: 0.62,
          mix: 0.14,
        }),
        m(18, 'erica_output', 72, 1, { level: 0.58 }),
      ],
      [
        cable(1, 2, 'clk1', 3, 'clock'),
        cable(2, 3, 'x2', 4, 'clock'),
        cable(3, 3, 'x2', 7, 'clock'),
        cable(4, 3, 'x2', 10, 'clock'),
        cable(5, 3, 'x2', 13, 'clock'),
        // PU1: cv → v/oct, gate → AR + BitBoy (LFSR/edge), env → level
        cable(6, 4, 'cv', 6, 'v_oct'),
        cable(7, 4, 'gate', 5, 'gate'),
        cable(8, 4, 'gate', 6, 'gate'),
        cable(9, 5, 'env', 6, 'level_cv'),
        // PU2
        cable(10, 7, 'cv', 9, 'v_oct'),
        cable(11, 7, 'gate', 8, 'gate'),
        cable(12, 7, 'gate', 9, 'gate'),
        cable(13, 8, 'env', 9, 'level_cv'),
        // WAV bass
        cable(14, 10, 'cv', 12, 'v_oct'),
        cable(15, 10, 'gate', 11, 'gate'),
        cable(16, 10, 'gate', 12, 'gate'),
        cable(17, 11, 'env', 12, 'level_cv'),
        // NOI
        cable(18, 13, 'cv', 15, 'v_oct'),
        cable(19, 13, 'gate', 14, 'gate'),
        cable(20, 13, 'gate', 15, 'gate'),
        cable(21, 14, 'env', 15, 'level_cv'),
        // Mix → short room → out
        cable(22, 6, 'out', 16, 'in1'),
        cable(23, 9, 'out', 16, 'in2'),
        cable(24, 12, 'out', 16, 'in3'),
        cable(25, 15, 'out', 16, 'in4'),
        cable(26, 16, 'out', 17, 'in_l'),
        cable(27, 16, 'out2', 17, 'in_r'),
        cable(28, 17, 'out_l', 18, 'in_l'),
        cable(29, 17, 'out_r', 18, 'in_r'),
        cable(30, 18, 'line_l', SPEAKER, 'ch1'),
        cable(31, 18, 'line_r', SPEAKER, 'ch2'),
      ],
      19,
      32,
    ),
  },
  {
    id: 'builtin-chiptune-song',
    name: 'Chiptune song',
    builtin: true,
    updatedAt: 0,
    // Full 8-bit jam: pulse lead + wave bass + drums (no MIDI — press Start)
    graph: graph(
      [
        // --- row 0: clock + lead + bass ---
        m(2, 'fm_clock', 0, 0, { bpm: 152, pw: 0.16 }),
        m(3, 'clk_mult', 8, 0, { pw: 0.18 }),
        m(
          4,
          'sequencer16',
          12,
          0,
          seqParams(
            // Arp-y adventure hook (C maj-ish)
            deg(0, 12, 7, 12, 4, 12, 7, 12, 5, 12, 9, 12, 7, 16, 12, 7),
            [1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1],
          ),
        ),
        m(5, 'bitboy', 28, 0, {
          mode: 2,
          tune: 0.08,
          frame: 10,
          morph: 0.55,
          level: 0.82,
        }),
        m(
          6,
          'sequencer',
          36,
          0,
          seqParams(
            // Bass ostinato under the lead
            deg(0, 0, 7, 0, 5, 5, 7, 12),
            [1, 0, 1, 1, 1, 0, 1, 1],
          ),
        ),
        m(7, 'bitboy', 48, 0, {
          mode: 3, // CH3 wave bass
          tune: -1,
          frame: 2,
          morph: 0.3,
          level: 0.88,
        }),
        m(8, 'erica_mixer', 56, 0, mixerParams(0.75, 0.85, 0.9, 0)),
        m(9, 'erica_output', 64, 0, { level: 0.7 }),
        // --- row 1: drums ---
        m(10, 'divider', 0, 1, { pw: 0.35 }),
        m(11, 'drums', 4, 1, {
          tone: 0.38,
          snappy: 0.65,
          decay: 0.32,
          level: 0.92,
        }),
      ],
      [
        // Clock → lead (×2), bass (×1), drums
        cable(1, 2, 'clk1', 3, 'clock'),
        cable(2, 2, 'clk2', 10, 'clock'),
        cable(3, 3, 'x2', 4, 'clock'),
        cable(4, 3, 'x1', 6, 'clock'),
        // Lead pulse
        cable(5, 4, 'cv', 5, 'v_oct'),
        cable(6, 4, 'gate', 5, 'gate'),
        // Bass wave
        cable(7, 6, 'cv', 7, 'v_oct'),
        cable(8, 6, 'gate', 7, 'gate'),
        // Drums: kick quarters, snare 2&4, busy hats
        cable(9, 3, 'x1', 11, 'bd'),
        cable(10, 10, 'd2', 11, 'sd'),
        cable(11, 3, 'x4', 11, 'ch'),
        cable(12, 3, 'x2', 11, 'oh'),
        // Mix lead / bass / drums → out
        cable(13, 5, 'out', 8, 'in1'),
        cable(14, 7, 'out', 8, 'in2'),
        cable(15, 11, 'mix', 8, 'in3'),
        cable(16, 8, 'out', 9, 'in_l'),
        cable(17, 8, 'out2', 9, 'in_r'),
        cable(18, 9, 'line_l', SPEAKER, 'ch1'),
        cable(19, 9, 'line_r', SPEAKER, 'ch2'),
      ],
      12,
      20,
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

  // ── Beats ──
  {
    id: 'builtin-beat-box',
    name: 'Beat box',
    builtin: true,
    updatedAt: 0,
    // Clock ×4 → Beat. Click the Beat module to edit lanes (sound/level/pan).
    graph: graph(
      [
        m(2, 'fm_clock', 0, 0, { bpm: 122, pw: 0.12 }),
        m(3, 'clk_mult', 8, 0, { pw: 0.2 }),
        m(4, 'beat', 14, 0, {
          pattern: 0,
          swing: 0.08,
          level: 0.92,
          bd_on: 1,
          bd_sound: 0,
          bd_level: 0.95,
          bd_pan: 0,
          sd_on: 1,
          sd_sound: 3,
          sd_level: 0.85,
          sd_pan: 0.2,
          ch_on: 1,
          ch_sound: 6,
          ch_level: 0.65,
          ch_pan: -0.3,
          oh_on: 1,
          oh_sound: 8,
          oh_level: 0.55,
          oh_pan: 0.35,
        }),
        m(5, 'erica_output', 28, 0, { level: 0.7 }),
      ],
      [
        cable(1, 2, 'clk1', 3, 'clock'),
        cable(2, 3, 'x4', 4, 'clock'),
        cable(3, 4, 'out_l', 5, 'in_l'),
        cable(4, 4, 'out_r', 5, 'in_r'),
        cable(5, 5, 'line_l', SPEAKER, 'ch1'),
        cable(6, 5, 'line_r', SPEAKER, 'ch2'),
      ],
      6,
      7,
    ),
  },
  {
    id: 'builtin-beat-twin',
    name: 'Beat → Twin',
    builtin: true,
    updatedAt: 0,
    // Beat sequences; mute internal levels and drive Twin from gates.
    graph: graph(
      [
        m(2, 'fm_clock', 0, 0, { bpm: 118, pw: 0.12 }),
        m(3, 'clk_mult', 8, 0, { pw: 0.2 }),
        m(4, 'beat', 14, 0, {
          pattern: 1,
          swing: 0.06,
          level: 0.55,
          bd_on: 1,
          bd_level: 0.9,
          sd_on: 1,
          sd_level: 0.75,
          ch_on: 1,
          ch_level: 0.55,
          oh_on: 1,
          oh_level: 0.45,
        }),
        m(5, 'twin', 28, 0, {
          mode_a: 3,
          mode_b: 4,
          p1: 0.4,
          p2: 0.55,
          p3: 0.5,
          p4: 0.48,
          split: 1,
          level: 0.95,
        }),
        m(6, 'twin', 38, 0, {
          mode_a: 5,
          mode_b: 6,
          p1: 0.55,
          p2: 0.35,
          p3: 0.42,
          p4: 0.5,
          split: 1,
          level: 0.85,
        }),
        // Beat audio + Twin hits — was silent when beat level was 0 and Twin alone was thin.
        m(7, 'erica_mixer', 48, 0, mixerParams(0.55, 0.75, 0.55, 0)),
        m(8, 'erica_output', 60, 0, { level: 0.72 }),
      ],
      [
        cable(1, 2, 'clk1', 3, 'clock'),
        cable(2, 3, 'x4', 4, 'clock'),
        cable(3, 4, 'bd_g', 5, 'trig_a'),
        cable(4, 4, 'sd_g', 5, 'trig_b'),
        cable(5, 4, 'ch_g', 6, 'trig_a'),
        cable(6, 4, 'oh_g', 6, 'trig_b'),
        cable(7, 4, 'out_l', 7, 'in1'),
        cable(8, 5, 'mix', 7, 'in2'),
        cable(9, 6, 'mix', 7, 'in3'),
        cable(10, 7, 'out', 8, 'in_l'),
        cable(11, 7, 'out2', 8, 'in_r'),
        cable(12, 8, 'line_l', SPEAKER, 'ch1'),
        cable(13, 8, 'line_r', SPEAKER, 'ch2'),
      ],
      9,
      14,
    ),
  },
  {
    id: 'builtin-house',
    name: 'House beat',
    builtin: true,
    updatedAt: 0,
    graph: graph(
      [
        m(2, 'fm_clock', 0, 0, { bpm: 124, pw: 0.12 }),
        m(3, 'clk_mult', 8, 0, { pw: 0.18 }),
        m(4, 'beat', 14, 0, {
          pattern: 0,
          swing: 0,
          level: 0.9,
          bd_sound: 1,
          sd_sound: 4,
        }),
      ],
      [
        cable(1, 2, 'clk1', 3, 'clock'),
        cable(2, 3, 'x4', 4, 'clock'),
        cable(3, 4, 'mix', SPEAKER, 'ch1'),
      ],
      5,
      4,
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
  {
    id: 'builtin-shoegaze-haze',
    name: 'Shoegaze haze',
    builtin: true,
    updatedAt: 0,
    // Detuned pad + saw → driven Polivoks → BBD smear → ping-pong + huge reverb
    graph: graph(
      [
        m(2, 'fm_clock', 0, 0, { bpm: 68, pw: 0.22 }),
        m(
          3,
          'sequencer',
          8,
          0,
          seqParams(
            deg(0, 3, 7, 10, 12, 10, 7, 3),
            [1, 1, 1, 0, 1, 1, 0, 1],
            { glide: 0.28 },
          ),
        ),
        m(4, 'envelope', 20, 0, {
          attack: 0.55,
          decay: 0.45,
          sustain: 0.8,
          release: 1.6,
        }),
        m(5, 'facets', 28, 0, {
          model: 6,
          freq: 82.41,
          harmonics: 0.45,
          timbre: 0.38,
          morph: 0.55,
          level: 0.72,
        }),
        m(6, 'erica_vco3', 40, 0, {
          freq: 164.81,
          fine: -0.07,
          fm_amt: 0.15,
          pwm_amt: 0.55,
        }),
        m(7, 'erica_mixer', 52, 0, mixerParams(0.48, 0.42, 0, 0)),
        m(8, 'erica_polivoks_vcf', 60, 0, {
          cutoff: 1100,
          res: 0.28,
          drive: 0.72,
          fm_amt: 0.45,
        }),
        m(9, 'dual_vca', 70, 0, {
          bias_a: 0.28,
          bias_b: 0,
          exp_a: 0,
          exp_b: 0,
        }),
        m(10, 'lfo', 80, 0, { rate: 0.09, shape: 0.45, level: 0.55 }),
        m(11, 'swell', 88, 0, {
          freq: 0.11,
          shape: 0.5,
          slope: 0.55,
          smoothness: 0.65,
          mode: 1,
          range: 2,
        }),
        m(12, 'erica_bbd', 0, 1, {
          time: 320,
          feedback: 0.7,
          mix: 0.58,
          colour: 0.62,
          mod_rate: 0.32,
          mod_amt: 0.4,
        }),
        m(13, 'delay', 10, 1, {
          time: 0.58,
          feedback: 0.74,
          mix: 0.55,
          pingpong: 1,
        }),
        m(14, 'reverb', 18, 1, {
          size: 0.92,
          decay: 0.93,
          damp: 0.2,
          mix: 0.58,
        }),
        m(15, 'stereo', 26, 1, { pan: 0, width: 1.15, level: 0.78 }),
      ],
      [
        cable(1, 2, 'clk1', 3, 'clock'),
        cable(2, 3, 'cv', 5, 'v_oct'),
        cable(3, 3, 'cv', 6, 'v_oct'),
        cable(4, 3, 'gate', 4, 'gate'),
        cable(5, 11, 'bi', 5, 'morph_cv'),
        cable(6, 10, 'out', 5, 'timbre_cv'),
        cable(7, 5, 'out', 7, 'in1'),
        cable(8, 6, 'saw', 7, 'in2'),
        cable(9, 7, 'out', 8, 'in'),
        cable(10, 10, 'out', 8, 'fm'),
        cable(11, 8, 'lp', 9, 'in_a'),
        cable(12, 4, 'env', 9, 'cv_a'),
        cable(13, 9, 'out_a', 12, 'in'),
        cable(14, 11, 'bi', 12, 'time_cv'),
        cable(15, 12, 'mix_out', 13, 'in'),
        cable(16, 10, 'out', 13, 'time_cv'),
        cable(17, 13, 'out_l', 14, 'in_l'),
        cable(18, 13, 'out_r', 14, 'in_r'),
        cable(19, 14, 'out_l', 15, 'in_l'),
        cable(20, 14, 'out_r', 15, 'in_r'),
        cable(21, 15, 'out_l', SPEAKER, 'ch1'),
        cable(22, 15, 'out_r', SPEAKER, 'ch2'),
      ],
      16,
      23,
    ),
  },

  // ── Expansions (audible on load) ──────────────────────────
  {
    id: 'builtin-pluck-verb',
    name: 'Pluck room',
    builtin: true,
    updatedAt: 0,
    graph: graph(
      [
        m(2, 'fm_clock', 0, 0, { bpm: 96, pw: 0.16 }),
        m(
          3,
          'sequencer',
          8,
          0,
          seqParams(deg(0, 7, 12, 7, 3, 10, 15, 12), [1, 1, 1, 0, 1, 1, 1, 0], {
            glide: 0.02,
          }),
        ),
        m(4, 'envelope', 20, 0, {
          attack: 0.002,
          decay: 0.28,
          sustain: 0.05,
          release: 0.2,
        }),
        m(5, 'facets', 28, 0, {
          model: 5,
          freq: 130.81,
          harmonics: 0.55,
          timbre: 0.42,
          morph: 0.5,
          level: 0.9,
        }),
        m(6, 'reverb', 40, 0, {
          size: 0.55,
          decay: 0.62,
          damp: 0.4,
          mix: 0.38,
        }),
      ],
      [
        cable(1, 2, 'clk1', 3, 'clock'),
        cable(2, 3, 'cv', 5, 'v_oct'),
        cable(3, 3, 'gate', 4, 'gate'),
        cable(4, 3, 'gate', 5, 'trig'),
        cable(5, 4, 'env', 5, 'level_cv'),
        cable(6, 5, 'out', 6, 'in_l'),
        cable(7, 6, 'out_l', SPEAKER, 'ch1'),
        cable(8, 6, 'out_r', SPEAKER, 'ch2'),
      ],
      7,
      9,
    ),
  },
  {
    id: 'builtin-minor-run',
    name: 'Minor run',
    builtin: true,
    updatedAt: 0,
    graph: graph(
      [
        m(2, 'fm_clock', 0, 0, { bpm: 126, pw: 0.14 }),
        m(
          3,
          'sequencer16',
          8,
          0,
          seqParams(
            deg(0, 2, 3, 5, 7, 8, 10, 12, 10, 8, 7, 5, 3, 2, 0, -2),
            [1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 0],
            { glide: 0.04 },
          ),
        ),
        m(4, 'envelope', 24, 0, {
          attack: 0.008,
          decay: 0.2,
          sustain: 0.35,
          release: 0.18,
        }),
        m(5, 'vco', 32, 0, { freq: 110, fm_amt: 0, pwm_amt: 0.5 }),
        m(6, 'wasp', 44, 0, { cutoff: 1400, res: 0.35, drive: 0.3 }),
        m(7, 'dual_vca', 54, 0, { bias_a: 0, bias_b: 0, exp_a: 0, exp_b: 0 }),
        m(8, 'delay', 64, 0, {
          time: 0.28,
          feedback: 0.35,
          mix: 0.22,
          pingpong: 1,
        }),
      ],
      [
        cable(1, 2, 'clk1', 3, 'clock'),
        cable(2, 3, 'cv', 5, 'v_oct'),
        cable(3, 3, 'gate', 4, 'gate'),
        cable(4, 5, 'saw', 6, 'in'),
        cable(5, 4, 'env', 6, 'cv'),
        cable(6, 6, 'lp', 7, 'in_a'),
        cable(7, 4, 'env', 7, 'cv_a'),
        cable(8, 7, 'out_a', 8, 'in'),
        cable(9, 8, 'out_l', SPEAKER, 'ch1'),
        cable(10, 8, 'out_r', SPEAKER, 'ch2'),
      ],
      9,
      11,
    ),
  },
  {
    id: 'builtin-garage-beat',
    name: 'Garage beat',
    builtin: true,
    updatedAt: 0,
    graph: graph(
      [
        m(2, 'fm_clock', 0, 0, { bpm: 130, pw: 0.12 }),
        m(3, 'clk_mult', 8, 0, { pw: 0.18 }),
        m(4, 'beat', 14, 0, {
          pattern: 5,
          swing: 0.12,
          level: 0.92,
          bd_on: 1,
          bd_sound: 1,
          bd_level: 0.95,
          sd_on: 1,
          sd_sound: 3,
          sd_level: 0.8,
          ch_on: 1,
          ch_sound: 6,
          ch_level: 0.7,
          oh_on: 1,
          oh_sound: 8,
          oh_level: 0.5,
        }),
        m(5, 'delay', 28, 0, {
          time: 0.22,
          feedback: 0.28,
          mix: 0.18,
          pingpong: 1,
        }),
        m(6, 'erica_output', 38, 0, { level: 0.74 }),
      ],
      [
        cable(1, 2, 'clk1', 3, 'clock'),
        cable(2, 3, 'x4', 4, 'clock'),
        cable(3, 4, 'out_l', 5, 'in'),
        cable(4, 5, 'out_l', 6, 'in_l'),
        cable(5, 5, 'out_r', 6, 'in_r'),
        cable(6, 6, 'line_l', SPEAKER, 'ch1'),
        cable(7, 6, 'line_r', SPEAKER, 'ch2'),
      ],
      7,
      8,
    ),
  },
  {
    id: 'builtin-midi-keys-drone',
    name: 'MIDI keys + drone',
    builtin: true,
    updatedAt: 0,
    graph: graph(
      [
        m(2, 'midi_cv', 0, 0, { omni: 1, bend_range: 2 }),
        m(3, 'facets', 12, 0, {
          model: 0,
          freq: 110,
          harmonics: 0.4,
          timbre: 0.45,
          morph: 0.5,
          level: 0.85,
        }),
        m(4, 'envelope', 24, 0, {
          attack: 0.01,
          decay: 0.25,
          sustain: 0.5,
          release: 0.35,
        }),
        m(5, 'dual_vca', 32, 0, { bias_a: 0, bias_b: 0.22, exp_a: 0, exp_b: 0 }),
        m(6, 'chimes', 42, 0, {
          freq: 55,
          structure: 0.45,
          brightness: 0.4,
          damping: 0.55,
          position: 0.5,
        }),
        m(7, 'lfo', 52, 0, { rate: 0.08, shape: 0.5, level: 0.5 }),
        m(8, 'erica_mixer', 60, 0, mixerParams(0.8, 0.4, 0, 0)),
        m(9, 'reverb', 70, 0, {
          size: 0.7,
          decay: 0.75,
          damp: 0.35,
          mix: 0.3,
        }),
        m(10, 'erica_output', 80, 0, { level: 0.7 }),
      ],
      [
        cable(1, 2, 'cv1', 3, 'v_oct'),
        cable(2, 2, 'gate1', 4, 'gate'),
        cable(3, 2, 'gate1', 6, 'trig'),
        cable(4, 3, 'out', 5, 'in_a'),
        cable(5, 4, 'env', 5, 'cv_a'),
        cable(6, 6, 'odd', 5, 'in_b'),
        cable(7, 7, 'out', 6, 'structure_cv'),
        cable(8, 5, 'out_a', 8, 'in1'),
        cable(9, 5, 'out_b', 8, 'in2'),
        cable(10, 8, 'out', 9, 'in_l'),
        cable(11, 9, 'out_l', 10, 'in_l'),
        cable(12, 9, 'out_r', 10, 'in_r'),
        cable(13, 10, 'line_l', SPEAKER, 'ch1'),
        cable(14, 10, 'line_r', SPEAKER, 'ch2'),
      ],
      11,
      15,
    ),
  },
  {
    id: 'builtin-song-ember',
    name: 'Song: ember',
    builtin: true,
    updatedAt: 0,
    graph: graph(
      [
        m(2, 'fm_clock', 0, 0, { bpm: 92, pw: 0.14 }),
        m(3, 'clk_mult', 8, 0, { pw: 0.18 }),
        m(4, 'divider', 14, 0, { pw: 0.2 }),
        m(
          5,
          'sequencer',
          20,
          0,
          seqParams(deg(0, 3, 7, 10, 12, 10, 7, 5), [1, 0, 1, 1, 1, 0, 1, 1], {
            glide: 0.15,
          }),
        ),
        m(6, 'envelope', 32, 0, {
          attack: 0.08,
          decay: 0.35,
          sustain: 0.55,
          release: 0.5,
        }),
        m(7, 'erica_vco3', 40, 0, {
          freq: 82.41,
          fine: 0.02,
          fm_amt: 0.1,
          pwm_amt: 0.45,
        }),
        m(8, 'erica_polivoks_vcf', 52, 0, {
          cutoff: 900,
          res: 0.4,
          drive: 0.45,
          fm_amt: 0.35,
        }),
        m(9, 'dual_vca', 62, 0, { bias_a: 0, bias_b: 0, exp_a: 0, exp_b: 0 }),
        m(10, 'drums', 0, 1, { tone: 0.45, snappy: 0.4, decay: 0.45, level: 0.7 }),
        m(11, 'erica_mixer', 12, 1, mixerParams(0.7, 0.55, 0, 0)),
        m(12, 'reverb', 24, 1, {
          size: 0.65,
          decay: 0.7,
          damp: 0.4,
          mix: 0.28,
        }),
        m(13, 'erica_output', 34, 1, { level: 0.7 }),
      ],
      [
        cable(1, 2, 'clk1', 3, 'clock'),
        cable(2, 3, 'x2', 4, 'clock'),
        cable(3, 3, 'x4', 5, 'clock'),
        cable(4, 4, 'd1', 10, 'bd'),
        cable(5, 4, 'd2', 10, 'sd'),
        cable(6, 4, 'd4', 10, 'ch'),
        cable(7, 5, 'cv', 7, 'v_oct'),
        cable(8, 5, 'gate', 6, 'gate'),
        cable(9, 7, 'saw', 8, 'in'),
        cable(10, 6, 'env', 8, 'fm'),
        cable(11, 8, 'lp', 9, 'in_a'),
        cable(12, 6, 'env', 9, 'cv_a'),
        cable(13, 9, 'out_a', 11, 'in1'),
        cable(14, 10, 'mix', 11, 'in2'),
        cable(15, 11, 'out', 12, 'in_l'),
        cable(16, 12, 'out_l', 13, 'in_l'),
        cable(17, 12, 'out_r', 13, 'in_r'),
        cable(18, 13, 'line_l', SPEAKER, 'ch1'),
        cable(19, 13, 'line_r', SPEAKER, 'ch2'),
      ],
      14,
      20,
    ),
  },
  {
    id: 'builtin-texture-rain',
    name: 'Texture: rain',
    builtin: true,
    updatedAt: 0,
    graph: graph(
      [
        m(2, 'noise', 0, 0, { level: 0.7, color: 0.7 }),
        m(3, 'sample_hold', 8, 0, { slew: 0.45, noise: 0.2 }),
        m(4, 'lfo', 16, 0, { rate: 0.22, shape: 0.5, level: 0.65 }),
        m(5, 'fm_clock', 24, 0, { bpm: 64, pw: 0.2 }),
        m(6, 'chimes', 32, 0, {
          freq: 220,
          structure: 0.55,
          brightness: 0.35,
          damping: 0.7,
          position: 0.4,
        }),
        m(7, 'vcf', 44, 0, { cutoff: 1800, res: 0.25 }),
        m(8, 'reverb', 54, 0, {
          size: 0.85,
          decay: 0.88,
          damp: 0.25,
          mix: 0.55,
        }),
        m(9, 'stereo', 64, 0, { pan: 0, width: 1.2, level: 0.8 }),
      ],
      [
        cable(1, 5, 'clk1', 3, 'clock'),
        cable(2, 5, 'clk1', 6, 'trig'),
        cable(3, 2, 'pink', 3, 'in'),
        cable(4, 2, 'white', 6, 'in'),
        cable(5, 3, 'out', 6, 'v_oct'),
        cable(6, 4, 'out', 6, 'brightness_cv'),
        cable(7, 4, 'out', 7, 'fm'),
        cable(8, 6, 'odd', 7, 'in'),
        cable(9, 7, 'lp', 8, 'in_l'),
        cable(10, 8, 'out_l', 9, 'in_l'),
        cable(11, 8, 'out_r', 9, 'in_r'),
        cable(12, 9, 'out_l', SPEAKER, 'ch1'),
        cable(13, 9, 'out_r', SPEAKER, 'ch2'),
      ],
      10,
      14,
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

/** Presets nested under menu groups (empty groups omitted). */
export function listPresetsByGroup(): { group: PresetGroup; presets: Preset[] }[] {
  const all = listPresets()
  return PRESET_GROUPS.map((group) => ({
    group,
    presets: all.filter((p) => groupForPreset(p.id, p.builtin) === group.id),
  })).filter((g) => g.presets.length > 0)
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
