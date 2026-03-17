// Rendered inside the floating Picture-in-Picture window via React portal.
// Inherits CSS from the parent document (copied at pip open time).

interface Props {
  mainCountdown: string
  onClose: () => void
}

export function PipContent({ mainCountdown, onClose }: Props) {
  return (
    <div className="pip-wrap">
      <button className="pip-close" onClick={onClose} aria-label="Close mini player">
        <svg width="10" height="10" viewBox="0 0 10 10" fill="none" aria-hidden>
          <path d="M1 1l8 8M9 1l-8 8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
        </svg>
      </button>
      <span className="pip-main">{mainCountdown}</span>
    </div>
  )
}
