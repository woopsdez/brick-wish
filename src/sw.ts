/// <reference lib="webworker" />
import { cleanupOutdatedCaches, precacheAndRoute } from 'workbox-precaching'
import { clientsClaim } from 'workbox-core'

declare let self: ServiceWorkerGlobalScope

self.skipWaiting()
clientsClaim()
cleanupOutdatedCaches()
precacheAndRoute(self.__WB_MANIFEST)

interface PushPayload {
  title?: string
  body?: string
  url?: string
  tag?: string
}

self.addEventListener('push', (event) => {
  let data: PushPayload = {}
  try {
    data = event.data?.json() ?? {}
  } catch {
    data = { body: event.data?.text() }
  }
  const title = data.title ?? 'Brick Wish'
  const url = data.url ?? './#/parent'
  event.waitUntil(
    self.registration.showNotification(title, {
      body: data.body ?? '子どもから新しいおねがいが届きました',
      icon: './icons/icon-192.png',
      badge: './icons/icon-192.png',
      tag: data.tag ?? 'brick-wish-request',
      data: { url },
    }),
  )
})

self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  const url = new URL((event.notification.data?.url as string) ?? './#/parent', self.registration.scope).href
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(async (clients) => {
      for (const c of clients) {
        if (c.url.startsWith(self.registration.scope)) {
          await c.focus()
          c.navigate?.(url)
          return
        }
      }
      await self.clients.openWindow(url)
    }),
  )
})
