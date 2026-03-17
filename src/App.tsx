import { useState } from 'react'
import './App.css'
import { TimerConfig, AppState } from './types'
import { useTimer } from './hooks/useTimer'
import { ConfigScreen } from './components/ConfigScreen'
import { RunningScreen } from './components/RunningScreen'

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

  const handleStart = () => {
    start()
    setAppState('running')
  }

  const handleStop = () => {
    stop()
    setAppState('config')
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
        />
      )}
    </div>
  )
}
