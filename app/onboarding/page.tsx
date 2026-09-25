"use client";

import { useRouter } from "next/navigation";
import { useState, useSyncExternalStore } from "react";
import { balanceLabel, monoFor } from "@/components/AccountEditSheet";
import { AccountMark } from "@/components/app";
import { TermsCheckbox } from "@/components/TermsConsent";
import { Card, ListCard, PrimaryButton, SecondaryButton } from "@/components/ui/primitives";
import { dismissLegacyData, importData, importLegacyData, readLegacyData } from "@/lib/legacyImport";
import { seedData } from "@/lib/seed";
import { useTranslation } from "react-i18next";
import { useStore } from "@/lib/store";
import type { AccountKind } from "@/lib/types";

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

/** First run: pick starter accounts, or bring over data from the device-only version. */
export default function OnboardingPage() {
  const router = useRouter();
  const { user, userId, addAccount, load, acceptTerms } = useStore();
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
      addAccount({ name: s.name.trim(), kind: s.kind, openingBalance: parseFloat(s.balance) || 0, mono: monoFor(s.name), tone: s.tone });
    }
    // One message for the whole setup instead of one per account.
    useStore.getState().notify(tr("onboarding.ready", { count: chosen.length }));
    router.replace("/");
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

  return (
    <main className="flex min-h-dvh flex-col gap-5 px-6 pb-[calc(32px+env(safe-area-inset-bottom))] pt-[calc(40px+env(safe-area-inset-top)+var(--standalone-top,0px))]">
      <Heading name={user?.name} />
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
                <input
                  inputMode="decimal"
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

function Heading({ name }: { name?: string }) {
  const { t: tr } = useTranslation();
  return (
    <header className="flex flex-col gap-1">
      <span className="text-sm text-muted">{tr("onboarding.welcome")}{name ? ` ${name}` : ""}</span>
      <h1 className="font-serif text-[28px] font-bold leading-tight">{tr("onboarding.title")}</h1>
    </header>
  );
}
