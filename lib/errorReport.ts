/*
 * The browser half of error reporting: when the app breaks on someone's
 * phone and they don't write in, send what went wrong to /api/errors (the
 * message, the stack, the screen, the app version; never what they logged).
 * Quiet by design: a few reports per device, the same error once, and
 * nothing for errors that aren't the app's (no connection, extensions).
 */

export type ClientErrorSource = "error" | "rejection" | "save"

/** Reports one device sends per page load, and how often the same message is sent. */
const MAX_REPORTS = 5

/** Errors that aren't the app's doing: a dropped connection, a cancelled request, another script. */
const NOISE = [
  /^Script error\.?$/i,
  /ResizeObserver loop/i,
  /Failed to fetch|Load failed|NetworkError|network error|The network connection was lost/i,
  /AbortError|The operation was aborted|signal is aborted|cancell?ed/i,
  /timed? ?out/i,
  /Loading chunk|ChunkLoadError|Importing a module script failed|error loading dynamically imported module/i,
]
const FOREIGN = /(chrome|moz|safari-web)-extension:\/\//

/** The message and stack of whatever was thrown (an Error, a database error object, a string). */
export function describeError(error: unknown): { message: string; stack: string } {
  if (error instanceof Error) return { message: `${error.name}: ${error.message}`, stack: error.stack ?? "" }
  if (typeof error === "string") return { message: error, stack: "" }
  if (error && typeof error === "object") {
    const e = error as { message?: unknown; code?: unknown; hint?: unknown }
    if (typeof e.message === "string") {
      // A database error: its code and hint say more than the text.
      const tags = [e.code, e.hint].filter((x) => typeof x === "string" && x).join(" ")
      return { message: tags ? `${e.message} [${tags}]` : e.message, stack: "" }
    }
  }
  return { message: "", stack: "" }
}

/** Whether an error is worth sending: it has a message, and it isn't a connection or someone else's script. */
export function isReportable(message: string, stack: string): boolean {
  if (!message.trim()) return false
  if (NOISE.some((re) => re.test(message))) return false
  return !FOREIGN.test(stack)
}

const sent = new Set<string>()

/** Send an error to the maintainers, unless it is noise, a repeat, or one too many from this device. */
export function reportError(source: ClientErrorSource, error: unknown) {
  try {
    if (typeof window === "undefined" || !navigator.onLine) return
    const { message, stack } = describeError(error)
    if (!isReportable(message, stack) || sent.has(message) || sent.size >= MAX_REPORTS) return
    sent.add(message)
    void fetch("/api/errors", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      keepalive: true,
      body: JSON.stringify({
        source,
        message: message.slice(0, 1000),
        stack: stack.slice(0, 4000),
        page: location.pathname,
        appVersion: `${process.env.NEXT_PUBLIC_APP_VERSION} (${process.env.NEXT_PUBLIC_APP_COMMIT})`,
      }),
    }).catch(() => {})
  } catch {
    // Reporting an error must never cause one.
  }
}
