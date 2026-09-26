"use client";

import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { PushScreen, TxRow } from "@/components/app";
import { TxDetailSheet } from "@/components/TxDetailSheet";
import { Icon } from "@/components/ui/Icon";
import { Card, Empty, ListCard, PushHeader, Sheet } from "@/components/ui/primitives";
import { categoryLabel } from "@/lib/constants";
import { baht, shortDate } from "@/lib/format";
import { useGoBack } from "@/lib/nav";
import { spendByCategory } from "@/lib/selectors";
import { useStore } from "@/lib/store";
import { tagSummaries, type TagSummary } from "@/lib/tags";
import type { Transaction } from "@/lib/types";

/** Trips and projects: what each tag cost, over whatever months it spans. */
export default function TagsPage() {
  const { t } = useTranslation();
  const goBack = useGoBack("/insights");
  const transactions = useStore((s) => s.transactions);
  const tags = useMemo(() => tagSummaries(transactions), [transactions]);
  const [open, setOpen] = useState<TagSummary | null>(null);
  const [shown, setShown] = useState<TagSummary | null>(null);
  if (open && open !== shown) setShown(open);
  const [selected, setSelected] = useState<Transaction | null>(null);
  const entries = useMemo(
    () => (shown ? transactions.filter((x) => x.tag === shown.tag).sort((a, b) => b.date.localeCompare(a.date) || b.createdAt - a.createdAt) : []),
    [transactions, shown],
  );
  const byCat = useMemo(() => Object.entries(spendByCategory(entries)).sort((a, b) => b[1] - a[1]), [entries]);

  return (
    <PushScreen>
      <PushHeader title={t("tags.title")} onBack={goBack} />
      <p className="flex items-start gap-2 text-xs leading-relaxed text-muted">
        <Icon name="tag" size={16} strokeWidth={2} className="mt-px shrink-0" />
        {t("tags.hint")}
      </p>
      {tags.length ? (
        tags.map((g) => (
          <button key={g.tag} type="button" onClick={() => setOpen(g)} className="text-left">
            <Card className="flex items-center gap-3 px-4 py-3.5">
              <span className="flex min-w-0 grow flex-col">
                <span className="truncate text-[15px] font-semibold">{g.tag}</span>
                <span className="text-xs text-muted">
                  {g.from === g.to ? shortDate(g.from) : `${shortDate(g.from)} – ${shortDate(g.to)}`} · {t("common.items", { count: g.count })}
                </span>
              </span>
              <span className="font-mono text-[15px] font-semibold">{baht(g.spent)}</span>
              <Icon name="chevronRight" size={16} strokeWidth={2} className="text-faint" />
            </Card>
          </button>
        ))
      ) : (
        <Empty>{t("tags.empty")}</Empty>
      )}

      <Sheet open={!!open && !selected} onClose={() => setOpen(null)} title={shown?.tag ?? ""}>
        {shown ? (
          <>
            <p className="text-sm text-muted">{t("tags.total", { amount: baht(shown.spent), count: shown.count })}</p>
            {byCat.length ? (
              <div className="flex flex-wrap gap-x-3 gap-y-1 text-xs text-muted">
                {byCat.map(([key, amount]) => (
                  <span key={key}>
                    {categoryLabel(key)} <span className="font-mono font-semibold text-ink">{baht(amount)}</span>
                  </span>
                ))}
              </div>
            ) : null}
            <ListCard>
              {entries.map((x) => (
                <TxRow key={x.id} t={x} onClick={() => setSelected(x)} />
              ))}
            </ListCard>
          </>
        ) : null}
      </Sheet>
      <TxDetailSheet tx={selected} onClose={() => setSelected(null)} />
    </PushScreen>
  );
}
