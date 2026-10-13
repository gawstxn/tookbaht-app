/** The optional buttons under the note field on the add screen, in their default order. */
export const ADD_CHIPS = ["tag", "currency", "tax", "split", "slip"] as const
export type AddChip = (typeof ADD_CHIPS)[number]

/** What the user chose (profiles.settings.addChips): their order, and the buttons they hid. */
export type ChipPrefs = { order?: string[]; hidden?: string[] }

const known = (k: string): k is AddChip => (ADD_CHIPS as readonly string[]).includes(k)

/** Every button in the user's order; unknown or repeated keys are dropped and new buttons go last. */
export function chipOrder(prefs?: ChipPrefs): AddChip[] {
  const seen = new Set<AddChip>()
  for (const k of prefs?.order ?? []) if (known(k)) seen.add(k)
  for (const k of ADD_CHIPS) seen.add(k)
  return [...seen]
}

export function chipHidden(prefs?: ChipPrefs): AddChip[] {
  return [...new Set((prefs?.hidden ?? []).filter(known))]
}

/**
 * The buttons to show, in order: only those available on this screen (income has no tax
 * mark, a transfer has no currency…), minus hidden ones — except a hidden one that already
 * holds a value (`keep`), so an edited entry never carries something the screen doesn't show.
 */
export function visibleChips(prefs: ChipPrefs | undefined, available: AddChip[], keep: AddChip[] = []): AddChip[] {
  const hidden = chipHidden(prefs)
  return chipOrder(prefs).filter((k) => available.includes(k) && (!hidden.includes(k) || keep.includes(k)))
}

/** One step up (-1) or down (1) in the full order; the result is complete, ready to store. */
export function moveChip(prefs: ChipPrefs | undefined, key: AddChip, step: -1 | 1): Required<ChipPrefs> {
  const order = chipOrder(prefs)
  const from = order.indexOf(key)
  const to = from + step
  if (to >= 0 && to < order.length) [order[from], order[to]] = [order[to], order[from]]
  return { order, hidden: chipHidden(prefs) }
}

/** Show or hide one button. */
export function toggleChip(prefs: ChipPrefs | undefined, key: AddChip): Required<ChipPrefs> {
  const hidden = chipHidden(prefs)
  return {
    order: chipOrder(prefs),
    hidden: hidden.includes(key) ? hidden.filter((k) => k !== key) : [...hidden, key],
  }
}
