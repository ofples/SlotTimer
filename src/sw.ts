/// <reference lib="webworker" />
import { precacheAndRoute } from 'workbox-precaching'
import { nextTick, formatCountdown } from './lib/snapLogic'

declare const self: ServiceWorkerGlobalScope

precacheAndRoute(self.__WB_MANIFEST)

const TAG = 'slottimer'

// Timer state owned by the SW
let timerMainMs = 0
let timerPhase  = 0
let minuteTimer: ReturnType<typeof setTimeout> | null = null

function showCountdown(renotify: boolean): Promise<void> {
  const now      = Date.now()
  const nextMain = nextTick(now, timerMainMs, timerPhase)
  return self.registration.showNotification('SlotTimer', {
    tag:      TAG,
    body:     formatCountdown(nextMain - now),
    icon:     '/icon-192.png',
    badge:    '/icon-192.png',
    silent:   !renotify,
    renotify,
  })
}

function scheduleNextMinuteBoundary() {
  if (minuteTimer) clearTimeout(minuteTimer)
  if (!timerMainMs) return

  const now      = Date.now()
  const nextMain = nextTick(now, timerMainMs, timerPhase)
  const remaining   = nextMain - now
  const msIntoMinute = remaining % 60_000
  const delay        = msIntoMinute === 0 ? 60_000 : msIntoMinute

  minuteTimer = setTimeout(() => {
    if (!timerMainMs) return
    showCountdown(false)
    scheduleNextMinuteBoundary()
  }, delay)
}

self.addEventListener('message', (event: ExtendableMessageEvent) => {
  const data = event.data as { type: string; mainMs?: number; phase?: number }
  if (!data?.type) return

  if (data.type === 'SKIP_WAITING') {
    self.skipWaiting()
    return
  }

  if (data.type === 'CLEAR_NOTIFICATION') {
    timerMainMs = 0
    timerPhase  = 0
    if (minuteTimer) { clearTimeout(minuteTimer); minuteTimer = null }
    event.waitUntil(
      self.registration.getNotifications({ tag: TAG }).then(notifs =>
        Promise.all(notifs.map(n => { n.close(); return Promise.resolve() }))
      )
    )
    return
  }

  if (data.type === 'START_TIMER') {
    timerMainMs = data.mainMs!
    timerPhase  = data.phase!
    event.waitUntil(showCountdown(false))
    scheduleNextMinuteBoundary()
    return
  }

  if (data.type === 'FIRE_NOTIFICATION') {
    event.waitUntil(showCountdown(true))
  }
})

self.addEventListener('notificationclick', (event: NotificationEvent) => {
  event.notification.close()
  event.waitUntil(
    self.clients
      .matchAll({ type: 'window', includeUncontrolled: true })
      .then(clients => {
        const focused = clients.find(c => c.focused)
        if (focused) return focused.focus()
        if (clients.length > 0) return clients[0].focus()
        return self.clients.openWindow('/')
      })
  )
})
