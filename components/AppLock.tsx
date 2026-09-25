"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import { useTranslation } from "react-i18next";
import { Icon } from "@/components/ui/Icon";
import { cx } from "@/components/ui/primitives";
import { PIN_LENGTH, RELOCK_AFTER_MS, SERVER_LOCK_STATE, checkPin, getLockState, setUnlocked, subscribeLock, unlockWithBiometric, writeLock, type LockConfig } from "@/lib/appLock";
import { useStore } from "@/lib/store";

const setLockedAttr = (on: boolean) => {
  if (on) document.documentElement.dataset.locked = "";
  else delete document.documentElement.dataset.locked;
};

/**
 * Covers the app while a lock is set on this device: on open, and again after
 * a minute in the background. The boot script already hid the app before paint.
 */
export function LockGate({ active }: { active: boolean }) {
  const { config, locked } = useSyncExternalStore(subscribeLock, getLockState, () => SERVER_LOCK_STATE);
  const show = active && locked && !!config;

  // Keep the pre-paint "hidden" flag in step; signed-out screens (login, terms) are never locked.
  useEffect(() => {
    setLockedAttr(show);
  }, [show]);

  // Lock again after a minute in the background.
  useEffect(() => {
    let hiddenAt = 0;
    const onVisibility = () => {
      if (document.hidden) hiddenAt = Date.now();
      else if (hiddenAt && Date.now() - hiddenAt > RELOCK_AFTER_MS) setUnlocked(false);
    };
    document.addEventListener("visibilitychange", onVisibility);
    return () => document.removeEventListener("visibilitychange", onVisibility);
  }, []);

  if (!show) return null;
  return <LockScreen config={config!} onUnlock={() => setUnlocked(true)} />;
}

function LockScreen({ config, onUnlock }: { config: LockConfig; onUnlock: () => void }) {
  const { t } = useTranslation();
  const signOut = useStore((s) => s.signOut);
  const [error, setError] = useState(false);
  const [forgot, setForgot] = useState(false);

  const tryBiometric = async () => {
    if (config.credentialId && (await unlockWithBiometric(config.credentialId))) onUnlock();
  };

  return (
    <div className="fixed inset-0 z-[80] mx-auto flex max-w-[430px] flex-col items-center bg-paper px-6 pb-[calc(28px+env(safe-area-inset-bottom))] pt-[calc(64px+env(safe-area-inset-top))]">
      <span aria-hidden="true" className="flex h-14 w-14 items-center justify-center rounded-2xl bg-hero font-mono text-[26px] font-semibold text-lime">
        ฿
      </span>
      <h1 className="mt-4 font-serif text-2xl font-bold">{t("lock.title")}</h1>
      <PinPad
        length={config.length ?? 4}
        label={t("lock.enterPin")}
        error={error ? t("lock.wrongPin") : undefined}
        onComplete={async (pin) => {
          if (await checkPin(config, pin)) onUnlock();
          else setError(true);
        }}
        onChange={() => setError(false)}
        extraKey={
          config.credentialId ? (
            <button type="button" onClick={tryBiometric} aria-label={t("lock.useBiometric")} className="flex h-[72px] w-[72px] items-center justify-center text-ink">
              <Icon name="faceId" size={28} strokeWidth={1.8} />
            </button>
          ) : undefined
        }
      />
      {forgot ? (
        <div className="mt-auto flex flex-col items-center gap-2 text-center">
          <p className="text-[13px] text-muted">{t("lock.forgotLead")}</p>
          <button
            type="button"
            onClick={async () => {
              writeLock(null);
              await signOut();
              window.location.replace("/login");
            }}
            className="min-h-11 rounded-full border border-line bg-card px-5 text-sm font-semibold text-danger"
          >
            {t("lock.signOut")}
          </button>
        </div>
      ) : (
        <button type="button" onClick={() => setForgot(true)} className="mt-auto min-h-11 text-sm font-medium text-muted">
          {t("lock.forgot")}
        </button>
      )}
      {config.credentialId ? <AutoBiometric run={tryBiometric} /> : null}
    </div>
  );
}

/** Offer Face ID once when the lock screen appears (iOS may still require a tap on the button). */
function AutoBiometric({ run }: { run: () => void }) {
  useEffect(() => {
    run();
    // Only on mount.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return null;
}

/** Four dots and a phone-style keypad. Calls onComplete once PIN_LENGTH digits are in. */
export function PinPad({
  length = PIN_LENGTH,
  label,
  error,
  onComplete,
  onChange,
  extraKey,
}: {
  length?: number;
  label: string;
  error?: string;
  onComplete: (pin: string) => void;
  onChange?: () => void;
  extraKey?: React.ReactNode;
}) {
  const { t } = useTranslation();
  const [pin, setPin] = useState("");
  // A wrong PIN clears the dots so the next try starts fresh.
  const [shownError, setShownError] = useState(error);
  if (error !== shownError) {
    setShownError(error);
    if (error) setPin("");
  }
  const press = (d: string) => {
    if (pin.length >= length) return;
    const next = pin + d;
    setPin(next);
    onChange?.();
    if (next.length === length) onComplete(next);
  };

  return (
    <div className="mt-6 flex w-full shrink-0 flex-col items-center gap-7 pb-2">
      <div className="flex flex-col items-center gap-3.5">
        <span className="text-[15px] text-muted">{label}</span>
        <div className={cx("flex gap-3.5", error && "animate-[shake_300ms_ease-in-out]")} aria-live="polite" aria-label={t("lock.digits", { count: pin.length, total: length })}>
          {Array.from({ length }, (_, i) => (
            <span key={i} className={cx("h-3.5 w-3.5 rounded-full border-2", i < pin.length ? "border-ink bg-ink" : "border-line-strong")} />
          ))}
        </div>
        <span className="min-h-5 text-[13px] font-medium text-danger">{error}</span>
      </div>
      <div className="grid grid-cols-[repeat(3,72px)] justify-center gap-x-7 gap-y-4">
        {["1", "2", "3", "4", "5", "6", "7", "8", "9"].map((d) => (
          <Key key={d} onClick={() => press(d)}>
            {d}
          </Key>
        ))}
        {extraKey ?? <span />}
        <Key onClick={() => press("0")}>0</Key>
        <button type="button" onClick={() => setPin((p) => p.slice(0, -1))} aria-label={t("lock.delete")} className="flex h-[72px] w-[72px] items-center justify-center text-muted">
          <Icon name="del" size={24} strokeWidth={1.8} />
        </button>
      </div>
    </div>
  );
}

function Key({ children, onClick }: { children: React.ReactNode; onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} className="flex h-[72px] w-[72px] shrink-0 items-center justify-center rounded-full bg-card font-mono text-[28px] font-medium shadow-[0_1px_2px_rgba(0,0,0,0.06)] active:bg-chip">
      {children}
    </button>
  );
}
