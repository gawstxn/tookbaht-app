"use client";

import { useRouter } from "next/navigation";
import { useState, useSyncExternalStore } from "react";
import { balanceLabel, monoFor } from "@/components/AccountEditSheet";
import { AccountMark } from "@/components/app";
import { InstallPrompt } from "@/components/InstallPrompt";
import { MoneyField } from "@/components/MoneyField";
import { PushToggle } from "@/components/PushToggle";
import { TermsCheckbox } from "@/components/TermsConsent";
import { Card, Chip, ListCard, PrimaryButton, SecondaryButton } from "@/components/ui/primitives";
import { baht } from "@/lib/format";
import { dismissLegacyData, importData, importLegacyData, readLegacyData } from "@/lib/legacyImport";
import { seedData } from "@/lib/seed";
import { useTranslation } from "react-i18next";
import { useStore } from "@/lib/store";
import type { AccountKind } from "@/lib/types";
import { BahtInput } from "@/components/BahtInput";

interface Starter {
  name: string;
  kind: AccountKind;
  tone: string;
  on: boolean;
  balance: string;
}

// Names are filled in the current language when the screen opens.
const STARTERS: (Omit<Starter, "name"> & { nameKey: string })[] = [
  { nameKey: "onboarding.starterSalary", kind: "bank", tone: "#2f5b45", on: true, balance: "" },
  { nameKey: "onboarding.starterCash", kind: "cash", tone: "#5f6259", on: true, balance: "" },
  { nameKey: "onboarding.starterSaving", kind: "saving", tone: "#33558f", on: false, balance: "" },
  { nameKey: "onboarding.starterCredit", kind: "credit", tone: "#8a2e22", on: false, balance: "" },
];

// localStorage only exists in the browser; read it once after hydration.
const noop = () => () => {};
let legacyCache: ReturnType<typeof readLegacyData> | undefined;
const getLegacy = () => (legacyCache === undefined ? (legacyCache = readLegacyData()) : legacyCache);

/** Suggested spending budgets, as a share of income. */
const BUDGET_SHARES = [70, 80, 90];

/**
 * First run: pick starter accounts, then monthly goals (skippable), then
 * install the app and turn on notifications — or bring over data from the
 * device-only version.
 */
export default function OnboardingPage() {
  const router = useRouter();
  const { user, userId, accounts, addAccount, load, acceptTerms } = useStore();
  // Accounts already exist when the page is reopened after step 1.
  const [step, setStep] = useState<"accounts" | "goals" | "notify">(() => (accounts.length ? "goals" : "accounts"));
  const [agreed, setAgreed] = useState(false);
  const { t: tr } = useTranslation();
  const legacy = useSyncExternalStore(noop, getLegacy, () => null);
  const [skipLegacy, setSkipLegacy] = useState(false);
  const [starters, setStarters] = useState<Starter[]>(() => STARTERS.map(({ nameKey, ...s }) => ({ ...s, name: tr(nameKey) })));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(false);
  const chosen = starters.filter((s) => s.on && s.name.trim());

  const update = (i: number, p: Partial<Starter>) => setStarters((xs) => xs.map((x, j) => (j === i ? { ...x, ...p } : x)));

  const start = () => {
    acceptTerms();
    for (const s of chosen) {
      addAccount({ name: s.name.trim(), kind: s.kind, openingBalance: parseFloat(s.balance) || 0, mono: monoFor(s.name), tone: s.tone, fxFeePct: 0 });
    }
    // The per-account toasts would sit over step 2; one "ready" message comes at the end.
    useStore.getState().dismissToast();
    setStep("goals");
  };

  const runImport = async (sample = false) => {
    if (!userId || (!sample && !legacy)) return;
    acceptTerms();
    setBusy(true);
    setError(false);
    try {
      if (sample) await importData(userId, seedData());
      else await importLegacyData(userId, legacy!);
      await load(userId);
      router.replace("/");
    } catch (e) {
      console.error(e);
      setError(true);
      setBusy(false);
    }
  };

  if (legacy && !skipLegacy) {
    return (
      <main className="flex min-h-dvh flex-col gap-5 px-6 pb-[calc(32px+env(safe-area-inset-bottom))] pt-[calc(40px+env(safe-area-inset-top)+var(--standalone-top,0px))]">
        <Heading name={user?.name} />
        <Card className="flex flex-col gap-2 p-5">
          <h2 className="text-base font-semibold">{tr("onboarding.legacyFound")}</h2>
          <p className="text-sm text-muted">
            {tr("common.accounts", { count: legacy.accounts.length })} · {tr("common.items", { count: legacy.transactions.length })} · {legacy.subscriptions.length} subscriptions
          </p>
          <p className="text-sm text-muted">{tr("onboarding.legacyLead")}</p>
        </Card>
        {error ? (
          <p role="alert" className="text-center text-sm text-danger">
            {tr("onboarding.importFailed")}
          </p>
        ) : null}
        <div className="mt-auto flex flex-col gap-2.5">
          <TermsCheckbox checked={agreed} onChange={setAgreed} />
          <PrimaryButton disabled={busy || !agreed} onClick={() => runImport()}>
            {busy ? tr("onboarding.importing") : tr("onboarding.import")}
          </PrimaryButton>
          <SecondaryButton
            onClick={() => {
              dismissLegacyData();
              setSkipLegacy(true);
            }}
          >
            {tr("onboarding.skip")}
          </SecondaryButton>
        </div>
      </main>
    );
  }

  if (step === "goals") return <GoalsStep name={user?.name} onNext={() => setStep("notify")} />;
  if (step === "notify") return <NotifyStep name={user?.name} accountCount={accounts.length} />;

  return (
    <main className="flex min-h-dvh flex-col gap-5 px-6 pb-[calc(32px+env(safe-area-inset-bottom))] pt-[calc(40px+env(safe-area-inset-top)+var(--standalone-top,0px))]">
      <Heading name={user?.name} step={1} />
      <section className="flex flex-col gap-2">
        <h2 className="text-base font-semibold">{tr("onboarding.pick")}</h2>
        <p className="text-sm text-muted">{tr("onboarding.pickLead")}</p>
      </section>
      <ListCard>
        {starters.map((s, i) => (
          <div key={s.kind} className="flex min-h-[64px] items-center gap-3 py-2">
            <input
              type="checkbox"
              aria-label={tr("onboarding.use", { name: s.name })}
              checked={s.on}
              onChange={(e) => update(i, { on: e.target.checked })}
              className="h-5 w-5 shrink-0 accent-ink"
            />
            <AccountMark account={s} size={34} />
            <div className="flex min-w-0 grow flex-col">
              <input
                aria-label={tr("accounts.name")}
                value={s.name}
                maxLength={60}
                onChange={(e) => update(i, { name: e.target.value })}
                className="w-full min-w-0 bg-transparent text-[15px] font-medium outline-none"
              />
              <label className="flex items-baseline gap-1 text-xs text-muted">
                <span className="shrink-0 whitespace-nowrap">{balanceLabel(s.kind)} ฿</span>
                <BahtInput
                  value={s.balance}
                  placeholder="0"
                  onChange={(e) => update(i, { balance: e.target.value.replace(/[^0-9.]/g, ""), on: true })}
                  className="w-full min-w-0 bg-transparent font-mono text-sm font-semibold text-ink outline-none"
                />
              </label>
            </div>
          </div>
        ))}
      </ListCard>
      {error ? (
        <p role="alert" className="text-center text-sm text-danger">
          {tr("onboarding.sampleFailed")}
        </p>
      ) : null}
      <div className="mt-auto flex flex-col gap-2.5">
        <TermsCheckbox checked={agreed} onChange={setAgreed} />
        <PrimaryButton once disabled={chosen.length === 0 || busy || !agreed} onClick={start}>
          {tr("onboarding.start")}
        </PrimaryButton>
        {process.env.NEXT_PUBLIC_DEV_LOGIN === "true" ? (
          <SecondaryButton onClick={() => agreed && void runImport(true)}>{busy ? tr("onboarding.sampling") : tr("onboarding.sample")}</SecondaryButton>
        ) : null}
      </div>
    </main>
  );
}

/** Step 2: monthly income target and spending budget, which drive the budget banner and alerts. */
function GoalsStep({ name, onNext }: { name?: string; onNext: () => void }) {
  const { t: tr } = useTranslation();
  const goals = useStore((s) => s.goals);
  const setGoals = useStore((s) => s.setGoals);
  const [income, setIncome] = useState(goals.incomeTarget);
  const [expense, setExpense] = useState(goals.expenseBudget);
  const finish = (save: boolean) => {
    if (save) setGoals({ ...goals, incomeTarget: income, expenseBudget: expense });
    // One message for the whole setup comes at the end.
    useStore.getState().dismissToast();
    onNext();
  };
  const left = income - expense;

  return (
    <main className="flex min-h-dvh flex-col gap-5 px-6 pb-[calc(32px+env(safe-area-inset-bottom))] pt-[calc(40px+env(safe-area-inset-top)+var(--standalone-top,0px))]">
      <Heading
        name={name}
        step={2}
        action={
          <button type="button" onClick={() => finish(false)} className="min-h-9 rounded-full px-1 text-sm font-semibold text-muted">
            {tr("onboarding.skipGoals")}
          </button>
        }
      />
      <section className="flex flex-col gap-2">
        <h2 className="text-base font-semibold">{tr("onboarding.goalsTitle")}</h2>
        <p className="text-sm text-muted">{tr("onboarding.goalsLead")}</p>
      </section>
      <div className="grid grid-cols-2 gap-2.5">
        <MoneyField label={tr("goals.incomePerMonth")} icon="in" color="var(--color-income)" value={income} onChange={setIncome} />
        <MoneyField label={tr("goals.expensePerMonth")} icon="out" color="var(--color-expense)" value={expense} onChange={setExpense} />
      </div>
      {income > 0 ? (
        <div className="flex flex-wrap gap-1.5">
          {BUDGET_SHARES.map((pct) => {
            const amount = Math.round((income * pct) / 100 / 100) * 100;
            return (
              <Chip key={pct} size="sm" on={expense === amount} onClick={() => setExpense(amount)}>
                {tr("onboarding.suggest", { pct })} · {baht(amount)}
              </Chip>
            );
          })}
        </div>
      ) : null}
      {income > 0 && expense > 0 ? (
        <div className="flex items-center gap-2.5 rounded-2xl bg-hero px-4 py-3.5 text-[13px] text-on-hero">
          <span className="h-2 w-2 shrink-0 rounded-full bg-lime" />
          <span className="grow">{tr("goals.saving")}</span>
          <span className="font-mono text-[15px] font-semibold text-lime">
            {left < 0 ? "−" : ""}
            {baht(Math.abs(left))} {tr("common.perMonth")}
          </span>
        </div>
      ) : null}
      <div className="mt-auto flex flex-col gap-2.5">
        <PrimaryButton once disabled={!income && !expense} onClick={() => finish(true)}>
          {tr("onboarding.next")}
        </PrimaryButton>
      </div>
    </main>
  );
}

/** Step 3: add the app to the home screen and turn on reminders (both optional). */
function NotifyStep({ name, accountCount }: { name?: string; accountCount: number }) {
  const router = useRouter();
  const { t: tr } = useTranslation();
  const finish = () => {
    useStore.getState().notify(tr("onboarding.ready", { count: accountCount }));
    router.replace("/");
  };
  return (
    <main className="flex min-h-dvh flex-col gap-5 px-6 pb-[calc(32px+env(safe-area-inset-bottom))] pt-[calc(40px+env(safe-area-inset-top)+var(--standalone-top,0px))]">
      <Heading
        name={name}
        step={3}
        action={
          <button type="button" onClick={finish} className="min-h-9 rounded-full px-1 text-sm font-semibold text-muted">
            {tr("onboarding.skipGoals")}
          </button>
        }
      />
      <section className="flex flex-col gap-2">
        <h2 className="text-base font-semibold">{tr("onboarding.notifyTitle")}</h2>
        <p className="text-sm text-muted">{tr("onboarding.notifyLead")}</p>
      </section>
      <InstallPrompt />
      <ListCard>
        <PushToggle />
      </ListCard>
      <div className="mt-auto flex flex-col gap-2.5">
        <PrimaryButton once onClick={finish}>
          {tr("onboarding.finish")}
        </PrimaryButton>
      </div>
    </main>
  );
}

function Heading({ name, step, action }: { name?: string; step?: 1 | 2 | 3; action?: React.ReactNode }) {
  const { t: tr } = useTranslation();
  return (
    <header className="flex flex-col gap-1">
      <div className="flex min-h-9 items-center justify-between gap-3">
        <span className="text-sm text-muted">{tr("onboarding.welcome")}{name ? ` ${name}` : ""}</span>
        {action}
      </div>
      <h1 className="font-serif text-[28px] font-bold leading-tight">{tr("onboarding.title")}</h1>
      {step ? (
        <div className="mt-1 flex items-center gap-2" aria-label={tr("onboarding.step", { n: step })}>
          {[1, 2, 3].map((n) => (
            <span key={n} aria-hidden="true" className={n <= step ? "h-1.5 w-6 rounded-full bg-ink" : "h-1.5 w-6 rounded-full bg-chip"} />
          ))}
          <span className="text-xs text-muted">{tr("onboarding.step", { n: step })}</span>
        </div>
      ) : null}
    </header>
  );
}
