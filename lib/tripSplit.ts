/**
 * Settling up a trip: several bills, each paid by one person and shared by
 * some of the group. Works in satang so the totals always balance.
 */

/** The user, among the friends' names. */
export const ME = "@me";

export interface TripBill {
  id: string;
  title: string;
  amount: number;
  /** ME or a friend's name. */
  payer: string;
  /** Who shares it (evenly). */
  people: string[];
}

export interface Transfer {
  from: string;
  to: string;
  amount: number;
}

const satang = (n: number) => Math.round(n * 100);

/**
 * Each person's share of every bill. A bill's leftover satang go to the
 * first people listed (payer first when they share it), so shares add up
 * exactly to the bill.
 */
export function tripShares(bills: TripBill[]): Map<string, number> {
  const owed = new Map<string, number>();
  for (const b of bills) {
    if (!b.people.length || b.amount <= 0) continue;
    const people = b.people.includes(b.payer) ? [b.payer, ...b.people.filter((p) => p !== b.payer)] : b.people;
    const total = satang(b.amount);
    const base = Math.floor(total / people.length);
    let extra = total - base * people.length;
    for (const p of people) {
      owed.set(p, (owed.get(p) ?? 0) + base + (extra > 0 ? 1 : 0));
      extra--;
    }
  }
  return owed;
}

/** What each person paid minus their share, in satang: positive = is owed money. */
export function tripBalances(bills: TripBill[]): Map<string, number> {
  const net = new Map<string, number>();
  for (const b of bills) if (b.people.length && b.amount > 0) net.set(b.payer, (net.get(b.payer) ?? 0) + satang(b.amount));
  for (const [p, share] of tripShares(bills)) net.set(p, (net.get(p) ?? 0) - share);
  return net;
}

/**
 * Who pays whom so everyone is square, with few transfers: the biggest
 * debtor pays the biggest creditor, repeatedly. Amounts in baht.
 */
export function settleUp(bills: TripBill[]): Transfer[] {
  const net = [...tripBalances(bills)].filter(([, v]) => v !== 0);
  const order = (a: [string, number], b: [string, number]) => Math.abs(b[1]) - Math.abs(a[1]) || a[0].localeCompare(b[0]);
  const debtors = net.filter(([, v]) => v < 0).map(([p, v]) => [p, -v] as [string, number]).sort(order);
  const creditors = net.filter(([, v]) => v > 0).sort(order);
  const out: Transfer[] = [];
  while (debtors.length && creditors.length) {
    const d = debtors[0];
    const c = creditors[0];
    const amount = Math.min(d[1], c[1]);
    out.push({ from: d[0], to: c[0], amount: amount / 100 });
    d[1] -= amount;
    c[1] -= amount;
    if (d[1] === 0) debtors.shift();
    if (c[1] === 0) creditors.shift();
    debtors.sort(order);
    creditors.sort(order);
  }
  return out;
}

/** Unsaved trip splits are kept per device under this prefix (see app/tags/split). */
export const TRIP_DRAFT_PREFIX = "tookbaht-trip-";

/** Drop every unsaved trip split on this device (on sign-out). */
export function clearTripDrafts() {
  try {
    for (const key of Object.keys(localStorage)) if (key.startsWith(TRIP_DRAFT_PREFIX)) localStorage.removeItem(key);
  } catch {
    // Storage unavailable: nothing was kept.
  }
}

/** Plain-text summary to send to the group chat. */
export function settleText(tag: string, transfers: Transfer[], meLabel: string, line: (t: { from: string; to: string; amount: string }) => string, money: (n: number) => string): string {
  const name = (p: string) => (p === ME ? meLabel : p);
  return [tag, ...transfers.map((t) => line({ from: name(t.from), to: name(t.to), amount: money(t.amount) }))].join("\n");
}
