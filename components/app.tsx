"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useTranslation } from "react-i18next";
import { useStore } from "@/lib/store";
import { ACCOUNT_KIND_ICON, TYPE_META, categoryIcon, categoryLabel } from "@/lib/constants";
import { findBrand, onColor, type Brand } from "@/lib/brands";
import { baht2, relativeDue } from "@/lib/format";
import { txTitle } from "@/lib/txTitle";
import type { Account, Subscription, Transaction } from "@/lib/types";
import { Icon, type IconName } from "./ui/Icon";
import { Monogram, cx } from "./ui/primitives";

const TABS: { href: string; label: "home" | "transactions" | "monthly" | "profile"; icon: IconName }[] = [
  { href: "/", label: "home", icon: "home" },
  { href: "/transactions", label: "transactions", icon: "list" },
  { href: "/subscriptions", label: "monthly", icon: "repeat" },
  { href: "/profile", label: "profile", icon: "user" },
];

export function BottomNav() {
  const path = usePathname();
  const { t: tr } = useTranslation();
  const tab = (t: (typeof TABS)[number]) => {
    const on = t.href === "/" ? path === "/" : path.startsWith(t.href);
    return (
      <Link
        key={t.href}
        href={t.href}
        aria-current={on ? "page" : undefined}
        className={cx("flex min-h-12 flex-col items-center justify-center gap-0.5 text-[11px]", on ? "font-semibold text-ink" : "text-muted")}
      >
        <Icon name={t.icon} size={22} strokeWidth={on ? 2 : 1.8} />
        {tr(`nav.${t.label}`)}
      </Link>
    );
  };
  return (
    <nav
      aria-label={tr("nav.menu")}
      className="fixed inset-x-0 bottom-0 z-40 mx-auto grid max-w-[430px] grid-cols-5 items-center border-t border-line bg-card px-2 pb-[max(6px,calc(env(safe-area-inset-bottom)-8px))] pt-1"
    >
      {tab(TABS[0])}
      {tab(TABS[1])}
      <Link
        href="/add"
        aria-label={tr("nav.add")}
        className="-mt-[18px] flex h-14 w-14 items-center justify-center justify-self-center rounded-full bg-lime text-on-lime shadow-fab"
      >
        <Icon name="plus" size={26} strokeWidth={2.4} />
      </Link>
      {tab(TABS[2])}
      {tab(TABS[3])}
    </nav>
  );
}

/** Tab-screen scaffold: content + bottom nav. */
export function TabScreen({ children }: { children: React.ReactNode }) {
  return (
    <>
      <main className="flex flex-col gap-4 px-6 pb-[calc(100px+env(safe-area-inset-bottom))] pt-[calc(20px+env(safe-area-inset-top)+var(--standalone-top,0px))]">{children}</main>
      <BottomNav />
    </>
  );
}

/** Pushed-screen scaffold: fills the viewport so the primary action sits at the bottom. */
export function PushScreen({ children, className }: { children: React.ReactNode; className?: string }) {
  return <main className={cx("flex min-h-dvh flex-col gap-4 px-6 pb-[calc(24px+env(safe-area-inset-bottom))] pt-[calc(12px+env(safe-area-inset-top)+var(--standalone-top,0px))]", className)}>{children}</main>;
}

/** Round icon for a transaction: its category's icon in the income/expense colours (arrows for transfers). */
export function TxIcon({ type, category, size = 38 }: { type: Transaction["type"]; category?: string; size?: number }) {
  const meta = TYPE_META[type];
  return (
    <span
      aria-hidden="true"
      className="flex shrink-0 items-center justify-center rounded-full"
      style={{ width: size, height: size, background: meta.tint, color: meta.color }}
    >
      <Icon name={type === "move" || !category ? type : categoryIcon(category)} size={size * 0.46} strokeWidth={2} />
    </span>
  );
}

/** Account tile: the account's colour with an icon for its kind (bank, savings, card, cash). */
export function AccountMark({ account, size = 40 }: { account: Pick<Account, "kind" | "tone">; size?: number }) {
  return (
    <span
      aria-hidden="true"
      className="flex shrink-0 items-center justify-center text-white"
      style={{ width: size, height: size, borderRadius: size * 0.3, background: account.tone }}
    >
      <Icon name={ACCOUNT_KIND_ICON[account.kind]} size={size * 0.5} strokeWidth={2} />
    </span>
  );
}

export function TxRow({ t, onClick }: { t: Transaction; onClick?: () => void }) {
  const accounts = useStore((s) => s.accounts);
  const name = (id?: string) => accounts.find((a) => a.id === id)?.name ?? "";
  const meta = TYPE_META[t.type];
  const sub =
    t.type === "move"
      ? `${name(t.fromId)} → ${name(t.toId)}`
      : [categoryLabel(t.category), name(t.accountId)].filter(Boolean).join(" · ");
  const Tag = onClick ? "button" : "div";
  return (
    <Tag type={onClick ? "button" : undefined} onClick={onClick} className="flex min-h-[60px] w-full items-center gap-3 text-left">
      <TxIcon type={t.type} category={t.category} />
      <div className="flex min-w-0 grow flex-col">
        <span className="truncate text-[15px] font-medium">{txTitle(t, accounts)}</span>
        <span className="truncate text-xs text-muted">{sub}</span>
      </div>
      <span className="whitespace-nowrap font-mono text-[15px] font-semibold" style={{ color: meta.color }}>
        {meta.sign}
        {baht2(t.amount)}
      </span>
    </Tag>
  );
}

export function DuePill({ days }: { days: number }) {
  return (
    <span className={cx("whitespace-nowrap rounded-full px-2 py-px text-[11px] font-semibold", days <= 7 ? "bg-lime text-on-lime" : "bg-chip")}>{relativeDue(days)}</span>
  );
}

/** Subscription icon: the service's logo when we know it, else a monogram. */
export function SubMono({ s, size = 40 }: { s: Pick<Subscription, "name" | "tone">; size?: number }) {
  const brand = findBrand(s.name);
  if (!brand) return <Monogram text={(s.name.trim()[0] ?? "?").toUpperCase()} tone={s.tone} size={size} />;
  return <BrandMark brand={brand} size={size} />;
}

export function BrandMark({ brand, size = 40 }: { brand: Brand; size?: number }) {
  const fg = onColor(brand.color);
  return (
    <span
      aria-hidden="true"
      className="flex shrink-0 items-center justify-center font-bold"
      style={{ width: size, height: size, borderRadius: size * 0.3, background: brand.color, color: fg }}
    >
      {brand.path ? (
        <svg viewBox="0 0 24 24" width={size * 0.56} height={size * 0.56} fill="currentColor">
          <path d={brand.path} />
        </svg>
      ) : (
        <span style={{ fontSize: size * (brand.label!.length > 2 ? 0.3 : 0.4), letterSpacing: "-0.02em" }}>{brand.label}</span>
      )}
    </span>
  );
}
