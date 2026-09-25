"use client";

import { useTranslation } from "react-i18next";
import Link from "next/link";
import { useState } from "react";
import { AccountMark, PushScreen } from "@/components/app";
import { AccountEditSheet } from "@/components/AccountEditSheet";
import { ReconcileSheet } from "@/components/ReconcileSheet";
import { Icon } from "@/components/ui/Icon";
import { IconButton, ListCard, PushHeader } from "@/components/ui/primitives";
import { baht, shortDate, todayISO } from "@/lib/format";
import { accountBalance, accountDeleteBlock, accountDue, creditSummary } from "@/lib/selectors";
import { deleteBlockedText } from "@/components/accountDeleteText";
import { useStore } from "@/lib/store";


export default function AccountsPage() {
  const { t } = useTranslation();
  const { accounts, transactions, subscriptions, addAccount, updateAccount, removeAccount } = useStore();
  // "" = closed, "new" = adding, otherwise the account id being edited.
  const [editing, setEditing] = useState("");
  const current = accounts.find((a) => a.id === editing);
  const today = todayISO();
  /** "ครบกำหนด 5 ต.ค. · ค้างจ่าย ฿1,000" for cards and pay-later with a due day and something owed. */
  const dueLine = (a: (typeof accounts)[number]) => {
    const d = accountDue(a, transactions, today, subscriptions);
    return d && d.owed > 0 ? t("accounts.dueLine", { date: shortDate(d.due, false), amount: baht(d.owed) }) : null;
  };
  const [reconciling, setReconciling] = useState("");

  return (
    <PushScreen>
      <PushHeader title={t("accounts.title")} backHref="/profile" action={<IconButton icon="plus" label={t("accounts.add")} onClick={() => setEditing("new")} />} />

      <ListCard>
        {accounts.map((a) => {
          const row = (
            <>
              <AccountMark account={a} size={38} />
              <span className="flex min-w-0 grow flex-col">
                <span className="truncate text-[15px] font-medium">{a.name}</span>
                <span className="text-xs text-muted">{dueLine(a) ?? t(a.kind === "saving" ? "kind.savingLong" : `kind.${a.kind}`)}</span>
              </span>
              {a.kind === "credit" ? (
                <span className="flex flex-col items-end">
                  <span className="font-mono text-sm font-semibold">{baht(creditSummary(a, transactions, subscriptions, today).available)}</span>
                  <span className="text-[11px] text-muted">{t("pay.available")}</span>
                </span>
              ) : (
                <span className="font-mono text-sm font-semibold">{baht(accountBalance(a, transactions))}</span>
              )}
              <Icon name="chevronRight" size={16} strokeWidth={2} className="text-faint" />
            </>
          );
          const cls = "flex min-h-[64px] w-full items-center gap-3 text-left";
          // Cards and pay-later open their own page (credit, bill, installments); the rest edit in place.
          return a.kind === "credit" ? (
            <Link key={a.id} href={`/accounts/${a.id}`} className={cls}>
              {row}
            </Link>
          ) : (
            <button key={a.id} type="button" onClick={() => setEditing(a.id)} className={cls}>
              {row}
            </button>
          );
        })}
      </ListCard>
      <p className="text-center text-xs text-muted">{t("accounts.deleteHint")}</p>

      <AccountEditSheet
        open={editing !== ""}
        onClose={() => setEditing("")}
        initial={current}
        onSave={(a) => {
          if (current) updateAccount(current.id, a);
          else addAccount(a);
          setEditing("");
        }}
        onReconcile={
          current
            ? () => {
                setEditing("");
                setReconciling(current.id);
              }
            : undefined
        }
        deleteBlocked={current ? deleteBlockedText(accountDeleteBlock(current.id, accounts, transactions, subscriptions)) : null}
        onDelete={
          current
            ? () => {
                setEditing("");
                void removeAccount(current.id);
              }
            : undefined
        }
      />
      <ReconcileSheet account={accounts.find((a) => a.id === reconciling)} onClose={() => setReconciling("")} />
    </PushScreen>
  );
}
