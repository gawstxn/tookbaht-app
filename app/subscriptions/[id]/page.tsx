"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useState } from "react";
import { PushScreen, SubMono, TxIcon, TxRow } from "@/components/app";
import { Empty, ListCard, PrimaryButton, PushHeader, SecondaryButton, Sheet, SwitchRow } from "@/components/ui/primitives";
import { SUB_CATEGORIES, TYPE_META, categoryLabel } from "@/lib/constants";
import { baht2, cycleLabel, cyclePer, diffDays, dueDatesUntil, fromISO, relativeDue, shortDate, todayISO } from "@/lib/format";
import { chargesSoFar, nextCharge } from "@/lib/selectors";
import { useTranslation } from "react-i18next";
import { formatMoney, subTHB } from "@/lib/fx";
import { useStore } from "@/lib/store";

export default function SubscriptionDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const sub = useStore((s) => s.subscriptions.find((x) => x.id === id));
  const accounts = useStore((s) => s.accounts);
  const transactions = useStore((s) => s.transactions);
  const update = useStore((s) => s.updateSubscription);
  const remove = useStore((s) => s.deleteSubscription);
  const usdRate = useStore((s) => s.usdRate);
  const { t: tr } = useTranslation();
  const [confirm, setConfirm] = useState(false);
  const today = todayISO();

  if (!sub) {
    return (
      <PushScreen>
        <PushHeader backHref="/subscriptions" />
        <Empty>{tr("subs.notFound")}</Empty>
      </PushScreen>
    );
  }

  const recurring = sub.kind === "recurring";
  const next = nextCharge(sub, today);
  const days = next ? diffDays(next.due, today) : 0;
  const history = dueDatesUntil(sub.startDate, sub.cycle, today).reverse().slice(0, 3);
  const logged = transactions.filter((t) => t.subscriptionId === sub.id).sort((a, b) => b.date.localeCompare(a.date)).slice(0, 5);
  const paid = chargesSoFar(sub, today);
  const meta = TYPE_META[sub.entryType];
  const accName = (id?: string | null) => accounts.find((a) => a.id === id)?.name ?? "—";
  const start = fromISO(sub.startDate);
  const estimate = subTHB(sub, accounts, usdRate);
  const dayRule =
    sub.cycle === "week"
      ? tr("subs.everyWeek")
      : sub.cycle === "year"
        ? tr("subs.everyYear", { date: shortDate(sub.startDate, false) })
        : tr("subs.everyMonthDay", { day: start.getDate() });

  return (
    <PushScreen>
      <PushHeader
        backHref="/subscriptions"
        action={
          <Link href={`/subscriptions/${sub.id}/edit`} className="flex min-h-11 items-center rounded-full border border-line bg-card px-4 text-sm font-semibold">
            {tr("common.edit")}
          </Link>
        }
      />

      <section className="flex flex-col items-center gap-1.5 py-1">
        {recurring ? <TxIcon type={sub.entryType} category={sub.category} size={64} /> : <SubMono s={sub} size={64} />}
        <h1 className="mt-1 font-serif text-2xl font-bold">{sub.name}</h1>
        <span className="font-mono text-[30px] font-semibold tracking-tight" style={recurring ? { color: meta.color } : undefined}>
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
              : tr(recurring ? "rec.next" : "subs.next", { date: shortDate(next.due), rel: relativeDue(days) })}
        </span>
        {sub.installments ? (
          <span className="text-[13px] text-muted">
            {tr("rec.progress", { n: paid, total: sub.installments })}
            {paid < sub.installments ? ` · ${tr("rec.left", { count: sub.installments - paid, amount: baht2(sub.amount * (sub.installments - paid)) })}` : ""}
          </span>
        ) : null}
      </section>

      <ListCard>
        <Row label={tr("subs.cycle")} value={cycleLabel(sub.cycle)} />
        <Row label={tr("subs.billingDay")} value={dayRule} />
        {sub.entryType === "move" ? (
          <>
            <Row label={tr("rec.from")} value={accName(sub.accountId)} />
            <Row label={tr("rec.to")} value={accName(sub.toAccountId)} />
          </>
        ) : (
          <>
            <Row label={tr(sub.entryType === "in" ? "rec.intoAccount" : "subs.payFrom")} value={accName(sub.accountId)} />
            <Row label={tr("common.category")} value={recurring ? categoryLabel(sub.category) : (SUB_CATEGORIES.find((c) => c.key === sub.category)?.label ?? "—")} />
          </>
        )}
      </ListCard>

      <ListCard>
        {sub.entryType !== "in" ? (
          <SwitchRow label={tr(recurring ? "rec.remind" : "subs.remind")} hint={recurring ? undefined : tr("subs.remindHint")} checked={sub.remind} onChange={(remind) => update(sub.id, { remind })} />
        ) : null}
        <SwitchRow
          label={tr(!recurring ? "subs.autoLog" : sub.entryType === "in" ? "rec.autoLogIn" : sub.entryType === "move" ? "rec.autoLogMove" : "rec.autoLogOut")}
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
                <span className="font-mono font-semibold text-expense">−{formatMoney(sub.amount, sub.currency, true)}</span>
              </div>
            ))}
          </ListCard>
        ) : (
          <Empty>{tr("subs.noHistory")}</Empty>
        )}
      </section>
      )}

      <div className="mt-auto grid grid-cols-2 gap-2">
        <SecondaryButton onClick={() => update(sub.id, { paused: !sub.paused })}>{sub.paused ? tr("subs.resume") : tr("subs.pause")}</SecondaryButton>
        <SecondaryButton tone="danger" onClick={() => setConfirm(true)}>
          {tr(recurring ? "rec.delete" : "subs.cancel")}
        </SecondaryButton>
      </div>

      <Sheet open={confirm} onClose={() => setConfirm(false)} title={tr(recurring ? "rec.deleteTitle" : "subs.cancelTitle", { name: sub.name })}>
        <p className="text-sm text-muted">{tr(recurring ? "rec.deleteLead" : "subs.cancelLead")}</p>
        <PrimaryButton
          once
          tone="danger"
          onClick={() => {
            remove(sub.id);
            router.replace("/subscriptions");
          }}
        >
          {tr(recurring ? "rec.delete" : "subs.cancel")}
        </PrimaryButton>
        <SecondaryButton onClick={() => setConfirm(false)}>{tr("subs.keep")}</SecondaryButton>
      </Sheet>
    </PushScreen>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex min-h-11 items-center justify-between text-sm">
      <span className="text-muted">{label}</span>
      <span className="font-semibold">{value}</span>
    </div>
  );
}
