"use client";

import { useTranslation } from "react-i18next";
import { useState } from "react";
import { AccountMark, PushScreen } from "@/components/app";
import { AccountEditSheet } from "@/components/AccountEditSheet";
import { ReconcileSheet } from "@/components/ReconcileSheet";
import { Icon } from "@/components/ui/Icon";
import { IconButton, ListCard, PushHeader } from "@/components/ui/primitives";
import { baht } from "@/lib/format";
import { accountBalance } from "@/lib/selectors";
import { useStore } from "@/lib/store";


export default function AccountsPage() {
  const { t } = useTranslation();
  const { accounts, transactions, addAccount, updateAccount, removeAccount } = useStore();
  // "" = closed, "new" = adding, otherwise the account id being edited.
  const [editing, setEditing] = useState("");
  const current = accounts.find((a) => a.id === editing);
  const [reconciling, setReconciling] = useState("");

  return (
    <PushScreen>
      <PushHeader title={t("accounts.title")} backHref="/profile" action={<IconButton icon="plus" label={t("accounts.add")} onClick={() => setEditing("new")} />} />

      <ListCard>
        {accounts.map((a) => (
          <button key={a.id} type="button" onClick={() => setEditing(a.id)} className="flex min-h-[64px] w-full items-center gap-3 text-left">
            <AccountMark account={a} size={38} />
            <span className="flex min-w-0 grow flex-col">
              <span className="truncate text-[15px] font-medium">{a.name}</span>
              <span className="text-xs text-muted">{t(a.kind === "saving" ? "kind.savingLong" : `kind.${a.kind}`)}</span>
            </span>
            <span className="font-mono text-sm font-semibold">
              {a.kind === "credit" ? `${t("balance.limit")} ` : ""}
              {baht(accountBalance(a, transactions))}
            </span>
            <Icon name="chevronRight" size={16} strokeWidth={2} className="text-faint" />
          </button>
        ))}
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
