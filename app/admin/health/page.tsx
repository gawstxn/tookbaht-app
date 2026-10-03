"use client"

import { useEffect, useState } from "react"
import { useTranslation } from "react-i18next"
import { Tag, useAdminOnly } from "@/components/admin"
import { PushScreen } from "@/components/app"
import { Empty, ListCard, PushHeader, SecondaryButton } from "@/components/ui/primitives"
import { timeAgo } from "@/lib/format"
import { overallStatus, type HealthCheck, type HealthReport, type HealthStatus } from "@/lib/health"
import { useGoBack } from "@/lib/nav"

const TONE: Record<HealthStatus, "ok" | "plain" | "danger"> = { ok: "ok", warn: "plain", fail: "danger" }

/** The report, or a failed database check when the server couldn't reach the database at all. */
async function fetchHealth(): Promise<HealthReport> {
  const res = await fetch("/api/admin/health", { cache: "no-store" })
  if (res.status === 503) {
    return { checks: [{ id: "db", status: "fail", detail: "dbDown" }], version: "", commit: "", at: Date.now() }
  }
  if (!res.ok) throw new Error(`health ${res.status}`)
  return (await res.json()) as HealthReport
}

/** Admin: is the app healthy? Database, scheduled jobs, sign-in, push, the Discord webhook. */
export default function AdminHealthPage() {
  const { t } = useTranslation()
  const goBack = useGoBack("/profile")
  const isAdmin = useAdminOnly()
  const [report, setReport] = useState<HealthReport | null>(null)
  const [failed, setFailed] = useState(false)
  const [busy, setBusy] = useState(true)
  // Bumped to check again.
  const [round, setRound] = useState(0)

  useEffect(() => {
    if (!isAdmin) return
    let stale = false
    fetchHealth()
      .then((r) => {
        if (stale) return
        setReport(r)
        setFailed(false)
      })
      .catch((e) => {
        console.error(e)
        if (!stale) setFailed(true)
      })
      .finally(() => {
        if (!stale) setBusy(false)
      })
    return () => {
      stale = true
    }
  }, [isAdmin, round])

  if (!isAdmin) return <PushScreen>{null}</PushScreen>

  const checks = report?.checks ?? []
  const system = checks.filter((c) => !c.id.startsWith("job:"))
  const jobs = checks.filter((c) => c.id.startsWith("job:"))
  const overall = overallStatus(checks)
  const bad = checks.filter((c) => c.status !== "ok").length

  return (
    <PushScreen>
      <PushHeader title={t("admin.healthTitle")} onBack={goBack} />

      {failed ? (
        <p className="py-6 text-center text-sm text-muted">{t("admin.loadFailed")}</p>
      ) : !report ? (
        <Empty>{t("admin.healthChecking")}</Empty>
      ) : (
        <>
          <div className="flex flex-col gap-1">
            <p className="text-[17px] font-semibold">
              {overall === "ok" ? t("admin.healthAllOk") : t("admin.healthSomeBad", { count: bad })}
            </p>
            {report.version ? (
              <p className="text-xs text-muted">
                {t("admin.version")} {report.version} ({report.commit})
              </p>
            ) : null}
          </div>
          <ListCard>
            {system.map((c) => (
              <CheckRow key={c.id} check={c} label={t(`admin.health.${c.id}`)} now={report.at} />
            ))}
          </ListCard>
          {jobs.length ? (
            <section className="flex flex-col gap-2">
              <h2 className="text-sm font-semibold">{t("admin.healthJobs")}</h2>
              <ListCard>
                {jobs.map((c) => (
                  <CheckRow key={c.id} check={c} label={t(`admin.healthJob.${c.id.slice(4)}`)} now={report.at} />
                ))}
              </ListCard>
            </section>
          ) : null}
        </>
      )}

      <SecondaryButton
        onClick={() => {
          if (busy) return
          setBusy(true)
          setRound((n) => n + 1)
        }}
      >
        {busy ? t("admin.healthChecking") : t("admin.healthAgain")}
      </SecondaryButton>
    </PushScreen>
  )
}

/** A check's name, what was found underneath, and its status on the right. */
function CheckRow({ check, label, now }: { check: HealthCheck; label: string; now: number }) {
  const { t } = useTranslation()
  const notes = [
    check.detail ? t(`admin.healthDetail.${check.detail}`) : "",
    check.text ?? "",
    check.at ? t("admin.healthRan", { when: timeAgo(check.at, now) }) : "",
    check.ms !== undefined && check.status === "ok" ? t("admin.healthMs", { ms: check.ms }) : "",
  ].filter(Boolean)
  return (
    <div className="flex min-h-14 items-center justify-between gap-3 py-2">
      <span className="flex min-w-0 flex-col">
        <span className="text-[15px] font-medium">{label}</span>
        {notes.length ? <span className="text-xs leading-relaxed text-muted">{notes.join(" · ")}</span> : null}
      </span>
      <Tag tone={TONE[check.status]}>{t(`admin.healthStatus.${check.status}`)}</Tag>
    </div>
  )
}
