"use client";

import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { accountBalance } from "@/lib/selectors";
import { MONO_TONES } from "@/lib/constants";
import { baht, monthKey, monthLabel, todayISO } from "@/lib/format";
import { endOfMonth, savingsProgress } from "@/lib/savings";
import { useStore } from "@/lib/store";
import type { SavingsGoal } from "@/lib/types";
import { AmountInput } from "./AmountInput";
import { Icon } from "./ui/Icon";
import { Bar, Card, Chip, PrimaryButton, SecondaryButton, Sheet, cx } from "./ui/primitives";

/** Savings goals on the goals screen: progress, what to save per month, add / top up / edit. */
export function SavingsGoals() {
  const { t } = useTranslation();
  const goals = useStore((s) => s.savingsGoals);
  const [editing, setEditing] = useState<SavingsGoal | "new" | null>(null);
  const [open, setOpen] = useState<SavingsGoal | null>(null);

  return (
    <section className="flex flex-col gap-2">
      <div className="flex items-center justify-between">
        <h2 className="text-base font-semibold">{t("savings.title")}</h2>
        <button type="button" onClick={() => setEditing("new")} className="flex min-h-9 items-center gap-1 text-[13px] font-semibold">
          <Icon name="plus" size={16} strokeWidth={2.2} />
          {t("savings.add")}
        </button>
      </div>
      {goals.length ? (
        goals.map((g) => <GoalCard key={g.id} goal={g} onClick={() => setOpen(g)} />)
      ) : (
        <button type="button" onClick={() => setEditing("new")} className="rounded-[20px] border border-dashed border-line-strong px-4 py-5 text-center text-sm text-muted">
          {t("savings.empty")}
        </button>
      )}
      <GoalSheet
        goal={open ? (goals.find((g) => g.id === open.id) ?? null) : null}
        onClose={() => setOpen(null)}
        onEdit={(g) => {
          setOpen(null);
          setEditing(g);
        }}
      />
      <GoalFormSheet goal={editing} onClose={() => setEditing(null)} />
    </section>
  );
}

function useProgress(goal: SavingsGoal) {
  const accounts = useStore((s) => s.accounts);
  const txs = useStore((s) => s.transactions);
  const account = goal.accountId ? accounts.find((a) => a.id === goal.accountId) : undefined;
  const balance = useMemo(() => (account ? accountBalance(account, txs) : undefined), [account, txs]);
  return { progress: savingsProgress(goal, todayISO(), balance), account };
}

function GoalCard({ goal, onClick }: { goal: SavingsGoal; onClick: () => void }) {
  const { t } = useTranslation();
  const { progress: p } = useProgress(goal);
  return (
    <button type="button" onClick={onClick} className="text-left">
      <Card className="flex flex-col gap-2 px-4 py-3.5">
        <div className="flex items-baseline justify-between gap-3">
          <span className="truncate text-[15px] font-semibold">{goal.name}</span>
          <span className="shrink-0 font-mono text-[13px]">
            <span className="font-semibold">{baht(p.saved)}</span>
            <span className="text-muted"> / {baht(goal.target)}</span>
          </span>
        </div>
        <Bar value={p.pct} height={6} track="var(--color-divider)" color={p.done ? "var(--color-income)" : goal.tone} />
        <span className={cx("text-xs", p.overdue ? "font-semibold text-danger" : "text-muted")}>{statusText(t, goal, p)}</span>
      </Card>
    </button>
  );
}

type T = ReturnType<typeof useTranslation>["t"];
function statusText(t: T, goal: SavingsGoal, p: ReturnType<typeof savingsProgress>) {
  if (p.done) return t("savings.done");
  if (p.overdue) return t("savings.overdue", { amount: baht(p.left) });
  if (p.perMonth !== null && goal.deadline) return t("savings.perMonth", { amount: baht(p.perMonth), month: monthLabel(monthKey(goal.deadline)) });
  return t("savings.left", { amount: baht(p.left) });
}

/** A goal's detail: add to it (manual goals), edit or delete. */
function GoalSheet({ goal, onClose, onEdit }: { goal: SavingsGoal | null; onClose: () => void; onEdit: (g: SavingsGoal) => void }) {
  const [shown, setShown] = useState<SavingsGoal | null>(goal);
  if (goal && goal !== shown) setShown(goal);
  return (
    <Sheet open={!!goal} onClose={onClose} title={shown?.name ?? ""}>
      {shown ? <GoalDetail goal={shown} onClose={onClose} onEdit={onEdit} /> : null}
    </Sheet>
  );
}

function GoalDetail({ goal, onClose, onEdit }: { goal: SavingsGoal; onClose: () => void; onEdit: (g: SavingsGoal) => void }) {
  const { t } = useTranslation();
  const addToSavings = useStore((s) => s.addToSavings);
  const deleteSavingsGoal = useStore((s) => s.deleteSavingsGoal);
  const { progress: p, account } = useProgress(goal);
  const [amount, setAmount] = useState("");
  const value = parseFloat(amount) || 0;

  return (
    <>
      <div className="flex flex-col gap-2">
        <span className="font-mono text-[30px] font-semibold leading-tight">
          {baht(p.saved)}
          <span className="text-[15px] text-muted"> / {baht(goal.target)}</span>
        </span>
        <Bar value={p.pct} height={8} track="var(--color-divider)" color={p.done ? "var(--color-income)" : goal.tone} />
        <span className={cx("text-sm", p.overdue ? "font-semibold text-danger" : "text-muted")}>{statusText(t, goal, p)}</span>
        {account ? <span className="text-xs text-faint">{t("savings.linkedHint", { name: account.name })}</span> : null}
      </div>
      {!goal.accountId ? (
        <>
          <AmountInput label={t("savings.amount")} value={amount} onChange={setAmount} />
          <div className="grid grid-cols-2 gap-2">
            <SecondaryButton
              onClick={() => {
                addToSavings(goal.id, -Math.min(value, goal.saved));
                setAmount("");
              }}
            >
              {t("savings.takeOut")}
            </SecondaryButton>
            <PrimaryButton
              disabled={value <= 0}
              onClick={() => {
                addToSavings(goal.id, value);
                setAmount("");
              }}
            >
              {t("savings.putIn")}
            </PrimaryButton>
          </div>
        </>
      ) : null}
      <SecondaryButton onClick={() => onEdit(goal)}>{t("savings.edit")}</SecondaryButton>
      <SecondaryButton
        tone="danger"
        onClick={() => {
          deleteSavingsGoal(goal.id);
          onClose();
        }}
      >
        {t("savings.delete")}
      </SecondaryButton>
    </>
  );
}

/** New goal or edit: name, target, month to reach it by, and where the money is kept. */
function GoalFormSheet({ goal, onClose }: { goal: SavingsGoal | "new" | null; onClose: () => void }) {
  const { t } = useTranslation();
  const accounts = useStore((s) => s.accounts);
  const addSavingsGoal = useStore((s) => s.addSavingsGoal);
  const updateSavingsGoal = useStore((s) => s.updateSavingsGoal);
  const existing = goal && goal !== "new" ? goal : null;
  const [name, setName] = useState("");
  const [target, setTarget] = useState("");
  const [month, setMonth] = useState("");
  const [accountId, setAccountId] = useState("");
  const [shown, setShown] = useState<typeof goal>(null);
  if (goal && goal !== shown) {
    setShown(goal);
    setName(existing?.name ?? "");
    setTarget(existing ? String(existing.target) : "");
    setMonth(existing?.deadline ? monthKey(existing.deadline) : "");
    setAccountId(existing?.accountId ?? "");
  }
  const thisMonth = monthKey(todayISO());
  const value = parseFloat(target) || 0;
  const canSave = name.trim().length > 0 && value > 0;
  const savers = accounts.filter((a) => a.kind !== "credit");

  const save = () => {
    const fields = { name: name.trim(), target: value, deadline: month ? endOfMonth(month) : null, accountId: accountId || null };
    if (existing) updateSavingsGoal(existing.id, fields);
    else addSavingsGoal({ ...fields, saved: 0, tone: MONO_TONES[1] });
    onClose();
  };

  return (
    <Sheet open={!!goal} onClose={onClose} title={existing ? t("savings.editTitle") : t("savings.newTitle")}>
      <input
        value={name}
        maxLength={60}
        onChange={(e) => setName(e.target.value)}
        placeholder={t("savings.namePlaceholder")}
        aria-label={t("savings.name")}
        className="min-h-11 w-full rounded-xl border border-line bg-card px-3 text-[15px] outline-none"
      />
      <AmountInput label={t("savings.target")} value={target} onChange={setTarget} />
      <Card className="flex min-h-[52px] items-center justify-between gap-3 px-4">
        <label htmlFor="deadline" className="text-[13px] text-muted">
          {t("savings.by")}
        </label>
        <span className="flex items-center gap-2">
          <input
            id="deadline"
            type="month"
            min={thisMonth}
            value={month}
            onChange={(e) => setMonth(e.target.value)}
            className="min-h-9 bg-transparent text-right text-[15px] font-semibold outline-none"
          />
          {month ? (
            <button type="button" aria-label={t("savings.noDeadline")} onClick={() => setMonth("")} className="flex h-8 w-8 items-center justify-center rounded-full bg-chip">
              <Icon name="close" size={14} strokeWidth={2.2} />
            </button>
          ) : null}
        </span>
      </Card>
      <div className="flex flex-col gap-2">
        <span className="text-[13px] text-muted">{t("savings.keptIn")}</span>
        <div className="flex flex-wrap gap-1.5">
          <Chip size="sm" on={!accountId} onClick={() => setAccountId("")}>
            {t("savings.manual")}
          </Chip>
          {savers.map((a) => (
            <Chip key={a.id} size="sm" on={accountId === a.id} onClick={() => setAccountId(a.id)}>
              {a.name}
            </Chip>
          ))}
        </div>
        <span className="text-xs leading-relaxed text-faint">{accountId ? t("savings.linkedLead") : t("savings.manualLead")}</span>
      </div>
      <PrimaryButton disabled={!canSave} onClick={save}>
        {t("common.save")}
      </PrimaryButton>
    </Sheet>
  );
}
