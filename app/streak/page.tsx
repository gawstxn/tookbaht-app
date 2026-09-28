"use client";

import Link from "next/link";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { PushScreen } from "@/components/app";
import { useStreak } from "@/components/streak";
import { Icon } from "@/components/ui/Icon";
import { Bar, Card, HeroCard, PushHeader, SecondaryButton, Sheet, cx } from "@/components/ui/primitives";
import { dayHeading, daysInMonth, monthKey, monthLabel, shiftMonth, shortDate, toISO, weekdayNamesShort } from "@/lib/format";
import { useGoBack } from "@/lib/nav";
import { TIERS } from "@/lib/streak";
import { useStore } from "@/lib/store";

/** Logging streak: today's status, restoring missed days, tier and a calendar of counted days. */
export default function StreakPage() {
  const { t } = useTranslation();
  const goBack = useGoBack("/");
  const s = useStreak();
  const markNoSpend = useStore((st) => st.markNoSpend);
  const toNext = s.next ? s.next.days - s.total : 0;
  const [tiersOpen, setTiersOpen] = useState(false);

  return (
    <PushScreen>
      <PushHeader title={t("streak.title")} onBack={goBack} />

      <HeroCard label={t("streak.title")}>
        <div className="flex items-center gap-3">
          <span className={cx("flex h-14 w-14 shrink-0 items-center justify-center rounded-full", s.doneToday ? "bg-lime text-on-lime" : "bg-ink-line text-on-ink-muted")}>
            <Icon name="flame" size={28} strokeWidth={2} />
          </span>
          <div className="flex flex-col">
            <span className="font-mono text-4xl font-semibold leading-tight tracking-tight">{t("streak.days", { count: s.current })}</span>
            <span className="text-[13px] text-on-ink-muted">
              {s.missed.length ? t("streak.statusMissed") : s.doneToday ? t("streak.statusDone") : t("streak.statusPending")}
            </span>
          </div>
        </div>
        <button type="button" aria-haspopup="dialog" onClick={() => setTiersOpen(true)} className="flex flex-col gap-2 border-t border-ink-line pt-3 text-left">
          <div className="flex w-full items-center justify-between gap-2 text-[13px]">
            <span className="flex items-center gap-2 font-semibold">
              <span aria-hidden="true" className="h-3 w-3 rounded-full" style={{ background: s.tier.tone }} />
              {t(`streak.tier.${s.tier.key}`)}
            </span>
            <span className="flex items-center gap-1 text-on-ink-muted">
              {s.next ? t("streak.toNext", { count: toNext, tier: t(`streak.tier.${s.next.key}`) }) : t("streak.topTier")}
              <Icon name="chevronRight" size={14} strokeWidth={2} />
            </span>
          </div>
          {s.next ? (
            <span className="w-full">
              <Bar value={(s.total - s.tier.days) / (s.next.days - s.tier.days)} color="var(--color-lime)" track="var(--color-ink-line)" />
            </span>
          ) : null}
        </button>
      </HeroCard>

      {s.missed.map((d) => (
        <Card key={d} className="flex flex-col gap-3 border-expense-line px-4 py-3.5">
          <div className="flex flex-col gap-0.5">
            <span className="text-[15px] font-semibold">{t("streak.missedTitle", { day: dayHeading(d, s.today) })}</span>
            <span className="text-xs leading-relaxed text-muted">
              {s.quotaLeft > 0 ? t("streak.missedLead", { left: s.quotaLeft, quota: s.quota }) : t("streak.noQuota")}
            </span>
          </div>
          {s.quotaLeft > 0 ? (
            <div className="grid grid-cols-2 gap-2">
              <Link href={`/add?date=${d}`} className="flex min-h-12 items-center justify-center rounded-2xl bg-ink text-[14px] font-semibold text-paper">
                {t("streak.logThatDay")}
              </Link>
              <button type="button" onClick={() => markNoSpend(d)} className="min-h-12 rounded-2xl border border-line bg-card text-[14px] font-semibold">
                {t("streak.noSpendThatDay")}
              </button>
            </div>
          ) : null}
        </Card>
      ))}

      {!s.doneToday ? (
        <Card className="flex flex-col gap-3 px-4 py-3.5">
          <div className="flex flex-col gap-0.5">
            <span className="text-[15px] font-semibold">{t("streak.todayTitle")}</span>
            <span className="text-xs leading-relaxed text-muted">{t("streak.todayLead")}</span>
          </div>
          <SecondaryButton onClick={() => markNoSpend(s.today)}>{t("streak.noSpendToday")}</SecondaryButton>
        </Card>
      ) : null}

      <div className="grid grid-cols-2 gap-2.5">
        <Stat label={t("streak.best")} value={t("streak.days", { count: s.best })} />
        <Stat label={t("streak.total")} value={t("streak.days", { count: s.total })} />
      </div>

      <StreakCalendar today={s.today} onTime={s.onTime} restored={s.restored} />

      <section className="flex flex-col gap-2 text-xs leading-relaxed text-muted">
        <h2 className="text-sm font-semibold text-ink">{t("streak.rulesTitle")}</h2>
        <p>{t("streak.ruleCount")}</p>
        <p>{t("streak.ruleRestore")}</p>
        <p>{t("streak.ruleTier")}</p>
      </section>
      <TierSheet open={tiersOpen} onClose={() => setTiersOpen(false)} total={s.total} current={s.tier.key} />
    </PushScreen>
  );
}

/** Every tier, what it takes, and where the user stands. */
function TierSheet({ open, onClose, total, current }: { open: boolean; onClose: () => void; total: number; current: string }) {
  const { t } = useTranslation();
  const at = TIERS.findIndex((x) => x.key === current);
  return (
    <Sheet open={open} onClose={onClose} title={t("streak.tiersTitle")}>
      <p className="text-sm leading-relaxed text-muted">{t("streak.tiersLead", { count: total })}</p>
      <ol className="flex flex-col rounded-[20px] border border-line bg-card px-4 py-0.5">
        {TIERS.map((tier, i) => {
          const passed = i < at;
          const here = i === at;
          const next = TIERS[i + 1];
          return (
            <li key={tier.key} className={cx("flex min-h-[64px] flex-col justify-center gap-2 py-3", i < TIERS.length - 1 && "border-b border-divider")}>
              <div className="flex items-center gap-3">
                <span aria-hidden="true" className="h-7 w-7 shrink-0 rounded-full" style={{ background: tier.tone }} />
                <span className="flex grow flex-col">
                  <span className={cx("text-[15px] font-semibold", i > at && "text-muted")}>{t(`streak.tier.${tier.key}`)}</span>
                  <span className="text-xs text-muted">{tier.days ? t("streak.tierNeeds", { count: tier.days }) : t("streak.tierStart")}</span>
                </span>
                {here ? (
                  <span className="shrink-0 rounded-full bg-lime px-2.5 py-1 text-[11px] font-bold text-on-lime">{t("streak.tierYou")}</span>
                ) : passed ? (
                  <Icon name="check" size={18} strokeWidth={2.4} className="shrink-0 text-income" aria-label={t("streak.tierPassed")} />
                ) : (
                  <span className="shrink-0 text-xs text-muted">{t("streak.tierLeft", { count: tier.days - total })}</span>
                )}
              </div>
              {here && next ? <Bar value={(total - tier.days) / (next.days - tier.days)} color="var(--color-lime-ink)" track="var(--color-divider)" /> : null}
            </li>
          );
        })}
      </ol>
    </Sheet>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <Card className="flex flex-col gap-0.5 px-4 py-3">
      <span className="text-xs text-muted">{label}</span>
      <span className="font-mono text-lg font-semibold">{value}</span>
    </Card>
  );
}

/** A month of days: filled when logged on time, outlined when restored. */
function StreakCalendar({ today, onTime, restored }: { today: string; onTime: Set<string>; restored: Set<string> }) {
  const { t } = useTranslation();
  const [view, setView] = useState(monthKey(today));
  const [y, m] = view.split("-").map(Number);
  const first = new Date(y, m - 1, 1).getDay();
  const days = daysInMonth(y, m - 1);
  const atEnd = view >= monthKey(today);

  return (
    <Card className="flex flex-col gap-2 p-3">
      <div className="flex items-center justify-between">
        <button type="button" aria-label={t("picker.prevMonth")} onClick={() => setView(shiftMonth(view, -1))} className="flex h-10 w-10 items-center justify-center rounded-full">
          <Icon name="back" size={18} strokeWidth={2} />
        </button>
        <span className="text-[15px] font-semibold">{monthLabel(view)}</span>
        <button
          type="button"
          aria-label={t("picker.nextMonth")}
          disabled={atEnd}
          onClick={() => setView(shiftMonth(view, 1))}
          className={cx("flex h-10 w-10 items-center justify-center rounded-full", atEnd && "text-switch-off")}
        >
          <Icon name="chevronRight" size={18} strokeWidth={2} />
        </button>
      </div>
      <div aria-hidden="true" className="grid grid-cols-7 text-center text-xs text-muted">
        {weekdayNamesShort().map((d) => (
          <span key={d}>{d}</span>
        ))}
      </div>
      <div className="grid grid-cols-7 gap-y-1">
        {Array.from({ length: first }, (_, i) => (
          <span key={`b${i}`} />
        ))}
        {Array.from({ length: days }, (_, i) => {
          const iso = toISO(new Date(y, m - 1, i + 1));
          const done = onTime.has(iso);
          const back = restored.has(iso);
          return (
            <span
              key={iso}
              aria-label={`${shortDate(iso)}${done ? ` · ${t("streak.dayDone")}` : back ? ` · ${t("streak.dayRestored")}` : ""}`}
              className={cx(
                "mx-auto flex h-9 w-9 items-center justify-center rounded-full border-2 font-mono text-[13px] font-semibold",
                done ? "border-transparent bg-lime text-on-lime" : back ? "border-lime-ink text-lime-ink" : iso === today ? "border-line-strong" : "border-transparent",
                iso > today && "text-faint",
              )}
            >
              {i + 1}
            </span>
          );
        })}
      </div>
      <div className="flex items-center justify-center gap-4 pt-1 text-[11px] text-muted">
        <span className="flex items-center gap-1.5">
          <span aria-hidden="true" className="h-2.5 w-2.5 rounded-full bg-lime" />
          {t("streak.dayDone")}
        </span>
        <span className="flex items-center gap-1.5">
          <span aria-hidden="true" className="h-2.5 w-2.5 rounded-full border-2 border-lime-ink" />
          {t("streak.dayRestored")}
        </span>
      </div>
    </Card>
  );
}
