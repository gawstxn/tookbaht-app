"use client";

import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import Link from "next/link";
import { PushScreen } from "@/components/app";
import { NetWorthChart, SpendCalendar } from "@/components/insightCharts";
import { Icon } from "@/components/ui/Icon";
import { Card, Empty, PushHeader } from "@/components/ui/primitives";
import { categoryLabel } from "@/lib/constants";
import { baht, displayYear, monthKey, monthLabel, monthNamesShort, todayISO } from "@/lib/format";
import { categoryBreakdown, compact, monthlySeries, niceTicks } from "@/lib/insights";
import { useStore } from "@/lib/store";

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
  const current = monthKey(todayISO());
  const series = useMemo(() => monthlySeries(transactions, current), [transactions, current]);
  const [selected, setSelected] = useState(current);
  const sel = series.find((m) => m.month === selected) ?? series[series.length - 1];
  const cats = useMemo(() => categoryBreakdown(transactions, sel.month), [transactions, sel.month]);
  const net = sel.income - sel.expense;

  return (
    <PushScreen>
      <PushHeader title={t("insights.title")} backHref="/transactions" />

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

      <NetWorthChart />

      <Link href="/insights/year" className="flex min-h-[56px] items-center gap-3 rounded-2xl border border-line bg-card px-4">
        <Icon name="calendar" size={20} strokeWidth={2} />
        <span className="grow text-[15px] font-semibold">{t("year.open", { year: displayYear(Number(current.slice(0, 4))) })}</span>
        <Icon name="chevronRight" size={16} strokeWidth={2} className="text-faint" />
      </Link>
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
