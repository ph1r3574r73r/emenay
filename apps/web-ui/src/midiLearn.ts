/** MIDI Learn maps — app actions, knob CC bank, param binds (localStorage). */

export type MidiBindingDto = { kind: 'cc' | 'note' | 'none'; n: number }

/** Cleared / stolen binding — no longer matches MIDI. */
export const UNBOUND: MidiBindingDto = { kind: 'none', n: 0 }

export type MidiMaps = {
  actions: MidiActionBindingsDto
  bank: KnobBank
  learns: MidiParamLearnDto[]
}

export type CcOwner =
  | { kind: 'action'; action: keyof MidiActionBindingsDto }
  | { kind: 'knob'; index: number }
  | { kind: 'param'; moduleId: number; param: string }

export type MidiActionBindingsDto = {
  start: MidiBindingDto
  stop: MidiBindingDto
  rest: MidiBindingDto
  preset_prev: MidiBindingDto
  preset_next: MidiBindingDto
  preset_save: MidiBindingDto
  panic: MidiBindingDto
}

export type MidiParamLearnDto = {
  cc: number
  module_id: number
  param: string
}

export type MidiAppActionName =
  | 'Start'
  | 'Stop'
  | 'Rest'
  | 'PresetPrev'
  | 'PresetNext'
  | 'PresetSave'
  | 'Panic'

/** Eight generic knob CCs used by the MIDI CC module by default. */
export type KnobBank = [number, number, number, number, number, number, number, number]

const ACTIONS_KEY = 'emenay.midi.actions.v1'
const LEARNS_KEY = 'emenay.midi.learns.v1'
const KNOB_BANK_KEY = 'emenay.midi.knobBank.v1'
const PROFILE_KEY = 'emenay.midi.profile.v1'

/** Factory app-action map — generic CCs, rebind via Settings → MIDI. */
export const DEFAULT_ACTION_BINDINGS: MidiActionBindingsDto = {
  start: { kind: 'cc', n: 115 },
  stop: { kind: 'cc', n: 116 },
  rest: { kind: 'cc', n: 117 },
  preset_prev: { kind: 'cc', n: 110 },
  preset_next: { kind: 'cc', n: 111 },
  preset_save: { kind: 'cc', n: 112 },
  panic: { kind: 'cc', n: 118 },
}

/** Factory knob bank (CC 16…23) — matches MIDI CC module defaults. */
export const DEFAULT_KNOB_BANK: KnobBank = [16, 17, 18, 19, 20, 21, 22, 23]

export const ACTION_LABELS: {
  key: keyof MidiActionBindingsDto
  label: string
  hint: string
}[] = [
  { key: 'start', label: 'Start', hint: 'Start audio engine' },
  { key: 'stop', label: 'Stop', hint: 'Stop audio engine' },
  { key: 'rest', label: 'Rest', hint: 'Silence + reset modules' },
  {
    key: 'preset_prev',
    label: 'Preset ←',
    hint: 'Previous rack preset (Learn a CC/note — not Oxygen’s local preset arrows)',
  },
  {
    key: 'preset_next',
    label: 'Preset →',
    hint: 'Next rack preset (Learn a CC/note — Bank < / > or a pad often work)',
  },
  { key: 'preset_save', label: 'Save preset', hint: 'Save current user preset' },
  { key: 'panic', label: 'Panic', hint: 'All notes off + rest' },
]

export const KNOB_BANK_LABELS = [
  'Knob 1 → MIDI CC out 1',
  'Knob 2 → MIDI CC out 2',
  'Knob 3 → MIDI CC out 3',
  'Knob 4 → MIDI CC out 4',
  'Knob 5 → MIDI CC out 5',
  'Knob 6 → MIDI CC out 6',
  'Knob 7 → MIDI CC out 7',
  'Knob 8 → MIDI CC out 8',
] as const

function clampCc(n: number): number {
  return Math.max(0, Math.min(127, Math.round(n)))
}

function parseBinding(raw: unknown): MidiBindingDto | null {
  if (!raw || typeof raw !== 'object') return null
  const o = raw as Record<string, unknown>
  if (o.kind === 'none' || o.kind === 'off' || o.kind === 'unbound') {
    return { ...UNBOUND }
  }
  const kind = o.kind === 'note' ? 'note' : o.kind === 'cc' ? 'cc' : null
  const n = Number(o.n)
  if (!kind || !Number.isFinite(n)) return null
  return { kind, n: clampCc(n) }
}

const ACTION_KEYS = ACTION_LABELS.map(({ key }) => key)

/** First CC number not used by the knob bank (and optional reserved set). */
function freeKnobCc(bank: KnobBank, reserved: number[] = []): number {
  const used = new Set<number>([...bank, ...reserved])
  for (let i = 0; i < 128; i++) {
    if (!used.has(i)) return i
  }
  return 0
}

/** Clear CC `cc` from every map, then assign it to `owner` (one control → one target). */
export function claimCc(maps: MidiMaps, cc: number, owner: CcOwner): MidiMaps {
  const n = clampCc(cc)
  const actions = { ...maps.actions }
  for (const key of ACTION_KEYS) {
    const b = actions[key]
    if (b.kind === 'cc' && b.n === n) {
      actions[key] = { ...UNBOUND }
    }
  }

  const bank = [...maps.bank] as KnobBank
  for (let i = 0; i < bank.length; i++) {
    if (bank[i] === n) {
      bank[i] = -1 // mark; fill after owner is applied
    }
  }

  let learns = maps.learns.filter((l) => l.cc !== n)

  if (owner.kind === 'action') {
    actions[owner.action] = { kind: 'cc', n }
  } else if (owner.kind === 'knob') {
    bank[owner.index] = n
  } else {
    learns = [
      ...learns.filter(
        (l) => !(l.module_id === owner.moduleId && l.param === owner.param),
      ),
      { cc: n, module_id: owner.moduleId, param: owner.param },
    ]
  }

  // Replace stolen knob slots with unused CCs so the bank stays unique.
  for (let i = 0; i < bank.length; i++) {
    if (bank[i] < 0) {
      bank[i] = freeKnobCc(bank, [n])
    }
  }

  return { actions, bank, learns }
}

/** Notes only bind app actions — steal from other actions that share the note. */
export function claimNote(
  maps: MidiMaps,
  note: number,
  action: keyof MidiActionBindingsDto,
): MidiMaps {
  const n = clampCc(note)
  const actions = { ...maps.actions }
  for (const key of ACTION_KEYS) {
    const b = actions[key]
    if (b.kind === 'note' && b.n === n) {
      actions[key] = { ...UNBOUND }
    }
  }
  actions[action] = { kind: 'note', n }
  return { actions, bank: maps.bank, learns: maps.learns }
}

export function loadActionBindings(): MidiActionBindingsDto {
  try {
    const raw = localStorage.getItem(ACTIONS_KEY)
    if (!raw) return { ...DEFAULT_ACTION_BINDINGS }
    const parsed = JSON.parse(raw) as Record<string, unknown>
    const out = { ...DEFAULT_ACTION_BINDINGS }
    for (const { key } of ACTION_LABELS) {
      const b = parseBinding(parsed[key])
      if (b) out[key] = b
    }
    return out
  } catch {
    return { ...DEFAULT_ACTION_BINDINGS }
  }
}

export function saveActionBindings(b: MidiActionBindingsDto) {
  localStorage.setItem(ACTIONS_KEY, JSON.stringify(b))
}

export function loadParamLearns(): MidiParamLearnDto[] {
  try {
    const raw = localStorage.getItem(LEARNS_KEY)
    if (!raw) return []
    const arr = JSON.parse(raw) as unknown
    if (!Array.isArray(arr)) return []
    return arr
      .map((x) => {
        if (!x || typeof x !== 'object') return null
        const o = x as Record<string, unknown>
        const cc = Number(o.cc)
        const module_id = Number(o.module_id)
        const param = String(o.param ?? '')
        if (!Number.isFinite(cc) || !Number.isFinite(module_id) || !param) return null
        return {
          cc: clampCc(cc),
          module_id: Math.round(module_id),
          param,
        }
      })
      .filter((x): x is MidiParamLearnDto => x != null)
  } catch {
    return []
  }
}

export function saveParamLearns(learns: MidiParamLearnDto[]) {
  localStorage.setItem(LEARNS_KEY, JSON.stringify(learns))
}

export function loadKnobBank(): KnobBank {
  try {
    const raw = localStorage.getItem(KNOB_BANK_KEY)
    if (!raw) return [...DEFAULT_KNOB_BANK] as KnobBank
    const arr = JSON.parse(raw) as unknown
    if (!Array.isArray(arr) || arr.length !== 8) return [...DEFAULT_KNOB_BANK] as KnobBank
    return arr.map((n) => clampCc(Number(n))) as KnobBank
  } catch {
    return [...DEFAULT_KNOB_BANK] as KnobBank
  }
}

export function saveKnobBank(bank: KnobBank) {
  localStorage.setItem(KNOB_BANK_KEY, JSON.stringify(bank))
}

/** Params to apply when placing a new `midi_cc` module. */
export function midiCcParamsFromBank(bank: KnobBank = loadKnobBank()): Record<string, number> {
  const out: Record<string, number> = {}
  for (let i = 0; i < 8; i++) {
    out[`cc_num_${i + 1}`] = bank[i]
  }
  return out
}

/**
 * Default param order for focus knobs: faceplate param hits first (visual order),
 * else catalog param names. At most 8.
 */
export function focusParamNamesForModule(
  paramNames: string[],
  panelParamIds: string[] | null | undefined,
): string[] {
  const known = new Set(paramNames)
  const fromPanel = (panelParamIds ?? []).filter((id) => known.has(id))
  const ordered = fromPanel.length > 0 ? fromPanel : [...paramNames]
  const skip = new Set<string>(['channels'])
  if (ordered.includes('pattern')) skip.add('loop')
  return ordered.filter((n) => !skip.has(n)).slice(0, 8)
}

/** Temporary learns: knob bank CC i → param i on the focused module. */
export function focusLearnsFromKnobBank(
  moduleId: number,
  paramNames: string[],
  bank: KnobBank,
): MidiParamLearnDto[] {
  const out: MidiParamLearnDto[] = []
  const n = Math.min(8, paramNames.length)
  for (let i = 0; i < n; i++) {
    out.push({ cc: bank[i]!, module_id: moduleId, param: paramNames[i]! })
  }
  return out
}

/**
 * Focus learns win on their CCs over persistent maps. Focus maps are never
 * written to localStorage — callers pass them only to the engine.
 */
export function mergeFocusParamLearns(
  persistent: MidiParamLearnDto[],
  focus: MidiParamLearnDto[] | null | undefined,
): MidiParamLearnDto[] {
  if (!focus?.length) return persistent
  const focusCcs = new Set(focus.map((f) => f.cc))
  return [...persistent.filter((l) => !focusCcs.has(l.cc)), ...focus]
}

export function loadProfileName(): string {
  try {
    return localStorage.getItem(PROFILE_KEY)?.trim() || 'My controller'
  } catch {
    return 'My controller'
  }
}

export function saveProfileName(name: string) {
  localStorage.setItem(PROFILE_KEY, name.trim() || 'My controller')
}

export function formatBinding(b: MidiBindingDto): string {
  if (b.kind === 'none') return '—'
  return b.kind === 'cc' ? `CC${b.n}` : `N${b.n}`
}

export function resetMidiMapsToDefaults(): {
  actions: MidiActionBindingsDto
  bank: KnobBank
  learns: MidiParamLearnDto[]
  profile: string
} {
  const actions = { ...DEFAULT_ACTION_BINDINGS }
  const bank = [...DEFAULT_KNOB_BANK] as KnobBank
  const learns: MidiParamLearnDto[] = []
  const profile = 'My controller'
  saveActionBindings(actions)
  saveKnobBank(bank)
  saveParamLearns(learns)
  saveProfileName(profile)
  return { actions, bank, learns, profile }
}
