"use client"

import { useEffect, useState } from "react"
import { useTranslation } from "react-i18next"
import { InfoRow, Tag, useAdminOnly } from "@/components/admin"
import { PushScreen } from "@/components/app"
import {
  Empty,
  ListCard,
  PrimaryButton,
  PushHeader,
  SecondaryButton,
  Segmented,
  Sheet,
  cx,
} from "@/components/ui/primitives"
import { ADMIN_PAGE, deviceLabel, fetchAdminFeedback, resolveFeedback, type AdminFeedback } from "@/lib/admin"
import { timeAgo } from "@/lib/format"
import { useGoBack } from "@/lib/nav"
import { useStore } from "@/lib/store"
import { getSupabase } from "@/lib/supabase/client"

type Filter = "open" | "all"

/** Admin: the problem reports users send from their profile. */
export default function AdminFeedbackPage() {
  const { t } = useTranslation()
  const goBack = useGoBack("/profile")
  const isAdmin = useAdminOnly()
  const notify = useStore((s) => s.notify)
  const [filter, setFilter] = useState<Filter>("open")
  const [items, setItems] = useState<AdminFeedback[] | null>(null)
  const [more, setMore] = useState(false)
  const [failed, setFailed] = useState(false)
  const [busy, setBusy] = useState(false)
  const [picked, setPicked] = useState<AdminFeedback | null>(null)
  const [round, setRound] = useState(0)
  const [now, setNow] = useState(() => Date.now())

  useEffect(() => {
    if (!isAdmin) return
    let stale = false
    fetchAdminFeedback(getSupabase(), filter === "open")
      .then((list) => {
        if (stale) return
        setItems(list)
        setMore(list.length === ADMIN_PAGE)
        setFailed(false)
        setNow(Date.now())
      })
      .catch((e) => {
        console.error(e)
        if (!stale) setFailed(true)
      })
    return () => {
      stale = true
    }
  }, [isAdmin, filter, round])

  const loadMore = async () => {
    if (!items || busy) return
    setBusy(true)
    try {
      const list = await fetchAdminFeedback(getSupabase(), filter === "open", items.length)
      const have = new Set(items.map((f) => f.id))
      setItems([...items, ...list.filter((f) => !have.has(f.id))])
      setMore(list.length === ADMIN_PAGE)
    } catch (e) {
      console.error(e)
      notify(t("admin.loadFailed"), { tone: "error" })
    }
    setBusy(false)
  }

  const resolve = async (f: AdminFeedback, done: boolean) => {
    setBusy(true)
    try {
      await resolveFeedback(getSupabase(), f.id, done)
      const resolvedAt = done ? Date.now() : null
      // Under "not done yet", a report that's done leaves the list.
      setItems(
        (list) =>
          list?.flatMap((x) => (x.id !== f.id ? [x] : filter === "open" && done ? [] : [{ ...x, resolvedAt }])) ?? null,
      )
      setPicked(null)
      notify(t(done ? "admin.resolvedToast" : "admin.reopenedToast"), {
        action: {
          label: t("common.undo"),
          run: () =>
            void resolveFeedback(getSupabase(), f.id, !done)
              .then(() => setRound((n) => n + 1))
              .catch((e) => console.error(e)),
        },
      })
    } catch (e) {
      console.error(e)
      notify(t("admin.actionFailed"), { tone: "error" })
    }
    setBusy(false)
  }

  const copyEmail = async (email: string) => {
    try {
      await navigator.clipboard.writeText(email)
      notify(t("admin.emailCopied"))
    } catch {
      notify(t("admin.actionFailed"), { tone: "error" })
    }
  }

  if (!isAdmin) return <PushScreen>{null}</PushScreen>

  return (
    <PushScreen>
      <PushHeader title={t("admin.feedback")} onBack={goBack} />

      <Segmented<Filter>
        label={t("admin.feedback")}
        value={filter}
        onChange={(v) => {
          setItems(null)
          setFilter(v)
        }}
        options={[
          { value: "open", label: t("admin.fbOpen") },
          { value: "all", label: t("common.all") },
        ]}
      />

      {failed ? (
        <div className="flex flex-col items-center gap-3 py-6">
          <p className="text-sm text-muted">{t("admin.loadFailed")}</p>
          <SecondaryButton onClick={() => setRound((n) => n + 1)}>{t("common.retry")}</SecondaryButton>
        </div>
      ) : items === null ? (
        <Empty>{t("admin.loading")}</Empty>
      ) : items.length === 0 ? (
        <Empty>{t(filter === "open" ? "admin.fbNoneOpen" : "admin.fbNone")}</Empty>
      ) : (
        <div className="flex flex-col gap-2">
          {items.map((f) => (
            <button
              key={f.id}
              type="button"
              onClick={() => setPicked(f)}
              className={cx(
                "flex w-full flex-col gap-2 rounded-2xl border border-line bg-card px-4 py-3 text-left",
                !!f.resolvedAt && "opacity-60",
              )}
            >
              <span className="line-clamp-3 text-[15px] leading-relaxed break-words whitespace-pre-wrap">
                {f.message}
              </span>
              <span className="flex items-center gap-1.5 text-xs text-muted">
                {/* A long name gives way; when it was sent always shows. */}
                <span className="min-w-0 truncate">{f.name || f.email}</span>
                <span className="shrink-0">· {timeAgo(f.createdAt, now)}</span>
                {f.resolvedAt ? <Tag tone="ok">{t("admin.fbDone")}</Tag> : null}
              </span>
            </button>
          ))}
        </div>
      )}

      {more && !failed ? (
        <SecondaryButton onClick={loadMore}>{busy ? t("admin.loading") : t("admin.more")}</SecondaryButton>
      ) : null}

      <Sheet open={!!picked} onClose={() => !busy && setPicked(null)} title={t("admin.fbTitle")}>
        {picked ? (
          <>
            <p className="max-h-[38dvh] overflow-y-auto rounded-xl border border-line bg-card px-3.5 py-3 text-[15px] leading-relaxed break-words whitespace-pre-wrap select-text">
              {picked.message}
            </p>
            <ListCard>
              <InfoRow label={t("admin.fbFrom")} value={picked.name || "—"} />
              <InfoRow label={t("admin.fbEmail")} value={<span className="select-text">{picked.email}</span>} />
              <InfoRow label={t("admin.fbWhen")} value={timeAgo(picked.createdAt, now)} />
              <InfoRow label={t("admin.fbPage")} value={picked.page || "—"} />
              <InfoRow label={t("admin.version")} value={picked.appVersion || "—"} />
              <InfoRow label={t("admin.fbDevice")} value={deviceLabel(picked.userAgent) || "—"} />
            </ListCard>
            <PrimaryButton disabled={busy} onClick={() => void resolve(picked, !picked.resolvedAt)}>
              {t(picked.resolvedAt ? "admin.fbReopen" : "admin.fbResolve")}
            </PrimaryButton>
            <SecondaryButton onClick={() => void copyEmail(picked.email)}>{t("admin.copyEmail")}</SecondaryButton>
          </>
        ) : null}
      </Sheet>
    </PushScreen>
  )
}
