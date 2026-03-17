// Rendered inside the floating Picture-in-Picture window via React portal.
// Inherits CSS from the parent document (copied at pip open time).

const VIEW = 180
const CX = VIEW / 2
const CY = VIEW / 2
const R = 74
const CIRC = 2 * Math.PI * R

interface Props {
  mainCountdown: string
  subCountdown: string
  progress: number
  onStop: () => void
}

export function PipContent({ mainCountdown, subCountdown, progress, onStop }: Props) {
  const dashOffset = CIRC * (1 - progress)

  return (
    <div className="pip-wrap">
      <div className="pip-ring-wrap">
        <svg
          className="ring-svg"
          viewBox={`0 0 ${VIEW} ${VIEW}`}
          style={{ width: '100%', height: '100%' }}
        >
          <circle className="ring-track" cx={CX} cy={CY} r={R} />
          <circle
            className="ring-progress"
            cx={CX}
            cy={CY}
            r={R}
            strokeDasharray={CIRC}
            strokeDashoffset={dashOffset}
          />
        </svg>

        <div className="pip-countdown-wrap">
          <span className="pip-main">{mainCountdown}</span>
          <div className="countdown-sub">
            <span className="bell-icon">♪</span>
            <span className="sub-time">{subCountdown}</span>
          </div>
        </div>
      </div>

      <button className="pip-stop" onClick={onStop}>
        Stop
      </button>
    </div>
  )
}
