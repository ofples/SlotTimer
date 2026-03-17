import { useState } from 'react'
import { createPortal } from 'react-dom'
import './App.css'
import { TimerConfig, AppState } from './types'
import { useTimer } from './hooks/useTimer'
import { usePip } from './hooks/usePip'
import { ConfigScreen } from './components/ConfigScreen'
import { RunningScreen } from './components/RunningScreen'
import { PipContent } from './components/PipContent'

const DEFAULT_CONFIG: TimerConfig = {
  mainInterval: 30,
  subInterval: 5,
  snapEnabled: false,
  snapOffset: 0,
}

export function App() {
  const [config, setConfig] = useState<TimerConfig>(DEFAULT_CONFIG)
  const [appState, setAppState] = useState<AppState>('config')

  const { mainCountdown, subCountdown, progress, start, stop } = useTimer(config)
  const { isSupported: isPipSupported, isPip, pipContainer, open: openPip, close: closePip } = usePip()

  const handleStart = () => {
    start()
    setAppState('running')
  }

  const handleStop = () => {
    stop()
    closePip()
    setAppState('config')
  }

  const handlePipToggle = () => {
    if (isPip) closePip()
    else openPip()
  }

  return (
    <div className="app">
      {appState === 'config' && (
        <ConfigScreen
          config={config}
          onChange={setConfig}
          onStart={handleStart}
          visible
        />
      )}
      {appState === 'running' && (
        <RunningScreen
          mainCountdown={mainCountdown}
          subCountdown={subCountdown}
          progress={progress}
          onStop={handleStop}
          visible
          isPipSupported={isPipSupported}
          isPip={isPip}
          onPipToggle={handlePipToggle}
        />
      )}

      {/* PiP portal — renders into the floating window's DOM when active */}
      {pipContainer && createPortal(
        <PipContent
          mainCountdown={mainCountdown}
          subCountdown={subCountdown}
          progress={progress}
          onStop={handleStop}
        />,
        pipContainer
      )}
    </div>
  )
}
