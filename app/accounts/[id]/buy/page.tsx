"use client";

import { useParams, useRouter } from "next/navigation";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { PushScreen } from "@/components/app";
import { CategorySheet, DateSheet } from "@/components/pickers";
import { Card, Chip, Empty, ListCard, PickerRow, PrimaryButton, PushHeader } from "@/components/ui/primitives";
import { EXPENSE_CATEGORIES, MONO_TONES, categoryLabel } from "@/lib/constants";
import { addDays, baht2, diffDays, shortDate, stepCycle, todayISO } from "@/lib/format";
import { accountDue, creditSummary, planInterest } from "@/lib/selectors";
import { useGoBack } from "@/lib/nav";
import { useStore } from "@/lib/store";
import { BahtInput } from "@/components/BahtInput";

const MONTH_CHOICES = [3, 6, 10, 12];
const money = (s: string) => s.replace(/[^0-9.]/g, "");

/** A pay-later purchase: price, months, and the installment the shop's app shows. */
export default function BuyInInstallmentsPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const goBack = useGoBack(`/accounts/${id}`);
  const { t } = useTranslation();
  const account = useStore((s) => s.accounts.find((a) => a.id === id));
  const transactions = useStore((s) => s.transactions);
  const subscriptions = useStore((s) => s.subscriptions);
  const addSubscription = useStore((s) => s.addSubscription);
  const today = todayISO();
  // First installment on the account's next due date, skipping one less than two weeks away
  // (that bill has usually closed already); a month from today without a due day.
  const [firstDue, setFirstDue] = useState(() => {
    const next = account ? accountDue(account, transactions, addDays(today, 1))?.due : undefined;
    if (!next) return stepCycle(today, "month", 1);
    return diffDays(next, today) < 14 ? stepCycle(next, "month", 1) : next;
  });
  const [name, setName] = useState("");
  const [priceText, setPriceText] = useState("");
  const [months, setMonths] = useState(3);
  const [monthsText, setMonthsText] = useState("");
  const [perText, setPerText] = useState("");
  const [perTouched, setPerTouched] = useState(false);
  const [category, setCategory] = useState("shop");
  const [sheet, setSheet] = useState<"" | "date" | "category">("");

  if (!account) {
    return (
      <PushScreen>
        <PushHeader backHref="/accounts" />
        <Empty>{t("subs.notFound")}</Empty>
      </PushScreen>
    );
  }

  const price = parseFloat(priceText) || 0;
  // Until the user types the shop's figure, suggest an even split.
  const per = perTouched ? parseFloat(perText) || 0 : price && months ? Math.round((price / months) * 100) / 100 : 0;
  const interest = price && per ? planInterest({ amount: per, installments: months, principal: price }) : null;
  const available = creditSummary(account, transactions, subscriptions, today).available;
  const canSave = name.trim().length > 0 && price > 0 && per > 0 && months >= 1;
  const pickMonths = (n: number) => {
    setMonths(n);
    if (!perTouched) setPerText("");
  };

  return (
    <PushScreen className="gap-3.5">
      <PushHeader title={t("pay.buy")} backIcon="close" onBack={() => goBack()} />
      <p className="-mt-2 text-center text-[13px] text-muted">{account.name}</p>

      <Card className="flex flex-col gap-3 px-4 py-3.5">
        <label className="flex flex-col gap-0.5">
          <span className="text-xs text-muted">{t("pay.item")}</span>
          <input
            value={name}
            maxLength={80}
            onChange={(e) => setName(e.target.value)}
            placeholder={t("pay.itemPlaceholder")}
            className="min-h-9 w-full border-b border-line-strong bg-transparent pb-1 font-serif text-[20px] font-bold outline-none"
          />
        </label>
        <label className="flex items-baseline gap-2">
          <span className="shrink-0 text-[13px] text-muted">{t("pay.price")}</span>
          <span className="flex grow items-baseline justify-end gap-0.5 font-mono text-[26px] font-semibold">
            ฿
            <BahtInput value={priceText} onChange={(e) => setPriceText(money(e.target.value))} placeholder="0" aria-label={t("pay.price")} className="w-full min-w-0 bg-transparent text-right outline-none" />
          </span>
        </label>
        {price > available ? <p className="-mt-1 text-right text-xs font-semibold text-danger">{t("pay.overLimit", { amount: baht2(price - available) })}</p> : null}
      </Card>

      <section className="flex flex-col gap-2">
        <h2 className="text-[13px] font-semibold text-muted">{t("pay.months")}</h2>
        <div className="flex flex-wrap items-center gap-1.5">
          {MONTH_CHOICES.map((n) => (
            <Chip key={n} size="sm" on={months === n && !monthsText} onClick={() => { setMonthsText(""); pickMonths(n); }}>
              {t("pay.monthsN", { count: n })}
            </Chip>
          ))}
          <input
            inputMode="numeric"
            value={monthsText}
            onChange={(e) => {
              const v = e.target.value.replace(/[^0-9]/g, "").slice(0, 2);
              setMonthsText(v);
              const n = Math.min(60, parseInt(v, 10) || 0);
              if (n) pickMonths(n);
            }}
            placeholder="…"
            aria-label={t("pay.months")}
            className="min-h-[34px] w-14 rounded-full border border-line bg-card text-center text-[13px] outline-none"
          />
        </div>
      </section>

      <Card className="flex flex-col gap-2 px-4 py-3.5">
        <label className="flex items-baseline gap-2">
          <span className="flex shrink-0 flex-col">
            <span className="text-[13px] text-muted">{t("pay.perInstallment")}</span>
          </span>
          <span className="flex grow items-baseline justify-end gap-0.5 font-mono text-[24px] font-semibold">
            ฿
            <BahtInput
              value={perTouched ? perText : per ? String(per) : ""}
              onChange={(e) => {
                setPerTouched(true);
                setPerText(money(e.target.value));
              }}
              placeholder="0"
              aria-label={t("pay.perInstallment")}
              className="w-full min-w-0 bg-transparent text-right outline-none"
            />
          </span>
        </label>
        <p className="text-[11px] text-faint">{t("pay.perInstallmentHint")}</p>
        {interest ? (
          <div className="flex justify-between border-t border-divider pt-2 text-[13px]">
            <span className={interest.total > 0 ? "font-semibold text-expense" : "text-muted"}>
              {interest.total > 0 ? t("pay.interest", { total: baht2(interest.total), pct: interest.monthlyPct }) : t("pay.noInterest")}
            </span>
            <span className="font-semibold">{t("pay.totalPay", { total: baht2(per * months) })}</span>
          </div>
        ) : null}
      </Card>

      <ListCard>
        <PickerRow label={t("pay.firstDue")} value={shortDate(firstDue)} onClick={() => setSheet("date")} />
        <PickerRow label={t("common.category")} value={categoryLabel(category)} onClick={() => setSheet("category")} />
      </ListCard>

      <div className="mt-auto">
        <PrimaryButton
          once
          disabled={!canSave}
          onClick={() => {
            addSubscription({
              kind: "recurring",
              entryType: "out",
              name: name.trim(),
              amount: per,
              currency: "THB",
              cycle: "month",
              startDate: firstDue,
              accountId: account.id,
              toAccountId: null,
              installments: months,
              principal: price,
              category,
              remind: true,
              autoLog: true,
              paused: false,
              tone: MONO_TONES[5],
            });
            router.replace(`/accounts/${account.id}`);
          }}
        >
          {t("pay.save")}
        </PrimaryButton>
      </div>

      <DateSheet open={sheet === "date"} onClose={() => setSheet("")} title={t("pay.firstDue")} value={firstDue} onChange={setFirstDue} />
      <CategorySheet open={sheet === "category"} onClose={() => setSheet("")} title={t("common.category")} options={EXPENSE_CATEGORIES} value={category} onPick={setCategory} />
    </PushScreen>
  );
}
