import { Icon, type IconName } from "@/components/ui/Icon"
import type { TIERS } from "@/lib/streak"

type Tier = (typeof TIERS)[number]

/** Money that grows with the tier: a coin, a note, two, a stack, a bag, a safe. */
const ICON: Record<Tier["key"], IconName> = {
  coin: "coin",
  note: "note",
  wad: "notes2",
  stack: "notesStack",
  bag: "moneyBag",
  safe: "vault",
}

/** A tier's icon in its colour (bronze, silver, gold, then gems). */
export function TierBadge({ tier, size = 28 }: { tier: Tier; size?: number }) {
  return (
    <Icon
      name={ICON[tier.key]}
      size={size}
      strokeWidth={2}
      aria-hidden="true"
      className="shrink-0"
      style={{ color: tier.tone }}
    />
  )
}
