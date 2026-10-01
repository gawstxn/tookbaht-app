"use client"

import { useState } from "react"
import { useTranslation } from "react-i18next"
import { todayISO } from "@/lib/format"
import { periodOf, periodRange } from "@/lib/period"
import { PrimaryButton, Sheet, cx } from "./ui/primitives"

const DAYS = Array.from({ length: 31 }, (_, i) => i + 1)

/** Pick the day the user's month starts (payday), with the current month's dates as a preview. */
export function CycleDaySheet({
  open,
  value,
  onClose,
  onSave,
}: {
  open: boolean
  value: number
  onClose: () => void
  onSave: (day: number) => void
}) {
  const { t } = useTranslation()
  return (
    <Sheet open={open} onClose={onClose} title={t("payCycle.title")}>
      {/* Remounted on open and close, so the draft starts from the saved day and the sheet never empties while it slides away. */}
      <Picker key={open ? "open" : "closed"} value={value} onSave={onSave} />
    </Sheet>
  )
}

function Picker({ value, onSave }: { value: number; onSave: (day: number) => void }) {
  const { t } = useTranslation()
  const [day, setDay] = useState(value)
  const preview = periodOf(todayISO(), day)
  return (
    <>
      <p className="text-sm text-muted">{t("payCycle.lead")}</p>
      <div role="radiogroup" aria-label={t("payCycle.title")} className="grid grid-cols-7 gap-1.5">
        {DAYS.map((d) => (
          <button
            key={d}
            type="button"
            role="radio"
            aria-checked={d === day}
            onClick={() => setDay(d)}
            className={cx(
              "flex aspect-square items-center justify-center rounded-xl border font-mono text-sm",
              d === day ? "border-ink bg-ink font-semibold text-on-ink" : "border-line bg-card",
            )}
          >
            {d}
          </button>
        ))}
      </div>
      <p className="rounded-2xl border border-line bg-card px-3 py-2.5 text-center text-sm">
        {t("payCycle.preview", { range: periodRange(preview) })}
        {day > 28 ? <span className="mt-0.5 block text-xs text-muted">{t("payCycle.shortMonths")}</span> : null}
      </p>
      <PrimaryButton disabled={day === value} onClick={() => onSave(day)}>
        {t("common.save")}
      </PrimaryButton>
    </>
  )
}
