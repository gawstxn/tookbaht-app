"use client"

import { useMemo, useState } from "react"
import { useTranslation } from "react-i18next"
import {
  addDays,
  baht,
  daysInMonth,
  displayYear,
  monthLabel,
  monthNamesShort,
  shortDate,
  todayISO,
  weekdayNamesShort,
} from "@/lib/format"
import type { MonthForecast } from "@/lib/forecast"
import type { Period } from "@/lib/period"
import { compact, dailySpend, netWorthSeries, niceTicks } from "@/lib/insights"
import { useStore } from "@/lib/store"
import { TxRow } from "./app"
import { Card, ListCard, Sheet, cx } from "./ui/primitives"

/** Fill strength per level (share of the busiest day), one hue: light → dark. */
const LEVELS = [0, 18, 32, 46, 60]
const levelOf = (v: number, max: number) => (v <= 0 || max <= 0 ? 0 : Math.min(4, Math.ceil((v / max) * 4)))
const fill = (level: number) =>
  level ? `color-mix(in oklab, var(--color-chart-out) ${LEVELS[level]}%, var(--color-card))` : "var(--color-divider)"

/** A month as a calendar: each day shaded by what was spent; tap a day for its entries. */
export function SpendCalendar({ month }: { month: string }) {
  const { t } = useTranslation()
  const transactions = useStore((s) => s.transactions)
  const spend = useMemo(() => dailySpend(transactions, month), [transactions, month])
  const [day, setDay] = useState<string | null>(null)
  const [y, m] = month.split("-").map(Number)
  const first = new Date(y, m - 1, 1).getDay()
  const days = daysInMonth(y, m - 1)
  const max = Math.max(0, ...Object.values(spend))
  const today = todayISO()
  const dayTxs = useMemo(
    () => (day ? transactions.filter((x) => x.date === day).sort((a, b) => b.createdAt - a.createdAt) : []),
    [transactions, day],
  )

  return (
    <Card className="flex flex-col gap-2.5 px-4 py-3.5">
      <h2 className="text-[15px] font-semibold">{t("insights.calendar", { month: monthLabel(month) })}</h2>
      <div aria-hidden="true" className="grid grid-cols-7 gap-1 text-center text-[11px] text-muted">
        {weekdayNamesShort().map((d) => (
          <span key={d}>{d}</span>
        ))}
      </div>
      <div className="grid grid-cols-7 gap-1">
        {Array.from({ length: first }, (_, i) => (
          <span key={`b${i}`} />
        ))}
        {Array.from({ length: days }, (_, i) => {
          const date = `${month}-${String(i + 1).padStart(2, "0")}`
          const v = spend[date] ?? 0
          return (
            <button
              key={date}
              type="button"
              onClick={() => setDay(date)}
              aria-label={`${shortDate(date)}: ${v ? baht(v) : t("insights.noSpendDay")}`}
              className={cx(
                "flex aspect-square flex-col items-center justify-center rounded-lg text-[12px]",
                date === today && "ring-2 ring-ink ring-inset",
              )}
              style={{ background: fill(levelOf(v, max)) }}
            >
              <span className={date > today ? "text-faint" : "font-medium"}>{i + 1}</span>
            </button>
          )
        })}
      </div>
      <div className="flex items-center justify-end gap-1.5 text-[11px] text-muted" aria-hidden="true">
        {t("insights.less")}
        {LEVELS.map((_, l) => (
          <span key={l} className="h-3 w-3 rounded-[3px]" style={{ background: fill(l) }} />
        ))}
        {t("insights.more")}
      </div>

      <Sheet open={!!day} onClose={() => setDay(null)} title={day ? shortDate(day) : ""}>
        <p className="text-sm text-muted">{t("insights.daySpent", { amount: baht(day ? (spend[day] ?? 0) : 0) })}</p>
        {dayTxs.length ? (
          <ListCard>
            {dayTxs.map((x) => (
              <TxRow key={x.id} t={x} />
            ))}
          </ListCard>
        ) : (
          <p className="text-center text-sm text-muted">{t("insights.noEntriesDay")}</p>
        )}
      </Sheet>
    </Card>
  )
}

/* Line chart geometry (SVG units; scales to the card width). */
const W = 340
const H = 140
const LEFT = 38
const TOP = 10
const BOTTOM = 20

/** Round ticks covering lo..hi (about three steps of 1, 2 or 5 × a power of ten). */
function rangeTicks(lo: number, hi: number): number[] {
  if (hi === lo) hi = lo + 1
  const raw = (hi - lo) / 3
  const pow = 10 ** Math.floor(Math.log10(raw))
  const step = [1, 2, 5, 10].map((k) => k * pow).find((s) => s >= raw)!
  const start = Math.floor(lo / step) * step
  const out: number[] = []
  for (let v = start; v < hi + step; v += step) out.push(v)
  return out
}

/** Net worth at each month end over the last year; tap a point to read it. */
export function NetWorthChart() {
  const { t } = useTranslation()
  const accounts = useStore((s) => s.accounts)
  const transactions = useStore((s) => s.transactions)
  const current = todayISO().slice(0, 7)
  const series = useMemo(() => netWorthSeries(accounts, transactions, current, 12), [accounts, transactions, current])
  const [sel, setSel] = useState(series.length - 1)
  const values = series.map((p) => p.value)
  const ticks = rangeTicks(Math.min(...values), Math.max(...values))
  const lo = ticks[0]
  const hi = ticks[ticks.length - 1]
  const plotH = H - TOP - BOTTOM
  const band = (W - LEFT) / series.length
  const x = (i: number) => LEFT + band * i + band / 2
  const y = (v: number) => TOP + plotH - ((v - lo) / (hi - lo)) * plotH
  const point = series[sel] ?? series[series.length - 1]
  const change = series[series.length - 1].value - series[0].value
  const [py, pm] = point.month.split("-").map(Number)

  return (
    <Card className="flex flex-col gap-2.5 px-4 py-3.5">
      <div className="flex items-start justify-between gap-3">
        <span className="flex flex-col">
          <h2 className="text-[15px] font-semibold">{t("insights.netWorth")}</h2>
          <span className="text-xs text-muted">{t("insights.netWorthHint")}</span>
        </span>
        <span className="flex flex-col items-end">
          <span className="font-mono text-[17px] font-semibold">
            {point.value < 0 ? "−" : ""}
            {baht(Math.abs(point.value))}
          </span>
          <span className="text-xs text-muted">
            {t("insights.endOf", { month: `${monthNamesShort()[pm - 1]} ${displayYear(py)}` })}
          </span>
        </span>
      </div>
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="group" aria-label={t("insights.netWorth")}>
        {ticks.map((v) => (
          <g key={v}>
            <line x1={LEFT} x2={W} y1={y(v)} y2={y(v)} stroke="var(--color-divider)" strokeWidth={1} />
            <text
              x={LEFT - 6}
              y={y(v) + 3.5}
              textAnchor="end"
              fontSize={10}
              fill="var(--color-faint)"
              className="font-mono"
            >
              {v < 0 ? "−" : ""}
              {compact(Math.abs(v))}
            </text>
          </g>
        ))}
        <polyline
          points={series.map((p, i) => `${x(i)},${y(p.value)}`).join(" ")}
          fill="none"
          stroke="var(--color-chart-in)"
          strokeWidth={2}
          strokeLinejoin="round"
          strokeLinecap="round"
        />
        {series.map((p, i) => {
          const [, mm] = p.month.split("-").map(Number)
          const on = i === sel
          return (
            <g
              key={p.month}
              role="button"
              tabIndex={0}
              aria-pressed={on}
              aria-label={`${monthLabel(p.month)}: ${baht(p.value)}`}
              onClick={() => setSel(i)}
              className="cursor-pointer outline-none"
            >
              {/* Hit target: the whole band. */}
              <rect x={LEFT + band * i} y={0} width={band} height={H} fill="transparent" />
              {on ? (
                <line x1={x(i)} x2={x(i)} y1={TOP} y2={TOP + plotH} stroke="var(--color-line-strong)" strokeWidth={1} />
              ) : null}
              {on ? (
                <circle
                  cx={x(i)}
                  cy={y(p.value)}
                  r={4.5}
                  fill="var(--color-chart-in)"
                  stroke="var(--color-card)"
                  strokeWidth={2}
                />
              ) : null}
              {i % 2 === series.length % 2 || on ? (
                <text
                  x={x(i)}
                  y={H - 5}
                  textAnchor="middle"
                  fontSize={10}
                  fontWeight={on ? 600 : 400}
                  fill={on ? "var(--color-ink)" : "var(--color-muted)"}
                >
                  {monthNamesShort()[mm - 1]}
                </text>
              ) : null}
            </g>
          )
        })}
      </svg>
      <p className="border-t border-divider pt-2 text-xs text-muted">
        {t(change >= 0 ? "insights.netWorthUp" : "insights.netWorthDown", { amount: baht(Math.abs(change)) })}
      </p>
      <table className="sr-only">
        <caption>{t("insights.netWorth")}</caption>
        <tbody>
          {series.map((p) => (
            <tr key={p.month}>
              <th scope="row">{monthLabel(p.month)}</th>
              <td>{baht(p.value)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </Card>
  )
}

/** Where this month's spending is heading: the running total so far, then dashed to month end, against the budget. */
export function ForecastCard({ forecast: f, period }: { forecast: MonthForecast; period: Period }) {
  const { t } = useTranslation()
  const days = f.actual.length + f.ahead.length
  const ticks = niceTicks(Math.max(f.projected, f.budget), 3)
  const hi = ticks[ticks.length - 1] || 1
  const plotH = H - TOP - BOTTOM
  const band = (W - LEFT) / days
  const x = (d: number) => LEFT + band * (d - 0.5) // d = day of the user's month (1 = its first day)
  const y = (v: number) => TOP + plotH - (v / hi) * plotH
  const today = f.actual.length
  const over = f.budget > 0 ? f.projected - f.budget : 0
  const line = (vals: number[], from: number) => vals.map((v, i) => `${x(from + i)},${y(v)}`).join(" ")

  return (
    <Card className="flex flex-col gap-2.5 px-4 py-3.5">
      <div className="flex flex-col gap-0.5">
        <h2 className="text-[15px] font-semibold">{t("forecast.title")}</h2>
        <span className="text-xs text-muted">{t("forecast.lead")}</span>
        <span className="font-mono text-[28px] leading-tight font-semibold">{baht(f.projected)}</span>
        {f.budget > 0 ? (
          <span className={cx("text-sm font-semibold", over > 0 ? "text-expense" : "text-income")}>
            {t(over > 0 ? "forecast.over" : "forecast.under", { amount: baht(Math.abs(over)) })}
          </span>
        ) : null}
      </div>
      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="w-full"
        role="img"
        aria-label={t("forecast.chartLabel", { amount: baht(f.projected) })}
      >
        {ticks.map((v) => (
          <g key={v}>
            <line x1={LEFT} x2={W} y1={y(v)} y2={y(v)} stroke="var(--color-divider)" strokeWidth={1} />
            <text
              x={LEFT - 6}
              y={y(v) + 3.5}
              textAnchor="end"
              fontSize={10}
              fill="var(--color-faint)"
              className="font-mono"
            >
              {compact(v)}
            </text>
          </g>
        ))}
        {f.budget > 0 ? (
          <g>
            <line
              x1={LEFT}
              x2={W}
              y1={y(f.budget)}
              y2={y(f.budget)}
              stroke="var(--color-muted)"
              strokeWidth={1.5}
              strokeDasharray="2 3"
            />
            <text x={W} y={y(f.budget) - 4} textAnchor="end" fontSize={10} fill="var(--color-muted)">
              {t("forecast.budget")}
            </text>
          </g>
        ) : null}
        <polyline
          points={line([f.actual[today - 1], ...f.ahead], today)}
          fill="none"
          stroke={over > 0 ? "var(--color-expense)" : "var(--color-chart-out)"}
          strokeWidth={2}
          strokeDasharray="4 4"
          strokeLinecap="round"
          opacity={0.7}
        />
        <polyline
          points={line(f.actual, 1)}
          fill="none"
          stroke="var(--color-chart-out)"
          strokeWidth={2}
          strokeLinejoin="round"
          strokeLinecap="round"
        />
        <circle
          cx={x(today)}
          cy={y(f.actual[today - 1])}
          r={4}
          fill="var(--color-chart-out)"
          stroke="var(--color-card)"
          strokeWidth={2}
        />
        {[1, today, days]
          .filter((d, i, a) => a.indexOf(d) === i && (d === today || Math.abs(d - today) > 4))
          .map((d) => (
            <text
              key={d}
              x={x(d)}
              y={H - 5}
              textAnchor={d === 1 ? "start" : d === days ? "end" : "middle"}
              fontSize={10}
              fontWeight={d === today ? 600 : 400}
              fill={d === today ? "var(--color-ink)" : "var(--color-muted)"}
            >
              {d === today ? t("forecast.today") : shortDate(addDays(period.start, d - 1), false)}
            </text>
          ))}
      </svg>
      <dl className="flex flex-col gap-1 border-t border-divider pt-2 text-xs">
        <div className="flex justify-between gap-3">
          <dt className="text-muted">{t("forecast.spent")}</dt>
          <dd className="font-mono">{baht(f.spent)}</dd>
        </div>
        {f.scheduled > 0 ? (
          <div className="flex justify-between gap-3">
            <dt className="text-muted">{t("forecast.bills")}</dt>
            <dd className="font-mono">{baht(f.scheduled)}</dd>
          </div>
        ) : null}
        {f.daysLeft > 0 ? (
          <div className="flex justify-between gap-3">
            <dt className="text-muted">{t("forecast.daily", { amount: baht(f.perDay), count: f.daysLeft })}</dt>
            <dd className="font-mono">{baht(f.perDay * f.daysLeft)}</dd>
          </div>
        ) : null}
      </dl>
    </Card>
  )
}
