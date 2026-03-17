import { TimerConfig } from '../types'
import { IntervalPicker } from './IntervalPicker'
import { SnapConfig } from './SnapConfig'

const VERSION = import.meta.env.VITE_APP_VERSION as string

async function forceUpdate() {
  const reg = await navigator.serviceWorker?.getRegistration()
  if (!reg) { location.reload(); return }
  await reg.update()
  const sw = reg.waiting ?? reg.installing
  if (sw) {
    sw.postMessage({ type: 'SKIP_WAITING' })
    navigator.serviceWorker.addEventListener('controllerchange', () => location.reload(), { once: true })
  } else {
    location.reload()
  }
}

const MAIN_PRESETS = [10, 15, 30]
const SUB_PRESETS  = [5, 10, 15]

interface Props {
  config: TimerConfig
  onChange: (c: TimerConfig) => void
  onStart: () => void
  visible: boolean
}

export function ConfigScreen({ config, onChange, onStart, visible }: Props) {
  const set = <K extends keyof TimerConfig>(key: K, val: TimerConfig[K]) =>
    onChange({ ...config, [key]: val })

  const handleMainChange = (v: number) => {
    const newSub = config.subInterval >= v
      ? SUB_PRESETS.filter(p => p < v).at(-1) ?? Math.max(1, v - 1)
      : config.subInterval
    onChange({ ...config, mainInterval: v, subInterval: newSub })
  }

  return (
    <div
      className={`screen config-screen${visible ? '' : ' screen-exit-active'}`}
      aria-hidden={!visible}
    >
      <div className="config-inner">
        <IntervalPicker
          label="Main interval"
          value={config.mainInterval}
          presets={MAIN_PRESETS}
          onChange={handleMainChange}
          pickerTitle="Main interval (minutes)"
          pickerMin={1}
          pickerMax={240}
        />

        <IntervalPicker
          label="Sub interval"
          value={config.subInterval}
          presets={SUB_PRESETS}
          onChange={v => set('subInterval', v)}
          disabledAbove={config.mainInterval}
          pickerTitle="Sub interval (minutes)"
          pickerMin={1}
          pickerMax={config.mainInterval - 1}
        />

        <SnapConfig
          enabled={config.snapEnabled}
          offset={config.snapOffset}
          onToggle={v => set('snapEnabled', v)}
          onOffsetChange={v => set('snapOffset', v)}
        />

        <div className="config-section">
          <span className="section-label">Volume</span>
          <div className="volume-row">
            <span className="volume-icon">
              <VolumeIcon level={config.volume} />
            </span>
            <input
              className="volume-slider"
              type="range"
              min={0}
              max={1}
              step={0.05}
              value={config.volume}
              onChange={e => set('volume', parseFloat(e.target.value))}
            />
          </div>
        </div>

        <button className="main-btn start" onClick={onStart}>
          Start
        </button>
      </div>

      <span className="version-label" onDoubleClick={forceUpdate}>
        v{VERSION}
      </span>
    </div>
  )
}

function VolumeIcon({ level }: { level: number }) {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden>
      <path
        d="M2 5.5h2.5L8 2.5v11L4.5 10.5H2z"
        fill="currentColor"
        opacity={level === 0 ? 0.3 : 1}
      />
      {level > 0 && (
        <path d="M10 5a4 4 0 0 1 0 6" stroke="currentColor" strokeWidth="1.4"
          strokeLinecap="round" fill="none" />
      )}
      {level > 0.5 && (
        <path d="M11.5 3a7 7 0 0 1 0 10" stroke="currentColor" strokeWidth="1.4"
          strokeLinecap="round" fill="none" opacity="0.5" />
      )}
    </svg>
  )
}
