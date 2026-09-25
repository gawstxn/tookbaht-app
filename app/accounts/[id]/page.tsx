"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { AccountMark, PushScreen, TxIcon, TxRow } from "@/components/app";
import { AccountEditSheet } from "@/components/AccountEditSheet";
import { PayBillSheet } from "@/components/PayBillSheet";
import { Bar, Card, Empty, HeroCard, ListCard, PushHeader } from "@/components/ui/primitives";
import { baht, baht2, shortDate, todayISO } from "@/lib/format";
import { accountDeleteBlock, accountDue, chargesSoFar, creditSummary } from "@/lib/selectors";
import { deleteBlockedText } from "@/components/accountDeleteText";
import { useStore } from "@/lib/store";

/** A card or pay-later account: available credit, this cycle's bill, and purchases being paid off. */
export default function CreditAccountPage() {
  const { id } = useParams<{ id: string }>();
  const { t } = useTranslation();
  const accounts = useStore((s) => s.accounts);
  const account = accounts.find((a) => a.id === id);
  const transactions = useStore((s) => s.transactions);
  const subscriptions = useStore((s) => s.subscriptions);
  const updateAccount = useStore((s) => s.updateAccount);
  const removeAccount = useStore((s) => s.removeAccount);
  const router = useRouter();
  const [sheet, setSheet] = useState<"" | "edit" | "pay">("");
  const today = todayISO();

  if (!account) {
    return (
      <PushScreen>
        <PushHeader backHref="/accounts" />
        <Empty>{t("subs.notFound")}</Empty>
      </PushScreen>
    );
  }

  const credit = creditSummary(account, transactions, subscriptions, today);
  const due = accountDue(account, transactions, today, subscriptions);
  const plans = subscriptions.filter((s) => s.accountId === account.id && s.installments && s.entryType === "out");
  const open = plans.filter((s) => chargesSoFar(s, today) < s.installments!);
  const done = plans.filter((s) => chargesSoFar(s, today) >= s.installments!);
  const recent = transactions
    .filter((x) => x.accountId === account.id || x.fromId === account.id || x.toId === account.id)
    .sort((a, b) => b.date.localeCompare(a.date) || b.createdAt - a.createdAt)
    .slice(0, 5);

  return (
    <PushScreen>
      <PushHeader
        title={account.name}
        backHref="/accounts"
        action={
          <button type="button" onClick={() => setSheet("edit")} className="flex min-h-11 items-center rounded-full border border-line bg-card px-4 text-sm font-semibold">
            {t("common.edit")}
          </button>
        }
      />

      <HeroCard>
        <div className="flex items-center gap-3">
          <AccountMark account={account} size={36} />
          <span className="text-[13px] text-on-ink-muted">{t("pay.available")}</span>
        </div>
        <span className="-mt-2 font-mono text-4xl font-semibold tracking-tight">{baht(credit.available)}</span>
        <Bar value={credit.limit ? credit.used / credit.limit : 0} color="var(--color-lime)" />
        <span className="-mt-2 text-xs text-on-ink-muted">{t("pay.usedOf", { used: baht(credit.used), limit: baht(credit.limit) })}</span>
      </HeroCard>

      {due ? (
        <Card className="flex items-center gap-3 px-4 py-3.5">
          <div className="flex grow flex-col">
            <span className="text-[13px] text-muted">{t("pay.dueBy", { date: shortDate(due.due) })}</span>
            <span className="font-mono text-[22px] font-semibold">{due.owed > 0 ? baht2(due.owed) : t("pay.nothingDue")}</span>
          </div>
          {due.owed > 0 ? (
            <button type="button" onClick={() => setSheet("pay")} className="min-h-11 shrink-0 rounded-full bg-ink px-4 text-sm font-semibold text-on-ink">
              {t("pay.paid")}
            </button>
          ) : null}
        </Card>
      ) : (
        <button type="button" onClick={() => setSheet("edit")} className="flex flex-col gap-0.5 rounded-[20px] border border-dashed border-line-strong px-4 py-3.5 text-left">
          <span className="text-[15px] font-semibold">{t("pay.setDueDay")}</span>
          <span className="text-xs text-muted">{t("pay.setDueDayLead")}</span>
        </button>
      )}

      <section className="flex flex-col gap-2">
        <h2 className="text-base font-semibold">{t("pay.plans")}</h2>
        {open.length ? (
          <ListCard>
            {open.map((s) => {
              const n = chargesSoFar(s, today);
              return (
                <Link key={s.id} href={`/subscriptions/${s.id}`} className="flex min-h-16 items-center gap-3">
                  <TxIcon type="out" category={s.category} size={38} />
                  <div className="flex min-w-0 grow flex-col">
                    <span className="truncate text-[15px] font-medium">{s.name}</span>
                    <span className="text-xs text-muted">{t("pay.planLeft", { n, total: s.installments, amount: baht(s.amount * (s.installments! - n)) })}</span>
                  </div>
                  <span className="font-mono text-[15px] font-semibold">
                    {baht(s.amount)}
                    <span className="font-sans text-[11px] font-normal text-muted"> {t("cycle.perMonth")}</span>
                  </span>
                </Link>
              );
            })}
          </ListCard>
        ) : (
          <Empty>{t("pay.noPlans")}</Empty>
        )}
        <Link href={`/accounts/${account.id}/buy`} className="flex min-h-[54px] items-center justify-center rounded-2xl bg-ink text-base font-semibold text-on-ink">
          {t("pay.buy")}
        </Link>
        {done.length ? (
          <p className="px-0.5 text-xs text-muted">
            {t("pay.plansDone")}: {done.map((s) => s.name).join(", ")}
          </p>
        ) : null}
      </section>

      {recent.length ? (
        <section className="flex flex-col gap-2">
          <h2 className="text-base font-semibold">{t("pay.recent")}</h2>
          <ListCard>
            {recent.map((x) => (
              <TxRow key={x.id} t={x} />
            ))}
          </ListCard>
        </section>
      ) : null}

      <AccountEditSheet
        open={sheet === "edit"}
        onClose={() => setSheet("")}
        initial={account}
        onSave={(a) => {
          updateAccount(account.id, a);
          setSheet("");
        }}
        deleteBlocked={deleteBlockedText(accountDeleteBlock(account.id, accounts, transactions, subscriptions))}
        onDelete={async () => {
          setSheet("");
          if (await removeAccount(account.id)) router.replace("/accounts");
        }}
      />
      <PayBillSheet account={account} amount={due?.owed ?? 0} open={sheet === "pay"} onClose={() => setSheet("")} />
    </PushScreen>
  );
}
