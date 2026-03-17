export interface TimerConfig {
  mainInterval: number    // minutes
  subInterval: number     // minutes
  snapEnabled: boolean
  snapOffset: number      // minutes (0–59)
  volume: number          // 0–1
}

export type AppState = 'config' | 'running'
