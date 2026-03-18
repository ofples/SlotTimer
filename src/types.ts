export interface TimerConfig {
  mainInterval: number    // minutes
  subInterval: number     // minutes
  snapEnabled: boolean
  snapOffset: number      // minutes (0–59)
  subEnabled: boolean          // whether sub-interval bell is active
  notificationsEnabled: boolean
  volume: number          // 0–1 (gong/bell volume)
  bgTrack: 1 | 2 | 3     // background music track
  bgVolume: number        // 0–1; audio.volume clamped to min 0.01 so browser never sees muted
}

export type AppState = 'config' | 'running'
