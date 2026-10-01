import { Icon } from "@/components/ui/Icon"
import { Card } from "@/components/ui/primitives"

const toNum = (s: string) => parseInt(s.replace(/[^0-9]/g, ""), 10) || 0
const fmt = (n: number) => (n ? n.toLocaleString("en-US") : "")

/** Whole-baht amount card for monthly goals (income target, spending budget). */
export function MoneyField({
  label,
  icon,
  color,
  value,
  onChange,
}: {
  label: string
  icon: "in" | "out"
  color: string
  value: number
  onChange: (n: number) => void
}) {
  return (
    <Card className="px-3.5 py-3">
      <label className="flex flex-col gap-1">
        <span className="flex items-center gap-1.5 text-xs font-semibold" style={{ color }}>
          <Icon name={icon} size={14} strokeWidth={2.2} />
          {label}
        </span>
        <span className="flex items-baseline gap-0.5 font-mono text-[22px] font-semibold">
          ฿
          <input
            inputMode="numeric"
            value={fmt(value)}
            placeholder="0"
            onChange={(e) => onChange(toNum(e.target.value))}
            className="min-h-8 w-full min-w-0 bg-transparent outline-none"
          />
        </span>
      </label>
    </Card>
  )
}
