import { describe, expect, it } from "vitest"
import { TERMS_UPDATED, TERMS_VERSION } from "@/lib/legal"

const bangkokToday = () => new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Bangkok" }).format(new Date())

describe("terms dates", () => {
  it("the last-updated date is a real day that isn't in the future", () => {
    expect(TERMS_UPDATED).toMatch(/^\d{4}-\d{2}-\d{2}$/)
    expect(new Date(TERMS_UPDATED + "T00:00:00Z").toISOString().slice(0, 10)).toBe(TERMS_UPDATED)
    expect(TERMS_UPDATED <= bangkokToday()).toBe(true)
  })

  it("the version is set", () => {
    expect(TERMS_VERSION.length).toBeGreaterThan(0)
  })
})
