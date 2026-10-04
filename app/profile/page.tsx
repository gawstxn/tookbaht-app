"use client"

import Link from "next/link"
import { useRouter } from "next/navigation"
import { useMemo, useRef, useState } from "react"
import { TabScreen } from "@/components/app"
import { Icon } from "@/components/ui/Icon"
import { canEditPromptPay, endPromptPayEdit, startReauth } from "@/lib/reauth"
import { useTranslation } from "react-i18next"
import { ListCard, PrimaryButton, SecondaryButton, Sheet, TabHeader } from "@/components/ui/primitives"
import { FeedbackSheet } from "@/components/FeedbackSheet"
import { InstallPrompt } from "@/components/InstallPrompt"
import { PromptPayForm } from "@/components/PromptPayForm"
import { Avatar, ProfileSheet } from "@/components/ProfileSheet"
import { TierBadge } from "@/components/TierBadge"
import { useCashFlow } from "@/components/cashflow"
import { firstShortfall } from "@/lib/cashflow"
import { useStreak } from "@/components/streak"
import { Group, NavRow } from "@/components/settingsUi"
import { BackupError, backupFileName, makeBackup, parseBackup, type BackupData } from "@/lib/backup"
import { TYPE_META, categoryLabel } from "@/lib/constants"
import { shortDate } from "@/lib/format"
import { debtsByPerson } from "@/lib/ious"
import { maskPromptPayId } from "@/lib/promptpay"
import { replaceAllData } from "@/lib/legacyImport"
import { useStore } from "@/lib/store"

export default function ProfilePage() {
  const router = useRouter()
  const user = useStore((s) => s.user)
  const userId = useStore((s) => s.userId)
  const accounts = useStore((s) => s.accounts)
  const transactions = useStore((s) => s.transactions)
  const subscriptions = useStore((s) => s.subscriptions)
  const ious = useStore((s) => s.ious)
  const savingsGoals = useStore((s) => s.savingsGoals)
  const wishes = useStore((s) => s.wishes)
  const goals = useStore((s) => s.goals)
  const settings = useStore((s) => s.settings)
  const usdRate = useStore((s) => s.usdRate)
  const pending = useStore((s) => s.pending)
  const signOut = useStore((s) => s.signOut)
  const load = useStore((s) => s.load)
  const notify = useStore((s) => s.notify)
  const owedCount = useMemo(() => debtsByPerson(ious).length, [ious])
  const cashFlows = useCashFlow()
  const cashShort = useMemo(() => firstShortfall(cashFlows), [cashFlows])
  const waitingWishes = wishes.filter((w) => w.status === "waiting").length
  const myCategories = (settings.customCategories ?? []).filter((c) => !c.hidden).length
  const { t: tr } = useTranslation()
  const streak = useStreak()
  const [sheet, setSheet] = useState<
    | ""
    | "profile"
    | "logout"
    | "delete"
    | "restore"
    | "currency"
    | "feedback"
    | "data"
    | "account"
    | "promptpay"
    | "promptpayLocked"
  >(
    // Back from confirming with Google to change the PromptPay ID (see AppShell).
    () => (canEditPromptPay() ? "promptpay" : ""),
  )
  const [restoring, setRestoring] = useState<BackupData | null>(null)
  const fileInput = useRef<HTMLInputElement>(null)
  const [busy, setBusy] = useState(false)
  const [confirmed, setConfirmed] = useState(false)

  const exportCsv = () => {
    const name = (id?: string) => accounts.find((a) => a.id === id)?.name ?? ""
    const rows = [
      [
        "date",
        "type",
        "title",
        "amount",
        "category",
        "account",
        "from",
        "to",
        "note",
        "tag",
        "original_amount",
        "original_currency",
        "fx_rate",
      ],
      ...[...transactions]
        .sort((a, b) => a.date.localeCompare(b.date))
        .map((t) => [
          t.date,
          TYPE_META[t.type].label,
          t.title,
          String(t.amount),
          categoryLabel(t.category),
          name(t.accountId),
          name(t.fromId),
          name(t.toId),
          t.note ?? "",
          t.tag ?? "",
          t.origAmount ? String(t.origAmount) : "",
          t.origCurrency ?? "",
          t.fxRate ? String(t.fxRate) : "",
        ]),
    ]
    // Prefix cells that spreadsheets would run as formulas (CSV injection).
    const cell = (c: string) => `"${(/^[=+\-@\t\r]/.test(c) ? "'" + c : c).replace(/"/g, '""')}"`
    const csv = "﻿" + rows.map((r) => r.map(cell).join(",")).join("\n")
    download(
      new Blob([csv], { type: "text/csv;charset=utf-8" }),
      `tookbaht-${new Date().toISOString().slice(0, 10)}.csv`,
    )
  }

  const exportBackup = () => {
    const file = makeBackup({ accounts, transactions, subscriptions, ious, savingsGoals, wishes, goals, settings })
    download(new Blob([JSON.stringify(file, null, 1)], { type: "application/json" }), backupFileName())
  }

  const pickBackup = async (file: File | undefined) => {
    if (!file) return
    try {
      setRestoring(parseBackup(await file.text()))
      setConfirmed(false)
      setSheet("restore")
    } catch (e) {
      const problem = e instanceof BackupError ? e.problem : "json"
      notify(tr(`profile.file${problem[0].toUpperCase()}${problem.slice(1)}`), { tone: "error" })
    }
  }

  const restore = async () => {
    if (!userId || !restoring) return
    setBusy(true)
    try {
      // Keep this device's consent record; the backup may predate the current terms.
      const keep = { termsAcceptedVersion: settings.termsAcceptedVersion, termsAcceptedAt: settings.termsAcceptedAt }
      await replaceAllData(
        userId,
        { ...restoring, settings: restoring.settings ? { ...restoring.settings, ...keep } : undefined },
        {
          accounts: accounts.map((a) => a.id),
          transactions: transactions.map((t) => t.id),
          subscriptions: subscriptions.map((s) => s.id),
          ious: ious.map((i) => i.id),
          savingsGoals: savingsGoals.map((g) => g.id),
          wishes: wishes.map((w) => w.id),
        },
      )
      await load(userId)
      notify(tr("profile.restored"))
    } catch (e) {
      console.error(e)
      await load(userId)
      notify(tr("profile.restoreFailed"), { tone: "error" })
    }
    setBusy(false)
    setSheet("")
  }

  return (
    <TabScreen>
      <TabHeader title={tr("profile.title")} />

      <section className="flex flex-col gap-4 rounded-[28px] bg-hero p-[22px] text-on-hero shadow-hero">
        <button
          type="button"
          onClick={() => setSheet("profile")}
          aria-label={tr("profile.editTitle")}
          className="flex items-center gap-4 text-left"
        >
          <span className="shrink-0 rounded-full p-[3px]" style={{ background: streak.tier.tone }}>
            <span className="block rounded-full bg-hero p-[2px]">
              <Avatar name={user?.name} avatar={settings.avatar} size={56} />
            </span>
          </span>
          <div className="flex min-w-0 grow flex-col gap-0.5">
            <span className="truncate font-serif text-xl font-bold">{user?.name}</span>
            <span className="truncate text-[13px] text-on-ink-muted">{user?.email}</span>
          </div>
          <span
            aria-hidden="true"
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-ink-line"
          >
            <Icon name="pencil" size={16} strokeWidth={2} />
          </span>
        </button>
        <Link
          href="/streak"
          className="flex min-h-9 items-center gap-2 border-t border-ink-line pt-3 text-xs text-on-ink-muted"
        >
          <span className="flex items-center gap-1">
            <TierBadge tier={streak.tier} size={16} />
            <span className="font-semibold text-on-hero">{tr(`streak.tier.${streak.tier.key}`)}</span>
          </span>
          <span className="flex grow items-center gap-1">
            <Icon name="flame" size={13} strokeWidth={2.2} className={streak.doneToday ? "text-lime" : undefined} />
            {tr("streak.days", { count: streak.current })}
          </span>
          <Icon name="chevronRight" size={14} strokeWidth={2.2} />
        </Link>
      </section>

      <InstallPrompt variant="row" />

      <Group title={tr("profile.finance")}>
        <NavRow
          label={tr("profile.myAccounts")}
          value={tr("common.accounts", { count: accounts.length })}
          onClick={() => router.push("/accounts")}
        />
        <NavRow
          label={tr("cashflow.open")}
          value={cashShort ? tr("cashflow.rowShort", { date: shortDate(cashShort.event.date, false) }) : undefined}
          onClick={() => router.push("/cashflow")}
        />
        <NavRow
          label={tr("cats.title")}
          value={myCategories ? tr("cats.count", { count: myCategories }) : undefined}
          onClick={() => router.push("/categories")}
        />
        <NavRow
          label={tr("promptpay.row")}
          value={settings.promptPayId ? maskPromptPayId(settings.promptPayId) : tr("promptpay.notSet")}
          // Setting it the first time is free; changing or removing it asks Google first.
          onClick={() => setSheet(settings.promptPayId && !canEditPromptPay() ? "promptpayLocked" : "promptpay")}
        />
        <NavRow
          label={tr("profile.currency")}
          value={tr("profile.currencyValue")}
          onClick={() => setSheet("currency")}
        />
        <NavRow
          label={tr("ious.title")}
          value={owedCount ? tr("ious.people", { count: owedCount }) : undefined}
          onClick={() => router.push("/ious")}
        />
        <NavRow
          label={tr("wish.title")}
          value={waitingWishes ? tr("wish.waitingCount", { count: waitingWishes }) : undefined}
          onClick={() => router.push("/wishlist")}
        />
        <NavRow
          label={tr("savings.title")}
          value={savingsGoals.length ? String(savingsGoals.length) : undefined}
          onClick={() => router.push("/goals")}
        />
        <NavRow label={tr("profile.myData")} value={tr("profile.myDataValue")} onClick={() => setSheet("data")} />
      </Group>
      <input
        ref={fileInput}
        type="file"
        accept="application/json,.json"
        hidden
        onChange={(e) => {
          void pickBackup(e.target.files?.[0])
          e.target.value = ""
        }}
      />

      <ListCard>
        <NavRow label={tr("settings.title")} onClick={() => router.push("/settings")} />
      </ListCard>

      {user?.role === "admin" ? (
        <Group title={tr("admin.title")}>
          <NavRow label={tr("admin.users")} onClick={() => router.push("/admin/users")} />
          <NavRow label={tr("admin.feedback")} onClick={() => router.push("/admin/feedback")} />
          <NavRow label={tr("admin.healthTitle")} onClick={() => router.push("/admin/health")} />
        </Group>
      ) : null}

      <Group title={tr("profile.about")}>
        <NavRow label={tr("login.terms")} onClick={() => router.push("/terms")} />
        <NavRow label={tr("login.privacy")} onClick={() => router.push("/privacy")} />
        <NavRow label={tr("feedback.row")} onClick={() => setSheet("feedback")} />
      </Group>

      <Group title={tr("profile.account")}>
        <NavRow label={tr("profile.manageAccount")} onClick={() => setSheet("account")} />
        <button
          type="button"
          onClick={() => setSheet("logout")}
          className="flex min-h-[52px] w-full items-center gap-3 text-left text-[15px]"
        >
          <Icon name="logout" size={18} />
          {tr("profile.logout")}
        </button>
      </Group>

      <p className="text-center font-mono text-[11px] text-faint">
        Tookbaht v{process.env.NEXT_PUBLIC_APP_VERSION} · {process.env.NEXT_PUBLIC_APP_COMMIT}
      </p>

      <Sheet open={sheet === "logout"} onClose={() => setSheet("")} title={tr("profile.logoutTitle")}>
        <p className="text-sm text-muted">{tr("profile.logoutLead")}</p>
        {pending > 0 ? (
          <p className="text-sm font-semibold text-danger">{tr("offline.logoutPending", { count: pending })}</p>
        ) : null}
        <PrimaryButton
          disabled={busy}
          onClick={async () => {
            setBusy(true)
            await signOut()
            router.replace("/login")
          }}
        >
          {busy ? tr("profile.loggingOut") : tr("profile.logout")}
        </PrimaryButton>
        <SecondaryButton onClick={() => setSheet("")}>{tr("common.cancel")}</SecondaryButton>
      </Sheet>

      <Sheet
        open={sheet === "promptpay"}
        onClose={() => {
          endPromptPayEdit()
          setSheet("")
        }}
        title={tr("promptpay.row")}
      >
        <p className="text-sm text-muted">{tr("promptpay.lead")}</p>
        <PromptPayForm
          onSaved={() => {
            endPromptPayEdit()
            setSheet("")
          }}
        />
      </Sheet>
      <Sheet open={sheet === "promptpayLocked"} onClose={() => !busy && setSheet("")} title={tr("promptpay.row")}>
        <div className="flex items-center justify-between rounded-2xl border border-line bg-card px-4 py-3">
          <span className="text-sm text-muted">{tr("promptpay.current")}</span>
          <span className="font-mono text-[15px] font-semibold">
            {settings.promptPayId ? maskPromptPayId(settings.promptPayId) : ""}
          </span>
        </div>
        <p className="text-sm text-muted">{tr("promptpay.lockedLead")}</p>
        <PrimaryButton
          disabled={busy}
          onClick={async () => {
            // Google asks again; AppShell brings us back here with editing allowed.
            setBusy(true)
            if (!(await startReauth("promptpay"))) {
              setBusy(false)
              notify(tr("reauth.failed"), { tone: "error" })
            }
          }}
        >
          {tr("reauth.google")}
        </PrimaryButton>
        <SecondaryButton onClick={() => setSheet("")}>{tr("common.cancel")}</SecondaryButton>
      </Sheet>
      <Sheet open={sheet === "currency"} onClose={() => setSheet("")} title={tr("profile.currency")}>
        <p className="text-sm text-muted">{tr("profile.currencyLead")}</p>
        <ListCard>
          <div className="flex min-h-[52px] items-center justify-between gap-3">
            <span className="text-[15px]">{tr("profile.currencyMain")}</span>
            <span className="text-[13px] font-semibold">{tr("profile.currencyValue")}</span>
          </div>
          <div className="flex min-h-[52px] items-center justify-between gap-3">
            <span className="flex flex-col">
              <span className="text-[15px]">{tr("profile.usdRate")}</span>
              {usdRate ? (
                <span className="text-xs text-muted">
                  {tr("profile.usdRateAsOf", { date: shortDate(usdRate.date) })}
                </span>
              ) : null}
            </span>
            <span className="font-mono text-[13px] font-semibold">{usdRate ? `฿${usdRate.rate.toFixed(2)}` : "—"}</span>
          </div>
        </ListCard>
        <PrimaryButton onClick={() => setSheet("")}>{tr("common.gotIt")}</PrimaryButton>
      </Sheet>

      <Sheet open={sheet === "data"} onClose={() => setSheet("")} title={tr("profile.myData")}>
        <ListCard>
          <SheetRow icon="download" label={tr("profile.export")} hint={tr("profile.exportHint")} onClick={exportCsv} />
          <SheetRow
            icon="download"
            label={tr("profile.backup")}
            hint={tr("profile.backupHint")}
            onClick={exportBackup}
          />
          <SheetRow
            icon="upload"
            label={tr("profile.restore")}
            hint={tr("profile.restoreHint")}
            onClick={() => {
              setSheet("")
              fileInput.current?.click()
            }}
          />
        </ListCard>
      </Sheet>

      <Sheet open={sheet === "account"} onClose={() => setSheet("")} title={tr("profile.manageAccount")}>
        <ListCard>
          <div className="flex min-h-[52px] items-center justify-between gap-3">
            <span className="text-[15px]">{tr("profile.signedInAs")}</span>
            <span className="truncate text-[13px] text-muted">{user?.email}</span>
          </div>
          <div className="flex min-h-[52px] items-center justify-between gap-3">
            <span className="text-[15px]">{tr("profile.signInWith")}</span>
            <span className="text-[13px] text-muted">
              {user?.provider === "google" ? "Google" : tr("profile.emailProvider")}
            </span>
          </div>
        </ListCard>
        <p className="text-xs leading-relaxed text-muted">{tr("profile.deleteIntro")}</p>
        <SecondaryButton
          tone="danger"
          onClick={() => {
            setConfirmed(false)
            setSheet("delete")
          }}
        >
          {tr("profile.delete")}
        </SecondaryButton>
      </Sheet>

      <FeedbackSheet open={sheet === "feedback"} onClose={() => setSheet("")} />
      <ProfileSheet open={sheet === "profile"} onClose={() => setSheet("")} />

      <Sheet open={sheet === "restore"} onClose={() => !busy && setSheet("")} title={tr("profile.restoreTitle")}>
        {restoring ? (
          <p className="text-sm text-muted">
            {tr("profile.restoreLead", {
              accounts: restoring.accounts.length,
              transactions: restoring.transactions.length,
              subs: restoring.subscriptions.length,
            })}
          </p>
        ) : null}
        <p className="text-sm font-semibold text-danger">{tr("profile.restoreWarn")}</p>
        <label className="flex min-h-12 cursor-pointer items-center gap-3 rounded-[14px] border border-line bg-card px-3.5 text-sm">
          <input
            type="checkbox"
            checked={confirmed}
            onChange={(e) => setConfirmed(e.target.checked)}
            className="h-5 w-5 accent-ink"
          />
          {tr("profile.restoreConfirm")}
        </label>
        <PrimaryButton disabled={!confirmed || busy} onClick={restore}>
          {busy ? tr("profile.restoring") : tr("profile.restore")}
        </PrimaryButton>
        <SecondaryButton onClick={() => !busy && setSheet("")}>{tr("common.cancel")}</SecondaryButton>
      </Sheet>

      <Sheet
        open={sheet === "delete"}
        onClose={() => setSheet("")}
        title={tr("profile.deleteTitle")}
        titleClassName="text-danger"
      >
        <p className="text-sm text-muted">{tr("profile.deleteLead")}</p>
        <SecondaryButton onClick={exportBackup}>{tr("profile.deleteBackup")}</SecondaryButton>
        <label className="flex min-h-12 cursor-pointer items-center gap-3 rounded-[14px] border border-line bg-card px-3.5 text-sm">
          <input
            type="checkbox"
            checked={confirmed}
            onChange={(e) => setConfirmed(e.target.checked)}
            className="h-5 w-5 accent-danger"
          />
          {tr("profile.deleteConfirm")}
        </label>
        <PrimaryButton
          tone="danger"
          disabled={!confirmed || busy}
          onClick={async () => {
            // Google asks again; AppShell finishes the deletion when we come back.
            setBusy(true)
            if (!(await startReauth("delete"))) {
              setBusy(false)
              notify(tr("reauth.failed"), { tone: "error" })
            }
          }}
        >
          {busy ? tr("profile.deleting") : tr("profile.deleteGo")}
        </PrimaryButton>
        <SecondaryButton onClick={() => setSheet("")}>{tr("common.cancel")}</SecondaryButton>
      </Sheet>
    </TabScreen>
  )
}

/** Save a file from the browser (the share sheet on iOS). */
function download(blob: Blob, name: string) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement("a")
  a.href = url
  a.download = name
  a.click()
  URL.revokeObjectURL(url)
}

function SheetRow({
  icon,
  label,
  hint,
  onClick,
}: {
  icon: "download" | "upload"
  label: string
  hint: string
  onClick: () => void
}) {
  return (
    <button type="button" onClick={onClick} className="flex min-h-[60px] w-full items-center gap-3 py-2 text-left">
      <span aria-hidden="true" className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-chip">
        <Icon name={icon} size={18} strokeWidth={2} />
      </span>
      <span className="flex min-w-0 grow flex-col">
        <span className="text-[15px] font-medium">{label}</span>
        <span className="text-xs text-muted">{hint}</span>
      </span>
    </button>
  )
}
