"use client"

import Link from "next/link"
import { useMemo, useSyncExternalStore } from "react"
import { todayISO } from "@/lib/format"
import { buildNotifications, isUnread, type NotifKind } from "@/lib/notifications"
import { useTranslation } from "react-i18next"
import { cycleStartDay } from "@/lib/period"
import { useStore } from "@/lib/store"
import { Icon, type IconName } from "./ui/Icon"

// Re-read the clock once a minute so "due tomorrow 09:00" items appear on time.
const subscribeMinute = (cb: () => void) => {
  const t = setInterval(cb, 60_000)
  return () => clearInterval(t)
}
const minuteNow = () => Math.floor(Date.now() / 60_000) * 60_000

/** The user's notifications plus unread count. */
export function useNotifications() {
  const { accounts, transactions, subscriptions, goals, settings, wishes } = useStore()
  const now = useSyncExternalStore(subscribeMinute, minuteNow, () => 0)
  const items = useMemo(
    () =>
      now
        ? buildNotifications({
            accounts,
            transactions,
            subscriptions,
            goals,
            wishes,
            today: todayISO(),
            now,
            startDay: cycleStartDay(settings),
          })
        : [],
    [accounts, transactions, subscriptions, goals, wishes, now, settings],
  )
  const unread = items.filter((n) => isUnread(n, settings))
  return { items, unread, settings }
}

export const NOTIF_STYLE: Record<NotifKind, { icon: IconName; bg: string; fg: string }> = {
  due: { icon: "repeat", bg: "var(--color-lime-tint)", fg: "var(--color-lime-ink)" },
  over: { icon: "alert", bg: "var(--color-expense-tint)", fg: "var(--color-danger)" },
  near: { icon: "gauge", bg: "var(--color-warn-tint)", fg: "var(--color-warn-ink)" },
  autolog: { icon: "check", bg: "var(--color-transfer-tint)", fg: "var(--color-transfer)" },
  income: { icon: "target", bg: "var(--color-income-tint)", fg: "var(--color-income)" },
  weekly: { icon: "chart", bg: "var(--color-chip)", fg: "var(--color-ink)" },
  summary: { icon: "chart", bg: "var(--color-lime-tint)", fg: "var(--color-lime-ink)" },
  price: { icon: "tag", bg: "var(--color-warn-tint)", fg: "var(--color-warn-ink)" },
  wish: { icon: "bag", bg: "var(--color-income-tint)", fg: "var(--color-income)" },
  renew: { icon: "calendar", bg: "var(--color-warn-tint)", fg: "var(--color-warn-ink)" },
}

/** Header bell with an unread badge. */
export function NotificationBell() {
  const { unread } = useNotifications()
  const { t: tr } = useTranslation()
  const n = unread.length
  return (
    <Link
      href="/notifications"
      aria-label={n ? tr("notif.unreadCount", { count: n }) : tr("notif.title")}
      className="relative flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-line bg-card"
    >
      <Icon name="bell" size={20} strokeWidth={2} />
      {n ? (
        <span className="absolute top-1.5 right-1.5 flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-danger px-1 text-[10px] leading-none font-bold text-white">
          {n > 9 ? "9+" : n}
        </span>
      ) : null}
    </Link>
  )
}
