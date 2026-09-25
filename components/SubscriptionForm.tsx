"use client";

import { useState } from "react";
import { AccountSheet, CategorySheet, DateSheet } from "@/components/pickers";
import { Icon } from "@/components/ui/Icon";
import { Card, Chip, Empty, ListCard, PickerRow, PrimaryButton, PushHeader, Segmented, Sheet, SwitchRow, cx } from "@/components/ui/primitives";
import { BrandMark, PushScreen, SubMono } from "@/components/app";
import { findBrand, normalizeName, suggestCategory } from "@/lib/brands";
import { MONO_TONES, POPULAR_SUBS, SUB_CATALOG, SUB_CATEGORIES } from "@/lib/constants";
import { useTranslation } from "react-i18next";
import { baht, cyclePer, fromISO, monthlyEquivalent, shortDate, todayISO } from "@/lib/format";
import { useStore } from "@/lib/store";
import { formatMoney, toTHB } from "@/lib/fx";
import type { Currency, Cycle, Subscription } from "@/lib/types";

export type SubDraft = Omit<Subscription, "id">;

/** Brand colour for known services, otherwise a stable colour per name. */
function toneFor(name: string) {
  const brand = findBrand(name);
  if (brand) return brand.color;
  let h = 0;
  for (const ch of name.trim().toLowerCase()) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return MONO_TONES[h % MONO_TONES.length];
}

export function SubscriptionForm({
  title,
  initial,
  onSave,
  onBack,
  saveLabel,
}: {
  title: string;
  initial?: SubDraft;
  onSave: (s: SubDraft) => void;
  onBack: () => void;
  saveLabel: string;
}) {
  const accounts = useStore((s) => s.accounts);
  const usdRate = useStore((s) => s.usdRate);
  const ensureUsdRate = useStore((s) => s.ensureUsdRate);
  const today = todayISO();
  const [d, setD] = useState<SubDraft>(
    initial ?? {
      kind: "subscription",
      entryType: "out",
      name: "",
      amount: 0,
      currency: "THB",
      cycle: "month",
      startDate: today,
      accountId: accounts.find((a) => a.kind === "credit")?.id ?? accounts[0]?.id ?? "",
      category: "fun",
      remind: true,
      autoLog: true,
      paused: false,
      tone: MONO_TONES[0],
    },
  );
  const { t } = useTranslation();
  const [amountText, setAmountText] = useState(initial ? String(initial.amount) : "");
  // The field holds the listed price; +VAT is a toggle on top of it, so tapping it twice doesn't add 7% twice.
  const [vat, setVat] = useState(false);
  const [sheet, setSheet] = useState<"" | "date" | "account" | "category" | "catalog">("");
  const [categoryTouched, setCategoryTouched] = useState(!!initial);
  const pick = (n: string) => set({ name: n, category: suggestCategory(n) ?? d.category });
  const set = (p: Partial<SubDraft>) => setD((x) => ({ ...x, ...p }));

  const account = accounts.find((a) => a.id === d.accountId);
  // Baht per billing cycle (estimated for USD from the latest rate and the card's fee).
  const thb = toTHB(d.amount, d.currency, usdRate, account);
  const monthly = monthlyEquivalent(thb ?? 0, d.cycle);
  const priced = (text: string, withVat: boolean) => {
    const n = parseFloat(text) || 0;
    return withVat ? Math.round(n * 107) / 100 : n;
  };
  const setAmount = (v: string) => {
    setAmountText(v);
    set({ amount: priced(v, vat && d.currency === "USD") });
  };
  const toggleVat = () => {
    setVat(!vat);
    set({ amount: priced(amountText, !vat) });
  };
  const canSave = d.name.trim().length > 0 && d.amount > 0 && !!d.accountId;
  const start = fromISO(d.startDate);
  const hint =
    d.cycle === "week"
      ? t("subs.hintWeek")
      : d.cycle === "year"
        ? t("subs.hintYear", { date: shortDate(d.startDate, false) })
        : t("subs.hintMonth", { day: start.getDate() });

  return (
    <PushScreen className="gap-3.5">
      <PushHeader title={title} backIcon="close" onBack={onBack} />

      <div className="flex items-center gap-3.5">
        {findBrand(d.name) ? (
          <SubMono s={{ name: d.name, tone: toneFor(d.name) }} size={56} />
        ) : (
          <span aria-hidden="true" className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-hero text-2xl font-bold text-lime">
            {(d.name.trim()[0] ?? "?").toUpperCase()}
          </span>
        )}
        <div className="flex min-w-0 grow flex-col gap-0.5">
          <label htmlFor="subname" className="text-xs text-muted">
            {t("subs.name")}
          </label>
          <input
            id="subname"
            value={d.name}
            onChange={(e) => {
              // Typing a known service (e.g. "Claude Pro") picks its category too, until the user chooses one.
              const suggested = suggestCategory(e.target.value);
              set({ name: e.target.value, ...(suggested && !categoryTouched ? { category: suggested } : {}) });
            }}
            placeholder={t("subs.namePlaceholder")}
            className="min-h-9 w-full border-b border-line-strong bg-transparent pb-1 font-serif text-[22px] font-bold outline-none"
          />
        </div>
      </div>

      <div aria-label={t("subs.popular")} className="flex flex-wrap gap-1.5">
        {POPULAR_SUBS.map((n) => {
          const brand = findBrand(n);
          return (
            <Chip key={n} size="sm" on={d.name === n} onClick={() => pick(n)}>
              <span className="flex items-center gap-1.5">
                {brand ? <BrandMark brand={brand} size={18} /> : null}
                {n}
              </span>
            </Chip>
          );
        })}
        <Chip size="sm" on={false} onClick={() => setSheet("catalog")}>
          <span className="flex items-center gap-1">
            {t("common.seeAll")}
            <Icon name="chevronRight" size={14} strokeWidth={2.2} />
          </span>
        </Chip>
      </div>

      <Card className="flex flex-col gap-3 px-4 py-3.5">
        <div className="flex items-center justify-between gap-3">
          <span className="text-[13px] text-muted">{t("subs.price")}</span>
          <div className="w-32">
            <Segmented<Currency>
              size="sm"
              label={t("subs.currency")}
              value={d.currency}
              onChange={(currency) => {
                set({ currency, amount: priced(amountText, vat && currency === "USD") });
                if (currency === "USD") void ensureUsdRate();
              }}
              options={[
                { value: "THB", label: "฿ THB" },
                { value: "USD", label: "$ USD" },
              ]}
            />
          </div>
        </div>
        <label className="flex items-baseline gap-2">
          <span className="flex grow items-baseline gap-0.5 font-mono text-[30px] font-semibold">
            {d.currency === "USD" ? "US$" : "฿"}
            <input
              inputMode="decimal"
              value={amountText}
              onChange={(e) => setAmount(e.target.value.replace(/[^0-9.]/g, ""))}
              placeholder="0"
              aria-label={t("subs.price")}
              className="w-full min-w-0 bg-transparent outline-none"
            />
          </span>
          {d.currency === "USD" ? (
            <button
              type="button"
              aria-pressed={vat}
              onClick={toggleVat}
              className={cx(
                "flex shrink-0 items-center gap-1 rounded-full border px-2.5 py-1 text-xs font-semibold",
                vat ? "border-ink bg-ink text-on-ink" : "border-line",
              )}
            >
              {vat ? <Icon name="check" size={12} strokeWidth={2.6} /> : null}
              {t("subs.addVat")}
            </button>
          ) : null}
        </label>
        {d.currency === "USD" ? (
          <p className="-mt-1 text-xs leading-relaxed text-muted">
            {vat && d.amount > 0 ? (
              <span className="font-semibold text-ink">{t("subs.withVat", { amount: formatMoney(d.amount, "USD") })}</span>
            ) : (
              t("subs.vatHint")
            )}
            <br />
            {thb !== null && d.amount > 0 ? (
              <>
                <span className="font-semibold text-ink">
                  ≈ <span className="font-mono">{formatMoney(thb, "THB")}</span> {cyclePer(d.cycle)}
                </span>
                {" · "}
                {t("subs.estimateNote", {
                  rate: usdRate!.rate.toFixed(2),
                  fee: account?.fxFeePct ? t("subs.feeNote", { pct: account.fxFeePct }) : "",
                })}
              </>
            ) : thb === null ? (
              t("subs.noRate")
            ) : null}
          </p>
        ) : null}
        <Segmented<Cycle>
          size="sm"
          label={t("subs.cycle")}
          value={d.cycle}
          onChange={(cycle) => set({ cycle })}
          options={[
            { value: "week", label: t("cycle.week") },
            { value: "month", label: t("cycle.month") },
            { value: "year", label: t("cycle.year") },
          ]}
        />
      </Card>

      <ListCard>
        <PickerRow label={t("subs.start")} value={shortDate(d.startDate)} onClick={() => setSheet("date")} />
        <PickerRow label={t("subs.payFrom")} value={accounts.find((a) => a.id === d.accountId)?.name ?? t("common.selectAccount")} onClick={() => setSheet("account")} />
        <PickerRow label={t("common.category")} value={SUB_CATEGORIES.find((c) => c.key === d.category)?.label ?? ""} onClick={() => setSheet("category")} />
      </ListCard>

      <ListCard>
        <SwitchRow label={t("subs.remindForm")} checked={d.remind} onChange={(remind) => set({ remind })} />
        <SwitchRow label={t("subs.autoLog")} checked={d.autoLog} onChange={(autoLog) => set({ autoLog })} />
      </ListCard>

      <div className="mt-auto flex flex-col gap-2.5">
        <p className="flex justify-center gap-1.5 text-[13px] text-muted">
          {t("subs.average")} <span className="font-mono font-semibold text-ink">{baht(monthly)}</span> {t("common.perMonth")} ·
          <span className="font-mono font-semibold text-ink">{baht(monthly * 12)}</span> {t("common.perYear")}
        </p>
        <PrimaryButton
          once
          disabled={!canSave}
          onClick={() => {
            const name = d.name.trim();
            // Keep a custom colour on edit unless the name now matches a known service.
            const tone = findBrand(name) || !initial ? toneFor(name) : initial.tone;
            onSave({ ...d, name, tone });
          }}
        >
          {saveLabel}
        </PrimaryButton>
      </div>

      <DateSheet
        open={sheet === "date"}
        onClose={() => setSheet("")}
        title={t("subs.start")}
        value={d.startDate}
        onChange={(startDate) => set({ startDate })}
        hint={d.startDate < today ? hint + t("subs.noBackfill") : hint}
      />
      <AccountSheet open={sheet === "account"} onClose={() => setSheet("")} title={t("subs.payFrom")} value={d.accountId} onPick={(accountId) => set({ accountId })} />
      <CatalogSheet
        open={sheet === "catalog"}
        onClose={() => setSheet("")}
        onPick={(n) => {
          pick(n);
          setSheet("");
        }}
      />
      <CategorySheet open={sheet === "category"} onClose={() => setSheet("")} title={t("common.category")} options={SUB_CATEGORIES} value={d.category} onPick={(category) => {
          setCategoryTouched(true);
          set({ category });
        }} />
    </PushScreen>
  );
}

/** Full list of known services, grouped, with search. */
function CatalogSheet({ open, onClose, onPick }: { open: boolean; onClose: () => void; onPick: (name: string) => void }) {
  const { t } = useTranslation();
  const [q, setQ] = useState("");
  const query = normalizeName(q);
  const groups = SUB_CATALOG.map((g) => ({ ...g, names: g.names.filter((n) => !query || normalizeName(n).includes(query)) })).filter((g) => g.names.length);
  return (
    <Sheet open={open} onClose={onClose} title={t("subs.pickService")}>
      <label className="flex min-h-11 items-center gap-2 rounded-xl border border-line bg-card px-3">
        <Icon name="search" size={16} strokeWidth={2} className="text-faint" />
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder={t("subs.searchPlaceholder")} aria-label={t("subs.searchService")} className="min-w-0 grow bg-transparent text-sm outline-none" />
      </label>
      {groups.length === 0 ? <Empty>{t("subs.noService")}</Empty> : null}
      {groups.map((g) => (
        <section key={g.title} className="flex flex-col gap-1.5">
          <h3 className="text-[13px] font-semibold text-muted">{g.title}</h3>
          <ListCard>
            {g.names.map((n) => (
              <button key={n} type="button" onClick={() => onPick(n)} className="flex min-h-[52px] w-full items-center gap-3 text-left">
                <SubMono s={{ name: n, tone: toneFor(n) }} size={32} />
                <span className="grow text-[15px]">{n}</span>
              </button>
            ))}
          </ListCard>
        </section>
      ))}
    </Sheet>
  );
}
