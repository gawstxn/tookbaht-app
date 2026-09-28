/** Baht formatting. No i18n dependency, so server code (cron route) can use it. */

const nf0 = new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 });
const nf2 = new Intl.NumberFormat("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

/** What an amount shows as while amounts are hidden. */
export const MASK = "•••";
let masked = false;

/** Hide or show every amount these helpers format (see lib/hideAmounts.ts). */
export function setMasked(on: boolean) {
  masked = on;
}
export function isMasked() {
  return masked;
}

/** ฿1,234 (whole baht) */
export function baht(n: number): string {
  if (masked) return "฿" + MASK;
  return "฿" + nf0.format(Math.round(n));
}
/** ฿1,234.50 */
export function baht2(n: number): string {
  return masked ? "฿" + MASK : baht2Exact(n);
}
/** ฿1,234.50 even while amounts are hidden: for text that leaves the app (share, copy). */
export function baht2Exact(n: number): string {
  return "฿" + nf2.format(n);
}
export function num(n: number): string {
  return nf0.format(Math.round(n));
}
export function splitDecimals(n: number): [string, string] {
  if (masked) return ["฿" + MASK, ""];
  const [i, d] = nf2.format(n).split(".");
  return ["฿" + i, "." + d];
}
