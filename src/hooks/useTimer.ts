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
    postToSW({ type: 'FIRE_NOTIFICATION' })
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

    releaseWakeLock(wakeLockRef)
    postToSW({ type: 'CLEAR_NOTIFICATION' })
    setState({ mainCountdown: '--:--', subCountdown: '--:--', progress: 0 })
  }, [])

  // Cleanup on unmount
  useEffect(() => () => {
    if (tickTimerRef.current)  clearTimeout(tickTimerRef.current)
    if (rafRef.current)        cancelAnimationFrame(rafRef.current)
    releaseWakeLock(wakeLockRef)
  }, [])

  return { ...state, isRunning, start, stop }
}
