import type { KeyValueStore } from "./offline"

/*
 * Chat entry's history for the day: the lines the user sent and the entries
 * they became. Kept on this device only so the conversation is still there
 * when the add screen is opened again; yesterday's lines are dropped, and
 * everything is cleared on sign-out.
 */

/** One line the user sent and the entry it was saved as. */
export interface ChatLine {
  text: string
  txId: string
}

/** More than anyone logs in a day; keeps the stored log small. */
export const CHAT_LOG_MAX = 100
const PREFIX = "tookbaht-chat:"

const storage = (): KeyValueStore | null => {
  try {
    return typeof localStorage === "undefined" ? null : localStorage
  } catch {
    return null
  }
}

/** Today's lines, without those whose entry has since been deleted. */
export function readChatLog(userId: string, today: string, existing: (txId: string) => boolean, s = storage()) {
  try {
    const saved = JSON.parse(s?.getItem(PREFIX + userId) ?? "null") as { day?: string; lines?: ChatLine[] } | null
    if (saved?.day !== today || !Array.isArray(saved.lines)) return []
    return saved.lines.filter((l) => typeof l?.text === "string" && typeof l?.txId === "string" && existing(l.txId))
  } catch {
    return []
  }
}

export function saveChatLog(userId: string, today: string, lines: ChatLine[], s = storage()) {
  try {
    if (lines.length) s?.setItem(PREFIX + userId, JSON.stringify({ day: today, lines: lines.slice(-CHAT_LOG_MAX) }))
    else s?.removeItem(PREFIX + userId)
  } catch {
    // Full or unavailable storage: the history just doesn't outlive the screen.
  }
}

/** Nothing of the account stays on a shared device after signing out. */
export function clearChatLogs() {
  try {
    for (const key of Object.keys(localStorage)) if (key.startsWith(PREFIX)) localStorage.removeItem(key)
  } catch {
    // Storage unavailable: nothing was kept.
  }
}
