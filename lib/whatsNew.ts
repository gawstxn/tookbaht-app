import type { IconName } from "@/components/ui/Icon";

/**
 * Highlights per release for the "มีอะไรใหม่" drawer, newest first. Add an
 * entry with every user-visible release (copy in locales: whatsNew.<key>).
 */
export const RELEASES: { version: string; items: { key: string; icon: IconName }[] }[] = [
  { version: "1.27.0", items: [{ key: "tax", icon: "percent" }] },
  { version: "1.26.0", items: [{ key: "wishlist", icon: "bag" }] },
  { version: "1.25.0", items: [{ key: "outlook", icon: "calendar" }] },
  { version: "1.24.0", items: [{ key: "sharedSubs", icon: "users" }] },
  { version: "1.23.0", items: [{ key: "promptpaySafe", icon: "lock" }] },
  {
    version: "1.22.0",
    items: [
      { key: "trip", icon: "users" },
    ],
  },
  {
    version: "1.21.0",
    items: [
      { key: "promptpay", icon: "qr" },
      { key: "splitMore", icon: "users" },
      { key: "categories", icon: "tag" },
      { key: "slips", icon: "scan" },
      { key: "bills", icon: "repeat" },
      { key: "habits", icon: "gauge" },
    ],
  },
  { version: "1.20.0", items: [{ key: "insightsTabs", icon: "chart" }] },
  { version: "1.19.0", items: [{ key: "settings", icon: "sliders" }] },
  { version: "1.18.0", items: [{ key: "slip", icon: "scan" }] },
  { version: "1.17.0", items: [{ key: "tags", icon: "tag" }, { key: "iOwe", icon: "users" }] },
  {
    version: "1.16.0",
    items: [
      { key: "rollover", icon: "repeat" },
      { key: "calendar", icon: "calendar" },
      { key: "year", icon: "chart" },
    ],
  },
  {
    version: "1.15.0",
    items: [
      { key: "allowance", icon: "gauge" },
      { key: "reminder", icon: "bell" },
      { key: "priceUp", icon: "alert" },
    ],
  },
  { version: "1.14.0", items: [{ key: "keypad", icon: "calc" }] },
];

/** Accounts from before this drawer existed have seen up to here. */
export const BASELINE_VERSION = "1.13.0";
const MAX_ITEMS = 6;

/** -1, 0 or 1 comparing "1.10.0" style versions. */
export function compareVersions(a: string, b: string): number {
  const pa = a.split(".").map(Number);
  const pb = b.split(".").map(Number);
  for (let i = 0; i < 3; i++) {
    const d = (pa[i] ?? 0) - (pb[i] ?? 0);
    if (d) return Math.sign(d);
  }
  return 0;
}

/** Highlights released after `lastSeen` up to the running version, newest first. */
export function newSince(lastSeen: string | undefined, current: string) {
  const seen = lastSeen ?? BASELINE_VERSION;
  return RELEASES.filter((r) => compareVersions(r.version, seen) > 0 && compareVersions(r.version, current) <= 0)
    .flatMap((r) => r.items)
    .slice(0, MAX_ITEMS);
}
