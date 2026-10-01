import type { KeyValueStore } from "./offline"

/*
 * What the app keeps on this device: the service worker's copies of its
 * screens and build files (public/sw.js), the slip reader's engine, and the
 * copy of the user's data in localStorage (lib/offline.ts).
 */

export interface StorageUse {
  /** Screens and build files kept so the app opens fast and offline. */
  screens: number
  /** The slip reader's engine and Thai data, kept after its first use. */
  slipReader: number
  /** The user's latest data, entries waiting to sync, and per-device settings. */
  data: number
}

/** Everything the service worker keeps can be downloaded again. */
export const clearable = (use: StorageUse) => use.screens + use.slipReader

/** "820 KB", "12.4 MB": sizes for the settings screen. */
export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${Math.max(0, Math.round(bytes))} B`
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`
  const mb = bytes / (1024 * 1024)
  return `${mb >= 100 ? Math.round(mb) : mb.toFixed(1)} MB`
}

/** Size of the app's own keys in localStorage (browsers keep strings as UTF-16: two bytes a character). */
export function localBytes(
  storage: Pick<KeyValueStore, "getItem"> & { length: number; key(i: number): string | null },
) {
  let chars = 0
  for (let i = 0; i < storage.length; i++) {
    const key = storage.key(i)
    if (!key?.startsWith("tookbaht")) continue
    chars += key.length + (storage.getItem(key)?.length ?? 0)
  }
  return chars * 2
}

/** Adds up what is kept on this device (reads every kept file's size, so call it once per visit). */
export async function measureStorage(): Promise<StorageUse> {
  const use: StorageUse = { screens: 0, slipReader: 0, data: 0 }
  try {
    use.data = localBytes(localStorage)
  } catch {
    // Storage blocked: nothing is kept there.
  }
  if (typeof caches === "undefined") return use
  try {
    for (const name of await caches.keys()) {
      const cache = await caches.open(name)
      for (const request of await cache.keys()) {
        const size = (await (await cache.match(request))?.blob())?.size ?? 0
        if (new URL(request.url).pathname.startsWith("/ocr/")) use.slipReader += size
        else use.screens += size
      }
    }
  } catch {
    // Cache storage unavailable (private browsing): report what could be read.
  }
  return use
}

/** Remove every file the service worker kept. The user's data and settings stay. */
export async function clearKeptFiles(): Promise<void> {
  if (typeof caches === "undefined") return
  await Promise.all((await caches.keys()).map((name) => caches.delete(name)))
}
