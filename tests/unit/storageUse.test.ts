import { describe, expect, it } from "vitest"
import { clearable, formatBytes, localBytes } from "@/lib/storageUse"

const store = (items: Record<string, string>) => {
  const keys = Object.keys(items)
  return { length: keys.length, key: (i: number) => keys[i] ?? null, getItem: (k: string) => items[k] ?? null }
}

describe("storage kept on the device", () => {
  it("formats sizes", () => {
    expect(formatBytes(0)).toBe("0 B")
    expect(formatBytes(900)).toBe("900 B")
    expect(formatBytes(1024)).toBe("1 KB")
    expect(formatBytes(840_000)).toBe("820 KB")
    expect(formatBytes(1024 * 1024)).toBe("1.0 MB")
    expect(formatBytes(13_000_000)).toBe("12.4 MB")
    expect(formatBytes(250 * 1024 * 1024)).toBe("250 MB")
  })

  it("counts only the app's own keys, two bytes a character", () => {
    expect(localBytes(store({}))).toBe(0)
    expect(localBytes(store({ "tookbaht-cache:u1": "abcd", "other-site": "x".repeat(50) }))).toBe(
      ("tookbaht-cache:u1".length + 4) * 2,
    )
  })

  it("offers the kept files for clearing, never the user's data", () => {
    expect(clearable({ screens: 300, slipReader: 200, data: 9000 })).toBe(500)
  })
})
