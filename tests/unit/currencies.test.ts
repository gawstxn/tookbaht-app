import { describe, expect, it } from "vitest";
import { formatForeign, fxToBaht, isFxCurrency } from "@/lib/currencies";

describe("trip currencies", () => {
  it("formats with the currency's symbol and decimals", () => {
    expect(formatForeign(3000, "JPY")).toBe("¥3,000");
    expect(formatForeign(45000.4, "KRW")).toBe("₩45,000");
    expect(formatForeign(12.5, "EUR")).toBe("€12.50");
    expect(formatForeign(21.4, "USD")).toBe("US$21.40");
  });

  it("converts to baht at the rate plus the card fee, to the satang", () => {
    expect(fxToBaht(3000, 0.21398)).toBe(641.94);
    expect(fxToBaht(3000, 0.21398, 2.5)).toBe(657.99);
    expect(fxToBaht(45000, 0.02461)).toBe(1107.45);
  });

  it("knows which currencies have a published rate", () => {
    expect(isFxCurrency("JPY")).toBe(true);
    expect(isFxCurrency("THB")).toBe(false);
    expect(isFxCurrency("VND")).toBe(false);
  });
});
