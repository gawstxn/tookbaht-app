"use client";

import Link from "next/link";
import { useEffect, useMemo } from "react";
import { useTranslation } from "react-i18next";
import { Icon } from "@/components/ui/Icon";
import { cx } from "@/components/ui/primitives";
import { todayISO } from "@/lib/format";
import { useStore } from "@/lib/store";
import { MILESTONES, streakLogs, streakStatus, tierFor } from "@/lib/streak";

/** The user's streak and tier, from their entries and no-spend confirmations. */
export function useStreak() {
  const transactions = useStore((s) => s.transactions);
  const noSpend = useStore((s) => s.settings.noSpend);
  const today = todayISO();
  const logs = useMemo(() => streakLogs(transactions), [transactions]);
  return useMemo(() => {
    const status = streakStatus({ logs, noSpend: noSpend ?? [], today });
    return { ...status, ...tierFor(status.total), today };
  }, [logs, noSpend, today]);
}

/** Flame with the streak count for the home header; lit once today counts. */
export function StreakChip() {
  const s = useStreak();
  const { t } = useTranslation();
  const lit = s.doneToday && !s.missed.length;
  return (
    <Link
      href="/streak"
      aria-label={t("streak.chipLabel", { count: s.current })}
      className={cx("flex h-11 shrink-0 items-center gap-1 rounded-full border px-3.5", lit ? "border-transparent bg-lime text-on-lime" : "border-line bg-card text-muted")}
    >
      <Icon name="flame" size={18} strokeWidth={2} />
      <span className="font-mono text-[15px] font-semibold">{s.current}</span>
      {s.missed.length ? <span aria-hidden="true" className="ml-0.5 h-2 w-2 rounded-full bg-danger" /> : null}
    </Link>
  );
}

/**
 * Keeps the profile's streak summary current (the evening reminder reads it)
 * and toasts once when the streak reaches a new milestone.
 */
export function StreakSync() {
  const { current, last, quotaLeft } = useStreak();
  const saved = useStore((s) => s.settings.streak);
  const celebrated = useStore((s) => s.settings.streakMilestone ?? 0);
  const setSettings = useStore((s) => s.setSettings);
  const notify = useStore((s) => s.notify);
  const { t } = useTranslation();
  const reached = [...MILESTONES].reverse().find((m) => current >= m) ?? 0;

  const ready = useStore((s) => s.status === "ready");
  useEffect(() => {
    if (!ready || (saved?.n === current && saved.last === last && saved.left === quotaLeft)) return;
    setSettings({ streak: { n: current, last, left: quotaLeft } });
  }, [ready, current, last, quotaLeft, saved, setSettings]);

  useEffect(() => {
    if (!ready) return;
    // A broken streak celebrates its milestones again next time.
    if (reached < celebrated && reached === 0) setSettings({ streakMilestone: undefined });
    if (reached <= celebrated) return;
    setSettings({ streakMilestone: reached });
    notify(t("streak.milestone", { count: reached }));
  }, [ready, reached, celebrated, setSettings, notify, t]);
  return null;
}
