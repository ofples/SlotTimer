import { useState } from 'react'
import { createPortal } from 'react-dom'
import './App.css'
import { TimerConfig, AppState } from './types'
import { useTimer } from './hooks/useTimer'
import { usePip } from './hooks/usePip'
import { ConfigScreen } from './components/ConfigScreen'
import { RunningScreen } from './components/RunningScreen'
import { PipContent } from './components/PipContent'

const STORAGE_KEY = 'slottimer-config'

const DEFAULT_CONFIG: TimerConfig = {
  mainInterval: 30,
  subInterval: 5,
  snapEnabled: false,
  snapOffset: 0,
  volume: 0.8,
}

function loadConfig(): TimerConfig {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return DEFAULT_CONFIG
    return { ...DEFAULT_CONFIG, ...JSON.parse(raw) }
  } catch {
    return DEFAULT_CONFIG
  }
}

function saveConfig(config: TimerConfig) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(config))
  } catch { /* storage unavailable */ }
}

export function App() {
  const [config, setConfig] = useState<TimerConfig>(loadConfig)
  const [appState, setAppState] = useState<AppState>('config')

  const { mainCountdown, subCountdown, progress, start, stop } = useTimer(config)
  const { isSupported: isPipSupported, isPip, pipContainer, open: openPip, close: closePip } = usePip()

  const handleConfigChange = (c: TimerConfig) => {
    setConfig(c)
    saveConfig(c)
  }

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
          onChange={handleConfigChange}
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

      {pipContainer && createPortal(
        <PipContent
          mainCountdown={mainCountdown}
          onClose={closePip}
        />,
        pipContainer
      )}
    </div>
  )
}
