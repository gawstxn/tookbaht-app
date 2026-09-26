"use client";

import Link from "next/link";
import { useEffect, useId, useRef, useState, type ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { Icon, type IconName } from "./Icon";

export function cx(...c: (string | false | null | undefined)[]) {
  return c.filter(Boolean).join(" ");
}

/* ---------- surfaces ---------- */

export function Card({ className, children }: { className?: string; children: ReactNode }) {
  return <div className={cx("rounded-[20px] border border-line bg-card", className)}>{children}</div>;
}

/** The dark signature card used at the top of every tab screen. */
export function HeroCard({ className, children, label }: { className?: string; children: ReactNode; label?: string }) {
  return (
    <section
      aria-label={label}
      className={cx("flex flex-col gap-4 rounded-[28px] bg-hero p-[22px] text-on-hero shadow-hero", className)}
    >
      {children}
    </section>
  );
}

/** Divided list inside a card. Children should be rows. */
export function ListCard({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <Card className={cx("flex flex-col px-4 py-0.5 [&>*:not(:last-child)]:border-b [&>*:not(:last-child)]:border-divider", className)}>
      {children}
    </Card>
  );
}

/* ---------- headers ---------- */

export function IconButton({
  icon,
  label,
  onClick,
  href,
  variant = "light",
}: {
  icon: IconName;
  label: string;
  onClick?: () => void;
  href?: string;
  variant?: "light" | "dark";
}) {
  const cls = cx(
    "flex h-11 w-11 shrink-0 items-center justify-center rounded-full",
    variant === "dark" ? "bg-ink text-on-ink" : "border border-line bg-card",
  );
  const inner = <Icon name={icon} size={20} strokeWidth={variant === "dark" ? 2.2 : 2} />;
  if (href)
    return (
      <Link href={href} aria-label={label} className={cls}>
        {inner}
      </Link>
    );
  return (
    <button type="button" aria-label={label} onClick={onClick} className={cls}>
      {inner}
    </button>
  );
}

/** Header for pushed screens: back/close, centred title, optional action. */
export function PushHeader({
  title,
  backHref,
  backIcon = "back",
  onBack,
  action,
}: {
  title?: string;
  backHref?: string;
  backIcon?: IconName;
  onBack?: () => void;
  action?: ReactNode;
}) {
  const { t } = useTranslation();
  return (
    <header className="flex min-h-12 items-center justify-between">
      <IconButton icon={backIcon} label={t(backIcon === "close" ? "common.close" : "common.back")} href={backHref} onClick={onBack} />
      {title ? <h1 className="font-serif text-xl font-bold">{title}</h1> : <span />}
      {action ?? <span className="h-11 w-11" />}
    </header>
  );
}

/** Header for tab screens: serif title with a subtitle/month switcher, actions on the right. */
export function TabHeader({ title, subtitle, actions }: { title: string; subtitle?: ReactNode; actions?: ReactNode }) {
  return (
    <header className="flex min-h-12 items-center justify-between">
      <div className="flex flex-col">
        <h1 className="font-serif text-[26px] font-bold leading-tight">{title}</h1>
        {subtitle ? <div className="text-[13px] text-muted">{subtitle}</div> : null}
      </div>
      {actions ? <div className="flex items-center gap-2">{actions}</div> : null}
    </header>
  );
}

export function SectionHeader({ title, href, linkLabel, aside }: { title: string; href?: string; linkLabel?: string; aside?: ReactNode }) {
  const { t } = useTranslation();
  linkLabel ??= t("common.seeAll");
  return (
    <div className="flex items-center justify-between">
      <h2 className="text-base font-semibold">{title}</h2>
      {href ? (
        <Link href={href} className="py-2 text-[13px] font-medium text-muted">
          {linkLabel}
        </Link>
      ) : (
        aside
      )}
    </div>
  );
}

/* ---------- controls ---------- */

export function Switch({ checked, onChange, label }: { checked: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      onClick={() => onChange(!checked)}
      className={cx(
        "flex h-8 w-[52px] shrink-0 rounded-full p-[3px] transition-colors",
        checked ? "justify-end bg-income" : "justify-start bg-switch-off",
      )}
    >
      <span className="h-[26px] w-[26px] rounded-full bg-white shadow-[0_1px_2px_rgba(0,0,0,0.25)]" />
    </button>
  );
}

export function SwitchRow({ label, hint, checked, onChange }: { label: string; hint?: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <div className="flex min-h-14 items-center justify-between gap-3">
      <div className="flex flex-col">
        <span className="text-[15px]">{label}</span>
        {hint ? <span className="text-xs text-muted">{hint}</span> : null}
      </div>
      <Switch checked={checked} onChange={onChange} label={label} />
    </div>
  );
}

export function Segmented<T extends string>({
  options,
  value,
  onChange,
  label,
  colorFor,
  size = "md",
}: {
  options: { value: T; label: string }[];
  value: T;
  onChange: (v: T) => void;
  label: string;
  colorFor?: (v: T) => string;
  size?: "sm" | "md";
}) {
  return (
    <div
      role="radiogroup"
      aria-label={label}
      className={cx("grid gap-1 p-1", size === "md" ? "rounded-[14px] bg-chip" : "rounded-xl bg-divider")}
      style={{ gridTemplateColumns: `repeat(${options.length}, minmax(0, 1fr))` }}
    >
      {options.map((o) => {
        const on = o.value === value;
        return (
          <button
            key={o.value}
            type="button"
            role="radio"
            aria-checked={on}
            onClick={() => onChange(o.value)}
            className={cx(
              "font-semibold",
              size === "md" ? "min-h-10 rounded-[10px] text-sm" : "min-h-9 rounded-[9px] text-[13px]",
              on ? "bg-card dark:bg-ink-3" : "text-muted",
            )}
            style={on && colorFor ? { color: colorFor(o.value) } : undefined}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

export function Chip({ on, onClick, children, size = "md" }: { on: boolean; onClick: () => void; children: ReactNode; size?: "sm" | "md" }) {
  return (
    <button
      type="button"
      aria-pressed={on}
      onClick={onClick}
      className={cx(
        "rounded-full border font-medium",
        size === "md" ? "min-h-9 px-3.5 text-[13px]" : "min-h-[34px] px-3 text-[13px]",
        on ? "border-ink bg-ink text-on-ink" : "border-line bg-card",
      )}
    >
      {children}
    </button>
  );
}

export function PrimaryButton({
  children,
  onClick,
  disabled,
  type = "button",
  tone = "ink",
  once,
}: {
  children: ReactNode;
  onClick?: () => void;
  disabled?: boolean;
  type?: "button" | "submit";
  tone?: "ink" | "danger";
  /** Ignore taps after the first (for save buttons that leave the screen). */
  once?: boolean;
}) {
  const [used, setUsed] = useState(false);
  disabled = disabled || (once && used);
  return (
    <button
      type={type}
      onClick={() => {
        if (once) {
          if (used) return;
          setUsed(true);
        }
        onClick?.();
      }}
      disabled={disabled}
      className={cx(
        "min-h-[54px] w-full rounded-2xl text-base font-semibold",
        disabled ? "bg-chip text-muted" : tone === "danger" ? "bg-danger text-white" : "bg-ink text-on-ink",
      )}
    >
      {children}
    </button>
  );
}

export function SecondaryButton({ children, onClick, tone }: { children: ReactNode; onClick?: () => void; tone?: "danger" }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cx(
        "min-h-[52px] w-full rounded-2xl border text-[15px] font-semibold",
        tone === "danger" ? "border-expense-line bg-expense-tint text-danger" : "border-line bg-card",
      )}
    >
      {children}
    </button>
  );
}

/** A tappable settings/field row that opens a picker. */
export function PickerRow({ label, value, onClick }: { label: string; value: ReactNode; onClick: () => void }) {
  return (
    <button type="button" aria-haspopup="dialog" onClick={onClick} className="flex min-h-[50px] w-full items-center gap-3 text-left">
      <span className="grow text-sm text-muted">{label}</span>
      <span className="text-sm font-semibold">{value}</span>
      <Icon name="chevronRight" size={16} strokeWidth={2} className="text-faint" />
    </button>
  );
}

/* ---------- data display ---------- */

export function Monogram({ text, tone, size = 40, className }: { text: string; tone: string; size?: number; className?: string }) {
  return (
    <span
      aria-hidden="true"
      className={cx("flex shrink-0 items-center justify-center font-bold text-white", className)}
      style={{ width: size, height: size, borderRadius: size * 0.3, background: tone, fontSize: size * 0.42 }}
    >
      {text}
    </span>
  );
}

export function Bar({ value, color, track = "var(--color-ink-3)", height = 6, marker }: { value: number; color: string; track?: string; height?: number; marker?: { at: number; color: string } }) {
  const pct = Math.max(0, Math.min(1, value)) * 100;
  return (
    <div className="relative" style={{ height }}>
      <div className="overflow-hidden rounded-full" style={{ height, background: track }}>
        <div className="rounded-full" style={{ width: `${pct}%`, height, background: color }} />
      </div>
      {marker ? (
        <div
          aria-hidden="true"
          className="absolute rounded-full"
          style={{ left: `${marker.at * 100}%`, top: -4, width: 2, height: height + 8, background: marker.color }}
        />
      ) : null}
    </div>
  );
}

export function Empty({ children }: { children: ReactNode }) {
  return <p className="py-6 text-center text-sm text-muted">{children}</p>;
}

/* ---------- bottom sheet ---------- */

export function Sheet({ open, onClose, title, children, titleClassName }: { open: boolean; onClose: () => void; title: string; children: ReactNode; titleClassName?: string }) {
  const { t } = useTranslation();
  const titleId = useId();
  const panel = useRef<HTMLDivElement>(null);
  // Stay mounted after `open` turns false so the sheet can slide out, showing
  // the last content it had (parents often clear it on close).
  const [mounted, setMounted] = useState(open);
  const [kept, setKept] = useState({ title, children });
  if (open && !mounted) setMounted(true);
  if (open && (kept.title !== title || kept.children !== children)) setKept({ title, children });
  const closing = mounted && !open;

  // Unmount after the slide-out even if animationend never fires (hidden tab, reduced motion).
  useEffect(() => {
    if (!closing) return;
    const t = setTimeout(() => setMounted(false), 260);
    return () => clearTimeout(t);
  }, [closing]);

  // Parents often pass a new onClose each render; reading it through a ref keeps
  // the effect below from re-running (and pulling focus out of a text field) while typing.
  const closeRef = useRef(onClose);
  useEffect(() => {
    closeRef.current = onClose;
  });

  useEffect(() => {
    if (!open) return;
    const prev = document.activeElement as HTMLElement | null;
    panel.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") closeRef.current();
    };
    document.addEventListener("keydown", onKey);
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = overflow;
      prev?.focus?.();
    };
  }, [open]);

  if (!mounted) return null;
  return (
    <div className={cx("fixed inset-0 z-50 flex justify-center bg-hero/45 dark:bg-black/60", closing ? "animate-fade-out pointer-events-none" : "animate-fade")}>
      <div className="flex w-full max-w-[430px] flex-col">
      <button type="button" aria-label={t("common.close")} tabIndex={-1} onClick={onClose} className="grow" />
      <div
        ref={panel}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        onAnimationEnd={(e) => {
          if (closing && e.target === e.currentTarget) setMounted(false);
        }}
        className={cx(closing ? "animate-sheet-out" : "animate-sheet", "flex max-h-[88dvh] flex-col gap-3.5 overflow-y-auto rounded-t-[28px] bg-paper px-6 pb-[calc(32px+env(safe-area-inset-bottom))] pt-2.5 shadow-sheet outline-none")}
      >
        <span aria-hidden="true" className="h-1 w-10 self-center rounded-full bg-line-strong" />
        <div className="flex items-center justify-between">
          <h2 id={titleId} className={cx("font-serif text-xl font-bold", titleClassName)}>
            {closing ? kept.title : title}
          </h2>
          <button type="button" aria-label={t("common.close")} onClick={onClose} className="flex h-10 w-10 items-center justify-center rounded-full border border-line bg-card">
            <Icon name="close" size={18} strokeWidth={2} />
          </button>
        </div>
        {closing ? kept.children : children}
      </div>
      </div>
    </div>
  );
}
