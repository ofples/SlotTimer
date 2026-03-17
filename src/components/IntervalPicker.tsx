import { useState } from 'react'
import { CustomMinutePicker } from './CustomMinutePicker'

interface Props {
  label: string
  value: number          // current value in minutes
  presets: number[]
  onChange: (v: number) => void
  disabledAbove?: number // chips with value >= this are disabled
  pickerTitle?: string
  pickerMin?: number
  pickerMax?: number
}

export function IntervalPicker({
  label,
  value,
  presets,
  onChange,
  disabledAbove,
  pickerTitle = 'Custom interval',
  pickerMin = 1,
  pickerMax = 240,
}: Props) {
  const [showPicker, setShowPicker] = useState(false)
  const isCustom = !presets.includes(value)

  return (
    <div className="config-section">
      <span className="section-label">{label}</span>
      <div className="chips">
        {presets.map(p => {
          const disabled = disabledAbove !== undefined && p >= disabledAbove
          return (
            <button
              key={p}
              className={`chip${value === p && !isCustom ? ' active' : ''}`}
              disabled={disabled}
              onClick={() => onChange(p)}
            >
              {p}
            </button>
          )
        })}
        <button
          className={`chip${isCustom ? ' active' : ''}`}
          onClick={() => setShowPicker(true)}
        >
          {isCustom ? `${value}` : '…'}
        </button>
      </div>

      {showPicker && (
        <CustomMinutePicker
          title={pickerTitle}
          initial={isCustom ? value : presets[0]}
          min={pickerMin}
          max={pickerMax}
          onConfirm={v => { onChange(v); setShowPicker(false) }}
          onClose={() => setShowPicker(false)}
        />
      )}
    </div>
  )
}
