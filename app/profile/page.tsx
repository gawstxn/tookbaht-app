"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { TabScreen } from "@/components/app";
import { Icon } from "@/components/ui/Icon";
import { PushToggle } from "@/components/PushToggle";
import { ListCard, PrimaryButton, SecondaryButton, Sheet, TabHeader, cx } from "@/components/ui/primitives";
import { TYPE_META, categoryLabel } from "@/lib/constants";
import { useStore } from "@/lib/store";

export default function ProfilePage() {
  const router = useRouter();
  const { user, accounts, transactions, signOut, deleteAccount } = useStore();
  const [sheet, setSheet] = useState<"" | "logout" | "delete">("");
  const [busy, setBusy] = useState(false);
  const [confirmed, setConfirmed] = useState(false);

  const exportCsv = () => {
    const name = (id?: string) => accounts.find((a) => a.id === id)?.name ?? "";
    const rows = [
      ["date", "type", "title", "amount", "category", "account", "from", "to", "note"],
      ...[...transactions]
        .sort((a, b) => a.date.localeCompare(b.date))
        .map((t) => [t.date, TYPE_META[t.type].label, t.title, String(t.amount), categoryLabel(t.category), name(t.accountId), name(t.fromId), name(t.toId), t.note ?? ""]),
    ];
    // Prefix cells that spreadsheets would run as formulas (CSV injection).
    const cell = (c: string) => `"${(/^[=+\-@\t\r]/.test(c) ? "'" + c : c).replace(/"/g, '""')}"`;
    const csv = "﻿" + rows.map((r) => r.map(cell).join(",")).join("\n");
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = `tookbaht-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <TabScreen>
      <TabHeader title="โปรไฟล์" />

      <section className="flex flex-col gap-4 rounded-[28px] bg-ink p-[22px] text-on-ink shadow-hero">
        <div className="flex items-center gap-4">
          <span aria-hidden="true" className="flex h-[60px] w-[60px] shrink-0 items-center justify-center rounded-full bg-lime text-2xl font-bold text-ink">
            {(user?.name.trim()[0] ?? "?").toUpperCase()}
          </span>
          <div className="flex min-w-0 flex-col gap-0.5">
            <span className="font-serif text-xl font-bold">{user?.name}</span>
            <span className="truncate text-[13px] text-on-ink-muted">{user?.email}</span>
          </div>
        </div>
        <div className="flex items-center gap-2 border-t border-ink-line pt-3 text-xs text-on-ink-muted">
          <Icon name="check" size={14} strokeWidth={2.2} className="text-lime" />
          เข้าสู่ระบบด้วยบัญชี Google · ชื่อและรูปดึงจาก Google
        </div>
      </section>

      <Group title="การเงิน">
        <NavRow label="บัญชีของฉัน" value={`${accounts.length} บัญชี`} onClick={() => router.push("/accounts")} />
        <NavRow label="สกุลเงิน" value="บาท (THB)" />
        <NavRow label="ส่งออกข้อมูล" value="CSV" icon="download" onClick={exportCsv} />
      </Group>

      <Group title="การแจ้งเตือน">
        <PushToggle />
      </Group>

      <Group title="บัญชี">
        <button type="button" onClick={() => setSheet("logout")} className="flex min-h-[52px] w-full items-center gap-3 text-left text-[15px]">
          <Icon name="logout" size={18} />
          ออกจากระบบ
        </button>
        <button
          type="button"
          onClick={() => {
            setConfirmed(false);
            setSheet("delete");
          }}
          className="flex min-h-[52px] w-full items-center gap-3 text-left text-[15px] text-danger"
        >
          <Icon name="trash" size={18} />
          ลบบัญชี
        </button>
      </Group>

      <p className="text-center font-mono text-[11px] text-faint">
        ทุกบาท v{process.env.NEXT_PUBLIC_APP_VERSION} · {process.env.NEXT_PUBLIC_APP_COMMIT}
      </p>

      <Sheet open={sheet === "logout"} onClose={() => setSheet("")} title="ออกจากระบบ?">
        <p className="text-sm text-muted">ข้อมูลเก็บไว้ในบัญชีของคุณ เข้าสู่ระบบด้วย Google อีกครั้งเมื่อไหร่ก็ได้ ทุกเครื่อง</p>
        <PrimaryButton
          disabled={busy}
          onClick={async () => {
            setBusy(true);
            await signOut();
            router.replace("/login");
          }}
        >
          {busy ? "กำลังออกจากระบบ…" : "ออกจากระบบ"}
        </PrimaryButton>
        <SecondaryButton onClick={() => setSheet("")}>ยกเลิก</SecondaryButton>
      </Sheet>

      <Sheet open={sheet === "delete"} onClose={() => setSheet("")} title="ลบบัญชีถาวร?" titleClassName="text-danger">
        <p className="text-sm text-muted">รายการรายรับ รายจ่าย การโอน subscriptions และเป้าหมายทั้งหมดจะถูกลบ และกู้คืนไม่ได้</p>
        <label className="flex min-h-12 cursor-pointer items-center gap-3 rounded-[14px] border border-line bg-card px-3.5 text-sm">
          <input type="checkbox" checked={confirmed} onChange={(e) => setConfirmed(e.target.checked)} className="h-5 w-5 accent-danger" />
          ฉันเข้าใจว่าลบแล้วกู้คืนไม่ได้
        </label>
        <PrimaryButton
          tone="danger"
          disabled={!confirmed || busy}
          onClick={async () => {
            setBusy(true);
            if (await deleteAccount()) router.replace("/login");
            else setBusy(false);
          }}
        >
          {busy ? "กำลังลบ…" : "ลบบัญชี"}
        </PrimaryButton>
        <SecondaryButton onClick={() => setSheet("")}>ยกเลิก</SecondaryButton>
      </Sheet>
    </TabScreen>
  );
}

function Group({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="flex flex-col gap-2">
      <h2 className="text-base font-semibold">{title}</h2>
      <ListCard>{children}</ListCard>
    </section>
  );
}

function NavRow({ label, value, onClick, icon }: { label: string; value?: string; onClick?: () => void; icon?: "download" }) {
  const Tag = onClick ? "button" : "div";
  return (
    <Tag type={onClick ? "button" : undefined} onClick={onClick} className={cx("flex min-h-[52px] w-full items-center gap-3 text-left")}>
      <span className="grow text-[15px]">{label}</span>
      {value ? <span className="text-[13px] text-muted">{value}</span> : null}
      {onClick ? <Icon name={icon ?? "chevronRight"} size={16} strokeWidth={2} className="text-faint" /> : null}
    </Tag>
  );
}
