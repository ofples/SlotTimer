import { useEffect, useRef, useState } from 'react'

interface Props {
  mainCountdown: string
  subCountdown: string
  progress: number      // 0–1
  onStop: () => void
  visible: boolean
  isPipSupported: boolean
  isPip: boolean
  onPipToggle: () => void
}

// Fixed SVG coordinate space; scales via CSS width/height
const VIEW = 300
const CX = VIEW / 2
const CY = VIEW / 2
const R = 130
const CIRC = 2 * Math.PI * R

export function RunningScreen({
  mainCountdown, subCountdown, progress, onStop, visible,
  isPipSupported, isPip, onPipToggle,
}: Props) {
  const [pulse, setPulse] = useState(false)
  const prevCountdownRef = useRef(mainCountdown)

  // Detect when main countdown resets (gong fired) → pulse animation
  useEffect(() => {
    const prev = prevCountdownRef.current
    prevCountdownRef.current = mainCountdown
    if (prev === '--:--' || mainCountdown === '--:--') return
    const prevSecs = timeToSecs(prev)
    const currSecs = timeToSecs(mainCountdown)
    if (currSecs > prevSecs + 5) {
      setPulse(true)
      const t = setTimeout(() => setPulse(false), 700)
      return () => clearTimeout(t)
    }
  }, [mainCountdown])

  const dashOffset = CIRC * (1 - progress)

  return (
    <div
      className={`screen running-screen${visible ? '' : ' screen-exit-active'}`}
      aria-hidden={!visible}
    >
      {isPipSupported && (
        <button
          className={`pip-btn${isPip ? ' active' : ''}`}
          onClick={onPipToggle}
          title={isPip ? 'Close mini player' : 'Open mini player'}
          aria-label={isPip ? 'Close mini player' : 'Open mini player'}
        >
          <PipIcon active={isPip} />
        </button>
      )}

      <div className="running-inner">
        <div className="ring-wrap">
          <svg
            className="ring-svg"
            viewBox={`0 0 ${VIEW} ${VIEW}`}
            style={{ width: 'min(78vw, 320px)', height: 'min(78vw, 320px)' }}
          >
            <circle className="ring-track" cx={CX} cy={CY} r={R} />
            <circle
              className={`ring-progress${pulse ? ' ring-pulse' : ''}`}
              cx={CX}
              cy={CY}
              r={R}
              strokeDasharray={CIRC}
              strokeDashoffset={dashOffset}
            />
          </svg>

          <div className="countdown-wrap">
            <span className="countdown-main">{mainCountdown}</span>
            <div className="countdown-sub">
              <span className="bell-icon">♪</span>
              <span className="sub-time">{subCountdown}</span>
            </div>
          </div>
        </div>
      </div>

      <div className="running-bottom">
        <button className="main-btn stop" onClick={onStop}>
          Stop
        </button>
      </div>
    </div>
  )
}

function PipIcon({ active }: { active: boolean }) {
  // Standard PiP icon: large rect + small overlapping rect in corner
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" fill="none" aria-hidden>
      <rect x="1" y="3" width="16" height="12" rx="2"
        stroke="currentColor" strokeWidth="1.5" fill="none"
        opacity={active ? 0.4 : 1}
      />
      <rect x="9" y="8" width="7" height="5" rx="1"
        fill="currentColor"
      />
    </svg>
  )
}

function timeToSecs(s: string): number {
  const [m, sec] = s.split(':').map(Number)
  return (m || 0) * 60 + (sec || 0)
}
