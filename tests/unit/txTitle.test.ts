import { describe, expect, it } from "vitest"
import en from "@/lib/locales/en"
import th from "@/lib/locales/th"
import { isDefaultTitle } from "@/lib/txTitle"
import type { Account } from "@/lib/types"

const accounts: Account[] = [
  { id: "save", name: "ออม", kind: "saving", openingBalance: 0, mono: "", tone: "", fxFeePct: 0 },
]

describe("default transaction titles", () => {
  it("recognises the category name in either language", () => {
    expect(isDefaultTitle({ type: "out", title: th.cat.food, category: "food" }, accounts)).toBe(true)
    expect(isDefaultTitle({ type: "out", title: en.cat.food, category: "food" }, accounts)).toBe(true)
    expect(isDefaultTitle({ type: "out", title: "", category: "food" }, accounts)).toBe(true)
  })

  it("keeps a title the user typed", () => {
    expect(isDefaultTitle({ type: "out", title: "ข้าวมันไก่", category: "food" }, accounts)).toBe(false)
  })

  it("recognises generated transfer titles for the destination account", () => {
    const thTitle = th.add.transferTo.replace("{{name}}", "ออม")
    const enTitle = en.add.transferTo.replace("{{name}}", "ออม")
    expect(isDefaultTitle({ type: "move", title: thTitle, toId: "save" }, accounts)).toBe(true)
    expect(isDefaultTitle({ type: "move", title: enTitle, toId: "save" }, accounts)).toBe(true)
    expect(isDefaultTitle({ type: "move", title: "ค่าเทอม", toId: "save" }, accounts)).toBe(false)
  })
})
