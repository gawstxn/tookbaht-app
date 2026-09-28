"use client";

import { useTranslation } from "react-i18next";
import { PushScreen } from "@/components/app";
import { useCashFlow } from "@/components/cashflow";
import { Card, Empty, PushHeader, cx } from "@/components/ui/primitives";
import { CASHFLOW_DAYS, type CashEvent } from "@/lib/cashflow";
import { baht, shortDate } from "@/lib/format";
import { useGoBack } from "@/lib/nav";
import { useStore } from "@/lib/store";

/** Each account's balance day by day over the next 30 days, and where it runs short. */
export default function CashFlowPage() {
  const { t } = useTranslation();
  const goBack = useGoBack("/accounts");
  const flows = useCashFlow();
  const accounts = useStore((s) => s.accounts);
  // Cards whose bill can't be placed: no "pay from" account set.
  const unplaced = accounts.filter((a) => a.kind === "credit" && a.dueDay && !a.billFromId);

  return (
    <PushScreen>
      <PushHeader title={t("cashflow.title")} onBack={goBack} />
      <p className="text-sm leading-relaxed text-muted">{t("cashflow.lead", { count: CASHFLOW_DAYS })}</p>

      {flows.length ? (
        flows.map((f) => (
          <Card key={f.account.id} className="flex flex-col px-4 py-3">
            <div className="flex items-baseline justify-between gap-3 border-b border-divider pb-2.5">
              <span className="truncate text-[15px] font-semibold">{f.account.name}</span>
              <span className="shrink-0 text-xs text-muted">
                {t("cashflow.now")}{" "}
                <span className={cx("font-mono text-sm font-semibold", f.start < 0 ? "text-danger" : "text-ink")}>
                  {f.start < 0 ? "−" : ""}
                  {baht(Math.abs(f.start))}
                </span>
              </span>
            </div>
            {f.start < 0 ? (
              <p className="mt-2.5 rounded-xl bg-warn-tint px-3 py-2 text-xs leading-relaxed" style={{ color: "var(--color-warn-ink)" }}>
                {t("cashflow.negativeNow")}
              </p>
            ) : f.short ? (
              <p className="mt-2.5 rounded-xl bg-expense-tint px-3 py-2 text-xs font-semibold leading-relaxed text-danger">
                {t("cashflow.shortBy", { date: shortDate(f.short.event.date, false), amount: baht(f.short.by) })}
              </p>
            ) : (
              <p className="mt-2.5 text-xs font-semibold text-income">{t("cashflow.enough")}</p>
            )}
            <ol className="flex flex-col">
              {f.events.map((e, i) => (
                <EventRow key={`${e.date}-${e.subscriptionId ?? e.cardId}-${i}`} e={e} />
              ))}
            </ol>
          </Card>
        ))
      ) : (
        <Empty>{t("cashflow.empty", { count: CASHFLOW_DAYS })}</Empty>
      )}

      {unplaced.length ? <p className="text-xs leading-relaxed text-muted">{t("cashflow.noPayFrom", { names: unplaced.map((a) => a.name).join(", ") })}</p> : null}
      <p className="text-xs leading-relaxed text-muted">{t("cashflow.hint")}</p>
    </PushScreen>
  );
}

function EventRow({ e }: { e: CashEvent }) {
  const { t } = useTranslation();
  const label = e.kind === "card" ? t("cashflow.cardBill", { name: e.label }) : e.label || t("cashflow.transfer");
  return (
    <li className="flex min-h-12 items-center gap-3 border-b border-divider py-2 last:border-b-0">
      <span className="w-14 shrink-0 text-xs text-muted">{shortDate(e.date, false)}</span>
      <span className="flex min-w-0 grow flex-col">
        <span className="truncate text-sm font-medium">{label}</span>
        <span className={cx("font-mono text-xs", e.amount > 0 ? "text-income" : "text-muted")}>
          {e.amount > 0 ? "+" : "−"}
          {baht(Math.abs(e.amount))}
        </span>
      </span>
      <span className="shrink-0 text-right">
        <span className="block text-[11px] text-muted">{t("cashflow.after")}</span>
        <span className={cx("font-mono text-sm font-semibold", e.balance < 0 && "text-danger")}>
          {e.balance < 0 ? "−" : ""}
          {baht(Math.abs(e.balance))}
        </span>
      </span>
    </li>
  );
}
