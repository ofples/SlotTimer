import { useCallback, useEffect, useRef, useState } from 'react'
import { TimerConfig } from '../types'
import { nextTick, nextSubTick, mainProgress, formatCountdown } from '../lib/snapLogic'

interface TimerState {
  mainCountdown: string   // MM:SS
  subCountdown: string    // MM:SS
  progress: number        // 0–1
}

interface UseTimerReturn extends TimerState {
  isRunning: boolean
  start: () => void
  stop: () => void
}

// ── Audio ──────────────────────────────────────────────────────

function loadAudio(src: string): HTMLAudioElement | null {
  try {
    const a = new Audio(src)
    a.preload = 'auto'
    return a
  } catch {
    return null
  }
}

function playSound(audio: HTMLAudioElement | null, volume: number) {
  if (!audio) return
  audio.volume = Math.max(0, Math.min(1, volume))
  audio.currentTime = 0
  audio.play().catch(() => { /* sound file may not exist yet */ })
}

// ── Silent audio keep-alive ────────────────────────────────────
//
// Chrome/Android throttle setTimeout on backgrounded tabs, which causes bells
// to fire late or not at all.  Playing audio via an HTMLAudioElement exempts
// the page from background throttling AND activates the MediaSession API so
// that lock-screen / notification-shade controls appear on Android.
//
// An AudioContext alone does NOT trigger MediaSession on Android — a real
// HTMLAudioElement is required.  We generate a tiny silent WAV as a data URL
// at runtime so no extra audio file is needed.

function makeSilentWavUrl(): string {
  // 0.5 s of silence: 8 kHz, 16-bit mono PCM (~8 KB WAV)
  const sampleRate = 8_000
  const numSamples = sampleRate / 2          // 0.5 seconds
  const dataSize   = numSamples * 2          // 16-bit = 2 bytes/sample
  const buf        = new ArrayBuffer(44 + dataSize)
  const v          = new DataView(buf)
  const w = (o: number, s: string) => { for (let i = 0; i < s.length; i++) v.setUint8(o + i, s.charCodeAt(i)) }
  w(0, 'RIFF'); v.setUint32(4, 36 + dataSize, true)
  w(8, 'WAVE'); w(12, 'fmt '); v.setUint32(16, 16, true)
  v.setUint16(20, 1, true)               // PCM
  v.setUint16(22, 1, true)               // mono
  v.setUint32(24, sampleRate, true)
  v.setUint32(28, sampleRate * 2, true)  // byte rate
  v.setUint16(32, 2, true)               // block align
  v.setUint16(34, 16, true)              // bits per sample
  w(36, 'data'); v.setUint32(40, dataSize, true)
  // PCM data bytes default to 0 (silence)
  const bytes = new Uint8Array(buf)
  let bin = ''
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i])
  return 'data:audio/wav;base64,' + btoa(bin)
}

function startSilentAudio(ref: React.MutableRefObject<HTMLAudioElement | null>) {
  if (ref.current) return
  try {
    const audio = new Audio(makeSilentWavUrl())
    audio.loop   = true
    audio.volume = 0.001  // inaudible but not muted — muted elements don't
                          // activate MediaSession on Android
    audio.play().catch(() => {})
    ref.current = audio
  } catch {
    // Not available in this environment — not critical
  }
}

function stopSilentAudio(ref: React.MutableRefObject<HTMLAudioElement | null>) {
  if (ref.current) {
    ref.current.pause()
    ref.current.src = ''
    ref.current = null
  }
}

// ── Wake Lock ──────────────────────────────────────────────────

async function acquireWakeLock(ref: React.MutableRefObject<WakeLockSentinel | null>) {
  if (!('wakeLock' in navigator)) return
  try {
    ref.current = await navigator.wakeLock.request('screen')
  } catch {
    // Permission denied or not supported — not critical
  }
}

function releaseWakeLock(ref: React.MutableRefObject<WakeLockSentinel | null>) {
  ref.current?.release().catch(() => {})
  ref.current = null
}

// ── Service Worker messaging ───────────────────────────────────

function postToSW(data: object) {
  navigator.serviceWorker?.controller?.postMessage(data)
}

async function ensureNotificationPermission(): Promise<boolean> {
  if (!('Notification' in window)) return false
  if (Notification.permission === 'granted') return true
  if (Notification.permission === 'denied') return false
  const result = await Notification.requestPermission()
  return result === 'granted'
}

// ── Hook ───────────────────────────────────────────────────────

export function useTimer(config: TimerConfig): UseTimerReturn {
  const [isRunning, setIsRunning] = useState(false)
  const [state, setState] = useState<TimerState>({
    mainCountdown: '--:--',
    subCountdown: '--:--',
    progress: 0,
  })

  const phaseRef          = useRef(0)
  const mainIntervalMsRef = useRef(0)
  const subIntervalMsRef  = useRef(0)
  const tickTimerRef      = useRef<ReturnType<typeof setTimeout> | null>(null)
  const rafRef            = useRef<number | null>(null)
  const isRunningRef      = useRef(false)
  const gongRef           = useRef<HTMLAudioElement | null>(null)
  const bellRef           = useRef<HTMLAudioElement | null>(null)
  const wakeLockRef       = useRef<WakeLockSentinel | null>(null)
  const notifGrantedRef   = useRef(false)
  const silentAudioRef    = useRef<HTMLAudioElement | null>(null)

  // Preload audio on mount
  useEffect(() => {
    gongRef.current = loadAudio('/sounds/gong.mp3')
    bellRef.current = loadAudio('/sounds/bell.mp3')
  }, [])

  // ── Display update (RAF loop) ────────────────────────────────

  const updateDisplay = useCallback(() => {
    const now      = Date.now()
    const mainMs   = mainIntervalMsRef.current
    const subMs    = subIntervalMsRef.current
    const phase    = phaseRef.current
    const nextMain = nextTick(now, mainMs, phase)
    const nextSub  = nextSubTick(now, mainMs, subMs, phase)
    const prog     = mainProgress(now, mainMs, phase)

    setState({
      mainCountdown: formatCountdown(nextMain - now),
      subCountdown:  formatCountdown(nextSub  - now),
      progress: prog,
    })
  }, [])

  const rafLoop = useCallback(() => {
    if (!isRunningRef.current) return
    updateDisplay()
    rafRef.current = requestAnimationFrame(rafLoop)
  }, [updateDisplay])

  // ── Notification helper ──────────────────────────────────────

  const fireNotification = useCallback(() => {
    if (!notifGrantedRef.current) return
    // Pass current timer state so the SW can self-heal if it was terminated
    // and lost its module-level timerMainMs/timerPhase.
    postToSW({
      type:   'FIRE_NOTIFICATION',
      mainMs: mainIntervalMsRef.current,
      phase:  phaseRef.current,
    })
  }, [])

  // ── Tick scheduler ───────────────────────────────────────────

  const scheduleNextTick = useCallback(() => {
    if (!isRunningRef.current) return
    const now    = Date.now()
    const mainMs = mainIntervalMsRef.current
    const subMs  = subIntervalMsRef.current
    const phase  = phaseRef.current

    const nextMain = nextTick(now, mainMs, phase)
    const nextSub  = nextSubTick(now, mainMs, subMs, phase)
    const nextFire = Math.min(nextMain, nextSub)
    const delay    = Math.max(0, nextFire - Date.now())

    tickTimerRef.current = setTimeout(() => {
      if (!isRunningRef.current) return
      const fireTime = Date.now()

      // Determine what fired (within 1s tolerance)
      const firedMain = Math.abs(fireTime - nextMain) < 1000
      const firedSub  = !firedMain && Math.abs(fireTime - nextSub) < 1000

      if (firedMain) {
        playSound(gongRef.current, config.volume)
        fireNotification()
      } else if (firedSub) {
        playSound(bellRef.current, config.volume)
      }

      scheduleNextTick()
    }, delay)
  }, [fireNotification])

  // ── Visibility re-sync ───────────────────────────────────────

  useEffect(() => {
    const handleVisibility = async () => {
      if (document.visibilityState === 'visible' && isRunningRef.current) {
        if (tickTimerRef.current) clearTimeout(tickTimerRef.current)
        scheduleNextTick()
        updateDisplay()
        // Re-acquire wake lock (it auto-releases when backgrounded)
        await acquireWakeLock(wakeLockRef)
        // Re-sync SW in case it was terminated while the page was backgrounded
        if (notifGrantedRef.current) {
          postToSW({
            type:   'START_TIMER',
            mainMs: mainIntervalMsRef.current,
            phase:  phaseRef.current,
          })
        }
      }
    }
    document.addEventListener('visibilitychange', handleVisibility)
    return () => document.removeEventListener('visibilitychange', handleVisibility)
  }, [scheduleNextTick, updateDisplay])

  // ── Start / Stop ─────────────────────────────────────────────

  const start = useCallback(async () => {
    const now    = Date.now()
    const mainMs = config.mainInterval * 60_000
    const subMs  = config.subInterval  * 60_000

    mainIntervalMsRef.current = mainMs
    subIntervalMsRef.current  = subMs
    phaseRef.current = config.snapEnabled
      ? config.snapOffset * 60_000
      : now % mainMs

    isRunningRef.current = true
    setIsRunning(true)
    updateDisplay()
    scheduleNextTick()
    rafRef.current = requestAnimationFrame(rafLoop)

    // Silent audio loop — prevents Chrome from throttling JS timers in background
    startSilentAudio(silentAudioRef)

    // MediaSession — labels the audio source on the lock screen / notification shade
    if ('mediaSession' in navigator) {
      navigator.mediaSession.metadata = new MediaMetadata({
        title: 'SlotTimer',
        artist: `Every ${config.mainInterval} min`,
      })
      navigator.mediaSession.setActionHandler('stop', stop)
      navigator.mediaSession.setActionHandler('pause', stop)
    }

    // Wake lock — keep screen on
    await acquireWakeLock(wakeLockRef)

    // Notification permission — delegate all scheduling to the SW
    notifGrantedRef.current = await ensureNotificationPermission()
    if (notifGrantedRef.current) {
      postToSW({ type: 'START_TIMER', mainMs, phase: phaseRef.current })
    }
  }, [config, updateDisplay, scheduleNextTick, rafLoop])

  const stop = useCallback(() => {
    isRunningRef.current = false
    setIsRunning(false)

    if (tickTimerRef.current)  { clearTimeout(tickTimerRef.current);   tickTimerRef.current  = null }
    if (rafRef.current)        { cancelAnimationFrame(rafRef.current); rafRef.current        = null }

    stopSilentAudio(silentAudioRef)
    if ('mediaSession' in navigator) navigator.mediaSession.metadata = null
    releaseWakeLock(wakeLockRef)
    postToSW({ type: 'CLEAR_NOTIFICATION' })
    setState({ mainCountdown: '--:--', subCountdown: '--:--', progress: 0 })
  }, [])

  // Cleanup on unmount
  useEffect(() => () => {
    if (tickTimerRef.current)  clearTimeout(tickTimerRef.current)
    if (rafRef.current)        cancelAnimationFrame(rafRef.current)
    releaseWakeLock(wakeLockRef)
    stopSilentAudio(silentAudioRef)
  }, [])

  return { ...state, isRunning, start, stop }
}
