"use client"

import Link from "next/link"
import { useParams, useRouter } from "next/navigation"
import { useState } from "react"
import { PushScreen, SubMono, TxIcon, TxRow } from "@/components/app"
import { Icon } from "@/components/ui/Icon"
import {
  Card,
  Empty,
  ListCard,
  PrimaryButton,
  PushHeader,
  SecondaryButton,
  Sheet,
  SwitchRow,
} from "@/components/ui/primitives"
import { SUB_CATEGORIES, TYPE_META, categoryLabel } from "@/lib/constants"
import {
  baht2,
  cycleLabel,
  cyclePer,
  diffDays,
  dueDatesUntil,
  fromISO,
  relativeDue,
  shortDate,
  todayISO,
} from "@/lib/format"
import { renewalNotifId, spentSoFar, upcomingRenewal, yearlyCost } from "@/lib/renewals"
import { chargesSoFar, nextCharge, planInterest } from "@/lib/selectors"
import { inTrial } from "@/lib/trial"
import { useTranslation } from "react-i18next"
import { formatMoney, subTHB } from "@/lib/fx"
import { useStore } from "@/lib/store"

export default function SubscriptionDetailPage() {
  const { id } = useParams<{ id: string }>()
  const router = useRouter()
  const sub = useStore((s) => s.subscriptions.find((x) => x.id === id))
  const accounts = useStore((s) => s.accounts)
  const transactions = useStore((s) => s.transactions)
  const update = useStore((s) => s.updateSubscription)
  const remove = useStore((s) => s.deleteSubscription)
  const usdRate = useStore((s) => s.usdRate)
  const renewKept = useStore((s) => s.settings.renewKept)
  const setSettings = useStore((s) => s.setSettings)
  const markRead = useStore((s) => s.markNotificationRead)
  const notify = useStore((s) => s.notify)
  const { t: tr } = useTranslation()
  const [confirm, setConfirm] = useState(false)
  const today = todayISO()

  if (!sub) {
    return (
      <PushScreen>
        <PushHeader backHref="/subscriptions" />
        <Empty>{tr("subs.notFound")}</Empty>
      </PushScreen>
    )
  }

  const recurring = sub.kind === "recurring"
  const next = nextCharge(sub, today)
  const days = next ? diffDays(next.due, today) : 0
  const history = dueDatesUntil(sub.startDate, sub.cycle, today).reverse().slice(0, 3)
  const logged = transactions
    .filter((t) => t.subscriptionId === sub.id)
    .sort((a, b) => b.date.localeCompare(a.date))
    .slice(0, 5)
  const paid = chargesSoFar(sub, today)
  const meta = TYPE_META[sub.entryType]
  const interest = planInterest(sub)
  const accName = (id?: string | null) => accounts.find((a) => a.id === id)?.name ?? "—"
  const start = fromISO(sub.startDate)
  const estimate = subTHB(sub, accounts, usdRate)
  // A yearly renewal coming up asks whether it's still used, until the user answers.
  const renewal = upcomingRenewal(sub, today)
  const reviewId = renewal ? renewalNotifId(renewal) : null
  const askReview = renewal && reviewId && !(renewKept ?? []).includes(reviewId)
  const spent = recurring ? null : spentSoFar(sub, transactions, today)
  const trial = inTrial(sub, today)
  const dayRule =
    sub.cycle === "week"
      ? tr("subs.everyWeek")
      : sub.cycle === "year"
        ? tr("subs.everyYear", { date: shortDate(sub.startDate, false) })
        : tr("subs.everyMonthDay", { day: start.getDate() })

  return (
    <PushScreen>
      <PushHeader
        backHref="/subscriptions"
        action={
          <Link
            href={`/subscriptions/${sub.id}/edit`}
            className="flex min-h-11 items-center rounded-full border border-line bg-card px-4 text-sm font-semibold"
          >
            {tr("common.edit")}
          </Link>
        }
      />

      <section className="flex flex-col items-center gap-1.5 py-1">
        {recurring ? <TxIcon type={sub.entryType} category={sub.category} size={64} /> : <SubMono s={sub} size={64} />}
        <h1 className="mt-1 font-serif text-2xl font-bold">{sub.name}</h1>
        <span
          className="font-mono text-[30px] font-semibold tracking-tight"
          style={recurring ? { color: meta.color } : undefined}
        >
          {recurring ? meta.sign : ""}
          {formatMoney(sub.amount, sub.currency, true).replace(/.00$/, "")}
          <span className="font-sans text-[15px] font-medium tracking-normal text-muted"> {cyclePer(sub.cycle)}</span>
        </span>
        {sub.currency !== "THB" && estimate !== null ? (
          <span className="-mt-1 text-sm text-muted">
            ≈ <span className="font-mono">{formatMoney(estimate, "THB")}</span> {cyclePer(sub.cycle)}
          </span>
        ) : null}
        <span className="rounded-full bg-chip px-3 py-1 text-[13px] font-semibold">
          {sub.paused
            ? tr("subs.pausedNow")
            : !next
              ? tr("rec.paidOff")
              : tr(recurring ? "rec.next" : trial ? "subs.trialNext" : "subs.next", {
                  date: shortDate(next.due),
                  rel: relativeDue(days),
                })}
        </span>
        {sub.installments ? (
          <span className="text-[13px] text-muted">
            {tr("rec.progress", { n: paid, total: sub.installments })}
            {paid < sub.installments
              ? ` · ${tr("rec.left", { count: sub.installments - paid, amount: baht2(sub.amount * (sub.installments - paid)) })}`
              : ""}
          </span>
        ) : null}
      </section>

      {askReview ? (
        <Card className="flex flex-col gap-3 p-4">
          <div className="flex items-start gap-3">
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-[14px] bg-warn-tint text-warn-ink">
              <Icon name="calendar" size={20} strokeWidth={2} />
            </span>
            <div className="flex min-w-0 flex-col gap-0.5">
              <span className="font-semibold">
                {tr(renewal.trial ? "subs.trialReviewTitle" : "subs.reviewTitle", { count: renewal.days })}
              </span>
              <span className="text-sm leading-relaxed text-muted">
                {tr(renewal.trial ? "subs.trialReviewLead" : "subs.reviewLead", {
                  date: shortDate(renewal.due),
                  amount: formatMoney(sub.amount, sub.currency),
                  name: sub.name,
                })}
              </span>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <SecondaryButton
              onClick={() => {
                setSettings({ renewKept: [...(renewKept ?? []), reviewId].slice(-20) })
                markRead(reviewId)
                notify(renewal.trial ? tr("subs.trialKept", { date: shortDate(renewal.due) }) : tr("subs.reviewKept"))
              }}
            >
              {tr("subs.reviewKeep")}
            </SecondaryButton>
            <SecondaryButton tone="danger" onClick={() => setConfirm(true)}>
              {tr("subs.reviewDrop")}
            </SecondaryButton>
          </div>
        </Card>
      ) : null}

      <ListCard>
        {sub.principal ? <Row label={tr("rec.price")} value={baht2(sub.principal)} /> : null}
        {interest ? (
          <Row
            label={tr("rec.interest")}
            value={
              interest.total > 0
                ? `${baht2(interest.total)} · ${interest.monthlyPct}%/${tr("cycle.month")}`
                : tr("pay.noInterest")
            }
          />
        ) : null}
        {sub.trialFrom ? (
          <Row label={tr("subs.trialPeriod")} value={`${shortDate(sub.trialFrom)} – ${shortDate(sub.startDate)}`} />
        ) : null}
        <Row label={tr("subs.cycle")} value={cycleLabel(sub.cycle)} />
        <Row label={tr("subs.billingDay")} value={dayRule} />
        {!recurring && sub.cycle !== "year" ? (
          <Row label={tr("subs.perYear")} value={formatMoney(yearlyCost(sub.amount, sub.cycle), sub.currency)} />
        ) : null}
        {spent?.count ? (
          <Row
            label={tr("subs.spentSoFar")}
            value={tr("subs.spentCount", { amount: formatMoney(spent.amount, spent.currency), count: spent.count })}
          />
        ) : null}
        {sub.entryType === "move" ? (
          <>
            <Row label={tr("rec.from")} value={accName(sub.accountId)} />
            <Row label={tr("rec.to")} value={accName(sub.toAccountId)} />
          </>
        ) : (
          <>
            <Row
              label={tr(sub.entryType === "in" ? "rec.intoAccount" : "subs.payFrom")}
              value={accName(sub.accountId)}
            />
            <Row
              label={tr("common.category")}
              value={
                recurring
                  ? categoryLabel(sub.category)
                  : (SUB_CATEGORIES.find((c) => c.key === sub.category)?.label ?? "—")
              }
            />
            {sub.splitWith?.length && sub.entryType === "out" ? (
              <Row label={tr("shareSub.row")} value={sub.splitWith.join(", ")} />
            ) : null}
          </>
        )}
      </ListCard>

      <ListCard>
        {sub.entryType !== "in" ? (
          <SwitchRow
            label={tr(recurring ? "rec.remind" : "subs.remind")}
            hint={
              recurring
                ? undefined
                : tr(trial ? "subs.remindHintTrial" : sub.cycle === "year" ? "subs.remindHintYear" : "subs.remindHint")
            }
            checked={sub.remind}
            onChange={(remind) => update(sub.id, { remind })}
          />
        ) : null}
        <SwitchRow
          label={tr(
            !recurring
              ? "subs.autoLog"
              : sub.entryType === "in"
                ? "rec.autoLogIn"
                : sub.entryType === "move"
                  ? "rec.autoLogMove"
                  : "rec.autoLogOut",
          )}
          hint={tr(recurring ? "rec.autoLogHint" : "subs.autoLogHint")}
          checked={sub.autoLog}
          onChange={(autoLog) => update(sub.id, { autoLog })}
        />
      </ListCard>

      {recurring ? (
        <section className="flex flex-col gap-2">
          <h2 className="text-base font-semibold">{tr("rec.history")}</h2>
          {logged.length ? (
            <ListCard>
              {logged.map((t) => (
                <TxRow key={t.id} t={t} />
              ))}
            </ListCard>
          ) : (
            <Empty>{tr("subs.noHistory")}</Empty>
          )}
        </section>
      ) : (
        <section className="flex flex-col gap-2">
          <h2 className="text-base font-semibold">{tr("subs.history")}</h2>
          {history.length ? (
            <ListCard>
              {history.map((d) => (
                <div key={d} className="flex min-h-11 items-center justify-between text-sm">
                  <span>{shortDate(d)}</span>
                  <span className="font-mono font-semibold text-expense">
                    −{formatMoney(sub.amount, sub.currency, true)}
                  </span>
                </div>
              ))}
            </ListCard>
          ) : (
            <Empty>{tr("subs.noHistory")}</Empty>
          )}
        </section>
      )}

      <div className="mt-auto grid grid-cols-2 gap-2">
        <SecondaryButton onClick={() => update(sub.id, { paused: !sub.paused })}>
          {sub.paused ? tr("subs.resume") : tr("subs.pause")}
        </SecondaryButton>
        <SecondaryButton tone="danger" onClick={() => setConfirm(true)}>
          {tr(recurring ? "rec.delete" : "subs.cancel")}
        </SecondaryButton>
      </div>

      <Sheet
        open={confirm}
        onClose={() => setConfirm(false)}
        title={tr(recurring ? "rec.deleteTitle" : "subs.cancelTitle", { name: sub.name })}
      >
        <p className="text-sm text-muted">{tr(recurring ? "rec.deleteLead" : "subs.cancelLead")}</p>
        <PrimaryButton
          once
          tone="danger"
          onClick={() => {
            remove(sub.id)
            router.replace("/subscriptions")
          }}
        >
          {tr(recurring ? "rec.delete" : "subs.cancel")}
        </PrimaryButton>
        <SecondaryButton onClick={() => setConfirm(false)}>{tr("subs.keep")}</SecondaryButton>
      </Sheet>
    </PushScreen>
  )
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex min-h-11 items-center justify-between text-sm">
      <span className="text-muted">{label}</span>
      <span className="font-semibold">{value}</span>
    </div>
  )
}
