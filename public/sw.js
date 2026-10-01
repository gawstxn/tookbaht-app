// Service worker: caches hashed build assets and the app's screens, so the app
// opens without a connection (the data itself is kept by the app, see
// lib/offline.ts). Pages it doesn't have fall back to /offline.html.

const VERSION = "v2"
const STATIC_CACHE = `tookbaht-static-${VERSION}`
// Screen HTML is the same for every user (data loads in the browser).
const PAGE_CACHE = `tookbaht-pages-${VERSION}`
const OFFLINE_URL = "/offline.html"
const PRECACHE = [OFFLINE_URL, "/icons/icon-192.png"]

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(STATIC_CACHE)
      .then((cache) => cache.addAll(PRECACHE))
      .then(() => self.skipWaiting()),
  )
})

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(keys.filter((k) => k !== STATIC_CACHE && k !== PAGE_CACHE).map((k) => caches.delete(k))),
      )
      .then(() => self.clients.claim()),
  )
})

self.addEventListener("fetch", (event) => {
  const { request } = event
  if (request.method !== "GET") return
  const url = new URL(request.url)
  if (url.origin !== self.location.origin) return

  // Page navigations: network first (keeping a copy), then the saved copy, then the offline screen.
  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request)
        .then((res) => {
          if (isAppPage(res)) {
            const copy = res.clone()
            caches.open(PAGE_CACHE).then((cache) => cache.put(url.pathname, copy))
          }
          return res
        })
        .catch(async () => (await caches.match(url.pathname, { cacheName: PAGE_CACHE })) || caches.match(OFFLINE_URL)),
    )
    return
  }

  // Screen data for in-app navigation (React Server Components): network first,
  // then the last copy for the same screen and segment, so moving between
  // screens works offline too.
  if (request.headers.get("RSC") === "1") {
    const key = `${url.pathname}?rsc=${request.headers.get("Next-Router-Segment-Prefetch") || "nav"}`
    event.respondWith(
      fetch(request)
        .then((res) => {
          if (res.ok && !res.redirected) {
            const copy = res.clone()
            caches.open(PAGE_CACHE).then((cache) => cache.put(key, copy))
          }
          return res
        })
        .catch(async () => (await caches.match(key, { cacheName: PAGE_CACHE })) || Response.error()),
    )
    return
  }

  // The slip reader's engine and Thai data (large, rarely change): keep after first use.
  if (url.pathname.startsWith("/ocr/")) {
    event.respondWith(
      caches.match(request, { cacheName: STATIC_CACHE }).then(
        (hit) =>
          hit ||
          fetch(request).then((res) => {
            if (res.ok) {
              const copy = res.clone()
              caches.open(STATIC_CACHE).then((cache) => cache.put(request, copy))
            }
            return res
          }),
      ),
    )
    return
  }

  // Build assets have content hashes in their names, so cache-first is safe.
  if (url.pathname.startsWith("/_next/static/")) {
    event.respondWith(
      caches.match(request).then(
        (hit) =>
          hit ||
          fetch(request).then((res) => {
            if (res.ok) {
              const copy = res.clone()
              caches.open(STATIC_CACHE).then((cache) => cache.put(request, copy))
            }
            return res
          }),
      ),
    )
    return
  }

  // Anything else (e.g. the offline screen's icon): network, then precache.
  if (PRECACHE.includes(url.pathname)) {
    event.respondWith(fetch(request).catch(() => caches.match(request)))
  }
})

/** A signed-in screen (not a redirect to /login or an error). */
function isAppPage(res) {
  return res.ok && !res.redirected && (res.headers.get("content-type") || "").includes("text/html")
}

// The app asks to keep its screens (and the build files they load) for offline use.
self.addEventListener("message", (event) => {
  if (event.data?.type !== "warm" || !Array.isArray(event.data.urls)) return
  const build = typeof event.data.build === "string" ? event.data.build : ""
  event.waitUntil(
    warm(
      event.data.urls.filter((u) => typeof u === "string" && u.startsWith("/")),
      build,
    ),
  )
})

const ASSET = /\/_next\/static\/[^"'\s)]+/g

const WARMED = "/__warmed"

/** Fetch screens not kept yet; after a new build, fetch them all again (their build files changed). */
async function warm(paths, build) {
  const pages = await caches.open(PAGE_CACHE)
  const statics = await caches.open(STATIC_CACHE)
  const marker = await pages.match(WARMED)
  const sameBuild = !!build && !!marker && (await marker.text()) === build
  let complete = true
  for (const path of paths) {
    if (sameBuild && (await pages.match(path))) continue
    try {
      const res = await fetch(path, { credentials: "same-origin" })
      if (!isAppPage(res)) continue
      const html = await res.clone().text()
      await pages.put(path, res)
      const assets = [...new Set(html.match(ASSET) || [])]
      for (const asset of assets) {
        if (await statics.match(asset)) continue
        const a = await fetch(asset)
        if (!a.ok) continue
        // Stylesheets pull in fonts (relative URLs); keep the Thai and Latin ones too.
        if (asset.endsWith(".css")) {
          for (const [, ref] of (await a.clone().text()).matchAll(/url\(([^)]+)\)/g)) {
            const font = new URL(ref.replace(/["']/g, ""), self.location.origin + asset).pathname
            if (/(thai|latin)[^/]*\.woff2$/.test(font) && !assets.includes(font)) assets.push(font)
          }
        }
        await statics.put(asset, a)
      }
    } catch {
      // Offline or a failed page: try again next time the app starts.
      complete = false
    }
  }
  if (build && complete) await pages.put(WARMED, new Response(build))
}

// Subscription reminders sent by /api/cron/reminders: { title, body, url, tag }.
self.addEventListener("push", (event) => {
  if (!event.data) return
  const data = event.data.json()
  event.waitUntil(
    self.registration.showNotification(data.title, {
      body: data.body,
      tag: data.tag,
      icon: "/icons/icon-192.png",
      badge: "/icons/icon-192.png",
      lang: "th",
      data: { url: data.url || "/" },
    }),
  )
})

self.addEventListener("notificationclick", (event) => {
  event.notification.close()
  const target = new URL(event.notification.data?.url || "/", self.location.origin).href
  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((wins) => {
      const win = wins.find((w) => w.url.startsWith(self.location.origin))
      if (win) return win.focus().then((w) => w.navigate(target))
      return self.clients.openWindow(target)
    }),
  )
})
