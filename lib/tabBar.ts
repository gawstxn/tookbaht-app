import { useSyncExternalStore } from "react"

/*
 * Tab bar style: the floating glass pill (default) or the classic full-width bar.
 * Per device (localStorage), like the theme; the bar re-renders when it flips.
 */

export type TabBarStyle = "floating" | "classic"
export const TAB_BAR_KEY = "tookbaht-tab-bar"

const listeners = new Set<() => void>()

export function readTabBarStyle(): TabBarStyle {
  try {
    return localStorage.getItem(TAB_BAR_KEY) === "classic" ? "classic" : "floating"
  } catch {
    return "floating"
  }
}

let style: TabBarStyle = typeof window !== "undefined" ? readTabBarStyle() : "floating"

export function tabBarStyle() {
  return style
}

export function setTabBarStyle(next: TabBarStyle) {
  style = next
  try {
    if (next === "classic") localStorage.setItem(TAB_BAR_KEY, "classic")
    else localStorage.removeItem(TAB_BAR_KEY)
  } catch {
    // Not persisted; still switched for this session.
  }
  listeners.forEach((l) => l())
}

function subscribe(l: () => void) {
  listeners.add(l)
  return () => listeners.delete(l)
}

/** The chosen tab bar style; re-renders when it changes. */
export function useTabBarStyle() {
  return useSyncExternalStore(subscribe, tabBarStyle, () => "floating" as const)
}
