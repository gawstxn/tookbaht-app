import { useStore } from "./store"

/** Screens kept by the service worker so they open offline. */
const OFFLINE_PAGES = [
  "/",
  "/transactions",
  "/subscriptions",
  "/profile",
  "/add",
  "/goals",
  "/goals/edit",
  "/ious",
  "/ious/split",
  "/insights",
  "/accounts",
  "/notifications",
  "/subscriptions/new",
  "/recurring/new",
  "/terms",
  "/privacy",
]

/**
 * Have the service worker keep the app's screens for offline use, including
 * each subscription's and account's detail screen (public/sw.js "warm").
 * Production builds only: dev assets aren't content-hashed.
 */
export function keepScreensOffline() {
  if (process.env.NODE_ENV !== "production" || !("serviceWorker" in navigator)) return
  const { subscriptions, accounts } = useStore.getState()
  const detail = [
    ...subscriptions.map((s) => `/subscriptions/${s.id}`),
    ...accounts.map((a) => `/accounts/${a.id}`),
  ].slice(0, 80)
  const build = `${process.env.NEXT_PUBLIC_APP_VERSION}-${process.env.NEXT_PUBLIC_APP_COMMIT}`
  void navigator.serviceWorker.ready.then((reg) =>
    reg.active?.postMessage({ type: "warm", urls: [...OFFLINE_PAGES, ...detail], build }),
  )
}
