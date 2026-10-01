"use client"

import { useState } from "react"
import { useTranslation } from "react-i18next"
import { PushScreen, TxRow } from "@/components/app"
import { TxDetailSheet } from "@/components/TxDetailSheet"
import { Icon } from "@/components/ui/Icon"
import { Bar, Card, Chip, Empty, HeroCard, ListCard, PushHeader, Sheet } from "@/components/ui/primitives"
import { baht, displayYear, todayISO } from "@/lib/format"
import { useGoBack } from "@/lib/nav"
import { useStore } from "@/lib/store"
import { LIFE_HEALTH_CAP, taxYear, taxYears, type TaxLine, type TaxType } from "@/lib/tax"
import type { Transaction } from "@/lib/types"

/** Expenses marked as tax deductions, totalled per kind for a tax (calendar) year. */
export default function TaxPage() {
  const { t } = useTranslation()
  const goBack = useGoBack("/insights")
  const transactions = useStore((s) => s.transactions)
  const current = todayISO().slice(0, 4)
  const years = taxYears(transactions, current)
  const [year, setYear] = useState(current)
  const { lines, total, lifeHealthOver } = taxYear(transactions, year)
  const [open, setOpen] = useState<TaxType | null>(null)
  const [selected, setSelected] = useState<Transaction | null>(null)
  const line = lines.find((l) => l.key === open) ?? null

  return (
    <PushScreen>
      <PushHeader title={t("tax.title")} onBack={goBack} />

      {years.length > 1 ? (
        <div className="flex flex-wrap gap-2">
          {years.map((y) => (
            <Chip key={y} size="sm" on={y === year} onClick={() => setYear(y)}>
              {t("tax.yearChip", { year: displayYear(Number(y)) })}
            </Chip>
          ))}
        </div>
      ) : null}

      <HeroCard label={t("tax.title")}>
        <div className="flex flex-col gap-1">
          <span className="text-[13px] text-on-ink-muted">{t("tax.totalIn", { year: displayYear(Number(year)) })}</span>
          <span className="font-mono text-4xl leading-tight font-semibold tracking-tight">{baht(total)}</span>
        </div>
        <span className="text-xs text-on-ink-muted">{t("tax.fileBy", { year: displayYear(Number(year) + 1) })}</span>
      </HeroCard>

      {lines.length ? (
        <div className="flex flex-col gap-2.5">
          {lines.map((l) => (
            <LineCard key={l.key} line={l} onOpen={() => setOpen(l.key)} />
          ))}
        </div>
      ) : (
        <Empty>{t("tax.empty")}</Empty>
      )}

      {lifeHealthOver > 0 ? (
        <p
          className="flex items-start gap-2 rounded-2xl bg-warn-tint px-3.5 py-3 text-xs leading-relaxed"
          style={{ color: "var(--color-warn-ink)" }}
        >
          <Icon name="alert" size={16} strokeWidth={2} className="mt-px shrink-0" />
          {t("tax.lifeHealthOver", { cap: baht(LIFE_HEALTH_CAP), amount: baht(lifeHealthOver) })}
        </p>
      ) : null}

      <p className="flex items-start gap-2 text-xs leading-relaxed text-muted">
        <Icon name="alert" size={16} strokeWidth={2} className="mt-px shrink-0" />
        {t("tax.disclaimer")}
      </p>

      <Sheet open={!!line && !selected} onClose={() => setOpen(null)} title={line ? t(`tax.type.${line.key}`) : ""}>
        {line ? (
          <ListCard>
            {line.items.map((x) => (
              <TxRow key={x.id} t={x} onClick={() => setSelected(x)} />
            ))}
          </ListCard>
        ) : null}
      </Sheet>
      <TxDetailSheet tx={selected} onClose={() => setSelected(null)} />
    </PushScreen>
  )
}

function LineCard({ line, onOpen }: { line: TaxLine; onOpen: () => void }) {
  const { t } = useTranslation()
  const over = line.cap ? line.amount - line.cap : 0
  return (
    <button type="button" onClick={onOpen} className="text-left">
      <Card className="flex flex-col gap-2 px-4 py-3.5">
        <div className="flex items-baseline justify-between gap-3">
          <span className="text-[15px] font-semibold">{t(`tax.type.${line.key}`)}</span>
          <span className="font-mono text-[15px] font-semibold">{baht(line.amount)}</span>
        </div>
        {line.cap ? (
          <>
            <Bar
              value={Math.min(1, line.amount / line.cap)}
              height={6}
              track="var(--color-divider)"
              color={over > 0 ? "var(--color-warn-ink)" : "var(--color-income)"}
            />
            <span className="text-xs text-muted">
              {over > 0
                ? t("tax.overCap", { cap: baht(line.cap), amount: baht(over) })
                : t("tax.roomLeft", { cap: baht(line.cap), amount: baht(line.cap - line.amount) })}
            </span>
          </>
        ) : (
          <span className="text-xs leading-relaxed text-muted">{t(`tax.rule.${line.key}`)}</span>
        )}
        <span className="flex items-center gap-1 text-xs text-faint">
          {t("tax.entries", { count: line.items.length })}
          <Icon name="chevronRight" size={12} strokeWidth={2} />
        </span>
      </Card>
    </button>
  )
}
