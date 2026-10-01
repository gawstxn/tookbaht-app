"use client"

import { useSyncExternalStore } from "react"

/* Logo paths are ~30 KB, so they load as their own chunk after the app starts. */

let paths: Record<string, string> | null = null
let loading: Promise<void> | null = null
const listeners = new Set<() => void>()

/** Start fetching the logos (AppShell calls this on start-up). */
export function preloadBrandLogos() {
  loading ??= import("./brands.paths")
    .then((m) => {
      paths = m.BRAND_PATHS
      listeners.forEach((l) => l())
    })
    .catch((e) => {
      // Offline before the chunk was cached: tiles stay plain; try again next time.
      loading = null
      console.error(e)
    })
  return loading
}

const subscribe = (cb: () => void) => {
  listeners.add(cb)
  void preloadBrandLogos()
  return () => listeners.delete(cb)
}

/** The brand's SVG logo path once loaded. */
export function useBrandPath(key: string): string | undefined {
  return useSyncExternalStore(
    subscribe,
    () => paths?.[key],
    () => undefined,
  )
}
