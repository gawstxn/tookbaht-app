import { Icon, type IconName } from "@/components/ui/Icon";
import { cx } from "@/components/ui/primitives";
import type { TIERS } from "@/lib/streak";

type Tier = (typeof TIERS)[number];

/** Money that grows with the tier: a coin, a note, two, a stack, a bag, a safe. */
const ICON: Record<Tier["key"], IconName> = { coin: "coin", note20: "note", note50: "notes2", note100: "notesStack", note500: "moneyBag", note1000: "vault" };

/**
 * A tier as an app tile: lime for the user's current tier, chip grey for the
 * rest (muted until reached), with the note's colour as a dot in the corner.
 * `ring` is the surface behind, so the dot's border blends into it.
 */
export function TierBadge({
  tier,
  state = "current",
  size = 44,
  ring = "border-card",
}: {
  tier: Tier;
  state?: "current" | "reached" | "ahead";
  size?: number;
  ring?: string;
}) {
  const dot = Math.round(size * 0.27);
  return (
    <span
      aria-hidden="true"
      className={cx(
        "relative flex shrink-0 items-center justify-center",
        state === "current" ? "bg-lime text-on-lime" : state === "reached" ? "bg-chip text-ink" : "bg-chip text-muted",
      )}
      style={{ width: size, height: size, borderRadius: size * 0.32 }}
    >
      <Icon name={ICON[tier.key]} size={Math.round(size * 0.5)} strokeWidth={2} />
      <span className={cx("absolute rounded-full border-2", ring)} style={{ width: dot, height: dot, right: -3, bottom: -3, background: tier.tone }} />
    </span>
  );
}
