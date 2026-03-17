import { TimerConfig } from '../types'
import { IntervalPicker } from './IntervalPicker'
import { SnapConfig } from './SnapConfig'

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

  // When main interval changes, clamp sub if it would become invalid
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

        <button className="main-btn start" onClick={onStart}>
          Start
        </button>
      </div>
    </div>
  )
}
