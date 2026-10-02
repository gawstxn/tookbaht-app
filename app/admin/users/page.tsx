"use client"

import { useEffect, useState } from "react"
import { useTranslation } from "react-i18next"
import { InfoRow, Tag, useAdminOnly } from "@/components/admin"
import { PushScreen } from "@/components/app"
import { ConfirmSheet } from "@/components/ConfirmSheet"
import { Avatar } from "@/components/ProfileSheet"
import { Icon } from "@/components/ui/Icon"
import {
  Bar,
  Card,
  Empty,
  ListCard,
  PrimaryButton,
  PushHeader,
  SecondaryButton,
  Sheet,
} from "@/components/ui/primitives"
import {
  ADMIN_PAGE,
  DB_LIMIT_BYTES,
  ROW_CAPS,
  dataSize,
  fetchAdminOverview,
  fetchAdminUserDetail,
  fetchAdminUsers,
  megabytes,
  setSuspended,
  type AdminOverview,
  type AdminUser,
  type AdminUserDetail,
} from "@/lib/admin"
import { shortDate, timeAgo, toISO } from "@/lib/format"
import { useGoBack } from "@/lib/nav"
import { useStore } from "@/lib/store"
import { getSupabase } from "@/lib/supabase/client"

/** Admin: who uses the app and when they last opened it; suspend an account that abuses it. */
export default function AdminUsersPage() {
  const { t } = useTranslation()
  const goBack = useGoBack("/profile")
  const isAdmin = useAdminOnly()
  const myId = useStore((s) => s.userId)
  const notify = useStore((s) => s.notify)
  const [query, setQuery] = useState("")
  const [users, setUsers] = useState<AdminUser[] | null>(null)
  const [overview, setOverview] = useState<AdminOverview | null>(null)
  const [more, setMore] = useState(false)
  const [failed, setFailed] = useState(false)
  const [busy, setBusy] = useState(false)
  const [picked, setPicked] = useState<AdminUser | null>(null)
  // The picked user's counts and settings, fetched when their sheet opens.
  const [detail, setDetail] = useState<{ id: string; data: AdminUserDetail } | null>(null)
  const pickedId = picked?.id
  const [sheet, setSheet] = useState<"" | "detail" | "suspend" | "lift">("")
  const [note, setNote] = useState("")
  // Bumped to fetch again (retry, or after suspending changed the totals).
  const [round, setRound] = useState(0)
  const [now, setNow] = useState(() => Date.now())

  useEffect(() => {
    if (!isAdmin) return
    let stale = false
    // Wait for typing to pause before searching.
    const timer = setTimeout(
      async () => {
        try {
          const list = await fetchAdminUsers(getSupabase(), query)
          if (stale) return
          setUsers(list)
          setMore(list.length === ADMIN_PAGE)
          setFailed(false)
          setNow(Date.now())
        } catch (e) {
          console.error(e)
          if (!stale) setFailed(true)
        }
      },
      query ? 300 : 0,
    )
    return () => {
      stale = true
      clearTimeout(timer)
    }
  }, [isAdmin, query, round])

  useEffect(() => {
    if (!isAdmin) return
    let stale = false
    fetchAdminOverview(getSupabase())
      .then((o) => {
        if (!stale) setOverview(o)
      })
      .catch((e) => console.error(e))
    return () => {
      stale = true
    }
  }, [isAdmin, round])

  useEffect(() => {
    if (!isAdmin || !pickedId) return
    let stale = false
    fetchAdminUserDetail(getSupabase(), pickedId)
      .then((data) => {
        if (!stale && data) setDetail({ id: pickedId, data })
      })
      .catch((e) => console.error(e))
    return () => {
      stale = true
    }
  }, [isAdmin, pickedId])
  const info = detail && detail.id === pickedId ? detail.data : null

  const loadMore = async () => {
    if (!users || busy) return
    setBusy(true)
    try {
      const list = await fetchAdminUsers(getSupabase(), query, users.length)
      const have = new Set(users.map((u) => u.id))
      setUsers([...users, ...list.filter((u) => !have.has(u.id))])
      setMore(list.length === ADMIN_PAGE)
    } catch (e) {
      console.error(e)
      notify(t("admin.loadFailed"), { tone: "error" })
    }
    setBusy(false)
  }

  const suspend = async (user: AdminUser, on: boolean) => {
    setBusy(true)
    try {
      await setSuspended(getSupabase(), user.id, on, note)
      const patch = { suspendedAt: on ? Date.now() : null, suspendedNote: on ? note.trim() : "" }
      setUsers((list) => list?.map((u) => (u.id === user.id ? { ...u, ...patch } : u)) ?? null)
      setPicked({ ...user, ...patch })
      setRound((n) => n + 1)
      notify(t(on ? "admin.suspendedToast" : "admin.liftedToast", { name: user.name || user.email }))
      setSheet("detail")
    } catch (e) {
      console.error(e)
      notify(t("admin.actionFailed"), { tone: "error" })
    }
    setBusy(false)
  }

  if (!isAdmin) return <PushScreen>{null}</PushScreen>

  return (
    <PushScreen>
      <PushHeader title={t("admin.users")} onBack={goBack} />

      {overview ? (
        <Card className="flex flex-col gap-3 px-4 py-3.5">
          <div className="grid grid-cols-3 gap-2">
            <Stat label={t("admin.total")} value={overview.users} />
            <Stat label={t("admin.activeDay")} value={overview.activeDay} />
            <Stat label={t("admin.activeWeek")} value={overview.activeWeek} />
          </div>
          <div className="flex flex-col gap-1.5 border-t border-divider pt-3">
            <div className="flex items-center justify-between text-xs text-muted">
              <span>{t("admin.database")}</span>
              <span className="font-mono font-semibold text-ink">
                {megabytes(overview.dbBytes)} / {megabytes(DB_LIMIT_BYTES)}
              </span>
            </div>
            <Bar
              value={overview.dbBytes / DB_LIMIT_BYTES}
              height={6}
              track="var(--color-divider)"
              color={overview.dbBytes / DB_LIMIT_BYTES > 0.8 ? "var(--color-expense)" : "var(--color-income)"}
            />
          </div>
          {overview.suspended ? (
            <span className="text-xs text-muted">{t("admin.suspendedCount", { count: overview.suspended })}</span>
          ) : null}
        </Card>
      ) : null}

      <label className="flex min-h-12 items-center gap-2 rounded-[14px] border border-line bg-card px-3.5">
        <Icon name="search" size={18} className="text-muted" />
        <span className="sr-only">{t("admin.search")}</span>
        <input
          value={query}
          maxLength={80}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={t("admin.search")}
          autoCapitalize="none"
          autoCorrect="off"
          className="min-w-0 grow bg-transparent text-[15px] outline-none"
        />
      </label>

      {failed ? (
        <div className="flex flex-col items-center gap-3 py-6">
          <p className="text-sm text-muted">{t("admin.loadFailed")}</p>
          <SecondaryButton onClick={() => setRound((n) => n + 1)}>{t("common.retry")}</SecondaryButton>
        </div>
      ) : users === null ? (
        <Empty>{t("admin.loading")}</Empty>
      ) : users.length === 0 ? (
        <Empty>{t("admin.noUsers")}</Empty>
      ) : (
        <ListCard>
          {users.map((u) => (
            <button
              key={u.id}
              type="button"
              onClick={() => {
                setPicked(u)
                setSheet("detail")
              }}
              className="flex min-h-16 w-full items-center gap-3 text-left"
            >
              <Avatar name={u.name || u.email} avatar={u.avatar} size={40} />
              <span className="flex min-w-0 grow flex-col">
                <span className="flex items-center gap-1.5">
                  <span className="truncate text-[15px] font-medium">{u.name || "—"}</span>
                  {u.suspendedAt ? <Tag tone="danger">{t("admin.tagSuspended")}</Tag> : null}
                  {u.role === "admin" ? <Tag>{t("admin.tagAdmin")}</Tag> : null}
                  {u.deletionRequestedAt ? <Tag>{t("admin.tagDeleting")}</Tag> : null}
                </span>
                <span className="truncate text-xs text-muted">{u.email}</span>
              </span>
              <span className="shrink-0 text-right text-xs text-muted">
                {u.lastActiveAt ? timeAgo(u.lastActiveAt, now) : t("admin.never")}
              </span>
            </button>
          ))}
        </ListCard>
      )}

      {more && !failed ? (
        <SecondaryButton onClick={loadMore}>{busy ? t("admin.loading") : t("admin.more")}</SecondaryButton>
      ) : null}

      <p className="text-center text-xs leading-relaxed text-faint">{t("admin.privacyNote")}</p>

      <Sheet open={sheet === "detail"} onClose={() => setSheet("")} title={t("admin.userTitle")}>
        {picked ? (
          <>
            <div className="flex items-center gap-3">
              <Avatar name={picked.name || picked.email} avatar={picked.avatar} size={48} />
              <span className="flex min-w-0 flex-col">
                <span className="truncate text-[17px] font-semibold">{picked.name || "—"}</span>
                <span className="truncate text-[13px] text-muted select-text">{picked.email}</span>
              </span>
            </div>
            <ListCard>
              <InfoRow
                label={t("admin.status")}
                value={
                  picked.suspendedAt
                    ? t("admin.statusSuspended", { date: shortDate(toISO(new Date(picked.suspendedAt))) })
                    : picked.deletionRequestedAt
                      ? t("admin.statusDeleting")
                      : t("admin.statusActive")
                }
              />
              <InfoRow
                label={t("admin.lastActive")}
                value={picked.lastActiveAt ? timeAgo(picked.lastActiveAt, now) : t("admin.never")}
              />
              <InfoRow label={t("admin.joined")} value={shortDate(toISO(new Date(picked.createdAt)))} />
              {picked.role === "admin" ? <InfoRow label={t("admin.role")} value={t("admin.tagAdmin")} /> : null}
              {info ? (
                <InfoRow label={t("admin.pushDevices")} value={t("admin.devices", { count: info.pushDevices })} />
              ) : null}
            </ListCard>
            <section className="flex flex-col gap-2">
              <h3 className="text-sm font-semibold">{t("admin.stored")}</h3>
              <ListCard>
                <CapRow label={t("admin.entries")} n={info ? info.entries : picked.entries} cap={ROW_CAPS.entries} />
                {info ? (
                  <>
                    <InfoRow label={t("admin.entriesDay")} value={info.entriesDay.toLocaleString("en-US")} />
                    <InfoRow label={t("admin.entriesWeek")} value={info.entriesWeek.toLocaleString("en-US")} />
                    <CapRow label={t("admin.rowsAccounts")} n={info.accounts} cap={ROW_CAPS.accounts} />
                    <CapRow label={t("admin.rowsSchedules")} n={info.subscriptions} cap={ROW_CAPS.subscriptions} />
                    <CapRow label={t("ious.title")} n={info.ious} cap={ROW_CAPS.ious} />
                    <CapRow label={t("savings.title")} n={info.savingsGoals} cap={ROW_CAPS.savingsGoals} />
                    <CapRow label={t("wish.title")} n={info.wishes} cap={ROW_CAPS.wishes} />
                    <CapRow label={t("admin.feedback")} n={info.feedback} cap={ROW_CAPS.feedback} />
                    <InfoRow label={t("admin.feedbackDay")} value={info.feedbackDay.toLocaleString("en-US")} />
                    <InfoRow label={t("admin.dataSize")} value={dataSize(info.dataBytes)} />
                  </>
                ) : null}
              </ListCard>
            </section>
            {picked.suspendedAt && picked.suspendedNote ? (
              <p className="text-sm leading-relaxed text-muted">
                {t("admin.noteLabel")}: {picked.suspendedNote}
              </p>
            ) : null}
            {picked.role === "admin" || picked.id === myId ? (
              <p className="text-xs leading-relaxed text-faint">{t("admin.cannotSuspendAdmin")}</p>
            ) : picked.suspendedAt ? (
              <SecondaryButton onClick={() => setSheet("lift")}>{t("admin.lift")}</SecondaryButton>
            ) : (
              <SecondaryButton
                tone="danger"
                onClick={() => {
                  setNote("")
                  setSheet("suspend")
                }}
              >
                {t("admin.suspend")}
              </SecondaryButton>
            )}
          </>
        ) : null}
      </Sheet>

      <Sheet
        open={sheet === "suspend"}
        onClose={() => !busy && setSheet("detail")}
        title={t("admin.suspendTitle", { name: picked?.name || picked?.email || "" })}
        titleClassName="text-danger"
      >
        <p className="text-sm leading-relaxed text-muted">{t("admin.suspendLead")}</p>
        <label className="flex flex-col gap-1">
          <span className="text-xs text-muted">{t("admin.noteLabel")}</span>
          <input
            value={note}
            maxLength={200}
            onChange={(e) => setNote(e.target.value)}
            placeholder={t("admin.notePlaceholder")}
            className="min-h-12 w-full rounded-xl border border-line bg-card px-3 text-[15px] outline-none"
          />
        </label>
        <PrimaryButton tone="danger" disabled={busy} onClick={() => picked && void suspend(picked, true)}>
          {t("admin.suspend")}
        </PrimaryButton>
        <SecondaryButton onClick={() => !busy && setSheet("detail")}>{t("common.cancel")}</SecondaryButton>
      </Sheet>

      <ConfirmSheet
        open={sheet === "lift"}
        onClose={() => !busy && setSheet("detail")}
        title={t("admin.liftTitle", { name: picked?.name || picked?.email || "" })}
        lead={t("admin.liftLead")}
        confirmLabel={t("admin.lift")}
        tone="ink"
        onConfirm={() => picked && void suspend(picked, false)}
      />
    </PushScreen>
  )
}

/** How many rows of a kind the account keeps, against the most it may; red from 80%. */
function CapRow({ label, n, cap }: { label: string; n: number; cap: number }) {
  return (
    <InfoRow
      label={label}
      value={
        <span className={n >= cap * 0.8 ? "text-danger" : undefined}>
          {n.toLocaleString("en-US")}
          <span className="font-normal text-muted"> / {cap.toLocaleString("en-US")}</span>
        </span>
      }
    />
  )
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="flex flex-col gap-0.5">
      <span className="font-mono text-[22px] leading-tight font-semibold">{value.toLocaleString("en-US")}</span>
      <span className="text-xs text-muted">{label}</span>
    </div>
  )
}
