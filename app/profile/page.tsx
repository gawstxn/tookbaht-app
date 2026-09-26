"use client";

import { useRouter } from "next/navigation";
import { useMemo, useRef, useState } from "react";
import { TabScreen } from "@/components/app";
import { Icon } from "@/components/ui/Icon";
import { PushToggle } from "@/components/PushToggle";
import { LockSettings } from "@/components/LockSettings";
import { readLock } from "@/lib/appLock";
import { startReauth } from "@/lib/reauth";
import { useTranslation } from "react-i18next";
import { ListCard, PrimaryButton, SecondaryButton, Sheet, SwitchRow, TabHeader, cx } from "@/components/ui/primitives";
import { FeedbackSheet } from "@/components/FeedbackSheet";
import { currentLang, type Lang } from "@/lib/i18n";
import { setThemePref, themePref, type ThemePref } from "@/lib/theme";
import { BackupError, backupFileName, makeBackup, parseBackup, type BackupData } from "@/lib/backup";
import { TYPE_META, categoryLabel } from "@/lib/constants";
import { shortDate } from "@/lib/format";
import { debtsByPerson } from "@/lib/ious";
import { replaceAllData } from "@/lib/legacyImport";
import { useStore } from "@/lib/store";

export default function ProfilePage() {
  const router = useRouter();
  const { user, userId, accounts, transactions, subscriptions, ious, savingsGoals, goals, settings, usdRate, pending, signOut, setLanguage, setSettings, load, notify } = useStore();
  const owedCount = useMemo(() => debtsByPerson(ious).length, [ious]);
  const { t: tr } = useTranslation();
  const [sheet, setSheet] = useState<"" | "logout" | "delete" | "restore" | "lang" | "theme" | "lock" | "currency" | "feedback" | "data" | "account">("");
  // Per-device setting, read after mount (profile only renders once data has loaded).
  const [lock, setLock] = useState(readLock);
  const [restoring, setRestoring] = useState<BackupData | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [confirmed, setConfirmed] = useState(false);
  const [theme, setTheme] = useState<ThemePref>(themePref);
  const langOptions: { value: Lang; label: string }[] = [
    { value: "th", label: tr("lang.th") },
    { value: "en", label: tr("lang.en") },
  ];
  const themeOptions: { value: ThemePref; label: string }[] = [
    { value: "light", label: tr("theme.light") },
    { value: "dark", label: tr("theme.dark") },
    { value: "system", label: tr("theme.system") },
  ];

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
    download(new Blob([csv], { type: "text/csv;charset=utf-8" }), `tookbaht-${new Date().toISOString().slice(0, 10)}.csv`);
  };

  const exportBackup = () => {
    const file = makeBackup({ accounts, transactions, subscriptions, ious, savingsGoals, goals, settings });
    download(new Blob([JSON.stringify(file, null, 1)], { type: "application/json" }), backupFileName());
  };

  const pickBackup = async (file: File | undefined) => {
    if (!file) return;
    try {
      setRestoring(parseBackup(await file.text()));
      setConfirmed(false);
      setSheet("restore");
    } catch (e) {
      const problem = e instanceof BackupError ? e.problem : "json";
      notify(tr(`profile.file${problem[0].toUpperCase()}${problem.slice(1)}`), { tone: "error" });
    }
  };

  const restore = async () => {
    if (!userId || !restoring) return;
    setBusy(true);
    try {
      // Keep this device's consent record; the backup may predate the current terms.
      const keep = { termsAcceptedVersion: settings.termsAcceptedVersion, termsAcceptedAt: settings.termsAcceptedAt };
      await replaceAllData(
        userId,
        { ...restoring, settings: restoring.settings ? { ...restoring.settings, ...keep } : undefined },
        {
          accounts: accounts.map((a) => a.id),
          transactions: transactions.map((t) => t.id),
          subscriptions: subscriptions.map((s) => s.id),
          ious: ious.map((i) => i.id),
          savingsGoals: savingsGoals.map((g) => g.id),
        },
      );
      await load(userId);
      notify(tr("profile.restored"));
    } catch (e) {
      console.error(e);
      await load(userId);
      notify(tr("profile.restoreFailed"), { tone: "error" });
    }
    setBusy(false);
    setSheet("");
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
          {user?.provider === "google" ? tr("profile.googleNote") : tr("profile.emailNote")}
        </div>
      </section>

      <Group title={tr("profile.finance")}>
        <NavRow label={tr("profile.myAccounts")} value={tr("common.accounts", { count: accounts.length })} onClick={() => router.push("/accounts")} />
        <NavRow label={tr("profile.currency")} value={tr("profile.currencyValue")} onClick={() => setSheet("currency")} />
        <NavRow label={tr("ious.title")} value={owedCount ? tr("ious.people", { count: owedCount }) : undefined} onClick={() => router.push("/ious")} />
        <NavRow label={tr("savings.title")} value={savingsGoals.length ? String(savingsGoals.length) : undefined} onClick={() => router.push("/goals")} />
        <NavRow label={tr("profile.myData")} value={tr("profile.myDataValue")} onClick={() => setSheet("data")} />
      </Group>
      <input
        ref={fileInput}
        type="file"
        accept="application/json,.json"
        hidden
        onChange={(e) => {
          void pickBackup(e.target.files?.[0]);
          e.target.value = "";
        }}
      />

      <Group title={tr("profile.display")}>
        <NavRow label={tr("lang.title")} value={langOptions.find((o) => o.value === currentLang())?.label} onClick={() => setSheet("lang")} />
        <NavRow label={tr("theme.title")} value={themeOptions.find((o) => o.value === theme)?.label} onClick={() => setSheet("theme")} />
        <SwitchRow
          label={tr("profile.keypadMath")}
          hint={tr("profile.keypadMathHint")}
          checked={settings.keypadMath !== false}
          onChange={(on) => {
            setSettings({ keypadMath: on });
            notify(on ? tr("profile.keypadMathOn") : tr("profile.keypadMathOff"));
          }}
        />
      </Group>

      <Group title={tr("lock.group")}>
        <NavRow
          label={tr("lock.row")}
          value={!lock ? tr("lock.off") : lock.credentialId ? tr("lock.onBiometric") : tr("lock.onPin")}
          onClick={() => setSheet("lock")}
        />
      </Group>

      <Group title={tr("profile.notifications")}>
        <PushToggle />
        <SwitchRow
          label={tr("summary.label")}
          hint={tr("summary.hint")}
          checked={settings.monthlySummary !== false}
          onChange={(on) => {
            setSettings({ monthlySummary: on });
            notify(on ? tr("summary.on") : tr("summary.off"));
          }}
        />
        <SwitchRow
          label={tr("reminder.label")}
          hint={tr("reminder.hint")}
          checked={settings.dailyReminder === true}
          onChange={(on) => {
            setSettings({ dailyReminder: on });
            notify(on ? tr("reminder.on") : tr("reminder.off"));
          }}
        />
      </Group>

      <Group title={tr("profile.about")}>
        <NavRow label={tr("login.terms")} onClick={() => router.push("/terms")} />
        <NavRow label={tr("login.privacy")} onClick={() => router.push("/privacy")} />
        <NavRow label={tr("feedback.row")} onClick={() => setSheet("feedback")} />
      </Group>

      <Group title={tr("profile.account")}>
        <NavRow label={tr("profile.manageAccount")} onClick={() => setSheet("account")} />
        <button type="button" onClick={() => setSheet("logout")} className="flex min-h-[52px] w-full items-center gap-3 text-left text-[15px]">
          <Icon name="logout" size={18} />
          {tr("profile.logout")}
        </button>
      </Group>

      <p className="text-center font-mono text-[11px] text-faint">
        Tookbaht v{process.env.NEXT_PUBLIC_APP_VERSION} · {process.env.NEXT_PUBLIC_APP_COMMIT}
      </p>

      <Sheet open={sheet === "logout"} onClose={() => setSheet("")} title={tr("profile.logoutTitle")}>
        <p className="text-sm text-muted">{tr("profile.logoutLead")}</p>
        {pending > 0 ? <p className="text-sm font-semibold text-danger">{tr("offline.logoutPending", { count: pending })}</p> : null}
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

      <ChoiceSheet
        open={sheet === "lang"}
        onClose={() => setSheet("")}
        title={tr("lang.title")}
        options={langOptions}
        value={currentLang()}
        onPick={(v) => {
          setSheet("");
          setLanguage(v);
        }}
      />
      <ChoiceSheet
        open={sheet === "theme"}
        onClose={() => setSheet("")}
        title={tr("theme.title")}
        options={themeOptions}
        value={theme}
        onPick={(v) => {
          setSheet("");
          setTheme(v);
          setThemePref(v);
        }}
      />

      <Sheet open={sheet === "currency"} onClose={() => setSheet("")} title={tr("profile.currency")}>
        <p className="text-sm text-muted">{tr("profile.currencyLead")}</p>
        <ListCard>
          <div className="flex min-h-[52px] items-center justify-between gap-3">
            <span className="text-[15px]">{tr("profile.currencyMain")}</span>
            <span className="text-[13px] font-semibold">{tr("profile.currencyValue")}</span>
          </div>
          <div className="flex min-h-[52px] items-center justify-between gap-3">
            <span className="flex flex-col">
              <span className="text-[15px]">{tr("profile.usdRate")}</span>
              {usdRate ? <span className="text-xs text-muted">{tr("profile.usdRateAsOf", { date: shortDate(usdRate.date) })}</span> : null}
            </span>
            <span className="font-mono text-[13px] font-semibold">{usdRate ? `฿${usdRate.rate.toFixed(2)}` : "—"}</span>
          </div>
        </ListCard>
        <PrimaryButton onClick={() => setSheet("")}>{tr("common.gotIt")}</PrimaryButton>
      </Sheet>

      <Sheet open={sheet === "data"} onClose={() => setSheet("")} title={tr("profile.myData")}>
        <ListCard>
          <SheetRow icon="download" label={tr("profile.export")} hint={tr("profile.exportHint")} onClick={exportCsv} />
          <SheetRow icon="download" label={tr("profile.backup")} hint={tr("profile.backupHint")} onClick={exportBackup} />
          <SheetRow
            icon="upload"
            label={tr("profile.restore")}
            hint={tr("profile.restoreHint")}
            onClick={() => {
              setSheet("");
              fileInput.current?.click();
            }}
          />
        </ListCard>
      </Sheet>

      <Sheet open={sheet === "account"} onClose={() => setSheet("")} title={tr("profile.manageAccount")}>
        <ListCard>
          <div className="flex min-h-[52px] items-center justify-between gap-3">
            <span className="text-[15px]">{tr("profile.signedInAs")}</span>
            <span className="truncate text-[13px] text-muted">{user?.email}</span>
          </div>
          <div className="flex min-h-[52px] items-center justify-between gap-3">
            <span className="text-[15px]">{tr("profile.signInWith")}</span>
            <span className="text-[13px] text-muted">{user?.provider === "google" ? "Google" : tr("profile.emailProvider")}</span>
          </div>
        </ListCard>
        <p className="text-xs leading-relaxed text-muted">{tr("profile.deleteIntro")}</p>
        <SecondaryButton
          tone="danger"
          onClick={() => {
            setConfirmed(false);
            setSheet("delete");
          }}
        >
          {tr("profile.delete")}
        </SecondaryButton>
      </Sheet>

      <FeedbackSheet open={sheet === "feedback"} onClose={() => setSheet("")} />

      <LockSettings open={sheet === "lock"} onClose={() => setSheet("")} onChange={setLock} />

      <Sheet open={sheet === "restore"} onClose={() => !busy && setSheet("")} title={tr("profile.restoreTitle")}>
        {restoring ? (
          <p className="text-sm text-muted">
            {tr("profile.restoreLead", { accounts: restoring.accounts.length, transactions: restoring.transactions.length, subs: restoring.subscriptions.length })}
          </p>
        ) : null}
        <p className="text-sm font-semibold text-danger">{tr("profile.restoreWarn")}</p>
        <label className="flex min-h-12 cursor-pointer items-center gap-3 rounded-[14px] border border-line bg-card px-3.5 text-sm">
          <input type="checkbox" checked={confirmed} onChange={(e) => setConfirmed(e.target.checked)} className="h-5 w-5 accent-ink" />
          {tr("profile.restoreConfirm")}
        </label>
        <PrimaryButton disabled={!confirmed || busy} onClick={restore}>
          {busy ? tr("profile.restoring") : tr("profile.restore")}
        </PrimaryButton>
        <SecondaryButton onClick={() => !busy && setSheet("")}>{tr("common.cancel")}</SecondaryButton>
      </Sheet>

      <Sheet open={sheet === "delete"} onClose={() => setSheet("")} title={tr("profile.deleteTitle")} titleClassName="text-danger">
        <p className="text-sm text-muted">{tr("profile.deleteLead")}</p>
        <SecondaryButton onClick={exportBackup}>{tr("profile.deleteBackup")}</SecondaryButton>
        <label className="flex min-h-12 cursor-pointer items-center gap-3 rounded-[14px] border border-line bg-card px-3.5 text-sm">
          <input type="checkbox" checked={confirmed} onChange={(e) => setConfirmed(e.target.checked)} className="h-5 w-5 accent-danger" />
          {tr("profile.deleteConfirm")}
        </label>
        <PrimaryButton
          tone="danger"
          disabled={!confirmed || busy}
          onClick={async () => {
            // Google asks again; AppShell finishes the deletion when we come back.
            setBusy(true);
            if (!(await startReauth("delete"))) {
              setBusy(false);
              notify(tr("reauth.failed"), { tone: "error" });
            }
          }}
        >
          {busy ? tr("profile.deleting") : tr("profile.deleteGo")}
        </PrimaryButton>
        <SecondaryButton onClick={() => setSheet("")}>{tr("common.cancel")}</SecondaryButton>
      </Sheet>
    </TabScreen>
  );
}

/** Bottom drawer with one choice per row; picking closes it. */
function ChoiceSheet<T extends string>({ open, onClose, title, options, value, onPick }: { open: boolean; onClose: () => void; title: string; options: { value: T; label: string }[]; value: T; onPick: (v: T) => void }) {
  return (
    <Sheet open={open} onClose={onClose} title={title}>
      <ListCard>
        <div role="radiogroup" aria-label={title} className="flex flex-col [&>*:not(:last-child)]:border-b [&>*:not(:last-child)]:border-divider">
          {options.map((o) => (
            <button key={o.value} type="button" role="radio" aria-checked={o.value === value} onClick={() => onPick(o.value)} className="flex min-h-[52px] w-full items-center gap-3 text-left">
              <span className="grow text-[15px]">{o.label}</span>
              {o.value === value ? <Icon name="check" size={18} strokeWidth={2.4} className="text-income" /> : null}
            </button>
          ))}
        </div>
      </ListCard>
    </Sheet>
  );
}

/** Save a file from the browser (the share sheet on iOS). */
function download(blob: Blob, name: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  URL.revokeObjectURL(url);
}

function Group({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="flex flex-col gap-2">
      <h2 className="text-base font-semibold">{title}</h2>
      <ListCard>{children}</ListCard>
    </section>
  );
}

function SheetRow({ icon, label, hint, onClick }: { icon: "download" | "upload"; label: string; hint: string; onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} className="flex min-h-[60px] w-full items-center gap-3 py-2 text-left">
      <span aria-hidden="true" className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-chip">
        <Icon name={icon} size={18} strokeWidth={2} />
      </span>
      <span className="flex min-w-0 grow flex-col">
        <span className="text-[15px] font-medium">{label}</span>
        <span className="text-xs text-muted">{hint}</span>
      </span>
    </button>
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
