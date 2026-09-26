"use client";

import { useMemo, useState } from "react";
import { TabScreen, TxRow } from "@/components/app";
import { TxDetailSheet } from "@/components/TxDetailSheet";
import { DateSheet, MonthSwitcher } from "@/components/pickers";
import { Icon } from "@/components/ui/Icon";
import { Chip, Empty, IconButton, ListCard, PickerRow, PrimaryButton, SecondaryButton, Sheet, TabHeader } from "@/components/ui/primitives";
import { EXPENSE_CATEGORIES, INCOME_CATEGORIES, categoryLabel } from "@/lib/constants";
import { baht, baht2, dayHeading, shortDate, todayISO } from "@/lib/format";
import { filterTransactions, monthTransactions, summarize, type TxFilter } from "@/lib/selectors";
import { useTranslation } from "react-i18next";
import { txTitle } from "@/lib/txTitle";
import { useStore } from "@/lib/store";
import type { Transaction, TxType } from "@/lib/types";

type Filter = "all" | TxType;

export default function TransactionsPage() {
  const { transactions, viewMonth, accounts } = useStore();
  const { t: tr } = useTranslation();
  const [filter, setFilter] = useState<Filter>("all");
  const [query, setQuery] = useState("");
  const [searching, setSearching] = useState(false);
  const [selected, setSelected] = useState<Transaction | null>(null);
  const [scope, setScope] = useState<TxFilter>({});
  const [filterSheet, setFilterSheet] = useState(false);
  const today = todayISO();
  const accName = (id?: string) => accounts.find((a) => a.id === id)?.name ?? "—";
  // A date range replaces the month view; account and category narrow either.
  const ranged = !!(scope.from || scope.to);

  const month = useMemo(
    () => filterTransactions(ranged ? transactions : monthTransactions(transactions, viewMonth), scope),
    [transactions, viewMonth, scope, ranged],
  );
  const sum = useMemo(() => summarize(month), [month]);
  const active = [
    scope.accountId ? { key: "accountId" as const, label: accName(scope.accountId) } : null,
    scope.category ? { key: "category" as const, label: categoryLabel(scope.category) } : null,
  ].filter((x) => x !== null);

  const groups = useMemo(() => {
    const q = query.trim().toLowerCase();
    const rows = month
      .filter((t) => filter === "all" || t.type === filter)
      .filter((t) => !q || txTitle(t, accounts).toLowerCase().includes(q) || t.title.toLowerCase().includes(q) || (t.note ?? "").toLowerCase().includes(q))
      .sort((a, b) => b.date.localeCompare(a.date) || b.createdAt - a.createdAt);
    const map = new Map<string, Transaction[]>();
    for (const t of rows) map.set(t.date, [...(map.get(t.date) ?? []), t]);
    return [...map.entries()].map(([date, items]) => ({ date, items, net: summarize(items).net }));
  }, [month, filter, query, accounts]);

  return (
    <TabScreen>
      <TabHeader
        title={tr("tx.title")}
        subtitle={
          ranged ? (
            <button type="button" onClick={() => setFilterSheet(true)} className="flex min-h-6 items-center gap-1 text-[13px] text-muted">
              {rangeLabel(scope, tr("tx.anyDate"))}
              <Icon name="chevronDown" size={14} strokeWidth={2} />
            </button>
          ) : (
            <MonthSwitcher />
          )
        }
        actions={
          <>
            <span className="relative">
              <IconButton icon="sliders" label={tr("tx.filters")} onClick={() => setFilterSheet(true)} />
              {active.length || ranged ? <span aria-hidden="true" className="absolute right-0.5 top-0.5 h-2.5 w-2.5 rounded-full border-2 border-paper bg-expense" /> : null}
            </span>
            <IconButton icon="chart" label={tr("insights.open")} href="/insights" />
            <IconButton icon={searching ? "close" : "search"} label={tr(searching ? "tx.closeSearch" : "tx.search")} onClick={() => { setSearching(!searching); setQuery(""); }} />
          </>
        }
      />

      {active.length || ranged ? (
        <div className="flex flex-wrap gap-1.5">
          {ranged ? <ActiveFilter label={rangeLabel(scope, tr("tx.anyDate"))} onRemove={() => setScope({ ...scope, from: undefined, to: undefined })} /> : null}
          {active.map((f) => (
            <ActiveFilter key={f.key} label={f.label} onRemove={() => setScope({ ...scope, [f.key]: undefined })} />
          ))}
        </div>
      ) : null}

      {searching ? (
        <label className="flex min-h-12 items-center gap-2 rounded-[14px] border border-line bg-card px-3.5">
          <Icon name="search" size={18} className="text-muted" />
          <span className="sr-only">{tr("tx.searchLabel")}</span>
          <input autoFocus value={query} onChange={(e) => setQuery(e.target.value)} placeholder={tr("tx.searchPlaceholder")} className="grow bg-transparent text-[15px] outline-none" />
        </label>
      ) : null}

      <div className="grid grid-cols-3 rounded-2xl border border-line bg-card px-1 py-3">
        <Stat label={tr("type.in")} value={`+${baht(sum.income).slice(1)}`} color="var(--color-income)" />
        <Stat label={tr("type.out")} value={`−${baht(sum.expense).slice(1)}`} color="var(--color-expense)" divided />
        <Stat label={tr("type.move")} value={baht(sum.moved).slice(1)} color="var(--color-transfer)" />
      </div>

      <div role="group" aria-label={tr("tx.filter")} className="flex gap-2">
        {(
          [
            ["all", tr("common.all")],
            ["in", tr("type.in")],
            ["out", tr("type.out")],
            ["move", tr("type.move")],
          ] as [Filter, string][]
        ).map(([k, l]) => (
          <Chip key={k} on={filter === k} onClick={() => setFilter(k)}>
            {l}
          </Chip>
        ))}
      </div>

      {groups.length ? (
        groups.map((g) => (
          <section key={g.date} className="flex flex-col gap-1.5">
            <div className="flex items-baseline justify-between px-0.5">
              <h2 className="text-[13px] font-semibold text-muted">{dayHeading(g.date, today)}</h2>
              {g.net !== 0 ? (
                <span className="font-mono text-xs text-muted">
                  {g.net > 0 ? "+" : "−"}
                  {baht2(Math.abs(g.net))}
                </span>
              ) : null}
            </div>
            <ListCard>
              {g.items.map((t) => (
                <TxRow key={t.id} t={t} onClick={() => setSelected(t)} />
              ))}
            </ListCard>
          </section>
        ))
      ) : (
        <Empty>{query || active.length || ranged ? tr("tx.notFound") : tr("tx.none")}</Empty>
      )}

      <FilterSheet open={filterSheet} value={scope} onClose={() => setFilterSheet(false)} onApply={setScope} />

      <TxDetailSheet tx={selected} onClose={() => setSelected(null)} />
    </TabScreen>
  );
}

/** "3 ก.ย. 2569 – 25 ก.ย. 2569", with `any` for an open end. */
function rangeLabel(f: TxFilter, any: string) {
  return `${f.from ? shortDate(f.from) : any} – ${f.to ? shortDate(f.to) : any}`;
}

function ActiveFilter({ label, onRemove }: { label: string; onRemove: () => void }) {
  const { t } = useTranslation();
  return (
    <button
      type="button"
      onClick={onRemove}
      aria-label={t("tx.removeFilter", { label })}
      className="flex min-h-8 items-center gap-1 rounded-full border border-ink bg-ink pl-3 pr-2 text-[13px] font-medium text-on-ink"
    >
      {label}
      <Icon name="close" size={14} strokeWidth={2.2} />
    </button>
  );
}

/** Account, category and date-range filters; edits a draft until "show results". */
function FilterSheet({ open, value, onClose, onApply }: { open: boolean; value: TxFilter; onClose: () => void; onApply: (f: TxFilter) => void }) {
  const { t } = useTranslation();
  const accounts = useStore((s) => s.accounts);
  const [draft, setDraft] = useState(value);
  const [picking, setPicking] = useState<"" | "from" | "to">("");
  const [wasOpen, setWasOpen] = useState(open);
  // Start from the applied filters each time the sheet opens.
  if (open !== wasOpen) {
    setWasOpen(open);
    if (open) setDraft(value);
  }
  const set = (p: Partial<TxFilter>) => setDraft((d) => ({ ...d, ...p }));

  return (
    <>
      <Sheet open={open && !picking} onClose={onClose} title={t("tx.filters")}>
        <section className="flex flex-col gap-2">
          <h3 className="text-[13px] font-semibold text-muted">{t("common.account")}</h3>
          <div className="flex flex-wrap gap-1.5">
            <Chip size="sm" on={!draft.accountId} onClick={() => set({ accountId: undefined })}>
              {t("tx.allAccounts")}
            </Chip>
            {accounts.map((a) => (
              <Chip key={a.id} size="sm" on={draft.accountId === a.id} onClick={() => set({ accountId: a.id })}>
                {a.name}
              </Chip>
            ))}
          </div>
        </section>
        <section className="flex flex-col gap-2">
          <h3 className="text-[13px] font-semibold text-muted">{t("common.category")}</h3>
          <div className="flex flex-wrap gap-1.5">
            <Chip size="sm" on={!draft.category} onClick={() => set({ category: undefined })}>
              {t("tx.allCategories")}
            </Chip>
          </div>
          {/* Expense and income each have their own "Other", so keep the two sets apart. */}
          {([["type.out", EXPENSE_CATEGORIES], ["type.in", INCOME_CATEGORIES]] as const).map(([label, cats]) => (
            <div key={label} className="flex flex-wrap items-center gap-1.5">
              <span className="w-full text-xs text-faint">{t(label)}</span>
              {cats.map((c) => (
                <Chip key={c.key} size="sm" on={draft.category === c.key} onClick={() => set({ category: c.key })}>
                  {c.label}
                </Chip>
              ))}
            </div>
          ))}
        </section>
        <section className="flex flex-col gap-2">
          <h3 className="text-[13px] font-semibold text-muted">{t("tx.dateRange")}</h3>
          <ListCard>
            <PickerRow label={t("tx.from")} value={draft.from ? shortDate(draft.from) : t("tx.anyDate")} onClick={() => setPicking("from")} />
            <PickerRow label={t("tx.to")} value={draft.to ? shortDate(draft.to) : t("tx.anyDate")} onClick={() => setPicking("to")} />
          </ListCard>
        </section>
        <PrimaryButton
          onClick={() => {
            onApply(draft);
            onClose();
          }}
        >
          {t("tx.showResults")}
        </PrimaryButton>
        <SecondaryButton
          onClick={() => {
            onApply({});
            onClose();
          }}
        >
          {t("tx.clearFilters")}
        </SecondaryButton>
      </Sheet>
      <DateSheet
        open={open && picking !== ""}
        onClose={() => setPicking("")}
        title={t(picking === "to" ? "tx.to" : "tx.from")}
        value={(picking === "to" ? draft.to : draft.from) ?? todayISO()}
        min={picking === "to" ? draft.from : undefined}
        max={picking === "from" ? draft.to : undefined}
        onChange={(d) => set(picking === "to" ? { to: d } : { from: d })}
      />
    </>
  );
}

function Stat({ label, value, color, divided }: { label: string; value: string; color: string; divided?: boolean }) {
  return (
    <div className={divided ? "flex flex-col items-center gap-0.5 border-x border-divider" : "flex flex-col items-center gap-0.5"}>
      <span className="text-xs text-muted">{label}</span>
      <span className="font-mono text-[15px] font-semibold" style={{ color }}>
        {value}
      </span>
    </div>
  );
}

