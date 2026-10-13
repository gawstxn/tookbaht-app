import { describe, expect, it } from "vitest"
import { ADD_CHIPS, chipHidden, chipOrder, moveChip, toggleChip, visibleChips } from "@/lib/addChips"

describe("chipOrder", () => {
  it("is the default order until the user chooses one", () => {
    expect(chipOrder()).toEqual([...ADD_CHIPS])
    expect(chipOrder({})).toEqual([...ADD_CHIPS])
  })

  it("follows the stored order and puts the rest last", () => {
    expect(chipOrder({ order: ["slip", "tag"] })).toEqual(["slip", "tag", "currency", "tax", "split"])
  })

  it("ignores unknown and repeated keys", () => {
    expect(chipOrder({ order: ["nope", "tax", "tax", "tag"] })).toEqual(["tax", "tag", "currency", "split", "slip"])
  })
})

describe("visibleChips", () => {
  const all = [...ADD_CHIPS]

  it("only lists what this screen offers, in the user's order", () => {
    const prefs = { order: ["slip", "tax", "tag"] }
    expect(visibleChips(prefs, ["tag", "tax", "slip"])).toEqual(["slip", "tax", "tag"])
    expect(visibleChips(prefs, ["tag"])).toEqual(["tag"])
  })

  it("leaves out hidden buttons", () => {
    expect(visibleChips({ hidden: ["currency", "slip"] }, all)).toEqual(["tag", "tax", "split"])
  })

  it("still shows a hidden button that holds a value", () => {
    expect(visibleChips({ hidden: ["tag", "tax"] }, all, ["tag"])).toEqual(["tag", "currency", "split", "slip"])
  })
})

describe("moveChip", () => {
  it("swaps with the neighbour and returns the full order", () => {
    expect(moveChip(undefined, "tax", -1)).toEqual({ order: ["tag", "tax", "currency", "split", "slip"], hidden: [] })
    expect(moveChip({ order: ["tag", "currency", "tax", "split", "slip"] }, "tag", 1).order).toEqual([
      "currency",
      "tag",
      "tax",
      "split",
      "slip",
    ])
  })

  it("does nothing at either end", () => {
    expect(moveChip(undefined, "tag", -1).order).toEqual([...ADD_CHIPS])
    expect(moveChip(undefined, "slip", 1).order).toEqual([...ADD_CHIPS])
  })

  it("keeps what was hidden", () => {
    expect(moveChip({ hidden: ["split"] }, "tag", 1).hidden).toEqual(["split"])
  })
})

describe("toggleChip", () => {
  it("hides and shows again", () => {
    const hidden = toggleChip(undefined, "currency")
    expect(hidden.hidden).toEqual(["currency"])
    expect(chipHidden(toggleChip(hidden, "currency"))).toEqual([])
  })

  it("keeps the order", () => {
    expect(toggleChip({ order: ["slip", "tag"] }, "tax").order).toEqual(["slip", "tag", "currency", "tax", "split"])
  })
})
