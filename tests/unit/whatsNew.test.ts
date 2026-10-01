import { describe, expect, it } from "vitest"
import { compareVersions, newSince } from "@/lib/whatsNew"

describe("what's new", () => {
  it("compares versions numerically", () => {
    expect(compareVersions("1.10.0", "1.9.0")).toBe(1)
    expect(compareVersions("1.18.0", "1.18.0")).toBe(0)
    expect(compareVersions("1.14.1", "1.15.0")).toBe(-1)
  })

  it("lists what came after the last version seen, up to the running one", () => {
    expect(newSince("1.17.0", "1.18.0").map((i) => i.key)).toEqual(["slip"])
    expect(newSince("1.18.0", "1.18.0")).toEqual([])
    // A release not deployed yet isn't announced.
    expect(newSince("1.17.0", "1.17.5")).toEqual([])
  })

  it("caps the list and starts older accounts from the baseline", () => {
    expect(newSince(undefined, "1.19.0")).toHaveLength(6)
    expect(newSince(undefined, "1.19.0")[0].key).toBe("settings")
    expect(newSince("1.19.0", "1.20.0").map((i) => i.key)).toEqual(["insightsTabs"])
  })
})
