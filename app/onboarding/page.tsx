"use client";

import { useRouter } from "next/navigation";
import { useState, useSyncExternalStore } from "react";
import { balanceLabel, monoFor } from "@/components/AccountEditSheet";
import { AccountMark } from "@/components/app";
import { Card, ListCard, PrimaryButton, SecondaryButton } from "@/components/ui/primitives";
import { dismissLegacyData, importData, importLegacyData, readLegacyData } from "@/lib/legacyImport";
import { seedData } from "@/lib/seed";
import { useStore } from "@/lib/store";
import type { AccountKind } from "@/lib/types";

interface Starter {
  name: string;
  kind: AccountKind;
  tone: string;
  on: boolean;
  balance: string;
}

const STARTERS: Starter[] = [
  { name: "บัญชีเงินเดือน", kind: "bank", tone: "#2f5b45", on: true, balance: "" },
  { name: "เงินสด", kind: "cash", tone: "#5f6259", on: true, balance: "" },
  { name: "บัญชีออม", kind: "saving", tone: "#33558f", on: false, balance: "" },
  { name: "บัตรเครดิต", kind: "credit", tone: "#8a2e22", on: false, balance: "" },
];

// localStorage only exists in the browser; read it once after hydration.
const noop = () => () => {};
let legacyCache: ReturnType<typeof readLegacyData> | undefined;
const getLegacy = () => (legacyCache === undefined ? (legacyCache = readLegacyData()) : legacyCache);

/** First run: pick starter accounts, or bring over data from the device-only version. */
export default function OnboardingPage() {
  const router = useRouter();
  const { user, userId, addAccount, load } = useStore();
  const legacy = useSyncExternalStore(noop, getLegacy, () => null);
  const [skipLegacy, setSkipLegacy] = useState(false);
  const [starters, setStarters] = useState(STARTERS);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(false);
  const chosen = starters.filter((s) => s.on && s.name.trim());

  const update = (i: number, p: Partial<Starter>) => setStarters((xs) => xs.map((x, j) => (j === i ? { ...x, ...p } : x)));

  const start = () => {
    for (const s of chosen) {
      addAccount({ name: s.name.trim(), kind: s.kind, openingBalance: parseFloat(s.balance) || 0, mono: monoFor(s.name), tone: s.tone });
    }
    // One message for the whole setup instead of one per account.
    useStore.getState().notify(`เพิ่ม ${chosen.length} บัญชีแล้ว พร้อมใช้งาน`);
    router.replace("/");
  };

  const runImport = async (sample = false) => {
    if (!userId || (!sample && !legacy)) return;
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
          <h2 className="text-base font-semibold">พบข้อมูลเดิมในเครื่องนี้</h2>
          <p className="text-sm text-muted">
            {legacy.accounts.length} บัญชี · {legacy.transactions.length} รายการ · {legacy.subscriptions.length} subscriptions
          </p>
          <p className="text-sm text-muted">นำเข้าขึ้นบัญชีของคุณเพื่อใช้ได้ทุกเครื่อง ข้อมูลเดิมในเครื่องจะถูกเก็บสำรองไว้</p>
        </Card>
        {error ? (
          <p role="alert" className="text-center text-sm text-danger">
            นำเข้าไม่สำเร็จ ลองอีกครั้ง
          </p>
        ) : null}
        <div className="mt-auto flex flex-col gap-2.5">
          <PrimaryButton disabled={busy} onClick={() => runImport()}>
            {busy ? "กำลังนำเข้า…" : "นำเข้าข้อมูลเดิม"}
          </PrimaryButton>
          <SecondaryButton
            onClick={() => {
              dismissLegacyData();
              setSkipLegacy(true);
            }}
          >
            ไม่นำเข้า เริ่มใหม่
          </SecondaryButton>
        </div>
      </main>
    );
  }

  return (
    <main className="flex min-h-dvh flex-col gap-5 px-6 pb-[calc(32px+env(safe-area-inset-bottom))] pt-[calc(40px+env(safe-area-inset-top)+var(--standalone-top,0px))]">
      <Heading name={user?.name} />
      <section className="flex flex-col gap-2">
        <h2 className="text-base font-semibold">เลือกบัญชีที่ใช้อยู่</h2>
        <p className="text-sm text-muted">ใส่ยอดเงินตอนนี้เป็นยอดเริ่มต้น เพิ่มหรือแก้ไขภายหลังได้ที่โปรไฟล์</p>
      </section>
      <ListCard>
        {starters.map((s, i) => (
          <div key={s.kind} className="flex min-h-[64px] items-center gap-3 py-2">
            <input
              type="checkbox"
              aria-label={`ใช้ ${s.name}`}
              checked={s.on}
              onChange={(e) => update(i, { on: e.target.checked })}
              className="h-5 w-5 shrink-0 accent-ink"
            />
            <AccountMark account={s} size={34} />
            <div className="flex min-w-0 grow flex-col">
              <input
                aria-label="ชื่อบัญชี"
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
          ใส่ข้อมูลตัวอย่างไม่สำเร็จ ลองอีกครั้ง
        </p>
      ) : null}
      <div className="mt-auto flex flex-col gap-2.5">
        <PrimaryButton once disabled={chosen.length === 0 || busy} onClick={start}>
          เริ่มใช้งาน
        </PrimaryButton>
        {process.env.NEXT_PUBLIC_DEV_LOGIN === "true" ? (
          <SecondaryButton onClick={() => void runImport(true)}>{busy ? "กำลังใส่ข้อมูล…" : "ลองด้วยข้อมูลตัวอย่าง (โหมดทดสอบ)"}</SecondaryButton>
        ) : null}
      </div>
    </main>
  );
}

function Heading({ name }: { name?: string }) {
  return (
    <header className="flex flex-col gap-1">
      <span className="text-sm text-muted">ยินดีต้อนรับ{name ? ` ${name}` : ""}</span>
      <h1 className="font-serif text-[28px] font-bold leading-tight">ตั้งค่าทุกบาท</h1>
    </header>
  );
}
