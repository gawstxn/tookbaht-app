/**
 * PromptPay "Thai QR" payloads (EMVCo merchant-presented QR, as issued by the
 * Bank of Thailand): a phone number, a 13-digit national / tax ID or a 15-digit
 * e-wallet ID, optionally with a fixed amount.
 */

export type PromptPayKind = "phone" | "id" | "ewallet";

/** Digits only; "081-234-5678" → "0812345678", "+66 81 234 5678" → "66812345678". */
const digits = (s: string) => s.replace(/\D/g, "");

/** What kind of PromptPay ID this is, or null when it isn't one. */
export function promptPayKind(raw: string): PromptPayKind | null {
  const d = digits(raw);
  if (/^0[689]\d{8}$/.test(d) || /^66[689]\d{8}$/.test(d)) return "phone";
  if (d.length === 13) return "id";
  if (d.length === 15) return "ewallet";
  return null;
}

/** "0812345678" → "081-234-5678"; IDs are grouped 1-4-5-2-1 like the Thai ID card. */
export function formatPromptPayId(raw: string): string {
  const d = digits(raw);
  const kind = promptPayKind(d);
  if (kind === "phone") {
    const local = d.startsWith("66") ? `0${d.slice(2)}` : d;
    return `${local.slice(0, 3)}-${local.slice(3, 6)}-${local.slice(6)}`;
  }
  if (kind === "id") return `${d[0]}-${d.slice(1, 5)}-${d.slice(5, 10)}-${d.slice(10, 12)}-${d[12]}`;
  return d;
}

const field = (id: string, value: string) => `${id}${String(value.length).padStart(2, "0")}${value}`;

/** CRC-16/CCITT-FALSE (poly 0x1021, init 0xFFFF), as uppercase hex. */
export function crc16(s: string): string {
  let crc = 0xffff;
  for (const byte of new TextEncoder().encode(s)) {
    crc ^= byte << 8;
    for (let i = 0; i < 8; i++) crc = crc & 0x8000 ? ((crc << 1) ^ 0x1021) & 0xffff : (crc << 1) & 0xffff;
  }
  return crc.toString(16).toUpperCase().padStart(4, "0");
}

/** The text to encode in the QR; null when the ID isn't a PromptPay ID. */
export function promptPayPayload(rawId: string, amount?: number): string | null {
  const kind = promptPayKind(rawId);
  if (!kind) return null;
  const d = digits(rawId);
  const target =
    kind === "phone"
      ? field("01", `0066${(d.startsWith("66") ? d.slice(2) : d.slice(1)).padStart(9, "0")}`)
      : kind === "id"
        ? field("02", d)
        : field("03", d);
  const hasAmount = amount !== undefined && amount > 0;
  const body = [
    field("00", "01"),
    // 11 = reusable QR; 12 = one-off QR with an amount.
    field("01", hasAmount ? "12" : "11"),
    field("29", field("00", "A000000677010111") + target),
    field("58", "TH"),
    field("53", "764"),
    ...(hasAmount ? [field("54", amount.toFixed(2))] : []),
  ].join("");
  const withCrcTag = `${body}6304`;
  return withCrcTag + crc16(withCrcTag);
}
