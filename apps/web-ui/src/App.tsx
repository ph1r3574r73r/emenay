import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from 'react'
import { invoke } from '@tauri-apps/api/core'
import { resolvePanel } from './panels'
import { resolvePanelLayout, type PanelHit } from './panelLayouts'
import {
  deleteUserPreset,
  getPreset,
  listPresets,
  listPresetsByGroup,
  packGraph,
  saveUserPreset,
  unpackGraph,
  type Preset,
} from './presets'
import { STATIC_CATALOG, mergeCatalog } from './staticCatalog'
import {
  claimCc,
  claimNote,
  focusLearnsFromKnobBank,
  focusParamNamesForModule,
  formatBinding,
  loadActionBindings,
  loadKnobBank,
  loadParamLearns,
  loadProfileName,
  mergeFocusParamLearns,
  midiCcParamsFromBank,
  resetMidiMapsToDefaults,
  saveActionBindings,
  saveKnobBank,
  saveParamLearns,
  saveProfileName,
  type KnobBank,
  type MidiActionBindingsDto,
  type MidiAppActionName,
  type MidiParamLearnDto,
} from './midiLearn'
import { MidiSettingsPage, type MidiLearnTarget } from './MidiSettingsPage'
import { BeatEditor } from './BeatEditor'
import './App.css'

/** >0 while a knob is being dragged — poll must not overwrite local params. */
const knobDragLock = { depth: 0 }

/** Modules that shouldn't steal the hardware knob bank when selected. */
const FOCUS_KNOB_SKIP = new Set(['speaker', 'midi_cc'])

type PortDesc = { name: string; kind: string; signal: string }
type ParamDesc = { name: string; min: number; max: number; default: number; unit: string }
type ModuleInfo = {
  type_id: string
  name: string
  hp: number
  inputs: PortDesc[]
  outputs: PortDesc[]
  params: ParamDesc[]
}

type ModuleLights = { values?: Record<string, number> }

type ModuleInstance = {
  id: number
  type_id: string
  x: number
  y: number
  params: Record<string, number>
  info?: ModuleInfo
  lights?: ModuleLights
}

type Cable = {
  id: number
  from: { module: number; port: string }
  to: { module: number; port: string }
}

type GraphSnapshot = {
  modules: ModuleInstance[]
  cables: Cable[]
  next_module_id: number
  next_cable_id: number
}

type EngineSnapshot = {
  sample_rate: number
  channels: number
  running: boolean
  graph: GraphSnapshot
}

type DeviceDto = { name: string; sample_rate: number; channels: number }
type MidiDeviceDto = { name: string; open_ports?: string[] }
type JackRef = { module: number; port: string; kind: 'in' | 'out' }

/** Eurorack HP ≈ 5.08mm; screen scale — larger = more readable faceplate silk. */
const HP_PX_MIN = 14
const HP_PX_MAX = 32
const HP_PX_STEP = 2
const HP_PX_DEFAULT = 24
const CASE_HP = 104
const ROWS = 2
/** 3U panel height factor so faceplates match HP width (no side letterboxing). */
const U_RATIO = 128.5 / 5.08
const ZOOM_STORAGE_KEY = 'emenay.rackHpPx'

function rackHeight(hpPx: number) {
  return Math.round(hpPx * U_RATIO)
}

function caseWidth(hpPx: number) {
  return CASE_HP * hpPx
}

function clampZoom(n: number) {
  const stepped = Math.round(n / HP_PX_STEP) * HP_PX_STEP
  return Math.max(HP_PX_MIN, Math.min(HP_PX_MAX, stepped))
}

function loadStoredHpPx(): number {
  try {
    const raw = localStorage.getItem(ZOOM_STORAGE_KEY)
    if (raw == null) return HP_PX_DEFAULT
    const n = Number(raw)
    if (!Number.isFinite(n)) return HP_PX_DEFAULT
    return clampZoom(n)
  } catch {
    return HP_PX_DEFAULT
  }
}

/** Module.y encodes row index (0 .. ROWS-1). */
const CABLE_COLORS = ['#e85d04', '#2a9d8f', '#e9c46a', '#9b5de5', '#00b4d8', '#ef476f']

/** Palette sidebar groups — order is display order. */
const PALETTE_CATEGORIES: { id: string; label: string; types: string[] }[] = [
  {
    id: 'oscillators',
    label: 'Oscillators',
    types: [
      'erica_vco3',
      'erica_bassline',
      'vco',
      'facets',
      'polysynth',
      'bitboy',
      'noise',
      'test_tone',
    ],
  },
  {
    id: 'drums',
    label: 'Drums',
    types: ['beat', 'twin', 'drums', 'midi_pads'],
  },
  {
    id: 'filters',
    label: 'Filters',
    types: ['erica_polivoks_vcf', 'vcf', 'wasp', 'rc_lpf'],
  },
  {
    id: 'dynamics',
    label: 'Envelopes & VCAs',
    types: [
      'ar',
      'adsr',
      'envelope',
      'dual_vca',
      'erica_mixer',
      'fm_boost',
      'erica_output',
      'midi_cv',
      'midi_cc',
    ],
  },
  {
    id: 'sampling',
    label: 'Sampling',
    types: ['sampler'],
  },
  {
    id: 'modulation',
    label: 'Modulation',
    types: ['erica_modulator', 'lfo', 'swell', 'twin', 'fm_offset', 'fm_drift'],
  },
  {
    id: 'sequencing',
    label: 'Clock & Sequencers',
    types: [
      'fm_clock',
      'clk_mult',
      'divider',
      'sequencer',
      'sequencer16',
      'sequencer32',
      'sequencer64',
      'seq_switch',
    ],
  },
  {
    id: 'utility',
    label: 'Utility',
    types: ['mult', 'cv_switch', 'stereo'],
  },
  {
    id: 'random',
    label: 'Random',
    types: ['erica_swamp', 'lots', 'fm_rng', 'sample_hold'],
  },
  {
    id: 'fx',
    label: 'Resonators & FX',
    types: ['chimes', 'twist', 'erica_bbd', 'delay', 'reverb'],
  },
]

const DEFAULT_OPEN_CATEGORIES = new Set(['oscillators', 'sequencing', 'random'])

function cablePath(x1: number, y1: number, x2: number, y2: number, seed: number) {
  const dx = x2 - x1
  const dist = Math.hypot(dx, y2 - y1)
  const hang = Math.min(96, 28 + dist * 0.22) + (seed % 3) * 8
  // Slight lateral bias so parallel cables don't sit on top of each other.
  const bias = ((seed % 5) - 2) * 6
  const c1x = x1 + dx * 0.2 + bias
  const c1y = y1 + hang
  const c2x = x2 - dx * 0.2 + bias
  const c2y = y2 + hang
  return `M ${x1} ${y1} C ${c1x} ${c1y}, ${c2x} ${c2y}, ${x2} ${y2}`
}

function isTauri() {
  return typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window
}

const NOTE_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'] as const

/** 1V/oct pitch CV — 0V = C0 (common modular convention). */
function formatPitchCv(volts: number) {
  const semis = Math.round(volts * 12)
  const n = ((semis % 12) + 12) % 12
  const oct = Math.floor(semis / 12)
  return `${NOTE_NAMES[n]}${oct}`
}

function isPitchStepParam(p: ParamDesc) {
  return p.unit === 'V' && /^s\d+$/.test(p.name)
}

function isIntParam(p: ParamDesc) {
  return p.unit === 'int' || p.unit === 'bool'
}

function snapParamValue(p: ParamDesc, value: number) {
  const clamped = Math.min(p.max, Math.max(p.min, value))
  if (p.unit === 'bool') return clamped >= 0.5 ? 1 : 0
  if (p.unit === 'int') return Math.round(clamped)
  return clamped
}

/** Map a MIDI CC normalized value (0…1) into a param’s real range. */
function mapMidiNormToParam(p: ParamDesc, norm01: number) {
  const t = Math.min(1, Math.max(0, norm01))
  if (p.unit === 'bool') return t >= 0.5 ? 1 : 0
  const raw = p.min + t * (p.max - p.min)
  return p.unit === 'int' ? Math.round(raw) : raw
}

function formatParam(p: ParamDesc, value: number) {
  if (p.unit === 'Hz') return `${Math.round(value)}`
  if (p.unit === 's') return value < 1 ? value.toFixed(2) : value.toFixed(1)
  if (p.unit === 'int') return `${Math.round(value)}`
  if (p.unit === 'bool') return value >= 0.5 ? 'on' : 'off'
  if (isPitchStepParam(p)) return formatPitchCv(value)
  if (p.unit === 'V') return value.toFixed(2)
  if (p.max <= 1) return value.toFixed(2)
  return value.toFixed(1)
}

function knobAngle(p: ParamDesc, value: number) {
  const t = (value - p.min) / (p.max - p.min || 1)
  return -135 + t * 270
}

function clampHp(x: number, hp: number, hpPx: number) {
  const maxX = Math.max(0, (CASE_HP - hp) * hpPx)
  return Math.max(0, Math.min(maxX, Math.round(x / hpPx) * hpPx))
}

type RackOccupant = { id: number; x: number; y: number; hp: number }

function overlapsHp(
  aX: number,
  aHp: number,
  bX: number,
  bHp: number,
  hpPx: number,
) {
  return aX < bX + bHp * hpPx && bX < aX + aHp * hpPx
}

function collidesAt(
  x: number,
  hp: number,
  row: number,
  occupants: RackOccupant[],
  hpPx: number,
  excludeId?: number,
) {
  return occupants.some(
    (o) =>
      o.id !== excludeId &&
      Math.round(o.y) === row &&
      overlapsHp(x, hp, o.x, o.hp, hpPx),
  )
}

/** Nearest free HP-aligned slot on `row`, or null if the row is full. */
function findFreeX(
  desiredX: number,
  hp: number,
  row: number,
  occupants: RackOccupant[],
  hpPx: number,
  excludeId?: number,
): number | null {
  const want = clampHp(desiredX, hp, hpPx)
  if (!collidesAt(want, hp, row, occupants, hpPx, excludeId)) return want
  const maxSlot = CASE_HP - hp
  for (let d = 1; d <= CASE_HP; d++) {
    for (const dir of [1, -1] as const) {
      const slot = Math.round(want / hpPx) + dir * d
      if (slot < 0 || slot > maxSlot) continue
      const x = slot * hpPx
      if (!collidesAt(x, hp, row, occupants, hpPx, excludeId)) return x
    }
  }
  return null
}

function PanelLed({ hit, value }: { hit: PanelHit; value: number }) {
  const v = Math.max(0, Math.min(1, value))
  const color = hit.color ?? '#e8c547'
  const size = hit.size ?? 'sm'
  const stageHole = hit.label === 'stage'
  return (
    <div
      className={`panel-led-wrap abs size-${size}${stageHole ? ' stage-hole' : ''}`}
      style={{ left: `${hit.x}%`, top: `${hit.y}%` }}
      title={hit.id}
    >
      <span
        className={`panel-led ${v > 0.15 ? 'on' : 'off'}`}
        style={
          {
            ['--led-color' as string]: color,
            ['--led-bright' as string]: String(Math.max(v, stageHole ? 0.22 : 0)),
          } as React.CSSProperties
        }
      />
    </div>
  )
}

function PanelDigit({ hit, value }: { hit: PanelHit; value: number }) {
  const digits = hit.digits ?? 1
  const n = Math.round(value)
  const text = String(Math.max(0, n)).padStart(digits, '0').slice(-digits)
  const color = hit.color ?? '#e8c547'
  const fillLcd = hit.w != null && hit.h != null
  return (
    <div
      className={`panel-digit-wrap abs size-${hit.size ?? 'sm'}${fillLcd ? ' lcd-fill' : ''}`}
      style={{
        left: `${hit.x}%`,
        top: `${hit.y}%`,
        ...(fillLcd ? { width: `${hit.w}%`, height: `${hit.h}%` } : {}),
      }}
      title={hit.label ?? hit.id}
    >
      <span className="panel-digit" style={{ color }}>
        {text}
      </span>
    </div>
  )
}

function StepToggle({
  param,
  value,
  onChange,
  hit,
  faceplate,
}: {
  param: ParamDesc
  value: number
  onChange: (v: number) => void
  hit?: PanelHit
  faceplate?: boolean
}) {
  /** Mixer mute rockers: lit = channel open (param 0), not muted. */
  const muteStyle = param.unit === 'bool' && /^mute/.test(param.name)
  const muted = value >= 0.5
  const on = muteStyle ? !muted : muted
  const label = hit?.label ?? param.name
  const abs = Boolean(hit && faceplate)
  // Round pushbuttons by default; mute rockers (and explicit hits) stay rectangular.
  const shape = hit?.shape ?? (muteStyle ? 'rect' : 'circle')
  return (
    <div
      className={`step-toggle-wrap ${abs ? 'abs' : ''} ${faceplate ? 'on-plate' : ''} size-${hit?.size ?? 'sm'} shape-${shape}`}
      style={abs ? { left: `${hit!.x}%`, top: `${hit!.y}%` } : undefined}
    >
      {!abs && <span className="knob-label">{label}</span>}
      <button
        type="button"
        className={`step-toggle shape-${shape} ${on ? 'on' : 'off'}`}
        title={`${label}: ${on ? 'on' : 'off'}`}
        aria-pressed={on}
        onPointerDown={(e) => e.stopPropagation()}
        onClick={(e) => {
          e.stopPropagation()
          if (muteStyle) {
            onChange(muted ? 0 : 1)
          } else {
            onChange(on ? 0 : 1)
          }
        }}
      />
    </div>
  )
}

function Knob({
  param,
  value,
  onChange,
  onLearn,
  hit,
  faceplate,
  silkLabel,
}: {
  param: ParamDesc
  value: number
  onChange: (v: number) => void
  /** Right-click → MIDI Learn for this param. */
  onLearn?: () => void
  hit?: PanelHit
  faceplate?: boolean
  /** Printed name when the faceplate art itself has no silk. */
  silkLabel?: string
}) {
  const drag = useRef<{ y: number; v: number } | null>(null)
  const [dragging, setDragging] = useState(false)
  const size = hit?.size ?? 'md'
  const label = silkLabel ?? (!faceplate ? param.name : undefined)
  const cap = hit?.color
  const pitchStep = isPitchStepParam(param)
  const display = formatParam(param, value)
  // Pitch steps: live note under the knob (old layout rhythm). Else value while dragging / off-plate.
  const pitchSilk = pitchStep ? display : undefined
  const effectiveSilk = pitchSilk ?? silkLabel
  const showValue = !faceplate ? true : dragging && !pitchStep
  const unitSuffix = pitchStep
    ? ` ${value.toFixed(2)}V`
    : param.unit && param.unit !== 'int' && param.unit !== 'bool'
      ? ` ${param.unit}`
      : ''
  const titleLabel = label ?? (pitchStep ? `step ${param.name.slice(1)}` : param.name)

  return (
    <div
      className={`knob-wrap ${hit ? 'abs' : ''} ${faceplate ? 'on-plate' : ''} ${effectiveSilk ? 'has-silk' : ''} ${pitchStep ? 'pitch-step' : ''} size-${size}`}
      style={hit ? { left: `${hit.x}%`, top: `${hit.y}%` } : undefined}
    >
      {effectiveSilk && (
        <span className={`knob-label ${effectiveSilk ? 'silk' : ''} ${pitchStep ? 'pitch' : ''}`}>
          {effectiveSilk}
        </span>
      )}
      <button
        type="button"
        className={`knob size-${size} ${cap ? 'tinted' : ''}${cap === '#e8c547' ? ' clock-pw' : ''}`}
        style={
          {
            ['--angle' as string]: `${knobAngle(param, value)}deg`,
            ...(cap ? { ['--knob-cap' as string]: cap } : {}),
          } as React.CSSProperties
        }
        title={`${titleLabel}: ${display}${unitSuffix}${onLearn ? ' · right-click MIDI Learn' : ''}`}
        onPointerDown={(e) => {
          e.preventDefault()
          e.stopPropagation()
          ;(e.target as HTMLElement).setPointerCapture(e.pointerId)
          drag.current = { y: e.clientY, v: value }
          knobDragLock.depth += 1
          setDragging(true)
        }}
        onPointerMove={(e) => {
          if (!drag.current) return
          const dy = drag.current.y - e.clientY
          const range = param.max - param.min
          // Integer / bool knobs need less travel per step.
          const sens = isIntParam(param) ? 48 : 80
          const raw = drag.current.v + (dy / sens) * range
          onChange(snapParamValue(param, raw))
        }}
        onPointerUp={() => {
          if (drag.current) knobDragLock.depth = Math.max(0, knobDragLock.depth - 1)
          drag.current = null
          setDragging(false)
        }}
        onPointerCancel={() => {
          if (drag.current) knobDragLock.depth = Math.max(0, knobDragLock.depth - 1)
          drag.current = null
          setDragging(false)
        }}
        onContextMenu={(e) => {
          if (!onLearn) return
          e.preventDefault()
          e.stopPropagation()
          onLearn()
        }}
      />
      {showValue && <span className="knob-value">{display}</span>}
    </div>
  )
}

function Jack({
  moduleId,
  port,
  kind,
  armed,
  patched,
  onClick,
  onContextMenu,
  ghost,
  hit,
  faceplate,
  showJackCap,
  silkLabel,
}: {
  moduleId: number
  port: PortDesc
  kind: 'in' | 'out'
  armed: boolean
  patched?: boolean
  onClick: () => void
  onContextMenu?: (e: React.MouseEvent) => void
  ghost?: boolean
  hit?: PanelHit
  faceplate?: boolean
  showJackCap?: boolean
  silkLabel?: string
}) {
  // Ring class = signal × direction (cv-in, gate-out, audio-in, …).
  const sig =
    port.signal === 'cv' || port.signal === 'gate' || port.signal === 'audio'
      ? port.signal
      : kind === 'out'
        ? 'audio'
        : 'cv'
  const ring = `${sig}-${kind}` // e.g. cv-in, gate-out, audio-in
  const size = hit?.size ?? 'md'
  const invisible =
    Boolean(ghost) || (Boolean(faceplate) && !showJackCap)
  const label = silkLabel ?? (!invisible ? port.name.replace(/_/g, ' ') : undefined)
  return (
    <div
      className={`jack-wrap ${invisible ? 'ghost' : ''} ${hit ? 'abs' : ''} ${faceplate ? 'on-plate' : ''} ${showJackCap ? 'jack-cap' : ''} ${silkLabel ? 'has-silk' : ''} size-${size}`}
      style={hit ? { left: `${hit.x}%`, top: `${hit.y}%` } : undefined}
    >
      {label && <span className={`jack-label ${silkLabel ? 'silk' : ''}`}>{label}</span>}
      <button
        type="button"
        className={`jack ${kind} ${ring} ${armed ? 'armed' : ''} ${patched ? 'patched' : ''} size-${size}`}
        title={
          patched
            ? `${label ?? port.name} — right-click to unpatch`
            : `${label ?? port.name} (${port.signal})`
        }
        data-jack={`${moduleId}:${kind}:${port.name}`}
        onClick={(e) => {
          e.stopPropagation()
          onClick()
        }}
        onContextMenu={onContextMenu}
        onPointerDown={(e) => e.stopPropagation()}
      />
    </div>
  )
}

export default function App() {
  const [catalog, setCatalog] = useState<ModuleInfo[]>([])
  const [snap, setSnap] = useState<EngineSnapshot | null>(null)
  const [devices, setDevices] = useState<DeviceDto[]>([])
  const [device, setDevice] = useState('')
  const [midiDevices, setMidiDevices] = useState<MidiDeviceDto[]>([])
  const [midiDevice, setMidiDevice] = useState('')
  const [midiOpenPorts, setMidiOpenPorts] = useState<string[]>([])
  const midiDeviceRef = useRef(midiDevice)
  midiDeviceRef.current = midiDevice
  const [midiSettingsOpen, setMidiSettingsOpen] = useState(false)
  const midiSettingsOpenRef = useRef(false)
  midiSettingsOpenRef.current = midiSettingsOpen
  const [profileName, setProfileName] = useState(() => loadProfileName())
  const [actionBindings, setActionBindings] = useState<MidiActionBindingsDto>(() =>
    loadActionBindings(),
  )
  const [knobBank, setKnobBank] = useState<KnobBank>(() => loadKnobBank())
  const [paramLearns, setParamLearns] = useState<MidiParamLearnDto[]>(() => loadParamLearns())
  const [learnTarget, setLearnTarget] = useState<MidiLearnTarget | null>(null)
  const learnTargetRef = useRef<MidiLearnTarget | null>(null)
  learnTargetRef.current = learnTarget
  const [lastMidiHint, setLastMidiHint] = useState<string | null>(null)
  const [lastMidiEvent, setLastMidiEvent] = useState<{
    isCc: boolean
    number: number
  } | null>(null)
  const snapRunningRef = useRef(false)
  snapRunningRef.current = Boolean(snap?.running)
  const catalogRef = useRef(catalog)
  catalogRef.current = catalog
  const [status, setStatus] = useState('idle')
  const [pendingJack, setPendingJack] = useState<JackRef | null>(null)
  const [hoverCable, setHoverCable] = useState<number | null>(null)
  const [cableTick, setCableTick] = useState(0)
  const [drag, setDrag] = useState<{
    id: number
    ox: number
    row: number
    fromX: number
    fromY: number
  } | null>(null)
  const [selectedId, setSelectedId] = useState<number | null>(null)
  const [openCategories, setOpenCategories] = useState<Record<string, boolean>>(() => {
    const init: Record<string, boolean> = {}
    for (const cat of PALETTE_CATEGORIES) {
      init[cat.id] = DEFAULT_OPEN_CATEGORIES.has(cat.id)
    }
    init.other = false
    return init
  })
  /** Pointer-based palette → rack drag (HTML5 DnD is unreliable in Tauri WebView). */
  const [paletteDrag, setPaletteDrag] = useState<{
    typeId: string
    hp: number
    name: string
    clientX: number
    clientY: number
  } | null>(null)
  const [dropHint, setDropHint] = useState<{
    row: number
    x: number
    hp: number
    blocked?: boolean
  } | null>(null)
  const [demo, setDemo] = useState(false)
  const [hpPx, setHpPx] = useState(loadStoredHpPx)
  const [rackBusy, setRackBusy] = useState(false)
  const [presets, setPresets] = useState<Preset[]>(() => listPresets())
  const [presetId, setPresetId] = useState('')
  const caseRef = useRef<HTMLDivElement>(null)
  const studioRef = useRef<HTMLElement>(null)
  const bayRefs = useRef<(HTMLDivElement | null)[]>([])
  const paletteDragRef = useRef<typeof paletteDrag>(null)
  paletteDragRef.current = paletteDrag
  const dropHintRef = useRef(dropHint)
  dropHintRef.current = dropHint
  const hpPxRef = useRef(hpPx)
  hpPxRef.current = hpPx
  const snapRef = useRef(snap)
  snapRef.current = snap
  const caseW = caseWidth(hpPx)
  const rackH = rackHeight(hpPx)

  const refresh = useCallback(async () => {
    if (!isTauri()) {
      setDemo(true)
      setCatalog(mergeCatalog(STATIC_CATALOG))
      setSnap({
        sample_rate: 48000,
        channels: 2,
        running: false,
        graph: {
          modules: [
            {
              id: 1,
              type_id: 'test_tone',
              x: 0,
              y: 0,
              params: { freq: 440, amp: 1 },
            },
            {
              id: 2,
              type_id: 'speaker',
              x: 0,
              y: 0,
              params: { channels: 2 },
            },
          ],
          cables: [],
          next_module_id: 3,
          next_cable_id: 1,
        },
      })
      setStatus('browser demo')
      return
    }
    const [cat, s, devs] = await Promise.all([
      invoke<ModuleInfo[]>('catalog'),
      invoke<EngineSnapshot>('snapshot'),
      invoke<DeviceDto[]>('list_devices'),
    ])
    // Prefer live engine catalog; keep static fallbacks so new faceplates still
    // get knobs/jacks if the UI is ahead of a rebuilt desktop binary.
    setCatalog(mergeCatalog(cat))
    setSnap(s)
    setDevices(devs)
    if (!device && devs[0]) setDevice(devs[0].name)
    setStatus(s.running ? `LIVE · ${s.sample_rate | 0}Hz · ${s.channels}ch` : 'stopped')
  }, [device])

  const refreshMidiDevices = useCallback(async (opts?: { force?: boolean }) => {
    if (!isTauri()) return
    try {
      const midiDevs = await invoke<MidiDeviceDto[]>('list_midi_devices')
      setMidiDevices(midiDevs)
      // Prefer current selection if still present; else first listed port
      // (engine already hides Mackie/HUI and sorts notes ports first).
      const prev = midiDeviceRef.current
      const chosen =
        (prev && midiDevs.some((d) => d.name === prev) ? prev : midiDevs[0]?.name) ?? ''
      if (chosen !== prev) setMidiDevice(chosen)
      if (midiDevs.length > 0) {
        try {
          // Soft ensure ignores preferred-name mismatches (avoids reconnect
          // storms). Force only for manual Reconnect / first pick.
          const info = opts?.force
            ? await invoke<MidiDeviceDto>('start_midi', {
                device: chosen || null,
                force: true,
              })
            : await invoke<MidiDeviceDto>('ensure_midi', {
                device: null,
              })
          // Keep user's preferred selection when it's still listed.
          if (chosen && midiDevs.some((d) => d.name === chosen)) {
            setMidiDevice(chosen)
          } else {
            setMidiDevice(info.name)
          }
          setMidiOpenPorts(info.open_ports ?? [info.name])
        } catch (e) {
          console.warn('MIDI auto-connect:', e)
          setMidiOpenPorts([])
        }
      } else {
        setMidiOpenPorts([])
      }
    } catch {
      setMidiDevices([])
    }
  }, [])

  const pushMidiMapsToEngine = useCallback(async (actions: MidiActionBindingsDto, learns: MidiParamLearnDto[]) => {
    if (!isTauri()) return
    try {
      await invoke('set_midi_action_bindings', { bindings: actions })
      await invoke('set_midi_param_learns', { learns })
    } catch (e) {
      console.warn('MIDI maps:', e)
    }
  }, [])

  const focusLearnsRef = useRef<MidiParamLearnDto[] | null>(null)
  /** Skip redundant IPC when merged maps haven't changed (lights poll used to spam this). */
  const lastMapsPushKey = useRef('')
  const mapsPushGen = useRef(0)

  const pushEffectiveMidiMaps = useCallback(
    async (actions: MidiActionBindingsDto, persistent: MidiParamLearnDto[]) => {
      const merged = mergeFocusParamLearns(persistent, focusLearnsRef.current)
      const key = JSON.stringify({ actions, learns: merged })
      if (key === lastMapsPushKey.current) return
      lastMapsPushKey.current = key
      const gen = ++mapsPushGen.current
      await pushMidiMapsToEngine(actions, merged)
      // A newer push started while we awaited — don't let ours look "current".
      if (gen !== mapsPushGen.current) {
        lastMapsPushKey.current = ''
      }
    },
    [pushMidiMapsToEngine],
  )

  /** Keep existing MIDI CC modules' cc_num_* in sync with the knob bank. */
  const syncMidiCcModulesFromBank = useCallback(
    async (bank: KnobBank) => {
      const current = snapRef.current
      if (!current) return
      const targets = current.graph.modules.filter((m) => m.type_id === 'midi_cc')
      if (!targets.length) return
      const updates: Array<{ id: number; name: string; value: number }> = []
      for (const m of targets) {
        for (let i = 0; i < 8; i++) {
          const name = `cc_num_${i + 1}`
          const value = bank[i]!
          if (m.params[name] === value) continue
          updates.push({ id: m.id, name, value })
        }
      }
      if (!updates.length) return
      if (isTauri()) {
        for (const u of updates) {
          try {
            await invoke('set_param', {
              args: { module_id: u.id, name: u.name, value: u.value },
            })
          } catch {
            /* ignore */
          }
        }
      }
      setSnap((prev) => {
        if (!prev) return prev
        return {
          ...prev,
          graph: {
            ...prev.graph,
            modules: prev.graph.modules.map((m) => {
              if (m.type_id !== 'midi_cc') return m
              const params = { ...m.params }
              for (let i = 0; i < 8; i++) params[`cc_num_${i + 1}`] = bank[i]!
              return { ...m, params }
            }),
          },
        }
      })
    },
    [],
  )

  useEffect(() => {
    refresh().catch((e) => setStatus(String(e)))
    refreshMidiDevices().catch(() => {})
    pushEffectiveMidiMaps(loadActionBindings(), loadParamLearns()).catch(() => {})
  }, [refresh, refreshMidiDevices, pushEffectiveMidiMaps])

  // MIDI watchdog — reopen only when ports actually vanish (sleep/unplug).
  // Skip while Learn is armed so we don't tear down mid-capture.
  useEffect(() => {
    if (!isTauri()) return
    let alive = true
    const tick = () => {
      if (!alive || learnTargetRef.current) return
      refreshMidiDevices().catch(() => {})
    }
    const id = window.setInterval(tick, 4000)
    const onVis = () => {
      if (document.visibilityState === 'visible') tick()
    }
    const onFocus = () => tick()
    document.addEventListener('visibilitychange', onVis)
    window.addEventListener('focus', onFocus)
    return () => {
      alive = false
      window.clearInterval(id)
      document.removeEventListener('visibilitychange', onVis)
      window.removeEventListener('focus', onFocus)
    }
  }, [refreshMidiDevices])

  const armLearn = useCallback(
    async (target: MidiLearnTarget) => {
      if (!isTauri()) {
        setStatus('MIDI Learn needs desktop build')
        return
      }
      setLearnTarget(target)
      const ccOnly = target.kind === 'knob' || target.kind === 'param'
      try {
        await invoke('arm_midi_learn', {
          armed: true,
          cc_only: ccOnly,
          ccOnly,
        })
        const label =
          target.kind === 'action'
            ? `Learn ${target.action}… move a control`
            : target.kind === 'knob'
              ? `Learn knob ${target.index + 1}… turn a knob (CC)`
              : `Learn ${target.param}… turn a knob (CC)`
        setStatus(label)
      } catch (e) {
        setLearnTarget(null)
        setStatus(`learn failed · ${String(e)}`)
      }
    },
    [],
  )

  const commitMidiMaps = useCallback(
    (maps: { actions: MidiActionBindingsDto; bank: KnobBank; learns: MidiParamLearnDto[] }) => {
      const bankChanged =
        maps.bank.some((cc, i) => cc !== knobBank[i]) || maps.bank.length !== knobBank.length
      setActionBindings(maps.actions)
      setKnobBank(maps.bank)
      setParamLearns(maps.learns)
      saveActionBindings(maps.actions)
      saveKnobBank(maps.bank)
      saveParamLearns(maps.learns)
      pushEffectiveMidiMaps(maps.actions, maps.learns).catch(() => {})
      if (bankChanged) syncMidiCcModulesFromBank(maps.bank).catch(() => {})
    },
    [knobBank, pushEffectiveMidiMaps, syncMidiCcModulesFromBank],
  )

  const applyLearnEvent = useCallback(
    (isCc: boolean, number: number) => {
      const target = learnTargetRef.current
      if (!target) return
      const maps = {
        actions: actionBindings,
        bank: knobBank,
        learns: paramLearns,
      }
      if (target.kind === 'action') {
        const next = isCc
          ? claimCc(maps, number, { kind: 'action', action: target.action })
          : claimNote(maps, number, target.action)
        commitMidiMaps(next)
        setStatus(
          `learned ${target.action} ← ${formatBinding(next.actions[target.action])}`,
        )
      } else if (target.kind === 'knob') {
        if (!isCc) {
          setStatus('knob bank learn needs a CC')
          setLearnTarget(null)
          return
        }
        const next = claimCc(maps, number, { kind: 'knob', index: target.index })
        commitMidiMaps(next)
        setStatus(`learned knob ${target.index + 1} ← CC${number}`)
      } else if (isCc) {
        const next = claimCc(maps, number, {
          kind: 'param',
          moduleId: target.moduleId,
          param: target.param,
        })
        commitMidiMaps(next)
        setStatus(`learned ${target.param} ← CC${number}`)
      } else {
        setStatus('param learn needs a CC (not a note)')
      }
      setLearnTarget(null)
    },
    [actionBindings, knobBank, paramLearns, commitMidiMaps],
  )

  const updateActionBindings = useCallback(
    (next: MidiActionBindingsDto) => {
      // Detect a single-key edit from Settings and steal that CC/note.
      const keys = Object.keys(next) as (keyof MidiActionBindingsDto)[]
      let changed: keyof MidiActionBindingsDto | null = null
      for (const k of keys) {
        const a = actionBindings[k]
        const b = next[k]
        if (a.kind !== b.kind || a.n !== b.n) {
          changed = k
          break
        }
      }
      if (changed) {
        const b = next[changed]
        const maps = { actions: actionBindings, bank: knobBank, learns: paramLearns }
        if (b.kind === 'cc') {
          commitMidiMaps(claimCc(maps, b.n, { kind: 'action', action: changed }))
          return
        }
        if (b.kind === 'note') {
          commitMidiMaps(claimNote(maps, b.n, changed))
          return
        }
      }
      setActionBindings(next)
      saveActionBindings(next)
      pushEffectiveMidiMaps(next, paramLearns).catch(() => {})
    },
    [actionBindings, knobBank, paramLearns, commitMidiMaps, pushEffectiveMidiMaps],
  )

  const updateKnobBank = useCallback(
    (next: KnobBank) => {
      let changed = -1
      for (let i = 0; i < 8; i++) {
        if (next[i] !== knobBank[i]) {
          changed = i
          break
        }
      }
      if (changed >= 0) {
        commitMidiMaps(
          claimCc(
            { actions: actionBindings, bank: knobBank, learns: paramLearns },
            next[changed],
            { kind: 'knob', index: changed },
          ),
        )
        return
      }
      setKnobBank(next)
      saveKnobBank(next)
    },
    [actionBindings, knobBank, paramLearns, commitMidiMaps],
  )

  // Poll lights only while running — a full snapshot every 50ms was cloning
  // the whole patch under the audio mutex and glitched dense cable graphs.
  useEffect(() => {
    if (!snap?.running) return
    let alive = true
    const id = window.setInterval(() => {
      invoke<Array<{ id: number; lights: ModuleLights }>>('poll_lights')
        .then((rows) => {
          if (!alive) return
          setSnap((prev) => {
            if (!prev) return prev
            const lightsById = new Map(rows.map((r) => [r.id, r.lights]))
            return {
              ...prev,
              graph: {
                ...prev.graph,
                modules: prev.graph.modules.map((m) => ({
                  ...m,
                  lights: lightsById.get(m.id) ?? m.lights,
                })),
              },
            }
          })
        })
        .catch(() => {})
    }, 66)
    return () => {
      alive = false
      window.clearInterval(id)
    }
  }, [snap?.running])

  // Re-measure jack anchors after layout (cables use DOM positions).
  useLayoutEffect(() => {
    setCableTick((t) => t + 1)
  }, [snap?.graph.modules, snap?.graph.cables])

  const infoByType = useMemo(() => {
    const m = new Map<string, ModuleInfo>()
    for (const c of catalog) m.set(c.type_id, c)
    return m
  }, [catalog])

  // Stable identity only — do NOT depend on whole `snap` (lights poll rewrites
  // it every ~66ms and was re-pushing MIDI maps continuously, killing CC→param).
  const selectedTypeId =
    selectedId == null
      ? null
      : (snap?.graph.modules.find((m) => m.id === selectedId)?.type_id ?? null)

  /** Knob bank → selected module’s default params (not persisted). */
  const focusLearns = useMemo((): MidiParamLearnDto[] | null => {
    if (selectedId == null || selectedTypeId == null) return null
    if (FOCUS_KNOB_SKIP.has(selectedTypeId)) return null
    const info = infoByType.get(selectedTypeId)
    if (!info?.params.length) return null
    const layout = resolvePanelLayout(selectedTypeId)
    const panelParams: string[] = []
    const seen = new Set<string>()
    for (const h of layout?.hits ?? []) {
      if (h.kind !== 'param' || seen.has(h.id)) continue
      seen.add(h.id)
      panelParams.push(h.id)
    }
    const names = focusParamNamesForModule(
      info.params.map((p) => p.name),
      panelParams,
    )
    if (!names.length) return null
    return focusLearnsFromKnobBank(selectedId, names, knobBank)
  }, [selectedId, selectedTypeId, infoByType, knobBank])

  focusLearnsRef.current = focusLearns

  useEffect(() => {
    pushEffectiveMidiMaps(actionBindings, paramLearns).catch(() => {})
  }, [focusLearns, actionBindings, paramLearns, pushEffectiveMidiMaps])

  useEffect(() => {
    if (selectedId == null) {
      if (paramLearns.length > 0) {
        setStatus('MIDI knobs → saved maps')
      }
      return
    }
    if (!focusLearns?.length || !snap) return
    const mod = snap.graph.modules.find((m) => m.id === selectedId)
    if (!mod) return
    const info = infoByType.get(mod.type_id) ?? mod.info
    setStatus(`MIDI knobs → ${info?.name ?? mod.type_id}`)
    // Announce when focus / deselect restores persistent maps.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedId, focusLearns?.[0]?.module_id, knobBank])

  const paletteSections = useMemo(() => {
    const byId = new Map(catalog.map((c) => [c.type_id, c]))
    const used = new Set<string>()
    const sections: { id: string; label: string; modules: ModuleInfo[] }[] = []
    for (const cat of PALETTE_CATEGORIES) {
      const modules: ModuleInfo[] = []
      for (const t of cat.types) {
        const m = byId.get(t)
        if (!m || m.type_id === 'speaker') continue
        modules.push(m)
        used.add(m.type_id)
      }
      if (modules.length > 0) {
        sections.push({ id: cat.id, label: cat.label, modules })
      }
    }
    const other = catalog.filter(
      (c) => c.type_id !== 'speaker' && !used.has(c.type_id),
    )
    if (other.length > 0) {
      sections.push({ id: 'other', label: 'Other', modules: other })
    }
    return sections
  }, [catalog])

  function moduleInfo(mod: ModuleInstance) {
    return mod.info ?? infoByType.get(mod.type_id)
  }

  function moduleHp(mod: ModuleInstance) {
    const panel = resolvePanel(mod.type_id)
    // Allow 2HP modules (e.g. Mult); never invent a wider slot than the plate.
    return Math.max(1, panel?.hp ?? moduleInfo(mod)?.hp ?? 4)
  }

  const speaker = useMemo(
    () => snap?.graph.modules.find((m) => m.type_id === 'speaker') ?? null,
    [snap],
  )

  const rackModules = useMemo(
    () => snap?.graph.modules.filter((m) => m.type_id !== 'speaker') ?? [],
    [snap],
  )

  const occupants = useMemo<RackOccupant[]>(
    () => rackModules.map((m) => ({ id: m.id, x: m.x, y: m.y, hp: moduleHp(m) })),
    [rackModules, catalog],
  )
  const occupantsRef = useRef(occupants)
  occupantsRef.current = occupants

  const setRackZoom = useCallback((next: number) => {
    const hp = clampZoom(next)
    const prev = hpPxRef.current
    if (hp === prev) return
    hpPxRef.current = hp
    setHpPx(hp)
    setDropHint(null)
    try {
      localStorage.setItem(ZOOM_STORAGE_KEY, String(hp))
    } catch {
      /* ignore quota / private mode */
    }
    const current = snapRef.current
    if (current) {
      const modules = current.graph.modules.map((m) => {
        if (m.type_id === 'speaker') return m
        const slot = Math.round(m.x / prev)
        return { ...m, x: slot * hp }
      })
      setSnap({ ...current, graph: { ...current.graph, modules } })
      if (isTauri()) {
        for (const m of modules) {
          if (m.type_id === 'speaker') continue
          invoke('move_module', {
            args: { module_id: m.id, x: m.x, y: m.y },
          }).catch(console.error)
        }
      }
    }
    setCableTick((t) => t + 1)
  }, [])

  const fitRackZoom = useCallback(() => {
    const studio = studioRef.current
    const app = studio?.closest('.app') as HTMLElement | null
    const palette = app?.querySelector('.palette') as HTMLElement | null
    if (!studio || !app) return

    const studioStyles = getComputedStyle(studio)
    const studioPadX =
      (parseFloat(studioStyles.paddingLeft) || 0) +
      (parseFloat(studioStyles.paddingRight) || 0)
    // Case outer width is caseW + 32 (inline) with border-box horizontal padding.
    const caseChrome = 32
    const gutter = 8
    const paletteW = palette?.getBoundingClientRect().width ?? 200
    // Studio column is app minus palette; prefer live layout widths over grid guesses.
    const studioViewport = Math.min(
      studio.clientWidth,
      app.clientWidth - paletteW,
    )
    const avail = studioViewport - studioPadX - caseChrome - gutter
    if (avail <= 0) return
    // Floor to step so Fit never rounds up and forces a horizontal scrollbar.
    const stepped = Math.floor(avail / CASE_HP / HP_PX_STEP) * HP_PX_STEP
    setRackZoom(stepped)
  }, [setRackZoom])

  const removeModule = useCallback(
    async (moduleId: number) => {
      if (!isTauri()) {
        setSnap((prev) => {
          if (!prev) return prev
          return {
            ...prev,
            graph: {
              ...prev.graph,
              modules: prev.graph.modules.filter((m) => m.id !== moduleId),
              cables: prev.graph.cables.filter(
                (c) => c.from.module !== moduleId && c.to.module !== moduleId,
              ),
            },
          }
        })
        setSelectedId((id) => (id === moduleId ? null : id))
        return
      }
      await invoke('remove_module', { args: { module_id: moduleId } })
      setSelectedId((id) => (id === moduleId ? null : id))
      await refresh()
    },
    [refresh],
  )

  const clearRack = useCallback(async () => {
    const current = snapRef.current
    if (!current) return
    const ids = current.graph.modules
      .filter((m) => m.type_id !== 'speaker')
      .map((m) => m.id)
    setPendingJack(null)
    setSelectedId(null)
    setPresetId('')
    if (ids.length === 0) {
      setStatus('rack empty')
      return
    }
    if (!isTauri()) {
      setSnap((prev) => {
        if (!prev) return prev
        return {
          ...prev,
          graph: {
            ...prev.graph,
            modules: prev.graph.modules.filter((m) => m.type_id === 'speaker'),
            cables: [],
          },
        }
      })
      setStatus('rack cleared')
      return
    }
    setStatus('clearing…')
    for (const id of ids) {
      await invoke('remove_module', { args: { module_id: id } })
    }
    await refresh()
    setStatus('rack cleared')
  }, [refresh])

  const reloadPresets = useCallback(() => {
    setPresets(listPresets())
  }, [])

  const applyPreset = useCallback(
    async (preset: Preset) => {
      const current = snapRef.current
      if (!current) return
      setRackBusy(true)
      setPendingJack(null)
      setSelectedId(null)
      setStatus(`loading “${preset.name}”…`)
      const wasRunning = current.running
      const deviceName = device
      try {
        const graph = unpackGraph(preset.graph, hpPxRef.current)
        const bankParams = midiCcParamsFromBank(knobBank)
        const next: EngineSnapshot = {
          ...current,
          running: false,
          graph: {
            modules: graph.modules.map((m) => ({
              ...m,
              params:
                m.type_id === 'midi_cc'
                  ? { ...m.params, ...bankParams }
                  : { ...m.params },
            })),
            cables: graph.cables,
            next_module_id: graph.next_module_id,
            next_cable_id: graph.next_cable_id,
          },
        }
        if (!isTauri()) {
          setSnap(next)
          setPresetId(preset.id)
          setStatus(`preset · ${preset.name}`)
          return
        }
        // Master rest around the swap: stop the stream so MI hosts / delay
        // lines aren't torn down under a live audio callback.
        if (wasRunning) {
          await invoke('stop_audio')
        } else {
          await invoke('master_rest')
        }
        await invoke('apply_graph', { snap: next })
        if (wasRunning) {
          const info = await invoke<DeviceDto>('start_audio', {
            device: deviceName || null,
          })
          let midiLabel = ''
          try {
            const midi = await invoke<MidiDeviceDto>('ensure_midi', {
              device: midiDevice || null,
            })
            setMidiDevice(midi.name)
            setMidiOpenPorts(midi.open_ports ?? [midi.name])
            midiLabel = ` · MIDI ${midi.name}`
          } catch (e) {
            midiLabel = ` · MIDI off (${String(e)})`
          }
          setStatus(
            `preset · ${preset.name} · LIVE · ${info.sample_rate | 0}Hz${midiLabel}`,
          )
        } else {
          try {
            const midi = await invoke<MidiDeviceDto>('ensure_midi', {
              device: midiDevice || null,
            })
            setMidiDevice(midi.name)
            setMidiOpenPorts(midi.open_ports ?? [midi.name])
            setStatus(`preset · ${preset.name} · MIDI ${midi.name}`)
          } catch (e) {
            setStatus(`preset · ${preset.name} · MIDI off (${String(e)})`)
          }
        }
        await refresh()
        setPresetId(preset.id)
      } catch (e) {
        setStatus(`preset failed · ${String(e)}`)
        try {
          await refresh()
        } catch {
          /* ignore */
        }
      } finally {
        setRackBusy(false)
      }
    },
    [device, knobBank, midiDevice, refresh],
  )

  const cyclePreset = useCallback(
    (dir: -1 | 1) => {
      if (!presets.length || rackBusy || !snap) return
      const idx = presets.findIndex((p) => p.id === presetId)
      const nextIdx =
        idx < 0
          ? dir > 0
            ? 0
            : presets.length - 1
          : (idx + dir + presets.length) % presets.length
      const next = presets[nextIdx]
      if (next) applyPreset(next).catch(console.error)
    },
    [applyPreset, presetId, presets, rackBusy, snap],
  )

  const masterRest = useCallback(async () => {
    if (!isTauri()) {
      setStatus('rest')
      return
    }
    setRackBusy(true)
    setStatus('rest…')
    try {
      const wasRunning = snapRef.current?.running
      if (wasRunning) {
        await invoke('stop_audio')
        await invoke('master_rest')
        const info = await invoke<DeviceDto>('start_audio', {
          device: device || null,
        })
        setStatus(`rested · LIVE · ${info.sample_rate | 0}Hz`)
      } else {
        await invoke('master_rest')
        setStatus('rested')
      }
      await refresh()
    } catch (e) {
      setStatus(`rest failed · ${String(e)}`)
    } finally {
      setRackBusy(false)
    }
  }, [device, refresh])

  const saveCurrentPreset = useCallback((opts?: { silent?: boolean }) => {
    const current = snapRef.current
    if (!current) return
    const selected = presetId ? getPreset(presetId) : undefined
    const canOverwrite = selected && !selected.builtin
    const defaultName = canOverwrite ? selected.name : 'My patch'
    let trimmed: string
    if (opts?.silent && canOverwrite) {
      trimmed = selected.name
    } else {
      const name = window.prompt(
        canOverwrite
          ? 'Save preset as (same name overwrites):'
          : 'Name this preset:',
        defaultName,
      )
      if (name == null) return
      trimmed = name.trim()
    }
    if (!trimmed) {
      setStatus('preset name required')
      return
    }
    const packed = packGraph(current.graph, hpPxRef.current)
    const replaceId =
      canOverwrite && trimmed.toLowerCase() === selected.name.toLowerCase()
        ? selected.id
        : undefined
    const saved = saveUserPreset(trimmed, packed, replaceId)
    reloadPresets()
    setPresetId(saved.id)
    setStatus(`saved · ${saved.name}`)
  }, [presetId, reloadPresets])

  // MIDI app-action + learn capture poll (desktop).
  useEffect(() => {
    if (!isTauri()) return
    let alive = true
    const id = window.setInterval(() => {
      // Sequential: one drain/apply/echo path per tick (parallel invokes raced).
      void (async () => {
        try {
          const actions = await invoke<string[]>('poll_midi_actions')
          if (!alive) return
          for (const a of actions as MidiAppActionName[]) {
            switch (a) {
              case 'Start':
                // Ignore while already live — repeated Start (FA/CC) was
                // re-entering start()/refresh and fighting knob updates.
                if (!snapRunningRef.current) start().catch(console.error)
                break
              case 'Stop':
                if (snapRunningRef.current) stop().catch(console.error)
                break
              case 'Rest':
              case 'Panic':
                masterRest().catch(console.error)
                break
              case 'PresetPrev':
                cyclePreset(-1)
                break
              case 'PresetNext':
                cyclePreset(1)
                break
              case 'PresetSave':
                saveCurrentPreset({ silent: true })
                break
              default:
                break
            }
          }
          const st = await invoke<{
            armed: boolean
            last_midi: string | null
            last_event?: {
              is_cc?: boolean
              isCc?: boolean
              number: number
              value: number
            } | null
            lastEvent?: {
              is_cc?: boolean
              isCc?: boolean
              number: number
              value: number
            } | null
            event: {
              is_cc?: boolean
              isCc?: boolean
              number: number
              value: number
            } | null
            params?: Array<{
              module_id?: number
              moduleId?: number
              param: string
              value: number
            }>
          }>('poll_midi_learn_status')
          if (!alive) return
          const hint =
            st.last_midi ??
            (st as { lastMidi?: string | null }).lastMidi ??
            null
          if (hint) setLastMidiHint(hint)
          const lastEv = st.last_event ?? st.lastEvent ?? null
          if (lastEv) {
            setLastMidiEvent({
              isCc: Boolean(lastEv.is_cc ?? lastEv.isCc),
              number: lastEv.number,
            })
          }
          const midiParams = st.params ?? []
          if (midiParams.length > 0 && knobDragLock.depth === 0) {
            const cat = catalogRef.current
            setSnap((prev) => {
              if (!prev) return prev
              let changed = false
              const modules = prev.graph.modules.map((m) => {
                let nextParams: Record<string, number> | null = null
                for (const p of midiParams) {
                  const id = p.module_id ?? p.moduleId
                  if (id !== m.id) continue
                  const info =
                    m.info ?? cat.find((c) => c.type_id === m.type_id)
                  const desc = info?.params.find((d) => d.name === p.param)
                  const value = desc ? mapMidiNormToParam(desc, p.value) : p.value
                  if (m.params[p.param] === value) continue
                  if (!nextParams) nextParams = { ...m.params }
                  nextParams[p.param] = value
                  changed = true
                }
                return nextParams ? { ...m, params: nextParams } : m
              })
              if (!changed) return prev
              return { ...prev, graph: { ...prev.graph, modules } }
            })
          }
          const ev = st.event
          if (!ev || !learnTargetRef.current) return
          const isCc = Boolean(ev.is_cc ?? ev.isCc)
          applyLearnEvent(isCc, ev.number)
        } catch {
          /* ignore poll errors */
        }
      })()
    }, 50)
    return () => {
      alive = false
      window.clearInterval(id)
    }
    // start/stop are stable enough for this poll; intentionally omit heavy deps.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [applyLearnEvent, cyclePreset, masterRest, saveCurrentPreset])

  const deleteSelectedPreset = useCallback(() => {
    const selected = presetId ? getPreset(presetId) : undefined
    if (!selected || selected.builtin) return
    if (!window.confirm(`Delete preset “${selected.name}”?`)) return
    deleteUserPreset(selected.id)
    reloadPresets()
    setPresetId('')
    setStatus(`deleted · ${selected.name}`)
  }, [presetId, reloadPresets])

  const randomFillRack = useCallback(async () => {
    const pool = catalog.filter((c) => c.type_id !== 'speaker')
    if (pool.length === 0) {
      setStatus('no modules in catalog')
      return
    }
    setRackBusy(true)
    setStatus('filling rack…')
    try {
      await clearRack()
      setPresetId('')

      const scale = hpPxRef.current
      const occupants: RackOccupant[] = []
      const placements: { typeId: string; x: number; y: number }[] = []

      for (let row = 0; row < ROWS; row++) {
        let cursor = 0
        let guard = 0
        while (cursor < CASE_HP && guard++ < CASE_HP) {
          const remaining = CASE_HP - cursor
          const candidates = pool
            .map((t) => ({
              typeId: t.type_id,
              hp: Math.max(1, resolvePanel(t.type_id)?.hp ?? t.hp ?? 4),
            }))
            .filter((t) => t.hp <= remaining)
          if (candidates.length === 0) break
          const pick = candidates[Math.floor(Math.random() * candidates.length)]!
          const x = cursor * scale
          const free = findFreeX(x, pick.hp, row, occupants, scale)
          if (free == null) break
          placements.push({ typeId: pick.typeId, x: free, y: row })
          occupants.push({
            id: -(occupants.length + 1),
            x: free,
            y: row,
            hp: pick.hp,
          })
          cursor = Math.round(free / scale) + pick.hp
        }
      }

      if (placements.length === 0) {
        setStatus('could not place modules')
        return
      }

      if (!isTauri()) {
        setSnap((prev) => {
          if (!prev) return prev
          let nextId = prev.graph.next_module_id
          const modules = [
            ...prev.graph.modules.filter((m) => m.type_id === 'speaker'),
            ...placements.map((p) => {
              const id = nextId++
              return {
                id,
                type_id: p.typeId,
                x: p.x,
                y: p.y,
                params: {},
              }
            }),
          ]
          return {
            ...prev,
            graph: {
              ...prev.graph,
              modules,
              cables: [],
              next_module_id: nextId,
            },
          }
        })
        setStatus(`random rack · ${placements.length} modules`)
        return
      }

      for (const p of placements) {
        await invoke('add_module', {
          args: { type_id: p.typeId, x: p.x, y: p.y },
        })
      }
      await refresh()
      setStatus(`random rack · ${placements.length} modules`)
    } finally {
      setRackBusy(false)
    }
  }, [catalog, clearRack, refresh])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setPendingJack(null)
        setSelectedId(null)
        return
      }
      const inField =
        e.target instanceof HTMLInputElement ||
        e.target instanceof HTMLTextAreaElement ||
        e.target instanceof HTMLSelectElement ||
        (e.target instanceof HTMLElement && e.target.isContentEditable)
      // Controllers in HID/DAW mode often send Space for Play — that scrolls
      // the page instead of hitting our MIDI Start binding.
      if (
        !inField &&
        (e.code === 'Space' || e.code === 'PageDown' || e.code === 'PageUp')
      ) {
        e.preventDefault()
      }
      if (
        (e.key === 'Backspace' || e.key === 'Delete') &&
        selectedId != null &&
        !inField
      ) {
        e.preventDefault()
        removeModule(selectedId).catch(console.error)
      }
    }
    const onResize = () => setCableTick((t) => t + 1)
    window.addEventListener('keydown', onKey)
    window.addEventListener('resize', onResize)
    return () => {
      window.removeEventListener('keydown', onKey)
      window.removeEventListener('resize', onResize)
    }
  }, [selectedId, removeModule])

  async function connectMidi(name?: string) {
    if (!isTauri()) return
    const want = name ?? midiDevice
    try {
      // Manual picker always force-reopens so a stuck host can't linger.
      const info = await invoke<MidiDeviceDto>('start_midi', {
        device: want || null,
        force: true,
      })
      setMidiDevice(info.name)
      setMidiOpenPorts(info.open_ports ?? [info.name])
      setStatus((s) =>
        s.startsWith('LIVE') ? `${s} · MIDI ${info.name}` : `MIDI · ${info.name}`,
      )
    } catch (e) {
      // No interface plugged in is fine — MidiCv just sits quiet.
      console.warn('MIDI:', e)
    }
  }

  async function start() {
    if (!isTauri()) return
    if (snapRunningRef.current) return
    const info = await invoke<DeviceDto>('start_audio', { device: device || null })
    let midiLabel = ''
    try {
      const midi = await invoke<MidiDeviceDto>('ensure_midi', {
        device: midiDevice || null,
      })
      setMidiDevice(midi.name)
      setMidiOpenPorts(midi.open_ports ?? [midi.name])
      midiLabel = ` · MIDI ${midi.name}`
    } catch (e) {
      midiLabel = ` · MIDI off (${String(e)})`
    }
    setStatus(
      `LIVE · ${info.name} · ${info.sample_rate | 0}Hz · ${info.channels}ch${midiLabel}`,
    )
    await refresh()
  }

  async function stop() {
    if (!isTauri()) return
    setStatus('stopping…')
    await invoke('stop_audio')
    setStatus('stopped')
    await refresh()
  }

  async function placeModule(typeId: string, row: number, x: number) {
    const info = infoByType.get(typeId)
    const panel = resolvePanel(typeId)
    const hp = Math.max(1, panel?.hp ?? info?.hp ?? 6)
    const sy = Math.max(0, Math.min(ROWS - 1, row))
    const sx = findFreeX(x, hp, sy, occupantsRef.current, hpPxRef.current)
    if (sx == null) {
      setStatus(`no free space on row ${sy + 1} for ${hp}HP`)
      return
    }

    const seedParams =
      typeId === 'midi_cc' ? midiCcParamsFromBank(knobBank) : {}

    if (!isTauri()) {
      setSnap((prev) => {
        if (!prev) return prev
        const id = prev.graph.next_module_id
        return {
          ...prev,
          graph: {
            ...prev.graph,
            next_module_id: id + 1,
            modules: [
              ...prev.graph.modules,
              { id, type_id: typeId, x: sx, y: sy, params: seedParams },
            ],
          },
        }
      })
      return
    }
    const id = await invoke<number>('add_module', {
      args: { type_id: typeId, x: sx, y: sy },
    })
    for (const [name, value] of Object.entries(seedParams)) {
      await invoke('set_param', { args: { module_id: id, name, value } })
    }
    await refresh()
  }

  function updatePaletteDropHint(clientX: number, clientY: number, hp: number) {
    const { row, x } = dropCoords(clientX, clientY)
    const bay = bayRefs.current[row]
    if (!bay) {
      setDropHint(null)
      return
    }
    const scale = hpPxRef.current
    const desired = x - (hp * scale) / 2
    const free = findFreeX(desired, hp, row, occupantsRef.current, scale)
    if (free == null) {
      setDropHint({ row, x: clampHp(desired, hp, scale), hp, blocked: true })
      return
    }
    setDropHint({ row, x: free, hp, blocked: false })
  }

  function finishPaletteDrop(clientX: number, clientY: number) {
    const pd = paletteDragRef.current
    const hint = dropHintRef.current
    paletteDragRef.current = null
    setPaletteDrag(null)
    setDropHint(null)
    if (!pd) return
    const caseEl = caseRef.current?.getBoundingClientRect()
    if (!caseEl) return
    // Accept anywhere over the case (rails, badge, I/O strip, either bay).
    const overCase =
      clientX >= caseEl.left - 8 &&
      clientX <= caseEl.right + 8 &&
      clientY >= caseEl.top - 8 &&
      clientY <= caseEl.bottom + 8
    if (!overCase) return
    if (hint?.blocked) {
      setStatus(`no free space for ${pd.hp}HP`)
      return
    }
    const { row, x } = dropCoords(clientX, clientY)
    const localX =
      hint && !hint.blocked ? hint.x : x - (pd.hp * hpPxRef.current) / 2
    const placeRow = hint && !hint.blocked ? hint.row : row
    placeModule(pd.typeId, placeRow, localX).catch(console.error)
  }

  function beginPaletteDrag(
    e: React.PointerEvent,
    typeId: string,
    hp: number,
    name: string,
  ) {
    if (e.button !== 0) return
    e.preventDefault()
    const drag = { typeId, hp, name, clientX: e.clientX, clientY: e.clientY }
    paletteDragRef.current = drag
    setPaletteDrag(drag)
    updatePaletteDropHint(e.clientX, e.clientY, hp)

    // Attach immediately — waiting for a useEffect misses fast pointerups.
    const onMove = (ev: PointerEvent) => {
      const pd = paletteDragRef.current
      if (!pd) return
      const next = { ...pd, clientX: ev.clientX, clientY: ev.clientY }
      paletteDragRef.current = next
      setPaletteDrag(next)
      updatePaletteDropHint(ev.clientX, ev.clientY, pd.hp)
    }
    const onUp = (ev: PointerEvent) => {
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup', onUp)
      window.removeEventListener('pointercancel', onUp)
      finishPaletteDrop(ev.clientX, ev.clientY)
    }
    window.addEventListener('pointermove', onMove)
    window.addEventListener('pointerup', onUp)
    window.addEventListener('pointercancel', onUp)
  }

  async function removeCable(cableId: number) {
    setHoverCable(null)
    if (!isTauri()) {
      setSnap((prev) => {
        if (!prev) return prev
        return {
          ...prev,
          graph: {
            ...prev.graph,
            cables: prev.graph.cables.filter((c) => c.id !== cableId),
          },
        }
      })
      return
    }
    await invoke('disconnect', { args: { cable_id: cableId } })
    await refresh()
  }

  function cableOnJack(modId: number, port: string, kind: 'in' | 'out') {
    return (
      snap?.graph.cables.find((c) =>
        kind === 'out'
          ? c.from.module === modId && c.from.port === port
          : c.to.module === modId && c.to.port === port,
      ) ?? null
    )
  }

  async function onJack(mod: ModuleInstance, port: string, kind: 'in' | 'out') {
    const jack: JackRef = { module: mod.id, port, kind }
    // Second click on the same armed jack cancels.
    if (
      pendingJack &&
      pendingJack.module === jack.module &&
      pendingJack.port === jack.port &&
      pendingJack.kind === jack.kind
    ) {
      setPendingJack(null)
      return
    }
    if (!pendingJack) {
      setPendingJack(jack)
      return
    }
    if (pendingJack.kind === kind) {
      setPendingJack(jack)
      return
    }
    const from = pendingJack.kind === 'out' ? pendingJack : jack
    const to = pendingJack.kind === 'in' ? pendingJack : jack
    setPendingJack(null)
    if (!isTauri()) {
      setSnap((prev) => {
        if (!prev) return prev
        const id = prev.graph.next_cable_id
        return {
          ...prev,
          graph: {
            ...prev.graph,
            next_cable_id: id + 1,
            cables: [
              ...prev.graph.cables.filter(
                (c) => !(c.to.module === to.module && c.to.port === to.port),
              ),
              {
                id,
                from: { module: from.module, port: from.port },
                to: { module: to.module, port: to.port },
              },
            ],
          },
        }
      })
      return
    }
    await invoke('connect', {
      args: {
        from_module: from.module,
        from_port: from.port,
        to_module: to.module,
        to_port: to.port,
      },
    })
    await refresh()
  }

  async function onJackContextMenu(
    e: React.MouseEvent,
    mod: ModuleInstance,
    port: string,
    kind: 'in' | 'out',
  ) {
    e.preventDefault()
    e.stopPropagation()
    const existing = cableOnJack(mod.id, port, kind)
    if (!existing) return
    await removeCable(existing.id)
  }

  async function setParam(moduleId: number, name: string, value: number) {
    setSnap((prev) => {
      if (!prev) return prev
      return {
        ...prev,
        graph: {
          ...prev.graph,
          modules: prev.graph.modules.map((m) =>
            m.id === moduleId ? { ...m, params: { ...m.params, [name]: value } } : m,
          ),
        },
      }
    })
    if (!isTauri()) return
    await invoke('set_param', { args: { module_id: moduleId, name, value } })
  }

  function jackPos(mod: ModuleInstance, port: string, kind: 'in' | 'out') {
    const root = caseRef.current
    const el = root?.querySelector(
      `[data-jack="${mod.id}:${kind}:${port}"]`,
    ) as HTMLElement | null
    if (root && el) {
      const br = root.getBoundingClientRect()
      const jr = el.getBoundingClientRect()
      return {
        x: jr.left - br.left + jr.width / 2,
        y: jr.top - br.top + jr.height / 2,
      }
    }
    const row = Math.round(mod.y)
    const scale = hpPxRef.current
    const width = moduleHp(mod) * scale
    return {
      x: mod.x + width / 2,
      y: 72 + row * (rackHeight(scale) + 36) + rackHeight(scale) - 36,
    }
  }

  function dropCoords(clientX: number, clientY: number) {
    for (let row = 0; row < ROWS; row++) {
      const bay = bayRefs.current[row]
      if (!bay) continue
      const r = bay.getBoundingClientRect()
      if (clientY >= r.top && clientY <= r.bottom) {
        return { row, x: clientX - r.left }
      }
    }
    // nearest row by Y
    let best = 0
    let bestDist = Infinity
    for (let row = 0; row < ROWS; row++) {
      const bay = bayRefs.current[row]
      if (!bay) continue
      const r = bay.getBoundingClientRect()
      const mid = (r.top + r.bottom) / 2
      const d = Math.abs(clientY - mid)
      if (d < bestDist) {
        bestDist = d
        best = row
      }
    }
    const bay = bayRefs.current[best]
    const r = bay?.getBoundingClientRect()
    return { row: best, x: r ? clientX - r.left : 0 }
  }

  const running = snap?.running ?? false
  const speakerInfo = speaker ? moduleInfo(speaker) : infoByType.get('speaker')
  const speakerChannels = Math.max(
    1,
    speakerInfo?.inputs.length ?? snap?.channels ?? 2,
  )

  return (
    <div
      className="app"
      style={{
        ['--hp' as string]: `${hpPx}px`,
        ['--rack-h' as string]: `${rackH}px`,
        ['--case-w' as string]: `${caseW}px`,
      }}
    >
      <header className="topbar">
        <div className="topbar-row topbar-primary">
          <div className="brand">
            <span className="logo">emenay</span>
            <span className="tag">eurorack · circuit-faithful</span>
          </div>

          <div className="topbar-group topbar-transport" role="group" aria-label="Transport">
            <button
              type="button"
              className="primary"
              onClick={() => start().catch(console.error)}
              disabled={demo || running}
            >
              Start
            </button>
            <button
              type="button"
              className="danger"
              onClick={() => stop().catch(console.error)}
              disabled={demo || !running}
            >
              Stop
            </button>
            <button
              type="button"
              title="Silence and reset all module DSP"
              disabled={demo || rackBusy}
              onClick={() => masterRest().catch(console.error)}
            >
              Rest
            </button>
          </div>

          <div className="topbar-meters">
            <span
              className={`status ${running ? 'live' : ''}`}
              title={status}
            >
              {status}
            </span>
            <span
              className={`midi-live${lastMidiHint ? ' has-msg' : ''}`}
              title="Last MIDI message"
              role="status"
              aria-live="polite"
            >
              <span className="midi-live-label">MIDI</span>
              <code className="midi-live-value">{lastMidiHint ?? '—'}</code>
            </span>
          </div>
        </div>

        <div className="topbar-row topbar-secondary">
          <div className="topbar-group topbar-io" role="group" aria-label="Audio and MIDI">
            <label className="topbar-field">
              <span className="topbar-field-label">Out</span>
              <select
                value={device}
                onChange={(e) => setDevice(e.target.value)}
                disabled={demo}
                title={device || 'Audio output'}
              >
                {devices.length === 0 && <option value="">default</option>}
                {devices.map((d) => (
                  <option key={d.name} value={d.name}>
                    {d.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="topbar-field">
              <span className="topbar-field-label">MIDI</span>
              <select
                value={midiDevice}
                title={midiDevice || 'MIDI input'}
                disabled={demo}
                onChange={(e) => {
                  const name = e.target.value
                  setMidiDevice(name)
                  if (name) connectMidi(name).catch(console.error)
                }}
              >
                {midiDevices.length === 0 && <option value="">none</option>}
                {midiDevices.map((d) => (
                  <option key={d.name} value={d.name}>
                    {d.name}
                  </option>
                ))}
              </select>
            </label>
            <button
              type="button"
              title="MIDI settings — map your controller"
              disabled={demo}
              className={learnTarget || midiSettingsOpen ? 'primary' : undefined}
              onClick={() => setMidiSettingsOpen(true)}
            >
              {learnTarget ? 'Learn…' : 'Map'}
            </button>
          </div>

          <div className="topbar-group rack-presets" role="group" aria-label="Presets">
            <button
              type="button"
              className="rack-presets-nav"
              title="Previous preset"
              aria-label="Previous preset"
              disabled={rackBusy || !snap || presets.length === 0}
              onClick={() => cyclePreset(-1)}
            >
              ‹
            </button>
            <select
              value={presetId}
              disabled={rackBusy || !snap}
              title="Load a preset"
              aria-label="Preset"
              onChange={(e) => {
                const id = e.target.value
                if (!id) {
                  setPresetId('')
                  return
                }
                const p = getPreset(id)
                if (p) applyPreset(p).catch(console.error)
                else setPresetId('')
              }}
            >
              <option value="">Presets…</option>
              {listPresetsByGroup().map(({ group, presets: groupPresets }) => (
                <optgroup
                  key={group.id}
                  label={
                    group.hint ? `${group.label} — ${group.hint}` : group.label
                  }
                >
                  {groupPresets.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
                </optgroup>
              ))}
            </select>
            <button
              type="button"
              className="rack-presets-nav"
              title="Next preset"
              aria-label="Next preset"
              disabled={rackBusy || !snap || presets.length === 0}
              onClick={() => cyclePreset(1)}
            >
              ›
            </button>
            <button
              type="button"
              title="Save the current rack as a named preset"
              disabled={rackBusy || !snap}
              onClick={() => saveCurrentPreset()}
            >
              Save
            </button>
            <button
              type="button"
              className="danger"
              title="Delete the selected saved preset"
              disabled={
                rackBusy || !presetId || Boolean(getPreset(presetId)?.builtin)
              }
              onClick={deleteSelectedPreset}
            >
              Del
            </button>
          </div>

          <div className="topbar-group rack-actions" role="group" aria-label="Rack actions">
            <button
              type="button"
              title="Clear rack and fill both rows with random modules"
              disabled={rackBusy}
              onClick={() => randomFillRack().catch(console.error)}
            >
              Random
            </button>
            <button
              type="button"
              className="danger"
              title="Remove all modules from the rack"
              disabled={rackBusy || rackModules.length === 0}
              onClick={() => {
                setRackBusy(true)
                clearRack()
                  .catch(console.error)
                  .finally(() => setRackBusy(false))
              }}
            >
              Clear
            </button>
          </div>

          <div className="topbar-group rack-zoom" role="group" aria-label="Rack zoom">
            <button
              type="button"
              aria-label="Zoom out"
              disabled={hpPx <= HP_PX_MIN}
              onClick={() => setRackZoom(hpPx - HP_PX_STEP)}
            >
              −
            </button>
            <button
              type="button"
              className="rack-zoom-value"
              title={`Reset to ${HP_PX_DEFAULT}px/HP`}
              onClick={() => setRackZoom(HP_PX_DEFAULT)}
            >
              {Math.round((hpPx / HP_PX_DEFAULT) * 100)}%
            </button>
            <button
              type="button"
              aria-label="Zoom in"
              disabled={hpPx >= HP_PX_MAX}
              onClick={() => setRackZoom(hpPx + HP_PX_STEP)}
            >
              +
            </button>
            <button type="button" title="Fit case to view" onClick={fitRackZoom}>
              Fit
            </button>
          </div>
        </div>
      </header>

      {midiSettingsOpen && (
        <MidiSettingsPage
          profileName={profileName}
          onProfileName={(name) => {
            setProfileName(name)
            saveProfileName(name)
          }}
          midiDevices={midiDevices}
          midiDevice={midiDevice}
          openPorts={midiOpenPorts}
          onMidiDevice={(name) => {
            setMidiDevice(name)
            if (name) connectMidi(name).catch(console.error)
          }}
          onReconnectMidi={() => {
            refreshMidiDevices({ force: true }).catch(console.error)
          }}
          actionBindings={actionBindings}
          onActionBindings={updateActionBindings}
          knobBank={knobBank}
          onKnobBank={updateKnobBank}
          paramLearns={paramLearns}
          onClearParamLearn={(l) => {
            setParamLearns((prev) => {
              const next = prev.filter(
                (x) =>
                  !(
                    x.module_id === l.module_id &&
                    x.param === l.param &&
                    x.cc === l.cc
                  ),
              )
              saveParamLearns(next)
              pushEffectiveMidiMaps(actionBindings, next).catch(() => {})
              return next
            })
          }}
          onClearAllParamLearns={() => {
            setParamLearns([])
            saveParamLearns([])
            pushEffectiveMidiMaps(actionBindings, []).catch(() => {})
          }}
          learnTarget={learnTarget}
          lastMidiHint={lastMidiHint}
          lastMidiEvent={lastMidiEvent}
          onArmLearn={armLearn}
          onUseLastMidi={() => {
            if (!lastMidiEvent || !learnTargetRef.current) return
            applyLearnEvent(lastMidiEvent.isCc, lastMidiEvent.number)
            if (isTauri()) {
              invoke('arm_midi_learn', {
                armed: false,
                cc_only: false,
                ccOnly: false,
              }).catch(() => {})
            }
          }}
          onCancelLearn={() => {
            setLearnTarget(null)
            if (isTauri()) {
              invoke('arm_midi_learn', {
                armed: false,
                cc_only: false,
                ccOnly: false,
              }).catch(() => {})
            }
          }}
          onResetDefaults={() => {
            const { actions, bank, learns, profile } = resetMidiMapsToDefaults()
            setActionBindings(actions)
            setKnobBank(bank)
            setParamLearns(learns)
            setProfileName(profile)
            pushEffectiveMidiMaps(actions, learns).catch(() => {})
            setStatus('MIDI map reset to defaults')
          }}
          onClose={() => {
            setMidiSettingsOpen(false)
            setLearnTarget(null)
            if (isTauri()) invoke('arm_midi_learn', { armed: false }).catch(() => {})
          }}
          demo={demo}
        />
      )}

      <aside className="palette">
        <h2>Modules</h2>
        <p className="drag-tip">Drag onto a row</p>
        {paletteSections.map((section) => {
          const open = openCategories[section.id] ?? false
          return (
            <div
              key={section.id}
              className={`palette-section ${open ? 'open' : 'closed'}`}
            >
        <button
          type="button"
                className="palette-section-head"
                aria-expanded={open}
                onClick={() =>
                  setOpenCategories((prev) => ({
                    ...prev,
                    [section.id]: !open,
                  }))
                }
              >
                <span className="palette-section-chevron" aria-hidden>
                  {open ? '▾' : '▸'}
                </span>
                <span className="palette-section-label">{section.label}</span>
                <span className="palette-section-count">{section.modules.length}</span>
              </button>
              {open && (
                <div className="palette-section-body">
                  {section.modules.map((c) => {
                    const panel = resolvePanel(c.type_id)
                    const hp = panel?.hp ?? c.hp
                    return (
                      <div
                        key={c.type_id}
                        className={`palette-card ${paletteDrag?.typeId === c.type_id ? 'dragging' : ''}`}
                        onPointerDown={(e) => beginPaletteDrag(e, c.type_id, hp, c.name)}
                      >
                        <div
                          className="palette-thumb"
                          style={
                            panel
                              ? {
                                  backgroundImage: `url(${panel.src})`,
                                  backgroundSize: 'cover',
                                  backgroundPosition: 'center top',
                                }
                              : undefined
                          }
                        />
                        <div className="palette-meta">
                          <strong>{c.name}</strong>
                          <span>{hp}HP</span>
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          )
        })}
        <p className="hint">
          Drag a module into a row (no overlapping). × / right-click / Delete removes a module.
          Click two jacks to patch; click a cable or right-click a jack to unpatch. Patch into case{' '}
          <em>OUTPUT</em> to hear sound.
        </p>
      </aside>

      {paletteDrag && (
        <div
          className="palette-drag-ghost"
          style={{
            left: paletteDrag.clientX + 12,
            top: paletteDrag.clientY + 12,
            width: paletteDrag.hp * hpPx,
          }}
        >
          {paletteDrag.name}
        </div>
      )}

      <main className="studio" ref={studioRef}>
        <div className="case" ref={caseRef} style={{ width: caseW + 32 }}>
          {/* Built-in case I/O (speaker) */}
          <div className="case-io">
            <div className="case-io-label">
              <span>OUTPUT</span>
              <span className="case-io-sub">built-in · to computer speakers</span>
            </div>
            <div className="case-io-jacks">
              {speaker &&
                (speakerInfo?.inputs ?? []).map((p) => (
                  <Jack
                    key={p.name}
                    moduleId={speaker.id}
                    port={p}
                    kind="in"
                    armed={pendingJack?.module === speaker.id && pendingJack.port === p.name}
                    patched={Boolean(cableOnJack(speaker.id, p.name, 'in'))}
                    onClick={() => onJack(speaker, p.name, 'in')}
                    onContextMenu={(e) => onJackContextMenu(e, speaker, p.name, 'in')}
                  />
                ))}
              {!speaker &&
                Array.from({ length: Math.min(speakerChannels, 8) }, (_, i) => (
                  <div key={i} className="jack-wrap">
                    <span className="jack-label">ch{i + 1}</span>
                    <span className="jack in disabled" />
                  </div>
                ))}
            </div>
            <div className={`case-io-led ${running ? 'on' : ''}`} title={running ? 'live' : 'stopped'} />
          </div>

          {/* Cables overlay the whole case so OUTPUT jacks share the same coord space. */}
          <svg className="cables case-cables" aria-hidden={false}>
            {snap?.graph.cables.map((c, i) => {
              void cableTick
              const fromM = snap.graph.modules.find((m) => m.id === c.from.module)
              const toM = snap.graph.modules.find((m) => m.id === c.to.module)
              if (!fromM || !toM) return null
              const start = jackPos(fromM, c.from.port, 'out')
              const end = jackPos(toM, c.to.port, 'in')
              const color = CABLE_COLORS[i % CABLE_COLORS.length]
              const d = cablePath(start.x, start.y, end.x, end.y, c.id)
              const hot = hoverCable === c.id
              return (
                <g
                  key={c.id}
                  className={`cable-group ${hot ? 'hot' : ''}`}
                  onPointerEnter={() => setHoverCable(c.id)}
                  onPointerLeave={() => setHoverCable((id) => (id === c.id ? null : id))}
                  onClick={(e) => {
                    // Left-click alone: do nothing (jacks sit under the cable SVG).
                    // Alt/⌥-click or middle-click mid-span removes the patch.
                    if (!(e.altKey || e.button === 1)) return
                    e.stopPropagation()
                    removeCable(c.id).catch(console.error)
                  }}
                  onContextMenu={(e) => {
                    e.preventDefault()
                    e.stopPropagation()
                    removeCable(c.id).catch(console.error)
                  }}
                >
                  <title>Right-click or ⌥-click cable to unpatch</title>
                  <path d={d} className="cable-hit" />
                  <path d={d} className="cable-shadow" />
                  <path d={d} className="cable-body" stroke={color} />
                  <path d={d} className="cable-sheen" />
                  <circle className="cable-plug" cx={start.x} cy={start.y} r={5.5} fill={color} />
                  <circle className="cable-plug" cx={end.x} cy={end.y} r={5.5} fill={color} />
                  <circle className="cable-plug-core" cx={start.x} cy={start.y} r={2.2} />
                  <circle className="cable-plug-core" cx={end.x} cy={end.y} r={2.2} />
                </g>
              )
            })}
                </svg>

          <div className="case-stack">
            {Array.from({ length: ROWS }, (_, row) => (
              <div key={row} className="case-row">
                <div className="row-tag">ROW {row + 1} · 104HP</div>
                <div className="rail top" />
                <div
                  className={`bay ${paletteDrag ? 'drop-target' : ''}`}
                  ref={(el) => {
                    bayRefs.current[row] = el
                  }}
                  onPointerDown={(e) => {
                    if (e.target === e.currentTarget) setSelectedId(null)
                  }}
                  onPointerMove={(e) => {
                    if (paletteDragRef.current) {
                      updatePaletteDropHint(
                        e.clientX,
                        e.clientY,
                        paletteDragRef.current.hp,
                      )
                    }
                    if (!drag || !snap) return
                    const { row: r, x } = dropCoords(e.clientX, e.clientY)
                    const mod = snap.graph.modules.find((m) => m.id === drag.id)
                    if (!mod) return
                    const hp = moduleHp(mod)
                    const desired = x - drag.ox
                    const free = findFreeX(
                      desired,
                      hp,
                      r,
                      occupantsRef.current,
                      hpPxRef.current,
                      drag.id,
                    )
                    if (free == null) return
                    setSnap({
                      ...snap,
                      graph: {
                        ...snap.graph,
                        modules: snap.graph.modules.map((m) =>
                          m.id === drag.id ? { ...m, x: free, y: r } : m,
                        ),
                      },
                    })
                  }}
                  onPointerUp={() => {
                    if (drag) {
                      const m = snap?.graph.modules.find((x) => x.id === drag.id)
                      if (m) {
                        const hp = moduleHp(m)
                        const free = findFreeX(
                          m.x,
                          hp,
                          Math.round(m.y),
                          occupantsRef.current,
                          hpPxRef.current,
                          m.id,
                        )
                        const x = free ?? drag.fromX
                        const y = free != null ? Math.round(m.y) : drag.fromY
                        if (x !== m.x || y !== m.y) {
                          setSnap((prev) => {
                            if (!prev) return prev
                            return {
                              ...prev,
                              graph: {
                                ...prev.graph,
                                modules: prev.graph.modules.map((mod) =>
                                  mod.id === m.id ? { ...mod, x, y } : mod,
                                ),
                              },
                            }
                          })
                        }
                        if (isTauri()) {
                          invoke('move_module', {
                            args: { module_id: m.id, x, y },
                          }).catch(console.error)
                        }
                      }
                    }
                    setDrag(null)
                  }}
                >
                  {dropHint?.row === row && (
                    <div
                      className={`drop-ghost ${dropHint.blocked ? 'blocked' : ''}`}
                      style={{ left: dropHint.x, width: dropHint.hp * hpPx }}
                    />
                  )}

                  {rackModules
                    .filter((m) => Math.round(m.y) === row)
                    .map((mod) => {
                      const info = moduleInfo(mod)
                      const panel = resolvePanel(mod.type_id)
                      const hp = moduleHp(mod)
                      const width = hp * hpPx
                      const params = (info?.params ?? []).filter((p) => p.name !== 'channels')
                      const inputs = info?.inputs ?? []
                      const outputs = info?.outputs ?? []
                      const hasFaceplate = Boolean(panel)
                      const layout = resolvePanelLayout(mod.type_id)
                      const usePlateLayout = Boolean(hasFaceplate && layout)
                      const showHitLabels = Boolean(panel?.showHitLabels)
                      const showJackCaps = Boolean(
                        panel?.showJackCaps && !panel?.jackArtInSvg,
                      )

                      const hitFor = (
                        id: string,
                        kind: 'param' | 'toggle' | 'in' | 'out' | 'led' | 'digit',
                      ) => layout?.hits.find((h) => h.id === id && h.kind === kind)

                      const lightVal = (id: string) => mod.lights?.values?.[id] ?? 0

                      const selected = selectedId === mod.id

                      return (
                        <div
                          key={mod.id}
                          className={`module ${hasFaceplate ? 'has-faceplate' : ''} ${usePlateLayout ? 'plate-layout' : ''} ${selected ? 'selected' : ''}`}
                          data-hp={hp}
                          style={{ left: mod.x, width }}
                          title={
                            panel
                              ? `${info?.name ?? mod.type_id} — right-click to remove`
                              : 'Right-click or Delete to remove'
                          }
                          onPointerDown={(e) => {
                            if (
                              (e.target as HTMLElement).closest(
                                '.jack, .knob, .step-toggle, .module-remove',
                              )
                            )
                              return
                            // Click selected → unselect (restore persistent MIDI maps).
                            // Click other → select (focus knobs on this module).
                            setSelectedId((id) => (id === mod.id ? null : mod.id))
                            const bay = bayRefs.current[row]
                            if (!bay) return
                            ;(e.currentTarget as HTMLElement).setPointerCapture(e.pointerId)
                            setDrag({
                              id: mod.id,
                              ox: e.clientX - bay.getBoundingClientRect().left - mod.x,
                              row,
                              fromX: mod.x,
                              fromY: Math.round(mod.y),
                            })
                          }}
                          onContextMenu={(e) => {
                            e.preventDefault()
                            e.stopPropagation()
                            setSelectedId(mod.id)
                            removeModule(mod.id).catch(console.error)
                          }}
                        >
                          <button
                            type="button"
                            className="module-remove"
                            title="Remove module"
                            aria-label="Remove module"
                            onPointerDown={(e) => e.stopPropagation()}
                            onClick={(e) => {
                              e.stopPropagation()
                              removeModule(mod.id).catch(console.error)
                            }}
                          >
                            ×
                          </button>
                          {panel && (
                            <img
                              className="module-faceplate"
                              src={panel.src}
                              alt=""
                              draggable={false}
                            />
                          )}
                          {!hasFaceplate && (
                            <div className="screws">
                              <span className="screw" />
                              <span className="screw" />
                            </div>
                          )}
                          {!usePlateLayout && (
                            <div className="module-title">{info?.name ?? mod.type_id}</div>
                          )}

                          {usePlateLayout ? (
                            <div className="module-body plate-hits">
                              {layout?.hits
                                .filter((h) => h.kind === 'led')
                                .map((h) => (
                                  <PanelLed key={`led-${h.id}-${h.x}`} hit={h} value={lightVal(h.id)} />
                                ))}
                              {layout?.hits
                                .filter((h) => h.kind === 'digit')
                                .map((h) => (
                                  <PanelDigit
                                    key={`digit-${h.id}-${h.x}`}
                                    hit={h}
                                    value={lightVal(h.id)}
                                  />
                                ))}
                              {params.map((p) => {
                                const toggleHit = hitFor(p.name, 'toggle')
                                const paramHit = hitFor(p.name, 'param')
                                // Explicit toggle hits → pushbutton. Bool/int drawn as knobs
                                // on the plate stay knobs (snap to discrete values).
                                if (toggleHit) {
                                  return (
                                    <StepToggle
                                      key={p.name}
                                      param={p}
                                      value={mod.params[p.name] ?? p.default}
                                      onChange={(v) => setParam(mod.id, p.name, v)}
                                      hit={toggleHit}
                                      faceplate
                                    />
                                  )
                                }
                                if (!paramHit) return null
                                return (
                                  <Knob
                                    key={p.name}
                                    param={p}
                                    value={mod.params[p.name] ?? p.default}
                                    onChange={(v) => setParam(mod.id, p.name, v)}
                                    onLearn={() =>
                                      armLearn({
                                        kind: 'param',
                                        moduleId: mod.id,
                                        param: p.name,
                                      })
                                    }
                                    hit={paramHit}
                                    faceplate
                                    silkLabel={
                                      showHitLabels
                                        ? paramHit.label ?? p.name.replace(/_/g, ' ').toUpperCase()
                                        : undefined
                                    }
                                  />
                                )
                              })}
                              {inputs.map((p) => {
                                const hit = hitFor(p.name, 'in')
                                if (!hit) return null
                                return (
                                  <Jack
                                    key={`in-${p.name}`}
                                    moduleId={mod.id}
                                    port={p}
                                    kind="in"
                                    hit={hit}
                                    faceplate
                                    showJackCap={showJackCaps}
                                    silkLabel={
                                      showHitLabels
                                        ? hit.label ?? p.name.replace(/_/g, ' ').toUpperCase()
                                        : undefined
                                    }
                                    armed={
                                      pendingJack?.module === mod.id &&
                                      pendingJack.port === p.name
                                    }
                                    patched={Boolean(cableOnJack(mod.id, p.name, 'in'))}
                                    onClick={() => onJack(mod, p.name, 'in')}
                                    onContextMenu={(e) =>
                                      onJackContextMenu(e, mod, p.name, 'in')
                                    }
                                  />
                                )
                              })}
                              {outputs.map((p) => {
                                const hit = hitFor(p.name, 'out')
                                if (!hit) return null
                                return (
                                  <Jack
                                    key={`out-${p.name}`}
                                    moduleId={mod.id}
                                    port={p}
                                    kind="out"
                                    hit={hit}
                                    faceplate
                                    showJackCap={showJackCaps}
                                    silkLabel={
                                      showHitLabels
                                        ? hit.label ?? p.name.replace(/_/g, ' ').toUpperCase()
                                        : undefined
                                    }
                                    armed={
                                      pendingJack?.module === mod.id &&
                                      pendingJack.port === p.name
                                    }
                                    patched={Boolean(cableOnJack(mod.id, p.name, 'out'))}
                                    onClick={() => onJack(mod, p.name, 'out')}
                                    onContextMenu={(e) =>
                                      onJackContextMenu(e, mod, p.name, 'out')
                                    }
                                  />
                                )
                              })}
                            </div>
                          ) : (
                            <div className="module-body">
                              {params.length > 0 && (
                                <div className="knob-bank">
                                  {params.map((p) =>
                                    p.unit === 'bool' ? (
                                      <StepToggle
                                        key={p.name}
                                        param={p}
                                        value={mod.params[p.name] ?? p.default}
                                        onChange={(v) => setParam(mod.id, p.name, v)}
                                      />
                                    ) : (
                                      <Knob
                                        key={p.name}
                                        param={p}
                                        value={mod.params[p.name] ?? p.default}
                                        onChange={(v) => setParam(mod.id, p.name, v)}
                                        onLearn={() =>
                                          armLearn({
                                            kind: 'param',
                                            moduleId: mod.id,
                                            param: p.name,
                                          })
                                        }
                                      />
                                    ),
                                  )}
                                </div>
                              )}

                              <div className="jack-bank">
                                {inputs.length > 0 && (
                                  <>
                                    <div className="section-label">in</div>
                                    <div className="jack-row">
                                      {inputs.map((p) => (
                                        <Jack
                                          key={p.name}
                                          moduleId={mod.id}
                                          port={p}
                                          kind="in"
                                          armed={
                                            pendingJack?.module === mod.id &&
                                            pendingJack.port === p.name
                                          }
                                          patched={Boolean(cableOnJack(mod.id, p.name, 'in'))}
                                          onClick={() => onJack(mod, p.name, 'in')}
                                          onContextMenu={(e) =>
                                            onJackContextMenu(e, mod, p.name, 'in')
                                          }
                                        />
                                      ))}
                                    </div>
                                  </>
                                )}
                                {outputs.length > 0 && (
                                  <>
                                    <div className="section-label">out</div>
                                    <div className="jack-row">
                                      {outputs.map((p) => (
                                        <Jack
                                          key={p.name}
                                          moduleId={mod.id}
                                          port={p}
                                          kind="out"
                                          armed={
                                            pendingJack?.module === mod.id &&
                                            pendingJack.port === p.name
                                          }
                                          patched={Boolean(cableOnJack(mod.id, p.name, 'out'))}
                                          onClick={() => onJack(mod, p.name, 'out')}
                                          onContextMenu={(e) =>
                                            onJackContextMenu(e, mod, p.name, 'out')
                                          }
                                        />
                                      ))}
                                    </div>
                                  </>
                                )}
                              </div>
                            </div>
                          )}

                          {!hasFaceplate && (
                            <div className="screws">
                              <span className="screw" />
                              <span className="screw" />
                            </div>
                          )}
                        </div>
                      )
                    })}
                </div>
                <div className="rail bottom" />
              </div>
            ))}
          </div>
        </div>
        {selectedId != null &&
          (() => {
            const mod = snap?.graph.modules.find((m) => m.id === selectedId)
            if (!mod || mod.type_id !== 'beat') return null
            return (
              <BeatEditor
                moduleId={mod.id}
                params={mod.params}
                onParam={(name, value) => {
                  setParam(mod.id, name, value).catch(console.error)
                }}
              />
            )
          })()}
      </main>
    </div>
  )
}
