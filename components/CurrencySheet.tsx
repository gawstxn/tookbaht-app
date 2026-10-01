"use client"

import { useTranslation } from "react-i18next"
import { FX_CURRENCIES, currencySymbol, type FxCurrency } from "@/lib/currencies"
import { Sheet, cx } from "./ui/primitives"

/** Baht or one of the trip currencies; "" is baht. */
export function CurrencySheet({
  open,
  onClose,
  title,
  value,
  onPick,
}: {
  open: boolean
  onClose: () => void
  title: string
  value: FxCurrency | ""
  onPick: (c: FxCurrency | "") => void
}) {
  const { t } = useTranslation()
  const options: (FxCurrency | "")[] = ["", ...FX_CURRENCIES]
  return (
    <Sheet open={open} onClose={onClose} title={title}>
      <div
        role="radiogroup"
        aria-label={title}
        className="flex flex-col rounded-[20px] border border-line bg-card px-4 py-0.5"
      >
        {options.map((c, i) => {
          const on = c === value
          return (
            <button
              key={c || "THB"}
              type="button"
              role="radio"
              aria-checked={on}
              onClick={() => {
                onPick(c)
                onClose()
              }}
              className={cx(
                "flex min-h-[52px] items-center gap-3 text-left",
                i < options.length - 1 && "border-b border-divider",
              )}
            >
              <span className="flex h-9 w-12 shrink-0 items-center justify-center rounded-xl bg-chip font-mono text-[13px] font-semibold">
                {c ? currencySymbol(c).trim() : "฿"}
              </span>
              <span className="flex grow flex-col">
                <span className="text-[15px] font-medium">{t(`currency.${c || "THB"}`)}</span>
                <span className="text-xs text-muted">{c || "THB"}</span>
              </span>
              <span
                aria-hidden="true"
                className="box-border h-[22px] w-[22px] shrink-0 rounded-full"
                style={
                  on
                    ? { border: "7px solid var(--color-ink)", background: "var(--color-lime)" }
                    : { border: "2px solid var(--color-switch-off)", background: "var(--color-card)" }
                }
              />
            </button>
          )
        })}
      </div>
    </Sheet>
  )
}
