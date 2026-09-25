"use client";

import { useState } from "react";
import { useStore } from "@/lib/store";
import { useTranslation } from "react-i18next";
import { daysInMonth, displayYear, monthLabel, monthNamesShort, shiftMonth, todayISO, toISO, monthKey, weekdayNamesShort, shortDate } from "@/lib/format";
import { accountSubtitle } from "@/lib/selectors";
import type { CategoryDef } from "@/lib/constants";
import { Icon } from "./ui/Icon";
import { AccountMark } from "./app";
import { PrimaryButton, Sheet, cx } from "./ui/primitives";

/* ---------- calendar ---------- */

export function Calendar({
  value,
  onChange,
  min,
  max,
}: {
  value: string;
  onChange: (d: string) => void;
  min?: string;
  max?: string;
}) {
  const [view, setView] = useState(monthKey(value));
  const today = todayISO();
  const { t } = useTranslation();
  const [y, m] = view.split("-").map(Number);
  const first = new Date(y, m - 1, 1).getDay();
  const days = daysInMonth(y, m - 1);

  return (
    <div className="flex flex-col gap-2 rounded-[20px] border border-line bg-card p-3">
      <div className="flex items-center justify-between">
        <button type="button" aria-label={t("picker.prevMonth")} onClick={() => setView(shiftMonth(view, -1))} className="flex h-10 w-10 items-center justify-center rounded-full">
          <Icon name="back" size={18} strokeWidth={2} />
        </button>
        <span className="text-[15px] font-semibold">{monthLabel(view)}</span>
        <button type="button" aria-label={t("picker.nextMonth")} onClick={() => setView(shiftMonth(view, 1))} className="flex h-10 w-10 items-center justify-center rounded-full">
          <Icon name="chevronRight" size={18} strokeWidth={2} />
        </button>
      </div>
      <div aria-hidden="true" className="grid grid-cols-7 text-center text-xs text-muted">
        {weekdayNamesShort().map((d) => (
          <span key={d}>{d}</span>
        ))}
      </div>
      <div className="grid grid-cols-7 gap-0.5">
        {Array.from({ length: first }, (_, i) => (
          <span key={`b${i}`} />
        ))}
        {Array.from({ length: days }, (_, i) => {
          const iso = toISO(new Date(y, m - 1, i + 1));
          const on = iso === value;
          const disabled = (min && iso < min) || (max && iso > max);
          const isToday = iso === today;
          return (
            <button
              key={iso}
              type="button"
              aria-pressed={on}
              aria-label={shortDate(iso)}
              disabled={!!disabled}
              onClick={() => onChange(iso)}
              className={cx(
                "h-10 rounded-full border font-mono text-sm font-semibold",
                on ? "border-hero bg-hero text-lime dark:border-lime" : isToday ? "border-ink" : "border-transparent",
                disabled && "text-switch-off",
              )}
            >
              {i + 1}
            </button>
          );
        })}
      </div>
    </div>
  );
}

export function DateSheet({
  open,
  onClose,
  title,
  value,
  onChange,
  min,
  max,
  hint,
  quick,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  value: string;
  onChange: (d: string) => void;
  min?: string;
  max?: string;
  hint?: string;
  quick?: { label: string; value: string }[];
}) {
  const { t } = useTranslation();
  return (
    <Sheet open={open} onClose={onClose} title={title}>
      {quick ? (
        <div className="flex gap-2">
          {quick.map((q) => (
            <button
              key={q.label}
              type="button"
              onClick={() => onChange(q.value)}
              className={cx("min-h-9 rounded-full border px-3.5 text-[13px] font-semibold", q.value === value ? "border-ink bg-ink text-on-ink" : "border-line bg-card")}
            >
              {q.label}
            </button>
          ))}
        </div>
      ) : null}
      <Calendar key={open ? "o" : "c"} value={value} onChange={onChange} min={min} max={max} />
      {hint ? <p className="text-center text-[13px] text-muted">{hint}</p> : null}
      <PrimaryButton onClick={onClose}>{t("common.ok")}</PrimaryButton>
    </Sheet>
  );
}

/* ---------- accounts ---------- */

export function AccountSheet({
  open,
  onClose,
  title,
  value,
  onPick,
  exclude,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  value: string;
  onPick: (id: string) => void;
  exclude?: string;
}) {
  const { t } = useTranslation();
  const accounts = useStore((s) => s.accounts);
  const txs = useStore((s) => s.transactions);
  return (
    <Sheet open={open} onClose={onClose} title={title}>
      <div role="radiogroup" aria-label={title} className="flex flex-col rounded-[20px] border border-line bg-card px-4 py-0.5">
        {accounts.map((a, i) => {
          const on = a.id === value;
          const blocked = a.id === exclude;
          return (
            <button
              key={a.id}
              type="button"
              role="radio"
              aria-checked={on}
              disabled={blocked}
              onClick={() => {
                onPick(a.id);
                onClose();
              }}
              className={cx("flex min-h-[60px] items-center gap-3 text-left", i < accounts.length - 1 && "border-b border-divider", blocked && "opacity-45")}
            >
              <AccountMark account={a} size={36} />
              <span className="flex grow flex-col">
                <span className="text-[15px] font-medium">{a.name}</span>
                <span className="text-xs text-muted">{blocked ? t("picker.otherSide") : accountSubtitle(a, txs)}</span>
              </span>
              <span
                aria-hidden="true"
                className="box-border h-[22px] w-[22px] shrink-0 rounded-full"
                style={on ? { border: "7px solid var(--color-ink)", background: "var(--color-lime)" } : { border: "2px solid var(--color-switch-off)", background: "var(--color-card)" }}
              />
            </button>
          );
        })}
      </div>
    </Sheet>
  );
}

/* ---------- categories ---------- */

export function CategorySheet({
  open,
  onClose,
  title,
  options,
  value,
  onPick,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  options: CategoryDef[];
  value: string;
  onPick: (k: string) => void;
}) {
  return (
    <Sheet open={open} onClose={onClose} title={title}>
      <div role="radiogroup" aria-label={title} className="grid grid-cols-3 gap-2">
        {options.map((c) => {
          const on = c.key === value;
          return (
            <button
              key={c.key}
              type="button"
              role="radio"
              aria-checked={on}
              onClick={() => {
                onPick(c.key);
                onClose();
              }}
              className={cx("flex min-h-[72px] flex-col items-center justify-center gap-1.5 rounded-2xl border px-1.5 text-[13px] font-semibold", on ? "border-ink bg-ink text-on-ink" : "border-line bg-card")}
            >
              <Icon name={c.icon} size={20} strokeWidth={2} />
              {c.label}
            </button>
          );
        })}
      </div>
    </Sheet>
  );
}

/* ---------- month switcher ---------- */

export function MonthSwitcher() {
  const viewMonth = useStore((s) => s.viewMonth);
  const setViewMonth = useStore((s) => s.setViewMonth);
  const [open, setOpen] = useState(false);
  const current = monthKey(todayISO());
  const months = Array.from({ length: 12 }, (_, i) => shiftMonth(current, -i));
  const { t } = useTranslation();
  return (
    <>
      <button type="button" aria-haspopup="dialog" onClick={() => setOpen(true)} className="flex min-h-6 items-center gap-1 text-[13px] text-muted">
        {monthLabel(viewMonth)}
        <Icon name="chevronDown" size={14} strokeWidth={2} />
      </button>
      <Sheet open={open} onClose={() => setOpen(false)} title={t("picker.pickMonth")}>
        <div className="grid grid-cols-3 gap-2">
          {months.map((k) => {
            const [yy, mm] = k.split("-").map(Number);
            const on = k === viewMonth;
            return (
              <button
                key={k}
                type="button"
                aria-pressed={on}
                onClick={() => {
                  setViewMonth(k);
                  setOpen(false);
                }}
                className={cx("flex min-h-14 flex-col items-center justify-center rounded-2xl border", on ? "border-ink bg-ink text-on-ink" : "border-line bg-card")}
              >
                <span className="text-sm font-semibold">{monthNamesShort()[mm - 1]}</span>
                <span className={cx("text-xs", on ? "text-on-ink/65" : "text-muted")}>{displayYear(yy)}</span>
              </button>
            );
          })}
        </div>
      </Sheet>
    </>
  );
}

