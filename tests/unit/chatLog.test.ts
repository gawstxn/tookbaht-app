import { describe, expect, it } from "vitest"
import { CHAT_LOG_MAX, readChatLog, saveChatLog } from "@/lib/chatLog"

const memory = () => {
  const items = new Map<string, string>()
  return {
    getItem: (k: string) => items.get(k) ?? null,
    setItem: (k: string, v: string) => void items.set(k, v),
    removeItem: (k: string) => void items.delete(k),
    size: () => items.size,
  }
}
const any = () => true
const TODAY = "2026-10-01"

describe("chat entry history", () => {
  it("keeps today's lines per account", () => {
    const s = memory()
    saveChatLog("u1", TODAY, [{ text: "ค่าข้าว 50", txId: "a" }], s)
    expect(readChatLog("u1", TODAY, any, s)).toEqual([{ text: "ค่าข้าว 50", txId: "a" }])
    expect(readChatLog("u2", TODAY, any, s)).toEqual([])
  })

  it("starts empty the next day", () => {
    const s = memory()
    saveChatLog("u1", TODAY, [{ text: "ค่าข้าว 50", txId: "a" }], s)
    expect(readChatLog("u1", "2026-10-02", any, s)).toEqual([])
  })

  it("drops lines whose entry was deleted", () => {
    const s = memory()
    saveChatLog(
      "u1",
      TODAY,
      [
        { text: "ค่าข้าว 50", txId: "a" },
        { text: "grab 120", txId: "gone" },
      ],
      s,
    )
    expect(readChatLog("u1", TODAY, (id) => id !== "gone", s).map((l) => l.txId)).toEqual(["a"])
  })

  it("keeps only the latest lines and removes an empty log", () => {
    const s = memory()
    const lines = Array.from({ length: CHAT_LOG_MAX + 5 }, (_, i) => ({ text: `x ${i}`, txId: String(i) }))
    saveChatLog("u1", TODAY, lines, s)
    const kept = readChatLog("u1", TODAY, any, s)
    expect(kept).toHaveLength(CHAT_LOG_MAX)
    expect(kept[0].txId).toBe("5")
    saveChatLog("u1", TODAY, [], s)
    expect(s.size()).toBe(0)
  })

  it("ignores a damaged log", () => {
    const s = memory()
    s.setItem("tookbaht-chat:u1", "{not json")
    expect(readChatLog("u1", TODAY, any, s)).toEqual([])
  })
})
