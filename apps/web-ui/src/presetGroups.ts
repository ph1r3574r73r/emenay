/** Built-in preset menu groups (order = menu order). */

export type PresetGroupId =
  | 'start'
  | 'midi'
  | 'voices'
  | 'melodies'
  | 'beats'
  | 'songs'
  | 'textures'
  | 'saved'

export type PresetGroup = {
  id: PresetGroupId
  label: string
  /** Short hint for empty / MIDI groups. */
  hint?: string
}

export const PRESET_GROUPS: PresetGroup[] = [
  { id: 'start', label: 'Start here' },
  { id: 'midi', label: 'MIDI', hint: 'Play keys / pads' },
  { id: 'voices', label: 'Voices & FX' },
  { id: 'melodies', label: 'Melodies' },
  { id: 'beats', label: 'Beats' },
  { id: 'songs', label: 'Songs' },
  { id: 'textures', label: 'Textures' },
  { id: 'saved', label: 'Saved' },
]

/** Map builtin preset id → group. Unknown builtins fall under Voices. */
const GROUP_BY_ID: Record<string, PresetGroupId> = {
  'builtin-empty': 'start',
  'builtin-voice': 'start',
  'builtin-erica-polivoks-voice': 'start',
  'builtin-facets-solo': 'start',

  'builtin-midi-vco3': 'midi',
  'builtin-midi-polivoks': 'midi',
  'builtin-midi-modulator': 'midi',
  'builtin-midi-bassline': 'midi',
  'builtin-midi-bbd': 'midi',
  'builtin-midi-swamp': 'midi',
  'builtin-midi-polysynth': 'midi',
  'builtin-midi-poly-cc': 'midi',
  'builtin-midi-pads-drums': 'midi',
  'builtin-midi-chiptune': 'midi',
  'builtin-midi-bitboy-adsr': 'midi',
  'builtin-midi-keys': 'midi',
  'builtin-midi-bass-lead': 'midi',
  'builtin-midi-duo': 'midi',
  'builtin-midi-poly4': 'midi',
  'builtin-midi-pad': 'midi',
  'builtin-midi-poly-twin': 'midi',
  'builtin-midi-keys-drone': 'midi',

  'builtin-facets': 'voices',
  'builtin-wobble': 'voices',
  'builtin-seq': 'voices',
  'builtin-drums': 'voices',
  'builtin-random': 'voices',
  'builtin-chimes': 'voices',
  'builtin-bass': 'voices',
  'builtin-twist': 'voices',
  'builtin-delay': 'voices',
  'builtin-bitboy': 'voices',
  'builtin-swell': 'voices',
  'builtin-noise-filter': 'voices',
  'builtin-pluck-verb': 'voices',

  'builtin-arp': 'melodies',
  'builtin-blues': 'melodies',
  'builtin-acid': 'melodies',
  'builtin-ostinato': 'melodies',
  'builtin-chiptune': 'melodies',
  'builtin-bitboy-nes': 'melodies',
  'builtin-chiptune-song': 'melodies',
  'builtin-pentatonic': 'melodies',
  'builtin-minor-run': 'melodies',

  'builtin-beat-box': 'beats',
  'builtin-beat-twin': 'beats',
  'builtin-house': 'beats',
  'builtin-breakbeat': 'beats',
  'builtin-techno': 'beats',
  'builtin-hiphop': 'beats',
  'builtin-jam': 'beats',
  'builtin-bassbeat': 'beats',
  'builtin-garage-beat': 'beats',

  'builtin-seq32': 'songs',
  'builtin-seq64': 'songs',
  'builtin-song-dusk': 'songs',
  'builtin-song-neon': 'songs',
  'builtin-song-tide': 'songs',
  'builtin-song-orbit': 'songs',
  'builtin-song-wire': 'songs',
  'builtin-song-ember': 'songs',

  'builtin-lots': 'textures',
  'builtin-texture-dust': 'textures',
  'builtin-texture-bloom': 'textures',
  'builtin-texture-static': 'textures',
  'builtin-shoegaze-haze': 'textures',
  'builtin-texture-rain': 'textures',
}

export function groupForPreset(id: string, builtin?: boolean): PresetGroupId {
  if (!builtin) return 'saved'
  return GROUP_BY_ID[id] ?? 'voices'
}

export function groupLabel(id: PresetGroupId): string {
  return PRESET_GROUPS.find((g) => g.id === id)?.label ?? id
}
