"use client"

import { useMemo, useState } from "react"
import { useTranslation } from "react-i18next"
import { PushScreen, TxIcon } from "@/components/app"
import { Card, Chip, Empty, HeroCard, ListCard, PushHeader } from "@/components/ui/primitives"
import { categoryLabel } from "@/lib/constants"
import { baht, displayYear, monthLabel, shortDate, todayISO } from "@/lib/format"
import { yearSummary, yearsWithData } from "@/lib/insights"
import { useGoBack } from "@/lib/nav"
import { useStore } from "@/lib/store"
import { txTitle } from "@/lib/txTitle"

/** A calendar year at a glance: totals, the months that went best and worst, where the money went. */
export default function YearPage() {
  const { t } = useTranslation()
  const goBack = useGoBack("/insights")
  const transactions = useStore((s) => s.transactions)
  const accounts = useStore((s) => s.accounts)
  const years = useMemo(() => yearsWithData(transactions), [transactions])
  const [year, setYear] = useState(() => Number(todayISO().slice(0, 4)))
  const y = useMemo(() => yearSummary(transactions, year), [transactions, year])
  const top = y.topCategories[0]?.amount ?? 0

  return (
    <PushScreen>
      <PushHeader title={t("year.title", { year: displayYear(year) })} onBack={goBack} />

      {years.length > 1 ? (
        <div className="flex flex-wrap gap-1.5">
          {years.map((yy) => (
            <Chip key={yy} size="sm" on={yy === year} onClick={() => setYear(yy)}>
              {displayYear(yy)}
            </Chip>
          ))}
        </div>
      ) : null}

      {!y.entries ? (
        <Empty>{t("year.empty")}</Empty>
      ) : (
        <>
          <HeroCard label={t("year.title", { year: displayYear(year) })}>
            <div className="flex flex-col gap-1">
              <span className="text-[13px] text-on-ink-muted">{t(y.net >= 0 ? "year.saved" : "year.short")}</span>
              <span className="font-mono text-4xl leading-tight font-semibold tracking-tight">
                {baht(Math.abs(y.net))}
              </span>
              {y.savingRate !== null && y.net > 0 ? (
                <span className="text-xs text-lime">{t("year.rate", { pct: Math.round(y.savingRate * 100) })}</span>
              ) : null}
            </div>
            <div className="grid grid-cols-2 gap-2.5 border-t border-ink-line pt-3 text-xs text-on-ink-muted">
              <span className="flex flex-col gap-0.5">
                {t("type.in")}
                <span className="font-mono text-[17px] font-semibold text-on-hero">+{baht(y.income)}</span>
              </span>
              <span className="flex flex-col gap-0.5">
                {t("type.out")}
                <span className="font-mono text-[17px] font-semibold text-on-hero">−{baht(y.expense)}</span>
              </span>
            </div>
          </HeroCard>

          <div className="grid grid-cols-2 gap-2.5">
            {y.bestMonth ? (
              <Tile
                label={t("year.best")}
                value={monthLabel(y.bestMonth.month)}
                detail={t("year.leftOver", { amount: signed(y.bestMonth.income - y.bestMonth.expense) })}
              />
            ) : null}
            {y.worstMonth ? (
              <Tile
                label={t("year.worst")}
                value={monthLabel(y.worstMonth.month)}
                detail={t("year.leftOver", { amount: signed(y.worstMonth.income - y.worstMonth.expense) })}
              />
            ) : null}
            <Tile label={t("year.automatic")} value={baht(y.automatic)} detail={t("year.automaticHint")} />
            <Tile label={t("year.entries")} value={String(y.entries)} detail={t("year.entriesHint")} />
          </div>

          {y.topCategories.length ? (
            <section className="flex flex-col gap-2">
              <h2 className="text-base font-semibold">{t("year.topCategories")}</h2>
              <Card className="flex flex-col gap-3 px-4 py-3.5">
                {y.topCategories.map((c) => (
                  <div key={c.key} className="flex flex-col gap-1.5">
                    <div className="flex items-baseline justify-between gap-3 text-sm">
                      <span>{categoryLabel(c.key)}</span>
                      <span className="font-mono font-semibold">{baht(c.amount)}</span>
                    </div>
                    <div className="h-1.5 overflow-hidden rounded-full bg-divider">
                      <div
                        className="h-full rounded-full"
                        style={{ width: `${(c.amount / top) * 100}%`, background: "var(--color-chart-out)" }}
                      />
                    </div>
                  </div>
                ))}
              </Card>
            </section>
          ) : null}

          {y.biggest ? (
            <section className="flex flex-col gap-2">
              <h2 className="text-base font-semibold">{t("year.biggest")}</h2>
              <ListCard>
                <div className="flex min-h-[60px] items-center gap-3">
                  <TxIcon type={y.biggest.type} category={y.biggest.category} />
                  <span className="flex min-w-0 grow flex-col">
                    <span className="truncate text-[15px] font-medium">{txTitle(y.biggest, accounts)}</span>
                    <span className="text-xs text-muted">{shortDate(y.biggest.date)}</span>
                  </span>
                  <span className="font-mono text-[15px] font-semibold">{baht(y.biggest.amount)}</span>
                </div>
              </ListCard>
            </section>
          ) : null}
        </>
      )}
    </PushScreen>
  )
}

/** "−฿129" rather than "฿-129". */
const signed = (n: number) => `${n < 0 ? "−" : ""}${baht(Math.abs(n))}`

function Tile({ label, value, detail }: { label: string; value: string; detail: string }) {
  return (
    <Card className="flex flex-col gap-0.5 px-3.5 py-3">
      <span className="text-xs text-muted">{label}</span>
      <span className="truncate text-[15px] font-semibold">{value}</span>
      <span className="text-[11px] text-faint">{detail}</span>
    </Card>
  )
}
