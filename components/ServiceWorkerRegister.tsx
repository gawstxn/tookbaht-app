"use client"

import { useEffect } from "react"
// Side effect: listens for beforeinstallprompt from the first page load (see lib/install.ts).
import "@/lib/install"

/** Registers /sw.js in production builds (dev assets aren't content-hashed). */
export function ServiceWorkerRegister() {
  useEffect(() => {
    if (process.env.NODE_ENV !== "production" || !("serviceWorker" in navigator)) return
    navigator.serviceWorker.register("/sw.js", { scope: "/", updateViaCache: "none" }).catch(() => {})
  }, [])
  return null
}
