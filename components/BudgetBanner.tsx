"use client";

import Link from "next/link";
import type { BannerTone, BudgetBanner } from "@/lib/budget";
import { Icon, type IconName } from "./ui/Icon";
import { cx } from "./ui/primitives";

const TONE: Record<BannerTone, { icon: IconName; tile: string; iconColor: string; card: string; amount: string; badge: string }> = {
  critical: { icon: "alert", tile: "bg-danger", iconColor: "#fff", card: "border-expense-line bg-expense-tint", amount: "text-danger", badge: "bg-danger" },
  danger: { icon: "alert", tile: "bg-expense-tint", iconColor: "var(--color-danger)", card: "border-line bg-card", amount: "text-danger", badge: "bg-danger" },
  warn: { icon: "gauge", tile: "bg-warn-tint", iconColor: "var(--color-warn-ink)", card: "border-line bg-card", amount: "text-warn", badge: "bg-warn-ink dark:text-on-ink" },
  ok: { icon: "check", tile: "bg-income-tint", iconColor: "var(--color-income)", card: "border-line bg-card", amount: "", badge: "" },
  setup: { icon: "target", tile: "bg-chip", iconColor: "var(--color-ink)", card: "border-line bg-card", amount: "", badge: "" },
};

/** Budget status under the overview card; tapping opens goals (or the budget editor). */
export function BudgetBannerCard({ banner }: { banner: BudgetBanner }) {
  const t = TONE[banner.tone];
  return (
    <Link
      href={banner.tone === "setup" ? "/goals/edit" : "/goals"}
      className={cx("flex min-h-[68px] items-center gap-3 rounded-[20px] border px-3.5 py-3", t.card)}
    >
      <span className={cx("flex h-11 w-11 shrink-0 items-center justify-center rounded-[14px]", t.tile)}>
        <Icon name={t.icon} size={20} strokeWidth={2} style={{ color: t.iconColor }} />
      </span>
      <span className="flex min-w-0 grow flex-col gap-0.5">
        <span className="text-[15px] font-semibold leading-snug">
          {banner.title}
          {banner.amount ? <span className={cx("ml-1.5 font-mono", t.amount)}>{banner.amount}</span> : null}
        </span>
        <span className="truncate text-xs text-muted">{banner.detail}</span>
      </span>
      {banner.count ? (
        <span className={cx("flex h-6 min-w-6 shrink-0 items-center justify-center rounded-full px-1.5 text-xs font-bold text-white", t.badge)}>
          {banner.count}
        </span>
      ) : null}
      <Icon name="chevronRight" size={16} strokeWidth={2} className="shrink-0 text-faint" />
    </Link>
  );
}
