"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { TabScreen } from "@/components/app";
import { Icon } from "@/components/ui/Icon";
import { PushToggle } from "@/components/PushToggle";
import { useTranslation } from "react-i18next";
import { ListCard, PrimaryButton, SecondaryButton, Segmented, Sheet, TabHeader, cx } from "@/components/ui/primitives";
import { currentLang, type Lang } from "@/lib/i18n";
import { setThemePref, themePref, type ThemePref } from "@/lib/theme";
import { TYPE_META, categoryLabel } from "@/lib/constants";
import { useStore } from "@/lib/store";

export default function ProfilePage() {
  const router = useRouter();
  const { user, accounts, transactions, signOut, deleteAccount, setLanguage } = useStore();
  const { t: tr } = useTranslation();
  const [sheet, setSheet] = useState<"" | "logout" | "delete">("");
  const [busy, setBusy] = useState(false);
  const [confirmed, setConfirmed] = useState(false);
  const [theme, setTheme] = useState<ThemePref>(themePref);

  const exportCsv = () => {
    const name = (id?: string) => accounts.find((a) => a.id === id)?.name ?? "";
    const rows = [
      ["date", "type", "title", "amount", "category", "account", "from", "to", "note", "original_amount", "original_currency", "fx_rate"],
      ...[...transactions]
        .sort((a, b) => a.date.localeCompare(b.date))
        .map((t) => [t.date, TYPE_META[t.type].label, t.title, String(t.amount), categoryLabel(t.category), name(t.accountId), name(t.fromId), name(t.toId), t.note ?? "", t.origAmount ? String(t.origAmount) : "", t.origCurrency ?? "", t.fxRate ? String(t.fxRate) : ""]),
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
      <TabHeader title={tr("profile.title")} />

      <section className="flex flex-col gap-4 rounded-[28px] bg-hero p-[22px] text-on-hero shadow-hero">
        <div className="flex items-center gap-4">
          <span aria-hidden="true" className="flex h-[60px] w-[60px] shrink-0 items-center justify-center rounded-full bg-lime text-2xl font-bold text-on-lime">
            {(user?.name.trim()[0] ?? "?").toUpperCase()}
          </span>
          <div className="flex min-w-0 flex-col gap-0.5">
            <span className="font-serif text-xl font-bold">{user?.name}</span>
            <span className="truncate text-[13px] text-on-ink-muted">{user?.email}</span>
          </div>
        </div>
        <div className="flex items-center gap-2 border-t border-ink-line pt-3 text-xs text-on-ink-muted">
          <Icon name="check" size={14} strokeWidth={2.2} className="text-lime" />
          {tr("profile.googleNote")}
        </div>
      </section>

      <Group title={tr("profile.finance")}>
        <NavRow label={tr("profile.myAccounts")} value={tr("common.accounts", { count: accounts.length })} onClick={() => router.push("/accounts")} />
        <NavRow label={tr("profile.currency")} value={tr("profile.currencyValue")} />
        <NavRow label={tr("profile.export")} value="CSV" icon="download" onClick={exportCsv} />
      </Group>

      <Group title={tr("lang.title")}>
        <div className="py-3">
          <Segmented<Lang>
            label={tr("lang.title")}
            value={currentLang()}
            onChange={setLanguage}
            options={[
              { value: "th", label: tr("lang.th") },
              { value: "en", label: tr("lang.en") },
            ]}
          />
        </div>
      </Group>

      <Group title={tr("theme.title")}>
        <div className="py-3">
          <Segmented<ThemePref>
            label={tr("theme.title")}
            value={theme}
            onChange={(v) => {
              setTheme(v);
              setThemePref(v);
            }}
            options={[
              { value: "light", label: tr("theme.light") },
              { value: "dark", label: tr("theme.dark") },
              { value: "system", label: tr("theme.system") },
            ]}
          />
        </div>
      </Group>

      <Group title={tr("profile.notifications")}>
        <PushToggle />
      </Group>

      <Group title={tr("profile.about")}>
        <NavRow label={tr("login.terms")} onClick={() => router.push("/terms")} />
        <NavRow label={tr("login.privacy")} onClick={() => router.push("/privacy")} />
      </Group>

      <Group title={tr("profile.account")}>
        <button type="button" onClick={() => setSheet("logout")} className="flex min-h-[52px] w-full items-center gap-3 text-left text-[15px]">
          <Icon name="logout" size={18} />
          {tr("profile.logout")}
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
          {tr("profile.delete")}
        </button>
      </Group>

      <p className="text-center font-mono text-[11px] text-faint">
        Tookbaht v{process.env.NEXT_PUBLIC_APP_VERSION} · {process.env.NEXT_PUBLIC_APP_COMMIT}
      </p>

      <Sheet open={sheet === "logout"} onClose={() => setSheet("")} title={tr("profile.logoutTitle")}>
        <p className="text-sm text-muted">{tr("profile.logoutLead")}</p>
        <PrimaryButton
          disabled={busy}
          onClick={async () => {
            setBusy(true);
            await signOut();
            router.replace("/login");
          }}
        >
          {busy ? tr("profile.loggingOut") : tr("profile.logout")}
        </PrimaryButton>
        <SecondaryButton onClick={() => setSheet("")}>{tr("common.cancel")}</SecondaryButton>
      </Sheet>

      <Sheet open={sheet === "delete"} onClose={() => setSheet("")} title={tr("profile.deleteTitle")} titleClassName="text-danger">
        <p className="text-sm text-muted">{tr("profile.deleteLead")}</p>
        <label className="flex min-h-12 cursor-pointer items-center gap-3 rounded-[14px] border border-line bg-card px-3.5 text-sm">
          <input type="checkbox" checked={confirmed} onChange={(e) => setConfirmed(e.target.checked)} className="h-5 w-5 accent-danger" />
          {tr("profile.deleteConfirm")}
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
          {busy ? tr("profile.deleting") : tr("profile.delete")}
        </PrimaryButton>
        <SecondaryButton onClick={() => setSheet("")}>{tr("common.cancel")}</SecondaryButton>
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
