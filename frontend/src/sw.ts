/// <reference lib="webworker" />

/**
 * Toju service worker.
 *
 * Caching strategy:
 *   • App shell (hashed JS/CSS/HTML/icons) — precached at install.
 *   • Navigations — network-first with cached index.html fallback (SPA deep links).
 *   • Same-origin assets — stale-while-revalidate.
 *   • API requests — never cached; IndexedDB is the offline data source.
 *   • Cross-origin fonts/images — cache-first.
 *
 * Background Sync is progressive enhancement (Chromium). The app also syncs on
 * online/visibility/focus, which is the supported path on iOS.
 */

declare const self: ServiceWorkerGlobalScope & {
  __WB_MANIFEST: Array<{ url: string; revision?: string | null }>
}

import { runCoreSync } from './lib/sync-core'

const VERSION = 'v1'
const PRECACHE = `toju-precache-${VERSION}`
const RUNTIME = `toju-runtime-${VERSION}`
const APP_SHELL = '/index.html'

const PRECACHE_URLS = self.__WB_MANIFEST.map((entry) => entry.url)
const PRECACHE_SET = new Set([...PRECACHE_URLS, APP_SHELL, '/', '/manifest.webmanifest'])

self.addEventListener('install', (event) => {
  event.waitUntil(
    (async () => {
      const cache = await caches.open(PRECACHE)
      await Promise.allSettled(
        [...PRECACHE_SET].map(async (url) => {
          try {
            const response = await fetch(new Request(url, { cache: 'reload' }))
            if (response.ok) await cache.put(url, response)
          } catch {
            // A single missing asset must never block installation.
          }
        }),
      )
    })(),
  )
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys()
      await Promise.all(
        keys.filter((key) => key !== PRECACHE && key !== RUNTIME).map((key) => caches.delete(key)),
      )
      await self.clients.claim()
    })(),
  )
})

async function networkFirst(request: Request): Promise<Response> {
  try {
    const response = await fetch(request)
    if (response.ok) {
      const cache = await caches.open(PRECACHE)
      cache.put(APP_SHELL, response.clone()).catch(() => undefined)
    }
    return response
  } catch {
    const cached = (await caches.match(request)) || (await caches.match(APP_SHELL))
    if (cached) return cached
    return new Response('Toju is offline and this page has not been cached yet.', {
      status: 503,
      headers: { 'Content-Type': 'text/plain' },
    })
  }
}

async function staleWhileRevalidate(request: Request): Promise<Response> {
  const cache = await caches.open(RUNTIME)
  const cached = await cache.match(request)
  const network = fetch(request)
    .then((response) => {
      if (response.ok) cache.put(request, response.clone()).catch(() => undefined)
      return response
    })
    .catch(() => undefined)
  return cached || (await network) || new Response('', { status: 504 })
}

async function cacheFirst(request: Request): Promise<Response> {
  const cache = await caches.open(RUNTIME)
  const cached = await cache.match(request)
  if (cached) return cached
  try {
    const response = await fetch(request)
    if (response.ok) cache.put(request, response.clone()).catch(() => undefined)
    return response
  } catch {
    return new Response('', { status: 504 })
  }
}

self.addEventListener('fetch', (event) => {
  const { request } = event
  if (request.method !== 'GET') return

  const url = new URL(request.url)
  const sameOrigin = url.origin === self.location.origin

  // API calls are intentionally not cached. Clinical data lives in IndexedDB.
  if (sameOrigin && (url.pathname.startsWith('/v1/') || url.pathname === '/health')) {
    return
  }

  if (request.mode === 'navigate') {
    event.respondWith(networkFirst(request))
    return
  }

  if (sameOrigin) {
    if (PRECACHE_SET.has(url.pathname)) {
      event.respondWith(
        (async () => (await caches.match(request)) || fetch(request))().catch(
          () => new Response('', { status: 504 }),
        ),
      )
      return
    }
    event.respondWith(staleWhileRevalidate(request))
    return
  }

  if (['font', 'image', 'style', 'script'].includes(request.destination)) {
    event.respondWith(cacheFirst(request))
  }
})

async function notifyClients(message: Record<string, unknown>): Promise<void> {
  const clients = await self.clients.matchAll({ type: 'window', includeUncontrolled: true })
  for (const client of clients) client.postMessage(message)
}

async function backgroundSync(): Promise<void> {
  try {
    const report = await runCoreSync()
    await notifyClients({ type: 'TOJU_SYNC_COMPLETE', report })
  } catch (error) {
    await notifyClients({
      type: 'TOJU_SYNC_FAILED',
      error: error instanceof Error ? error.message : 'Background sync failed',
    })
  }
}

self.addEventListener('sync', (event: Event) => {
  const syncEvent = event as Event & { tag?: string; waitUntil: (promise: Promise<unknown>) => void }
  if (syncEvent.tag === 'toju-sync') syncEvent.waitUntil(backgroundSync())
})

self.addEventListener('periodicsync', (event: Event) => {
  const periodic = event as Event & { tag?: string; waitUntil: (promise: Promise<unknown>) => void }
  if (periodic.tag === 'toju-periodic-sync') periodic.waitUntil(backgroundSync())
})

self.addEventListener('message', (event: Event) => {
  const messageEvent = event as ExtendableMessageEvent
  const data = messageEvent.data as { type?: string } | undefined
  if (!data) return
  if (data.type === 'SKIP_WAITING') {
    void self.skipWaiting()
  }
  if (data.type === 'TOJU_REQUEST_SYNC') {
    messageEvent.waitUntil(backgroundSync())
  }
})
