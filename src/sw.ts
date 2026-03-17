/// <reference lib="webworker" />
import { precacheAndRoute } from 'workbox-precaching'

declare const self: ServiceWorkerGlobalScope

precacheAndRoute(self.__WB_MANIFEST)

const TAG = 'slottimer'

interface UpdateMsg {
  type: 'UPDATE_NOTIFICATION'
  mainCountdown: string   // "MM:SS"
  subCountdown: string
  renotify: boolean       // true when a gong/bell just fired
  kind?: 'main' | 'sub'  // which interval fired (if renotify)
}

interface ClearMsg {
  type: 'CLEAR_NOTIFICATION'
}

type Msg = UpdateMsg | ClearMsg

self.addEventListener('message', (event: ExtendableMessageEvent) => {
  const data = event.data as Msg
  if (!data?.type) return

  if (data.type === 'CLEAR_NOTIFICATION') {
    event.waitUntil(
      self.registration.getNotifications({ tag: TAG }).then(notifs =>
        Promise.all(notifs.map(n => { n.close(); return Promise.resolve() }))
      )
    )
    return
  }

  if (data.type === 'UPDATE_NOTIFICATION') {
    const { mainCountdown, subCountdown, renotify, kind } = data

    let title = 'SlotTimer'
    let body = `Next gong  ${mainCountdown}   ·   Bell  ${subCountdown}`

    if (renotify && kind === 'main') {
      title = '🔔 Gong'
      body = `Next gong  ${mainCountdown}   ·   Bell  ${subCountdown}`
    } else if (renotify && kind === 'sub') {
      title = '🔔 Bell'
      body = `Next gong  ${mainCountdown}   ·   Bell  ${subCountdown}`
    }

    event.waitUntil(
      self.registration.showNotification(title, {
        tag: TAG,
        body,
        icon: '/icon-192.png',
        badge: '/icon-192.png',
        silent: !renotify,
        renotify,
      })
    )
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
