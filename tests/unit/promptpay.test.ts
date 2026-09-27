import { describe, expect, it } from "vitest";
import { crc16, formatPromptPayId, maskPromptPayId, promptPayKind, promptPayPayload } from "@/lib/promptpay";
import { encodeQr } from "@/lib/qr";

describe("PromptPay payload", () => {
  it("uses CRC-16/CCITT-FALSE", () => {
    expect(crc16("123456789")).toBe("29B1");
  });

  it("builds the EMVCo fields for a phone number", () => {
    const p = promptPayPayload("080-123-4567")!;
    expect(p.slice(0, -4)).toBe("00020101021129370016A000000677010111011300668012345675802TH53037646304");
    expect(p.slice(-4)).toBe(crc16(p.slice(0, -4)));
    // An amount makes it a one-off QR (01 = 12) with field 54.
    expect(promptPayPayload("0801234567", 4.22)).toMatch(/^000201010212.*5802TH530376454044\.226304[0-9A-F]{4}$/);
  });

  it("encodes national IDs and e-wallets", () => {
    expect(promptPayPayload("1-1111-11111-11-1")).toContain("0213" + "1111111111111");
    expect(promptPayPayload("123456789012345")).toContain("0315123456789012345");
  });

  it("recognises and formats IDs", () => {
    expect(promptPayKind("081-234-5678")).toBe("phone");
    expect(promptPayKind("+66 81 234 5678")).toBe("phone");
    expect(promptPayKind("1234567890123")).toBe("id");
    expect(promptPayKind("12345")).toBeNull();
    expect(promptPayPayload("12345")).toBeNull();
    expect(formatPromptPayId("0812345678")).toBe("081-234-5678");
    expect(formatPromptPayId("1234567890123")).toBe("1-2345-67890-12-3");
  });
});

describe("masking the ID for display", () => {
  it("keeps only the start and the last digits", () => {
    expect(maskPromptPayId("0987654321")).toBe("098-•••-4321");
    expect(maskPromptPayId("+66 98 765 4321")).toBe("098-•••-4321");
    expect(maskPromptPayId("1234567890123")).toBe("1-••••-•••••-12-3");
    expect(maskPromptPayId("123456789012345")).toBe("123•••2345");
  });
});

describe("QR encoder", () => {
  it("picks the smallest version that fits", () => {
    expect(encodeQr("HELLO")).toHaveLength(21);
    // A PromptPay payload with an amount (85 bytes) needs version 6 at level M.
    expect(encodeQr(promptPayPayload("0812345678", 1234.5)!)).toHaveLength(41);
  });

  it("draws the three finder patterns", () => {
    const g = encodeQr("https://tookbaht.gawstxn.dev");
    const n = g.length;
    for (const [x, y] of [[0, 0], [n - 7, 0], [0, n - 7]]) {
      expect(g[y][x]).toBe(true);
      expect(g[y + 1][x + 1]).toBe(false);
      expect(g[y + 3][x + 3]).toBe(true);
    }
  });
});
