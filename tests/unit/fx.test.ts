import { describe, expect, it } from "vitest";
import { formatMoney, impliedFeePct, toTHB } from "@/lib/fx";

const rate = { rate: 33.48, date: "2026-09-25" };

describe("foreign currency", () => {
  it("formats USD and THB", () => {
    expect(formatMoney(21.4, "USD")).toBe("US$21.40");
    expect(formatMoney(149, "THB")).toBe("฿149");
    expect(formatMoney(149, "THB", true)).toBe("฿149.00");
  });

  it("converts USD with the rate and the card's fee", () => {
    expect(toTHB(21.4, "USD", rate, { fxFeePct: 2.5 })).toBeCloseTo(21.4 * 33.48 * 1.025, 6);
    expect(toTHB(21.4, "USD", rate)).toBeCloseTo(21.4 * 33.48, 6);
  });

  it("returns baht as is, and nothing for USD until a rate is known", () => {
    expect(toTHB(419, "THB", null)).toBe(419);
    expect(toTHB(21.4, "USD", null)).toBeNull();
  });

  it("learns a card's fee from a statement amount, within 0–10%", () => {
    expect(impliedFeePct(21.4 * 33.48 * 1.025, 21.4, 33.48)).toBe(2.5);
    expect(impliedFeePct(1, 21.4, 33.48)).toBe(0);
    expect(impliedFeePct(10_000, 21.4, 33.48)).toBe(10);
  });
});
