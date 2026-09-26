"use client";

import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Card, PrimaryButton, Sheet } from "@/components/ui/primitives";
import { baht2, todayISO } from "@/lib/format";
import { accountBalance, reconcileEntry } from "@/lib/selectors";
import { useStore } from "@/lib/store";
import type { Account } from "@/lib/types";
import { BahtInput } from "./BahtInput";

/** Enter the balance the bank shows; the difference is logged as income or an expense. */
export function ReconcileSheet({ account, onClose }: { account: Account | undefined; onClose: () => void }) {
  const { t } = useTranslation();
  return (
    <Sheet open={!!account} onClose={onClose} title={t("accounts.reconcile")}>
      {/* Remount per account so the field starts empty. */}
      {account ? <ReconcileFields key={account.id} account={account} onDone={onClose} /> : null}
    </Sheet>
  );
}

function ReconcileFields({ account, onDone }: { account: Account; onDone: () => void }) {
  const { t } = useTranslation();
  const transactions = useStore((s) => s.transactions);
  const addTransaction = useStore((s) => s.addTransaction);
  const [text, setText] = useState("");
  const credit = account.kind === "credit";
  const current = accountBalance(account, transactions);
  const entry = text ? reconcileEntry(account, transactions, parseFloat(text) || 0, todayISO(), t("accounts.reconcileTx")) : null;

  return (
    <>
      <p className="text-sm text-muted">{t(credit ? "accounts.reconcileLeadCredit" : "accounts.reconcileLead")}</p>
      <Card className="flex flex-col gap-2.5 px-4 py-3.5">
        <div className="flex items-baseline justify-between">
          <span className="text-[13px] text-muted">{t("accounts.inApp")}</span>
          <span className="font-mono text-[15px] font-semibold">{baht2(current)}</span>
        </div>
        <label className="flex items-baseline gap-2 border-t border-divider pt-2.5">
          <span className="shrink-0 text-[13px] text-muted">{t(credit ? "accounts.actualCredit" : "accounts.actual")}</span>
          <span className="flex grow items-baseline justify-end gap-0.5 font-mono text-[24px] font-semibold">
            ฿
            <BahtInput
              autoFocus
              value={text}
              onChange={(e) => setText(e.target.value.replace(/[^0-9.]/g, ""))}
              placeholder="0"
              className="w-full min-w-0 bg-transparent text-right outline-none"
            />
          </span>
        </label>
      </Card>
      {text ? (
        <p className="text-center text-sm font-semibold" style={{ color: entry ? (entry.type === "in" ? "var(--color-income)" : "var(--color-expense)") : undefined }}>
          {entry ? t(entry.type === "in" ? "accounts.willLogIn" : "accounts.willLogOut", { amount: baht2(entry.amount) }) : t("accounts.matches")}
        </p>
      ) : null}
      <PrimaryButton
        once
        disabled={!entry}
        onClick={() => {
          if (entry) addTransaction(entry);
          onDone();
        }}
      >
        {t("accounts.reconcileSave")}
      </PrimaryButton>
    </>
  );
}
