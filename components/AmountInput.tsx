import { Card } from "@/components/ui/primitives";

/** Keep digits and one dot with up to two decimals ("12.345" → "12.34"). */
export function cleanAmount(text: string): string {
  const [int, ...rest] = text.replace(/[^0-9.]/g, "").split(".");
  const dec = rest.join("").slice(0, 2);
  return (int.slice(0, 9) || (rest.length ? "0" : "")) + (rest.length ? "." + dec : "");
}

/** Baht amount card with the system number pad (sheets and forms; the add screen has its own keypad). */
export function AmountInput({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <Card className="px-4 py-3">
      <label className="flex items-baseline gap-2">
        <span className="shrink-0 text-[13px] text-muted">{label}</span>
        <span className="flex grow items-baseline gap-0.5 font-mono text-[26px] font-semibold">
          ฿
          <input
            inputMode="decimal"
            value={value}
            onChange={(e) => onChange(cleanAmount(e.target.value))}
            placeholder="0"
            className="w-full min-w-0 bg-transparent outline-none"
          />
        </span>
      </label>
    </Card>
  );
}
