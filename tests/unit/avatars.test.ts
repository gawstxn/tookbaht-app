import { existsSync } from "node:fs"
import { describe, expect, it } from "vitest"
import { AVATARS, NAME_MAX, avatarSrc, cleanName } from "@/lib/avatars"

describe("profile avatars", () => {
  it("maps known keys to their image and anything else to none", () => {
    expect(avatarSrc("cat")).toBe("/avatars/cat.webp")
    expect(avatarSrc("dragon")).toBeNull()
    expect(avatarSrc(undefined)).toBeNull()
  })

  it("has an image file for every avatar", () => {
    for (const key of AVATARS) expect(existsSync(`public/avatars/${key}.webp`), key).toBe(true)
  })
})

describe("display name", () => {
  it("trims, collapses spaces and caps the length", () => {
    expect(cleanName("  สมชาย   ใจดี ")).toBe("สมชาย ใจดี")
    expect(cleanName("   ")).toBe("")
    expect(cleanName("a".repeat(60))).toHaveLength(NAME_MAX)
  })
})
