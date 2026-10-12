/** Click2-style lane strip for the Beat module (shown when selected). */

export const BEAT_SOUND_LABELS = [
  'Kick deep',
  'Kick punch',
  'Kick tight',
  'Snare',
  'Snare bright',
  'Snare dry',
  'CH closed',
  'CH tight',
  'OH open',
  'OH short',
  'Rim / wood',
  'Cowbell',
  'Clap',
  'Tom',
  'Shaker',
  'Metro beep',
] as const

export const BEAT_LANES = [
  { key: 'bd', label: 'BD' },
  { key: 'sd', label: 'SD' },
  { key: 'ch', label: 'CH' },
  { key: 'oh', label: 'OH' },
] as const

export const BEAT_PATTERN_LABELS = [
  'Four on floor',
  'Disco',
  'Electro',
  'Breaky',
  'Half-time',
  'Garage',
  'Clave-ish',
  'Techno',
  'Busy hats',
  'Boom-bap',
  'Syncop',
  'Hats + kick',
  'Snare train',
  'OH groove',
  'Fill',
  'Kick / metro',
] as const

type Props = {
  moduleId: number
  params: Record<string, number>
  onParam: (name: string, value: number) => void
}

export function BeatEditor({ params, onParam }: Props) {
  const pattern = Math.round(params.pattern ?? params.loop ?? 0)
  const swing = params.swing ?? 0
  const level = params.level ?? 0.9

  return (
    <div className="beat-editor" role="region" aria-label="Beat lane editor">
      <header className="beat-editor-head">
        <strong>Beat</strong>
        <span>pattern · lanes · sounds — Click2-style, Eurorack jacks on the panel</span>
      </header>

      <div className="beat-editor-globals">
        <label>
          Pattern
          <select
            value={pattern}
            onChange={(e) => {
              const v = Number(e.target.value)
              onParam('pattern', v)
              onParam('loop', v)
            }}
          >
            {BEAT_PATTERN_LABELS.map((name, i) => (
              <option key={name} value={i}>
                {i} · {name}
              </option>
            ))}
          </select>
        </label>
        <label>
          Swing
          <input
            type="range"
            min={0}
            max={1}
            step={0.01}
            value={swing}
            onChange={(e) => onParam('swing', Number(e.target.value))}
          />
          <code>{swing.toFixed(2)}</code>
        </label>
        <label>
          Master
          <input
            type="range"
            min={0}
            max={1}
            step={0.01}
            value={level}
            onChange={(e) => onParam('level', Number(e.target.value))}
          />
          <code>{level.toFixed(2)}</code>
        </label>
      </div>

      <ul className="beat-editor-lanes">
        {BEAT_LANES.map(({ key, label }) => {
          const on = (params[`${key}_on`] ?? 1) >= 0.5
          const sound = Math.round(params[`${key}_sound`] ?? 0)
          const laneLevel = params[`${key}_level`] ?? 0.85
          const pan = params[`${key}_pan`] ?? 0
          return (
            <li key={key} className={on ? '' : 'off'}>
              <label className="beat-lane-on">
                <input
                  type="checkbox"
                  checked={on}
                  onChange={(e) => onParam(`${key}_on`, e.target.checked ? 1 : 0)}
                />
                <strong>{label}</strong>
              </label>
              <label className="beat-lane-sound">
                Sound
                <select
                  value={sound}
                  disabled={!on}
                  onChange={(e) => onParam(`${key}_sound`, Number(e.target.value))}
                >
                  {BEAT_SOUND_LABELS.map((name, i) => (
                    <option key={name} value={i}>
                      {name}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Level
                <input
                  type="range"
                  min={0}
                  max={1}
                  step={0.01}
                  value={laneLevel}
                  disabled={!on}
                  onChange={(e) => onParam(`${key}_level`, Number(e.target.value))}
                />
              </label>
              <label>
                Pan
                <input
                  type="range"
                  min={-1}
                  max={1}
                  step={0.01}
                  value={pan}
                  disabled={!on}
                  onChange={(e) => onParam(`${key}_pan`, Number(e.target.value))}
                />
                <code>{pan.toFixed(2)}</code>
              </label>
            </li>
          )
        })}
      </ul>
    </div>
  )
}
