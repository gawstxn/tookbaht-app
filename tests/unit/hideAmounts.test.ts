import { afterEach, describe, expect, it } from "vitest";
import { amountsHidden, setAmountsHidden } from "@/lib/hideAmounts";
import { formatForeign } from "@/lib/currencies";
import { formatMoney } from "@/lib/fx";
import { compact } from "@/lib/insights";
import { baht, baht2, baht2Exact, splitDecimals } from "@/lib/money";

describe("hide amounts", () => {
  afterEach(() => setAmountsHidden(false));

  it("shows amounts by default", () => {
    expect(amountsHidden()).toBe(false);
    expect(baht(1234)).toBe("฿1,234");
  });

  it("masks every formatted amount while hidden", () => {
    setAmountsHidden(true);
    expect(baht(1234)).toBe("฿•••");
    expect(baht2(-50.5)).toBe("฿•••");
    expect(splitDecimals(21930)).toEqual(["฿•••", ""]);
    expect(formatMoney(21.4, "USD")).toBe("US$•••");
    expect(formatMoney(149, "THB", true)).toBe("฿•••");
    expect(compact(45000)).toBe("•••");
    expect(formatForeign(3000, "JPY")).toBe("¥•••");
    expect(compact(0)).toBe("0");
  });

  it("keeps exact amounts for text that leaves the app", () => {
    setAmountsHidden(true);
    expect(baht2Exact(1234.5)).toBe("฿1,234.50");
  });

  it("shows amounts again when turned off", () => {
    setAmountsHidden(true);
    setAmountsHidden(false);
    expect(baht2(1234.5)).toBe("฿1,234.50");
  });
});
