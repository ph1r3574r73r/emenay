import {
  ACTION_LABELS,
  DEFAULT_ACTION_BINDINGS,
  DEFAULT_KNOB_BANK,
  formatBinding,
  KNOB_BANK_LABELS,
  UNBOUND,
  type KnobBank,
  type MidiActionBindingsDto,
  type MidiBindingDto,
  type MidiParamLearnDto,
} from './midiLearn'

export type MidiLearnTarget =
  | { kind: 'action'; action: keyof MidiActionBindingsDto }
  | { kind: 'param'; moduleId: number; param: string }
  | { kind: 'knob'; index: number }

type MidiDeviceDto = { name: string; open_ports?: string[] }

type Props = {
  profileName: string
  onProfileName: (name: string) => void
  midiDevices: MidiDeviceDto[]
  midiDevice: string
  openPorts: string[]
  onMidiDevice: (name: string) => void
  /** Force-reopen CoreMIDI ports (after sleep / blank monitor). */
  onReconnectMidi?: () => void
  actionBindings: MidiActionBindingsDto
  onActionBindings: (next: MidiActionBindingsDto) => void
  knobBank: KnobBank
  onKnobBank: (next: KnobBank) => void
  paramLearns: MidiParamLearnDto[]
  onClearParamLearn: (learn: MidiParamLearnDto) => void
  onClearAllParamLearns: () => void
  learnTarget: MidiLearnTarget | null
  lastMidiHint: string | null
  lastMidiEvent: { isCc: boolean; number: number } | null
  onArmLearn: (target: MidiLearnTarget) => void
  /** Bind the currently armed Learn target to the last CC/note seen. */
  onUseLastMidi: () => void
  onCancelLearn: () => void
  onResetDefaults: () => void
  onClose: () => void
  demo?: boolean
}

function BindingEditor({
  binding,
  learning,
  disabled,
  onLearn,
  onChange,
}: {
  binding: MidiBindingDto
  learning: boolean
  disabled?: boolean
  onLearn: () => void
  onChange: (b: MidiBindingDto) => void
}) {
  const unbound = binding.kind === 'none'
  return (
    <div className={`midi-bind-edit${learning ? ' learning' : ''}`}>
      <select
        value={binding.kind}
        disabled={disabled}
        aria-label="Binding kind"
        onChange={(e) => {
          const v = e.target.value
          if (v === 'none') {
            onChange({ ...UNBOUND })
            return
          }
          onChange({
            kind: v === 'note' ? 'note' : 'cc',
            n: binding.kind === 'none' ? 0 : binding.n,
          })
        }}
      >
        <option value="cc">CC</option>
        <option value="note">Note</option>
        <option value="none">Off</option>
      </select>
      <input
        type="number"
        min={0}
        max={127}
        value={unbound ? '' : binding.n}
        disabled={disabled || unbound}
        aria-label="Binding number"
        placeholder="—"
        onChange={(e) =>
          onChange({
            kind: binding.kind === 'note' ? 'note' : 'cc',
            n: Math.max(0, Math.min(127, Number(e.target.value) || 0)),
          })
        }
      />
      <code>{formatBinding(binding)}</code>
      <button type="button" className={learning ? 'primary' : undefined} disabled={disabled} onClick={onLearn}>
        {learning ? 'Move control…' : 'Learn'}
      </button>
    </div>
  )
}

export function MidiSettingsPage({
  profileName,
  onProfileName,
  midiDevices,
  midiDevice,
  openPorts,
  onMidiDevice,
  onReconnectMidi,
  actionBindings,
  onActionBindings,
  knobBank,
  onKnobBank,
  paramLearns,
  onClearParamLearn,
  onClearAllParamLearns,
  learnTarget,
  lastMidiHint,
  lastMidiEvent,
  onArmLearn,
  onUseLastMidi,
  onCancelLearn,
  onResetDefaults,
  onClose,
  demo,
}: Props) {
  const setAction = (key: keyof MidiActionBindingsDto, b: MidiBindingDto) => {
    onActionBindings({ ...actionBindings, [key]: b })
  }

  const setKnob = (index: number, cc: number) => {
    const next = [...knobBank] as KnobBank
    next[index] = Math.max(0, Math.min(127, Math.round(cc)))
    onKnobBank(next)
  }

  const lastLabel = lastMidiEvent
    ? lastMidiEvent.isCc
      ? `CC${lastMidiEvent.number}`
      : `N${lastMidiEvent.number}`
    : null
  const canUseLast =
    Boolean(learnTarget && lastMidiEvent) &&
    !(
      learnTarget &&
      (learnTarget.kind === 'knob' || learnTarget.kind === 'param') &&
      lastMidiEvent &&
      !lastMidiEvent.isCc
    )

  return (
    <div className="midi-settings" role="dialog" aria-label="MIDI settings">
      <header className="midi-settings-top">
        <div>
          <h1>MIDI settings</h1>
          <p>Set up your controller once — app actions, knob CC bank, and learned params.</p>
        </div>
        <div className="midi-settings-top-actions">
          {learnTarget && canUseLast && (
            <button type="button" className="primary" onClick={onUseLastMidi}>
              Use last ({lastLabel})
            </button>
          )}
          {learnTarget && (
            <button type="button" onClick={onCancelLearn}>
              Cancel learn
            </button>
          )}
          <button type="button" onClick={onClose}>
            Back to rack
          </button>
        </div>
      </header>

      <div className="midi-settings-listen" role="status">
        <strong>{learnTarget ? 'Listening for Learn…' : 'MIDI monitor'}</strong>
        <span>
          {learnTarget
            ? 'Press the control now (watch this monitor). If nothing changes, that button is not sending MIDI.'
            : 'Keys show N… · knobs show CC… · bank/preset often show PC…'}
        </span>
        <code>{lastMidiHint ?? 'no MIDI yet'}</code>
      </div>

      <div className="midi-settings-body">
        <section className="midi-settings-card">
          <h2>Controller</h2>
          <p className="midi-settings-hint">
            Prefer the <strong>USB MIDI</strong> port (not MIDI DIN). Mackie/HUI is hidden.
            emenay listens on every notes port and auto-reconnects after sleep/unplug.
          </p>
          <label className="midi-settings-field">
            <span>Profile name</span>
            <input
              type="text"
              value={profileName}
              disabled={demo}
              maxLength={48}
              onChange={(e) => onProfileName(e.target.value)}
            />
          </label>
          <label className="midi-settings-field">
            <span>MIDI input</span>
            <select
              value={midiDevice}
              disabled={demo}
              onChange={(e) => onMidiDevice(e.target.value)}
            >
              {midiDevices.length === 0 && <option value="">no MIDI in</option>}
              {midiDevices.map((d) => (
                <option key={d.name} value={d.name}>
                  {d.name}
                </option>
              ))}
            </select>
          </label>
          <p className="midi-settings-hint">
            Listening on:{' '}
            <code>{openPorts.length ? openPorts.join(' · ') : midiDevice || '—'}</code>
            {onReconnectMidi && (
              <>
                {' '}
                <button
                  type="button"
                  disabled={demo}
                  title="Force-reopen MIDI ports"
                  onClick={() => onReconnectMidi()}
                >
                  Reconnect
                </button>
              </>
            )}
          </p>
        </section>

        <section className="midi-settings-card">
          <h2>App actions</h2>
          <p className="midi-settings-hint">
            Defaults are placeholder CCs ({formatBinding(DEFAULT_ACTION_BINDINGS.start)}…
            {formatBinding(DEFAULT_ACTION_BINDINGS.panic)}) — Learn (or <strong>Use last</strong>)
            to bind real controls. Assigning a CC clears it from any previous target (action, knob
            bank, or param learn). Oxygen transport in DAW mode is usually Mackie/HUI (we hide that
            port). In Preset mode, Play/Stop may send MIDI realtime (<code>RT Start</code> /{' '}
            <code>RT Stop</code> in the monitor) rather than a CC. <strong>&lt;&lt; / &gt;&gt;</strong>{' '}
            and local preset arrows often send nothing we can Learn — use Bank, pads, or type a CC.
          </p>
          <ul className="midi-settings-rows">
            {ACTION_LABELS.map(({ key, label, hint }) => (
              <li key={key}>
                <div className="midi-settings-row-label">
                  <strong>{label}</strong>
                  <span>{hint}</span>
                </div>
                <BindingEditor
                  binding={actionBindings[key]}
                  learning={learnTarget?.kind === 'action' && learnTarget.action === key}
                  disabled={demo}
                  onLearn={() => onArmLearn({ kind: 'action', action: key })}
                  onChange={(b) => setAction(key, b)}
                />
              </li>
            ))}
          </ul>
        </section>

        <section className="midi-settings-card">
          <h2>Knob CC bank</h2>
          <p className="midi-settings-hint">
            Generic defaults CC {DEFAULT_KNOB_BANK[0]}–{DEFAULT_KNOB_BANK[7]}. Map your hardware
            knobs here once — then selecting a module auto-assigns knobs 1–8 to that module’s
            faceplate params (cleared when you deselect). Also applied when you add a{' '}
            <strong>MIDI CC</strong> module.
          </p>
          <ul className="midi-settings-rows">
            {KNOB_BANK_LABELS.map((label, i) => (
              <li key={label}>
                <div className="midi-settings-row-label">
                  <strong>{label}</strong>
                  <span>cc_num_{i + 1}</span>
                </div>
                <div
                  className={`midi-bind-edit${
                    learnTarget?.kind === 'knob' && learnTarget.index === i ? ' learning' : ''
                  }`}
                >
                  <span className="midi-bind-kind">CC</span>
                  <input
                    type="number"
                    min={0}
                    max={127}
                    value={knobBank[i]}
                    disabled={demo}
                    aria-label={`${label} CC`}
                    onChange={(e) => setKnob(i, Number(e.target.value) || 0)}
                  />
                  <code>CC{knobBank[i]}</code>
                  <button
                    type="button"
                    className={
                      learnTarget?.kind === 'knob' && learnTarget.index === i
                        ? 'primary'
                        : undefined
                    }
                    disabled={demo}
                    onClick={() => onArmLearn({ kind: 'knob', index: i })}
                  >
                    {learnTarget?.kind === 'knob' && learnTarget.index === i
                      ? 'Turn knob…'
                      : 'Learn'}
                  </button>
                </div>
              </li>
            ))}
          </ul>
        </section>

        <section className="midi-settings-card">
          <h2>Param learns</h2>
          <p className="midi-settings-hint">
            Right-click any faceplate knob on the rack → Learn. Binds that module instance’s
            param to a CC (applied via engine <code>set_param</code>).
          </p>
          {paramLearns.length === 0 ? (
            <p className="midi-settings-empty">No param learns yet.</p>
          ) : (
            <>
              <ul className="midi-settings-learns">
                {paramLearns.map((l) => (
                  <li key={`${l.module_id}-${l.param}-${l.cc}`}>
                    <span>
                      module {l.module_id} · <code>{l.param}</code>
                    </span>
                    <code>CC{l.cc}</code>
                    <button type="button" onClick={() => onClearParamLearn(l)}>
                      Clear
                    </button>
                  </li>
                ))}
              </ul>
              <button type="button" onClick={onClearAllParamLearns}>
                Clear all param learns
              </button>
            </>
          )}
        </section>

        <section className="midi-settings-card danger-zone">
          <h2>Reset</h2>
          <p className="midi-settings-hint">
            Restore factory app actions (CC 110–118), knob bank (CC 16–23), and clear param
            learns.
          </p>
          <button type="button" className="danger" disabled={demo} onClick={onResetDefaults}>
            Reset MIDI map to defaults
          </button>
        </section>
      </div>
    </div>
  )
}
