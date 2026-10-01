import { describe, expect, it } from "vitest"
import { groupDigits } from "@/components/BahtInput"

describe("thousands separators while typing", () => {
  it("groups the whole-baht part only", () => {
    expect(groupDigits("10000")).toBe("10,000")
    expect(groupDigits("1234567.5")).toBe("1,234,567.5")
    expect(groupDigits("999")).toBe("999")
  })
  it("keeps a trailing dot and partial decimals as typed", () => {
    expect(groupDigits("1000.")).toBe("1,000.")
    expect(groupDigits("0.05")).toBe("0.05")
    expect(groupDigits("")).toBe("")
  })
})
