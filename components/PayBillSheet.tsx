"use client";

import { useState } from "react";
import { useTranslation } from "react-i18next";
import { AccountSheet } from "@/components/pickers";
import { Card, ListCard, PickerRow, PrimaryButton, Sheet } from "@/components/ui/primitives";
import { todayISO } from "@/lib/format";
import { useStore } from "@/lib/store";
import type { Account } from "@/lib/types";
import { BahtInput } from "./BahtInput";

/** Record paying a card / pay-later bill: a transfer from the usual bank account, remembered for next time. */
export function PayBillSheet({ account, amount, open, onClose }: { account: Account; amount: number; open: boolean; onClose: () => void }) {
  const { t } = useTranslation();
  return (
    <Sheet open={open} onClose={onClose} title={t("pay.payTitle", { name: account.name })}>
      {/* Remount per open so the amount starts from what's due now. */}
      {open ? <PayBillFields account={account} amount={amount} onDone={onClose} /> : null}
    </Sheet>
  );
}

function PayBillFields({ account, amount, onDone }: { account: Account; amount: number; onDone: () => void }) {
  const { t } = useTranslation();
  const accounts = useStore((s) => s.accounts);
  const addTransaction = useStore((s) => s.addTransaction);
  const updateAccount = useStore((s) => s.updateAccount);
  const [text, setText] = useState(amount > 0 ? String(amount) : "");
  const [fromId, setFromId] = useState(account.billFromId ?? accounts.find((a) => a.kind === "bank" && a.id !== account.id)?.id ?? "");
  const [picking, setPicking] = useState(false);
  const value = parseFloat(text) || 0;

  return (
    <>
      <Card className="px-4 py-3">
        <label className="flex items-baseline gap-2">
          <span className="shrink-0 text-[13px] text-muted">{t("pay.payAmount")}</span>
          <span className="flex grow items-baseline justify-end gap-0.5 font-mono text-[26px] font-semibold">
            ฿
            <BahtInput
              value={text}
              onChange={(e) => setText(e.target.value.replace(/[^0-9.]/g, ""))}
              placeholder="0"
              aria-label={t("pay.payAmount")}
              className="w-full min-w-0 bg-transparent text-right outline-none"
            />
          </span>
        </label>
      </Card>
      <ListCard>
        <PickerRow label={t("pay.payFrom")} value={accounts.find((a) => a.id === fromId)?.name ?? t("common.selectAccount")} onClick={() => setPicking(true)} />
      </ListCard>
      <PrimaryButton
        once
        disabled={!value || !fromId}
        onClick={() => {
          // Remember the source first, so the payment's own toast is the one that shows.
          if (fromId !== account.billFromId) updateAccount(account.id, { billFromId: fromId });
          addTransaction({ type: "move", amount: value, date: todayISO(), title: t("pay.payTx", { name: account.name }), fromId, toId: account.id });
          onDone();
        }}
      >
        {t("pay.paySave")}
      </PrimaryButton>
      <AccountSheet open={picking} onClose={() => setPicking(false)} title={t("pay.payFrom")} value={fromId} exclude={account.id} onPick={setFromId} />
    </>
  );
}
