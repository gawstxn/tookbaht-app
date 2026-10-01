import { useSyncExternalStore } from "react"
import { setMasked } from "./money"

/*
 * "Hide amounts": every amount the money helpers format shows as ฿•••.
 * Per device (localStorage), like the theme; AppShell remounts the screen
 * when it flips so already-formatted text updates.
 */

export const HIDE_AMOUNTS_KEY = "tookbaht-hide-amounts"

const listeners = new Set<() => void>()

function read(): boolean {
  try {
    return localStorage.getItem(HIDE_AMOUNTS_KEY) === "1"
  } catch {
    return false
  }
}

let hidden = typeof window !== "undefined" && read()
setMasked(hidden)

export function amountsHidden() {
  return hidden
}

export function setAmountsHidden(on: boolean) {
  hidden = on
  setMasked(on)
  try {
    if (on) localStorage.setItem(HIDE_AMOUNTS_KEY, "1")
    else localStorage.removeItem(HIDE_AMOUNTS_KEY)
  } catch {
    // Not persisted; still hidden for this session.
  }
  listeners.forEach((l) => l())
}

function subscribe(l: () => void) {
  listeners.add(l)
  return () => listeners.delete(l)
}

/** Whether amounts are hidden right now; re-renders when it changes. */
export function useAmountsHidden() {
  return useSyncExternalStore(subscribe, amountsHidden, () => false)
}
