"use client";

import Link from "next/link";
import { useState } from "react";
import { DuePill, SubMono, TabScreen, TxIcon } from "@/components/app";
import { RecurringSuggestions } from "@/components/RecurringSuggestions";
import { Icon } from "@/components/ui/Icon";
import { Empty, HeroCard, IconButton, ListCard, TabHeader, cx } from "@/components/ui/primitives";
import { SUB_CATEGORIES, TYPE_META } from "@/lib/constants";
import { baht, cyclePer, shortDate, todayISO } from "@/lib/format";
import { formatMoney, subTHB } from "@/lib/fx";
import type { Subscription } from "@/lib/types";
import { chargesSoFar, isService, subscriptionTotals, upcomingSubscriptions } from "@/lib/selectors";
import { useTranslation } from "react-i18next";
import { useStore } from "@/lib/store";

const SEG_COLORS = ["var(--color-lime)", "var(--color-peach)", "var(--color-on-ink-faint)", "#7fa98f", "#8fa3c9"];

export default function SubscriptionsPage() {
  const { subscriptions, accounts } = useStore();
  const { t: tr } = useTranslation();
  const today = todayISO();
  const [sort, setSort] = useState<"due" | "price">("due");

  const usdRate = useStore((s) => s.usdRate);
  const thb = (s: Subscription) => subTHB(s, accounts, usdRate) ?? 0;
  const totals = subscriptionTotals(subscriptions, today, thb);
  const services = subscriptions.filter(isService);
  const list = upcomingSubscriptions(services, today);
  const active = sort === "price" ? [...list].sort((a, b) => thb(b.sub) - thb(a.sub)) : list;
  const paused = subscriptions.filter((s) => s.paused);
  // Salary, rent, transfers and installment plans; paid-off plans go last.
  const recurring = subscriptions.filter((s) => !isService(s) && !s.paused);
  const upcomingRecurring = upcomingSubscriptions(recurring, today);
  const finished = recurring.filter((s) => !upcomingRecurring.some((u) => u.sub.id === s.id));

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

      <RecurringSuggestions />

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
                    {formatMoney(sub.amount, sub.currency)}
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

      <section className="flex flex-col gap-2">
        <div className="flex items-center justify-between">
          <h2 className="text-base font-semibold">{tr("rec.section")}</h2>
          <Link href="/recurring/new" className="flex min-h-9 items-center gap-1 text-[13px] font-medium text-muted">
            <Icon name="plus" size={14} strokeWidth={2.2} />
            {tr("rec.add")}
          </Link>
        </div>
        {recurring.length ? (
          <ListCard>
            {upcomingRecurring.map(({ sub, due, days, n }) => (
              <RecurringRow key={sub.id} sub={sub} account={accName(sub.accountId)} detail={shortDate(due, false)}>
                {sub.installments ? (
                  <span className="whitespace-nowrap rounded-full bg-chip px-2 py-px text-[11px] font-semibold">{tr("rec.progress", { n, total: sub.installments })}</span>
                ) : (
                  <DuePill days={days} />
                )}
              </RecurringRow>
            ))}
            {finished.map((sub) => (
              <RecurringRow key={sub.id} sub={sub} account={accName(sub.accountId)} detail={tr("rec.paidOff")} dim>
                <span className="whitespace-nowrap rounded-full bg-income-tint px-2 py-px text-[11px] font-semibold text-income">
                  {tr("rec.progress", { n: chargesSoFar(sub, today), total: sub.installments })}
                </span>
              </RecurringRow>
            ))}
          </ListCard>
        ) : (
          <Empty>{tr("rec.empty")}</Empty>
        )}
      </section>

      {paused.length ? (
        <section className="flex flex-col gap-2">
          <h2 className="text-base font-semibold">{tr("subs.paused")}</h2>
          <ListCard>
            {paused.map((sub) => (
              <Link key={sub.id} href={`/subscriptions/${sub.id}`} className={cx("flex min-h-16 items-center gap-3 opacity-70")}>
                {isService(sub) ? <SubMono s={sub} /> : <TxIcon type={sub.entryType} category={sub.category} size={40} />}
                <span className="grow text-[15px] font-medium">{sub.name}</span>
                <span className="font-mono text-[15px] font-semibold">{formatMoney(sub.amount, sub.currency)}</span>
              </Link>
            ))}
          </ListCard>
        </section>
      ) : null}
    </TabScreen>
  );
}

function RecurringRow({ sub, account, detail, dim, children }: { sub: Subscription; account: string; detail: string; dim?: boolean; children: React.ReactNode }) {
  const meta = TYPE_META[sub.entryType];
  return (
    <Link href={`/subscriptions/${sub.id}`} className={cx("flex min-h-16 items-center gap-3", dim && "opacity-70")}>
      <TxIcon type={sub.entryType} category={sub.category} size={40} />
      <div className="flex min-w-0 grow flex-col">
        <span className="truncate text-[15px] font-medium">{sub.name}</span>
        <span className="truncate text-xs text-muted">
          {detail} · {account}
        </span>
      </div>
      <div className="flex flex-col items-end gap-0.5">
        <span className="font-mono text-[15px] font-semibold" style={{ color: meta.color }}>
          {meta.sign}
          {baht(sub.amount)}
          <span className="font-sans text-[11px] font-normal text-muted"> {cyclePer(sub.cycle)}</span>
        </span>
        {children}
      </div>
    </Link>
  );
}
