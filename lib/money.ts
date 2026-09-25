/** Baht formatting. No i18n dependency, so server code (cron route) can use it. */

const nf0 = new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 });
const nf2 = new Intl.NumberFormat("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

/** ฿1,234 (whole baht) */
export function baht(n: number): string {
  return "฿" + nf0.format(Math.round(n));
}
/** ฿1,234.50 */
export function baht2(n: number): string {
  return "฿" + nf2.format(n);
}
export function num(n: number): string {
  return nf0.format(Math.round(n));
}
export function splitDecimals(n: number): [string, string] {
  const [i, d] = nf2.format(n).split(".");
  return ["฿" + i, "." + d];
}
