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

function loadAudio(src: string): HTMLAudioElement | null {
  try {
    const a = new Audio(src)
    a.preload = 'auto'
    return a
  } catch {
    return null
  }
}

function playSound(audio: HTMLAudioElement | null) {
  if (!audio) return
  audio.currentTime = 0
  audio.play().catch(() => { /* sound file may not exist yet */ })
}

export function useTimer(config: TimerConfig): UseTimerReturn {
  const [isRunning, setIsRunning] = useState(false)
  const [state, setState] = useState<TimerState>({ mainCountdown: '--:--', subCountdown: '--:--', progress: 0 })

  const phaseRef = useRef(0)
  const mainIntervalMsRef = useRef(0)
  const subIntervalMsRef = useRef(0)
  const tickTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const rafRef = useRef<number | null>(null)
  const isRunningRef = useRef(false)
  const gongRef = useRef<HTMLAudioElement | null>(null)
  const bellRef = useRef<HTMLAudioElement | null>(null)

  // Load audio on mount
  useEffect(() => {
    gongRef.current = loadAudio('/sounds/gong.mp3')
    bellRef.current = loadAudio('/sounds/bell.mp3')
  }, [])

  const updateDisplay = useCallback(() => {
    const now = Date.now()
    const mainMs = mainIntervalMsRef.current
    const subMs = subIntervalMsRef.current
    const phase = phaseRef.current

    const nextMain = nextTick(now, mainMs, phase)
    const nextSub = nextSubTick(now, mainMs, subMs, phase)
    const prog = mainProgress(now, mainMs, phase)

    setState({
      mainCountdown: formatCountdown(nextMain - now),
      subCountdown: formatCountdown(nextSub - now),
      progress: prog,
    })
  }, [])

  const rafLoop = useCallback(() => {
    if (!isRunningRef.current) return
    updateDisplay()
    rafRef.current = requestAnimationFrame(rafLoop)
  }, [updateDisplay])

  const scheduleNextTick = useCallback(() => {
    if (!isRunningRef.current) return
    const now = Date.now()
    const mainMs = mainIntervalMsRef.current
    const subMs = subIntervalMsRef.current
    const phase = phaseRef.current

    const nextMain = nextTick(now, mainMs, phase)
    const nextSub = nextSubTick(now, mainMs, subMs, phase)
    const nextFire = Math.min(nextMain, nextSub)
    const delay = Math.max(0, nextFire - Date.now())

    tickTimerRef.current = setTimeout(() => {
      if (!isRunningRef.current) return
      const fireTime = Date.now()
      const mainMs2 = mainIntervalMsRef.current
      const subMs2 = subIntervalMsRef.current
      const phase2 = phaseRef.current

      // Check what fired (within 500ms tolerance)
      const wasMain = Math.abs(fireTime - nextTick(fireTime - 1, mainMs2, phase2)) < 500
        || Math.abs(nextMain - fireTime) < 500
      const wasSub = Math.abs(fireTime - nextSubTick(fireTime - 1, mainMs2, subMs2, phase2)) < 500
        || Math.abs(nextSub - fireTime) < 500

      if (wasMain) playSound(gongRef.current)
      else if (wasSub) playSound(bellRef.current)

      scheduleNextTick()
    }, delay)
  }, [])

  // Re-sync when tab becomes visible again
  useEffect(() => {
    const handleVisibility = () => {
      if (document.visibilityState === 'visible' && isRunningRef.current) {
        if (tickTimerRef.current) clearTimeout(tickTimerRef.current)
        scheduleNextTick()
        updateDisplay()
      }
    }
    document.addEventListener('visibilitychange', handleVisibility)
    return () => document.removeEventListener('visibilitychange', handleVisibility)
  }, [scheduleNextTick, updateDisplay])

  const start = useCallback(() => {
    const now = Date.now()
    const mainMs = config.mainInterval * 60_000
    const subMs = config.subInterval * 60_000

    mainIntervalMsRef.current = mainMs
    subIntervalMsRef.current = subMs

    if (config.snapEnabled) {
      phaseRef.current = config.snapOffset * 60_000
    } else {
      // Phase anchored to "now" so first tick is exactly one interval away
      phaseRef.current = now % mainMs
    }

    isRunningRef.current = true
    setIsRunning(true)
    updateDisplay()
    scheduleNextTick()
    rafRef.current = requestAnimationFrame(rafLoop)
  }, [config, updateDisplay, scheduleNextTick, rafLoop])

  const stop = useCallback(() => {
    isRunningRef.current = false
    setIsRunning(false)
    if (tickTimerRef.current) { clearTimeout(tickTimerRef.current); tickTimerRef.current = null }
    if (rafRef.current) { cancelAnimationFrame(rafRef.current); rafRef.current = null }
    setState({ mainCountdown: '--:--', subCountdown: '--:--', progress: 0 })
  }, [])

  // Cleanup on unmount
  useEffect(() => () => {
    if (tickTimerRef.current) clearTimeout(tickTimerRef.current)
    if (rafRef.current) cancelAnimationFrame(rafRef.current)
  }, [])

  return { ...state, isRunning, start, stop }
}
