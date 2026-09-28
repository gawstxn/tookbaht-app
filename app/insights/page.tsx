"use client";

import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import Link from "next/link";
import { PushScreen } from "@/components/app";
import { ForecastCard, NetWorthChart, SpendCalendar } from "@/components/insightCharts";
import { Icon } from "@/components/ui/Icon";
import { Card, Empty, PushHeader, Segmented } from "@/components/ui/primitives";
import { categoryLabel } from "@/lib/constants";
import { baht, displayYear, monthKey, monthLabel, monthNamesShort, todayISO } from "@/lib/format";
import { categoryBreakdown, compact, monthlySeries, niceTicks, yearSummary } from "@/lib/insights";
import { runway, unusualCategories } from "@/lib/habits";
import { installmentOutlook } from "@/lib/installments";
import { monthForecast } from "@/lib/forecast";
import { taxYear } from "@/lib/tax";
import { subTHB } from "@/lib/fx";
import { tagSummaries } from "@/lib/tags";
import { useStore } from "@/lib/store";

type Tab = "month" | "overview";
const TAB_KEY = "tookbaht-insights-tab";
/** The tab last used on this device (a per-device convenience). */
const readTab = (): Tab => {
  try {
    return localStorage.getItem(TAB_KEY) === "overview" ? "overview" : "month";
  } catch {
    return "month";
  }
};

/* Chart geometry (SVG units; the SVG scales to the card width). */
const W = 340;
const H = 168;
const LEFT = 34; // y-axis labels
const TOP = 8;
const BOTTOM = 22; // month labels
const BAR = 16; // column thickness (<= 24)
const GAP = 2; // surface gap between a month's two columns

/** Last six months of income vs expense, and where the selected month's money went. */
export default function InsightsPage() {
  const { t } = useTranslation();
  const transactions = useStore((s) => s.transactions);
  const accounts = useStore((s) => s.accounts);
  const today = todayISO();
  const current = monthKey(todayISO());
  const series = useMemo(() => monthlySeries(transactions, current), [transactions, current]);
  const [selected, setSelected] = useState(current);
  const [tab, setTab] = useState<Tab>(readTab);
  const pickTab = (next: Tab) => {
    setTab(next);
    try {
      localStorage.setItem(TAB_KEY, next);
    } catch {
      // Not remembered; fine.
    }
  };
  const year = Number(current.slice(0, 4));
  const thisYear = useMemo(() => yearSummary(transactions, year), [transactions, year]);
  const tags = useMemo(() => tagSummaries(transactions).slice(0, 3), [transactions]);
  const sel = series.find((m) => m.month === selected) ?? series[series.length - 1];
  const cats = useMemo(() => categoryBreakdown(transactions, sel.month), [transactions, sel.month]);
  const net = sel.income - sel.expense;
  const unusual = useMemo(() => unusualCategories(transactions, sel.month, today), [transactions, sel.month, today]);
  const cushion = useMemo(() => runway(accounts, transactions, today), [accounts, transactions, today]);
  const subscriptions = useStore((s) => s.subscriptions);
  const taxTotal = useMemo(() => taxYear(transactions, String(year)).total, [transactions, year]);
  const usdRate = useStore((s) => s.usdRate);
  const expenseBudget = useStore((s) => s.goals.expenseBudget);
  const forecast = useMemo(
    () => monthForecast(transactions, subscriptions, expenseBudget, current, today, (s) => subTHB(s, accounts, usdRate) ?? s.amount),
    [transactions, subscriptions, expenseBudget, current, today, accounts, usdRate],
  );
  const outlook = useMemo(
    () => installmentOutlook(subscriptions, transactions, today, 6, (s) => subTHB(s, accounts, usdRate) ?? s.amount),
    [subscriptions, transactions, today, accounts, usdRate],
  );

  return (
    <PushScreen>
      <PushHeader title={t("insights.title")} backHref="/transactions" />

      <Segmented
        label={t("insights.title")}
        value={tab}
        onChange={pickTab}
        options={[
          { value: "month", label: t("insights.tabMonth") },
          { value: "overview", label: t("insights.tabOverview") },
        ]}
      />

      {tab === "month" ? (
        <>

      <section className="flex flex-col gap-0.5">
        <span className="text-[13px] text-muted">{t("insights.netIn", { month: monthLabel(sel.month) })}</span>
        <span className="font-mono text-[34px] font-semibold leading-tight tracking-tight">
          {net < 0 ? "−" : ""}
          {baht(Math.abs(net))}
        </span>
      </section>

      <Card className="flex flex-col gap-3 px-4 py-3.5">
        <div className="flex items-center justify-between">
          <h2 className="text-[15px] font-semibold">{t("insights.sixMonths")}</h2>
          <div className="flex items-center gap-3 text-xs text-muted" aria-hidden="true">
            <Swatch color="var(--color-chart-in)" label={t("type.in")} />
            <Swatch color="var(--color-chart-out)" label={t("type.out")} />
          </div>
        </div>
        <Columns series={series} selected={sel.month} onSelect={setSelected} />
        <dl className="grid grid-cols-3 border-t border-divider pt-2.5 text-center">
          <Figure label={t("type.in")} value={`+${baht(sel.income)}`} color="var(--color-chart-in)" />
          <Figure label={t("type.out")} value={`−${baht(sel.expense)}`} color="var(--color-chart-out)" />
          <Figure label={t("insights.net")} value={`${net < 0 ? "−" : ""}${baht(Math.abs(net))}`} />
        </dl>
        <table className="sr-only">
          <caption>{t("insights.sixMonths")}</caption>
          <thead>
            <tr>
              <th scope="col">{t("insights.month")}</th>
              <th scope="col">{t("type.in")}</th>
              <th scope="col">{t("type.out")}</th>
            </tr>
          </thead>
          <tbody>
            {series.map((m) => (
              <tr key={m.month}>
                <th scope="row">{monthLabel(m.month)}</th>
                <td>{baht(m.income)}</td>
                <td>{baht(m.expense)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>

      {forecast && sel.month === current ? <ForecastCard forecast={forecast} month={current} /> : null}

      {unusual.length ? (
        <Card className="flex flex-col gap-2 px-4 py-3.5">
          <div className="flex items-center gap-2">
            <span className="flex h-7 w-7 items-center justify-center rounded-full bg-warn-tint" style={{ color: "var(--color-warn-ink)" }}>
              <Icon name="gauge" size={15} strokeWidth={2.2} />
            </span>
            <h2 className="text-[15px] font-semibold">{t("unusual.title")}</h2>
          </div>
          {unusual.slice(0, 3).map((u) => (
            <div key={u.key} className="flex items-baseline justify-between gap-3 text-sm">
              <span className="min-w-0 truncate">
                {categoryLabel(u.key)} <span className="font-semibold text-warn">{t("unusual.more", { pct: Math.round(u.over * 100) })}</span>
              </span>
              <span className="shrink-0 font-mono text-xs text-muted">{t("unusual.vs", { spent: baht(u.spent), usual: baht(u.usual) })}</span>
            </div>
          ))}
          <span className="text-xs text-muted">{t(sel.month === current ? "unusual.hintNow" : "unusual.hintPast")}</span>
        </Card>
      ) : null}

      <section className="flex flex-col gap-2">
        <h2 className="text-base font-semibold">{t("insights.byCategory", { month: monthLabel(sel.month) })}</h2>
        {cats.length ? (
          <Card className="flex flex-col gap-3 px-4 py-3.5">
            {cats.map((c) => (
              <div key={c.key} className="flex flex-col gap-1.5">
                <div className="flex items-baseline justify-between gap-3 text-sm">
                  <span>{categoryLabel(c.key)}</span>
                  <span className="flex items-baseline gap-2">
                    <span className="font-mono font-semibold">{baht(c.amount)}</span>
                    <span className="w-9 text-right text-xs text-muted">{Math.round(c.share * 100)}%</span>
                  </span>
                </div>
                <div className="h-1.5 overflow-hidden rounded-full bg-divider">
                  {/* One series, so one hue; widths are relative to the largest category. */}
                  <div className="h-full rounded-full" style={{ width: `${(c.amount / cats[0].amount) * 100}%`, background: "var(--color-chart-out)" }} />
                </div>
              </div>
            ))}
          </Card>
        ) : (
          <Empty>{t("insights.noSpend")}</Empty>
        )}
      </section>

      <SpendCalendar month={sel.month} />
        </>
      ) : (
        <>
          <NetWorthChart />

          {outlook ? <InstallmentCard outlook={outlook} /> : null}

          <Link href="/tax" className="block">
            <Card className="flex items-center gap-3 px-4 py-3.5">
              <span className="flex min-w-0 grow flex-col gap-0.5">
                <span className="text-[15px] font-semibold">{t("tax.linkTitle", { year: displayYear(year) })}</span>
                <span className="truncate text-xs text-muted">{taxTotal ? t("tax.totalIn", { year: displayYear(year) }) : t("tax.linkEmpty")}</span>
              </span>
              {taxTotal ? <span className="font-mono text-[15px] font-semibold">{baht(taxTotal)}</span> : null}
              <Icon name="chevronRight" size={16} strokeWidth={2} className="text-faint" />
            </Card>
          </Link>

          {cushion ? (
            <Card className="flex flex-col gap-2 px-4 py-3.5">
              <h2 className="text-[15px] font-semibold">{t("runway.title")}</h2>
              <span className="font-mono text-[28px] font-semibold leading-tight">{t("runway.months", { count: cushion.months })}</span>
              <div className="h-1.5 overflow-hidden rounded-full bg-divider">
                {/* Six months is the usual emergency-fund target. */}
                <div className="h-full rounded-full" style={{ width: `${Math.min(1, cushion.months / 6) * 100}%`, background: cushion.months >= 6 ? "var(--color-income)" : cushion.months >= 3 ? "var(--color-warn-ink)" : "var(--color-expense)" }} />
              </div>
              <span className="text-xs leading-relaxed text-muted">
                {t("runway.detail", { cash: baht(cushion.cash), monthly: baht(cushion.monthly), count: cushion.basis })}
              </span>
              <span className="text-xs leading-relaxed text-muted">{t(cushion.months >= 6 ? "runway.good" : "runway.target")}</span>
            </Card>
          ) : null}

          <Link href="/insights/year" className="block">
            <Card className="flex flex-col gap-2 px-4 py-3.5">
              <div className="flex items-center justify-between">
                <h2 className="text-[15px] font-semibold">{t("year.open", { year: displayYear(year) })}</h2>
                <Icon name="chevronRight" size={16} strokeWidth={2} className="text-faint" />
              </div>
              {thisYear.entries ? (
                <div className="grid grid-cols-3 gap-2 text-center">
                  <Figure label={t("type.in")} value={`+${baht(thisYear.income)}`} color="var(--color-chart-in)" />
                  <Figure label={t("type.out")} value={`−${baht(thisYear.expense)}`} color="var(--color-chart-out)" />
                  <Figure label={t(thisYear.net >= 0 ? "year.saved" : "year.short")} value={baht(Math.abs(thisYear.net))} />
                </div>
              ) : (
                <span className="text-sm text-muted">{t("year.empty")}</span>
              )}
            </Card>
          </Link>

          <Link href="/tags" className="block">
            <Card className="flex flex-col gap-2 px-4 py-3.5">
              <div className="flex items-center justify-between">
                <h2 className="text-[15px] font-semibold">{t("tags.title")}</h2>
                <Icon name="chevronRight" size={16} strokeWidth={2} className="text-faint" />
              </div>
              {tags.length ? (
                <div className="flex flex-col">
                  {tags.map((g) => (
                    <div key={g.tag} className="flex min-h-9 items-center justify-between gap-3 text-sm">
                      <span className="truncate">#{g.tag}</span>
                      <span className="font-mono font-semibold">{baht(g.spent)}</span>
                    </div>
                  ))}
                </div>
              ) : (
                <span className="text-sm text-muted">{t("tags.empty")}</span>
              )}
            </Card>
          </Link>
        </>
      )}
    </PushScreen>
  );
}

function Columns({ series, selected, onSelect }: { series: ReturnType<typeof monthlySeries>; selected: string; onSelect: (m: string) => void }) {
  const { t } = useTranslation();
  const ticks = niceTicks(Math.max(...series.flatMap((m) => [m.income, m.expense])));
  const top = ticks[ticks.length - 1] || 1;
  const plotH = H - TOP - BOTTOM;
  const band = (W - LEFT) / series.length;
  const y = (v: number) => TOP + plotH - (v / top) * plotH;

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="group" aria-label={t("insights.sixMonths")}>
      {ticks.map((v) => (
        <g key={v}>
          <line x1={LEFT} x2={W} y1={y(v)} y2={y(v)} stroke="var(--color-divider)" strokeWidth={1} />
          <text x={LEFT - 6} y={y(v) + 3.5} textAnchor="end" fontSize={10} fill="var(--color-faint)" className="font-mono">
            {compact(v)}
          </text>
        </g>
      ))}
      {series.map((m, i) => {
        const cx = LEFT + band * i + band / 2;
        const on = m.month === selected;
        const [yy, mm] = m.month.split("-").map(Number);
        return (
          <g
            key={m.month}
            role="button"
            tabIndex={0}
            aria-pressed={on}
            aria-label={`${monthNamesShort()[mm - 1]} ${displayYear(yy)}: ${t("type.in")} ${baht(m.income)}, ${t("type.out")} ${baht(m.expense)}`}
            onClick={() => onSelect(m.month)}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") onSelect(m.month);
            }}
            className="cursor-pointer outline-none"
            opacity={on ? 1 : 0.42}
          >
            {/* Hit target: the whole band, larger than the columns. */}
            <rect x={LEFT + band * i} y={0} width={band} height={H} fill="transparent" />
            <Column x={cx - GAP / 2 - BAR} top={y(m.income)} bottom={y(0)} color="var(--color-chart-in)" />
            <Column x={cx + GAP / 2} top={y(m.expense)} bottom={y(0)} color="var(--color-chart-out)" />
            <text x={cx} y={H - 6} textAnchor="middle" fontSize={11} fontWeight={on ? 600 : 400} fill={on ? "var(--color-ink)" : "var(--color-muted)"}>
              {monthNamesShort()[mm - 1]}
            </text>
          </g>
        );
      })}
    </svg>
  );
}

/** A column with a 4px rounded top, square at the baseline. */
function Column({ x, top, bottom, color }: { x: number; top: number; bottom: number; color: string }) {
  const h = bottom - top;
  if (h <= 0.5) return null;
  const r = Math.min(4, h, BAR / 2);
  return <path d={`M${x} ${bottom}V${top + r}Q${x} ${top} ${x + r} ${top}H${x + BAR - r}Q${x + BAR} ${top} ${x + BAR} ${top + r}V${bottom}Z`} fill={color} />;
}

function Swatch({ color, label }: { color: string; label: string }) {
  return (
    <span className="flex items-center gap-1.5">
      <span className="h-2.5 w-2.5 rounded-[3px]" style={{ background: color }} />
      {label}
    </span>
  );
}

/** Figures use text colours; the swatch beside the label carries the series identity. */
function Figure({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <div className="flex flex-col items-center gap-0.5">
      <dt className="flex items-center gap-1.5 text-xs text-muted">
        {color ? <span className="h-2 w-2 rounded-[2px]" style={{ background: color }} /> : null}
        {label}
      </dt>
      <dd className="font-mono text-[15px] font-semibold">{value}</dd>
    </div>
  );
}

/** Money already promised to installment plans over the next months. */
function InstallmentCard({ outlook }: { outlook: NonNullable<ReturnType<typeof installmentOutlook>> }) {
  const { t } = useTranslation();
  const names = monthNamesShort();
  const next = outlook.months[1];
  const top = Math.max(...outlook.months.map((m) => m.amount)) || 1;
  const pct = outlook.income ? Math.round((next.amount / outlook.income) * 100) : null;
  return (
    <Link href="/subscriptions" className="block">
      <Card className="flex flex-col gap-3 px-4 py-3.5">
        <div className="flex items-center justify-between">
          <h2 className="text-[15px] font-semibold">{t("outlook.title")}</h2>
          <Icon name="chevronRight" size={16} strokeWidth={2} className="text-faint" />
        </div>
        <div className="flex flex-col gap-0.5">
          <span className="text-xs text-muted">{t("outlook.next", { month: monthLabel(next.month) })}</span>
          <span className="font-mono text-[26px] font-semibold leading-tight">{baht(next.amount)}</span>
          {pct !== null ? <span className="text-xs text-muted">{t("outlook.ofIncome", { pct })}</span> : null}
        </div>
        <div className="flex h-20 items-end gap-2" aria-hidden="true">
          {outlook.months.map((m, i) => (
            <div key={m.month} className="flex h-full grow flex-col items-center justify-end gap-1">
              <div
                className="w-full max-w-7 rounded-t-md"
                style={{ height: `${Math.max(m.amount ? 6 : 2, (m.amount / top) * 100)}%`, background: m.amount ? "var(--color-chart-out)" : "var(--color-divider)", opacity: m.amount && i !== 1 ? 0.4 : 1 }}
              />
              <span className="text-[10px] text-muted">{names[Number(m.month.slice(5, 7)) - 1]}</span>
            </div>
          ))}
        </div>
        <table className="sr-only">
          <caption>{t("outlook.title")}</caption>
          <tbody>
            {outlook.months.map((m) => (
              <tr key={m.month}>
                <th scope="row">{monthLabel(m.month)}</th>
                <td>{baht(m.amount)}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <span className="border-t border-divider pt-2.5 text-xs leading-relaxed text-muted">
          {t("outlook.summary", { count: outlook.planCount, amount: baht(outlook.remaining), last: outlook.lastDue ? monthLabel(outlook.lastDue.slice(0, 7)) : "" })}
        </span>
      </Card>
    </Link>
  );
}
