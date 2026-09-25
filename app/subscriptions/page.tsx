"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { DuePill, SubMono, TabScreen } from "@/components/app";
import { Icon } from "@/components/ui/Icon";
import { Empty, HeroCard, IconButton, ListCard, TabHeader, cx } from "@/components/ui/primitives";
import { SUB_CATEGORIES } from "@/lib/constants";
import { baht, cyclePer, shortDate, todayISO } from "@/lib/format";
import { subscriptionTotals, upcomingSubscriptions } from "@/lib/selectors";
import { useTranslation } from "react-i18next";
import { useStore } from "@/lib/store";

const SEG_COLORS = ["var(--color-lime)", "var(--color-peach)", "var(--color-on-ink-faint)", "#7fa98f", "#8fa3c9"];

export default function SubscriptionsPage() {
  const { subscriptions, accounts } = useStore();
  const { t: tr } = useTranslation();
  const today = todayISO();
  const [sort, setSort] = useState<"due" | "price">("due");

  const totals = useMemo(() => subscriptionTotals(subscriptions, today), [subscriptions, today]);
  const active = useMemo(() => {
    const list = upcomingSubscriptions(subscriptions, today);
    return sort === "price" ? [...list].sort((a, b) => b.sub.amount - a.sub.amount) : list;
  }, [subscriptions, today, sort]);
  const paused = subscriptions.filter((s) => s.paused);

  const segments = Object.entries(totals.byCategory)
    .sort((a, b) => b[1] - a[1])
    .map(([key, value], i) => ({
      key,
      value,
      label: SUB_CATEGORIES.find((c) => c.key === key)?.label ?? key,
      color: SEG_COLORS[i % SEG_COLORS.length],
    }));
  const accName = (id: string) => accounts.find((a) => a.id === id)?.name ?? "";

  return (
    <TabScreen>
      <TabHeader
        title={tr("subs.title")}
        subtitle={tr("subs.active", { count: totals.count })}
        actions={<IconButton href="/subscriptions/new" icon="plus" label={tr("subs.add")} variant="dark" />}
      />

      <HeroCard>
        <div className="flex items-end justify-between">
          <div className="flex flex-col gap-1">
            <span className="text-[13px] text-on-ink-muted">{tr("subs.perMonth")}</span>
            <span className="font-mono text-4xl font-semibold leading-tight tracking-tight">{baht(totals.perMonth)}</span>
          </div>
          {totals.perYearExtra > 0 ? (
            <div className="flex flex-col items-end gap-0.5">
              <span className="text-xs text-on-ink-muted">{tr("subs.yearlyMore")}</span>
              <span className="font-mono text-[15px] font-semibold">{baht(totals.perYearExtra)}</span>
            </div>
          ) : null}
        </div>
        {segments.length ? (
          <div className="flex flex-col gap-2.5">
            <div className="flex h-2 gap-[3px]">
              {segments.map((s) => (
                <div key={s.key} className="min-w-2 rounded-full" style={{ width: `${(s.value / totals.perMonth) * 100}%`, background: s.color }} />
              ))}
            </div>
            <div className="flex flex-wrap gap-x-3.5 gap-y-1 text-xs text-on-ink-muted">
              {segments.map((s) => (
                <span key={s.key} className="flex items-center gap-1.5">
                  <span className="h-2 w-2 rounded-full" style={{ background: s.color }} />
                  {s.label} {baht(s.value)}
                </span>
              ))}
            </div>
          </div>
        ) : null}
        <div className="-mt-1 flex min-h-9 items-center gap-2 border-t border-ink-line pt-2.5 text-xs text-on-ink-muted">
          <Icon name="calendar" size={14} strokeWidth={2} className="text-lime" />
          <span className="grow">{tr("subs.next7")}</span>
          <span className="font-mono text-[13px] font-semibold text-lime">{baht(totals.next7)}</span>
        </div>
      </HeroCard>

      <section className="flex flex-col gap-2">
        <div className="flex items-center justify-between">
          <h2 className="text-base font-semibold">{sort === "due" ? tr("subs.byDue") : tr("subs.byPrice")}</h2>
          <button type="button" onClick={() => setSort(sort === "due" ? "price" : "due")} className="min-h-9 text-[13px] font-medium text-muted">
            {tr("subs.changeSort")}
          </button>
        </div>
        {active.length ? (
          <ListCard>
            {active.map(({ sub, due, days }) => (
              <Link key={sub.id} href={`/subscriptions/${sub.id}`} className="flex min-h-16 items-center gap-3">
                <SubMono s={sub} />
                <div className="flex min-w-0 grow flex-col">
                  <span className="truncate text-[15px] font-medium">{sub.name}</span>
                  <span className="truncate text-xs text-muted">
                    {shortDate(due, false)} · {accName(sub.accountId)}
                  </span>
                </div>
                <div className="flex flex-col items-end gap-0.5">
                  <span className="font-mono text-[15px] font-semibold">
                    {baht(sub.amount)}
                    <span className="font-sans text-[11px] font-normal text-muted"> {cyclePer(sub.cycle)}</span>
                  </span>
                  <DuePill days={days} />
                </div>
              </Link>
            ))}
          </ListCard>
        ) : (
          <Empty>{tr("subs.empty")}</Empty>
        )}
      </section>

      {paused.length ? (
        <section className="flex flex-col gap-2">
          <h2 className="text-base font-semibold">{tr("subs.paused")}</h2>
          <ListCard>
            {paused.map((sub) => (
              <Link key={sub.id} href={`/subscriptions/${sub.id}`} className={cx("flex min-h-16 items-center gap-3 opacity-70")}>
                <SubMono s={sub} />
                <span className="grow text-[15px] font-medium">{sub.name}</span>
                <span className="font-mono text-[15px] font-semibold">{baht(sub.amount)}</span>
              </Link>
            ))}
          </ListCard>
        </section>
      ) : null}
    </TabScreen>
  );
}
