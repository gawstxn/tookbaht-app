"use client";

import { useMemo, useState } from "react";
import { TabScreen, TxIcon, TxRow } from "@/components/app";
import { MonthSwitcher } from "@/components/pickers";
import { Icon } from "@/components/ui/Icon";
import { Chip, Empty, IconButton, ListCard, SecondaryButton, Sheet, TabHeader } from "@/components/ui/primitives";
import { TYPE_META, categoryLabel } from "@/lib/constants";
import { baht, baht2, dayHeading, shortDate, todayISO } from "@/lib/format";
import { monthTransactions, summarize } from "@/lib/selectors";
import { useTranslation } from "react-i18next";
import { txTitle } from "@/lib/txTitle";
import { useStore } from "@/lib/store";
import type { Transaction, TxType } from "@/lib/types";

type Filter = "all" | TxType;

export default function TransactionsPage() {
  const { transactions, viewMonth, accounts, deleteTransaction } = useStore();
  const { t: tr } = useTranslation();
  const [filter, setFilter] = useState<Filter>("all");
  const [query, setQuery] = useState("");
  const [searching, setSearching] = useState(false);
  const [selected, setSelected] = useState<Transaction | null>(null);
  const today = todayISO();

  const month = useMemo(() => monthTransactions(transactions, viewMonth), [transactions, viewMonth]);
  const sum = useMemo(() => summarize(month), [month]);

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

  const accName = (id?: string) => accounts.find((a) => a.id === id)?.name ?? "—";

  return (
    <TabScreen>
      <TabHeader
        title={tr("tx.title")}
        subtitle={<MonthSwitcher />}
        actions={<IconButton icon={searching ? "close" : "search"} label={tr(searching ? "tx.closeSearch" : "tx.search")} onClick={() => { setSearching(!searching); setQuery(""); }} />}
      />

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
        <Empty>{query ? tr("tx.notFound") : tr("tx.none")}</Empty>
      )}

      <Sheet open={!!selected} onClose={() => setSelected(null)} title={tr("tx.detail")}>
        {selected ? (
          <>
            <div className="flex items-center gap-3">
              <TxIcon type={selected.type} category={selected.category} size={48} />
              <div className="flex flex-col">
                <span className="text-lg font-semibold">{txTitle(selected, accounts)}</span>
                <span className="font-mono text-xl font-semibold" style={{ color: TYPE_META[selected.type].color }}>
                  {TYPE_META[selected.type].sign}
                  {baht2(selected.amount)}
                </span>
              </div>
            </div>
            <ListCard>
              <Detail label={tr("common.type")} value={TYPE_META[selected.type].label} />
              <Detail label={tr("common.date")} value={shortDate(selected.date)} />
              {selected.type === "move" ? (
                <>
                  <Detail label={tr("common.fromAccount")} value={accName(selected.fromId)} />
                  <Detail label={tr("common.toAccount")} value={accName(selected.toId)} />
                </>
              ) : (
                <>
                  <Detail label={tr("common.category")} value={categoryLabel(selected.category)} />
                  <Detail label={tr("common.account")} value={accName(selected.accountId)} />
                </>
              )}
              {selected.note ? <Detail label={tr("common.note")} value={selected.note} /> : null}
              {selected.subscriptionId ? <Detail label={tr("common.source")} value={tr("tx.fromSub")} /> : null}
            </ListCard>
            <SecondaryButton
              tone="danger"
              onClick={() => {
                deleteTransaction(selected.id);
                setSelected(null);
              }}
            >
              {tr("tx.delete")}
            </SecondaryButton>
          </>
        ) : null}
      </Sheet>
    </TabScreen>
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

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex min-h-11 items-center justify-between gap-4 text-sm">
      <span className="text-muted">{label}</span>
      <span className="text-right font-semibold">{value}</span>
    </div>
  );
}
