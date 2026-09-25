"use client";

import { usePathname, useRouter } from "next/navigation";
import { Fragment, ViewTransition, useEffect, useLayoutEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { applyLang, preferredLang } from "@/lib/i18n";
import { applyTheme, followSystemTheme, themePref } from "@/lib/theme";
import { isManualBack, notifyPathCommitted } from "@/lib/nav";
import { hasPendingReauth, takeReauth } from "@/lib/reauth";
import { setUnlocked, writeLock } from "@/lib/appLock";
import { shortDate, toISO } from "@/lib/format";
import { TERMS_VERSION } from "@/lib/legal";
import { TermsGate } from "./TermsConsent";
import { LockGate } from "./AppLock";
import { getSupabase } from "@/lib/supabase/client";
import { useStore, type Toast } from "@/lib/store";
import { Icon } from "./ui/Icon";
import { PrimaryButton, cx } from "./ui/primitives";

/** Tab roots sit at depth 0; everything else is pushed on top of them. */
const TAB_ROOTS = ["/", "/transactions", "/subscriptions", "/profile"];
const depth = (path: string) => (TAB_ROOTS.includes(path) ? 0 : path.split("/").filter(Boolean).length);

/** Screens that work without a session or before any data exists. */
const NO_DATA_PATHS = ["/login", "/auth/", "/terms", "/privacy"];

/**
 * Follows the Supabase session, loads the user's data, and sends users
 * without accounts to onboarding. proxy.ts already keeps signed-out
 * visitors on /login.
 */
export function AppShell({ children }: { children: React.ReactNode }) {
  const status = useStore((s) => s.status);
  const needsOnboarding = useStore((s) => s.status === "ready" && s.accounts.length === 0);
  // Onboarded users who haven't accepted the current terms (onboarding asks new users itself).
  const needsTerms = useStore((s) => s.status === "ready" && s.accounts.length > 0 && s.settings.termsAcceptedVersion !== TERMS_VERSION);
  const pathname = usePathname();
  const router = useRouter();
  const noData = NO_DATA_PATHS.some((p) => pathname.startsWith(p));
  const onOnboarding = pathname === "/onboarding";
  const { i18n } = useTranslation();

  // Pages prerender in Thai; switch to the saved/device language once in the browser.
  useEffect(() => {
    applyLang(preferredLang());
  }, []);

  // The boot script already set the theme; keep "system" in step with the OS.
  useEffect(() => {
    applyTheme(themePref());
    return followSystemTheme();
  }, []);

  useEffect(() => {
    const sb = getSupabase();
    const { data } = sb.auth.onAuthStateChange((event, session) => {
      const { userId, load, reset } = useStore.getState();
      if (session?.user && session.user.id !== userId) {
        // Defer so we don't call Supabase inside its own auth callback.
        setTimeout(() => void load(session.user.id), 0);
      } else if (!session && event === "SIGNED_OUT") {
        reset();
        router.replace("/login");
      }
    });
    return () => data.subscription.unsubscribe();
  }, [router]);

  // iOS Safari still pinch-zooms despite the viewport settings; cancel its gesture events.
  useEffect(() => {
    const block = (e: Event) => e.preventDefault();
    document.addEventListener("gesturestart", block);
    return () => document.removeEventListener("gesturestart", block);
  }, []);

  useEffect(() => {
    if (needsOnboarding && !onOnboarding && !noData) router.replace("/onboarding");
  }, [needsOnboarding, onOnboarding, noData, router]);

  // Back from confirming with Google: finish what it was for.
  useEffect(() => {
    if (status !== "ready" || !hasPendingReauth()) return;
    void takeReauth().then(async (intent) => {
      const { notify, deleteAccount } = useStore.getState();
      if (intent === "unlock") {
        writeLock(null);
        setUnlocked(true);
        notify(i18n.t("lock.resetDone"));
      } else if (intent === "delete") {
        const until = await deleteAccount();
        if (until) router.replace(`/login?deleted=${until}`);
      } else {
        notify(i18n.t("reauth.failed"), { tone: "error" });
      }
    });
  }, [status, router, i18n]);
  const deletionRequestedAt = useStore((s) => s.deletionRequestedAt);

  let content: React.ReactNode;
  if (noData) content = children;
  else if (status === "error") content = <LoadError />;
  else if (status === "ready" && deletionRequestedAt) content = <DeletionPending requestedAt={deletionRequestedAt} />;
  else if (needsTerms) content = <TermsGate />;
  // Plain background while loading: iOS already showed its launch image.
  else if (status !== "ready" || (needsOnboarding && !onOnboarding)) content = <div aria-busy="true" className="min-h-dvh" />;
  else content = children;

  return (
    <div className="relative mx-auto min-h-dvh w-full max-w-[430px] bg-paper">
      <div className="app-content">
        <PageTransition path={pathname}>
          {/* Remount on language change so memoised labels recompute. */}
          <Fragment key={i18n.language}>{content}</Fragment>
        </PageTransition>
      </div>
      <LockGate active={!noData} />
      <ToastHost />
    </div>
  );
}

/**
 * Animates route changes (styles in globals.css): deeper screens slide in from
 * the right, going up slides back, tab switches are instant. Navigations are
 * transitions, so keying by path makes React run a view transition.
 */
function PageTransition({ path, children }: { path: string; children: React.ReactNode }) {
  const prev = useRef(path);
  // Runs inside the transition's DOM update, before the animation starts.
  useLayoutEffect(() => {
    const from = prev.current;
    prev.current = path;
    if (from === path) return;
    const [a, b] = [depth(from), depth(path)];
    // A history pop (goBack) runs its own whole-page transition, styled as "pop".
    document.documentElement.dataset.nav = isManualBack() ? "pop" : b > a ? "forward" : b < a ? "back" : "tab";
    notifyPathCommitted();
  }, [path]);
  return (
    <ViewTransition key={path} enter="page" exit="page" default="none">
      {/* Opaque and full-height, so the outgoing page never shows through the incoming one. */}
      <div className="min-h-dvh bg-paper">{children}</div>
    </ViewTransition>
  );
}

/** Signed in to an account that is closed and waiting to be deleted: restore it, or leave. */
function DeletionPending({ requestedAt }: { requestedAt: string }) {
  const { t } = useTranslation();
  const router = useRouter();
  const cancelDeletion = useStore((s) => s.cancelDeletion);
  const signOut = useStore((s) => s.signOut);
  const [busy, setBusy] = useState(false);
  const purgeOn = toISO(new Date(Date.parse(requestedAt) + 30 * 86_400_000));
  return (
    <main className="flex min-h-dvh flex-col items-center justify-center gap-4 px-6 text-center">
      <span aria-hidden="true" className="flex h-14 w-14 items-center justify-center rounded-2xl bg-expense-tint text-danger">
        <Icon name="alert" size={26} strokeWidth={2} />
      </span>
      <h1 className="font-serif text-2xl font-bold">{t("deletion.title")}</h1>
      <p className="text-sm leading-relaxed text-muted">{t("deletion.lead", { date: shortDate(purgeOn) })}</p>
      <div className="mt-4 flex w-full flex-col gap-2.5">
        <PrimaryButton
          disabled={busy}
          onClick={async () => {
            setBusy(true);
            if (!(await cancelDeletion())) setBusy(false);
          }}
        >
          {t("deletion.restore")}
        </PrimaryButton>
        <button
          type="button"
          onClick={async () => {
            await signOut();
            router.replace("/login");
          }}
          className="min-h-11 text-sm font-medium text-muted"
        >
          {t("profile.logout")}
        </button>
      </div>
    </main>
  );
}

function LoadError() {
  const { t } = useTranslation();
  const retry = () => {
    const { userId, load } = useStore.getState();
    if (userId) void load(userId);
  };
  return (
    <main className="flex min-h-dvh flex-col items-center justify-center gap-4 px-6 text-center">
      <h1 className="font-serif text-xl font-bold">{t("shell.loadFailed")}</h1>
      <p className="text-sm text-muted">{t("shell.checkConnection")}</p>
      <PrimaryButton onClick={retry}>{t("common.retry")}</PrimaryButton>
    </main>
  );
}

/** Bottom toast for the last change; delete toasts carry an undo button. */
function ToastHost() {
  const toast = useStore((s) => s.toast);
  const dismiss = useStore((s) => s.dismissToast);
  // Keep the last toast on screen while it animates out.
  const [shown, setShown] = useState<Toast | null>(toast);
  if (toast && toast !== shown) setShown(toast);
  const leaving = !toast && !!shown;

  // Same fallback as the sheet: clear the toast even if animationend never fires.
  useEffect(() => {
    if (!leaving) return;
    const t = setTimeout(() => setShown(null), 280);
    return () => clearTimeout(t);
  }, [leaving]);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(dismiss, toast.action ? 5000 : 2800);
    return () => clearTimeout(t);
  }, [toast, dismiss]);

  if (!shown) return null;
  return (
    <div
      role={shown.tone === "error" ? "alert" : "status"}
      className="pointer-events-none fixed inset-x-0 bottom-[calc(92px+env(safe-area-inset-bottom))] z-[60] mx-auto flex max-w-[430px] justify-center px-4"
    >
      <div
        key={shown.id}
        onAnimationEnd={() => {
          if (leaving) setShown(null);
        }}
        className={cx(
          "flex min-h-12 w-full items-center gap-3 rounded-2xl py-2 pl-4 pr-2 text-sm shadow-hero",
          leaving ? "animate-toast-out" : "animate-toast pointer-events-auto",
          shown.tone === "error" ? "bg-danger text-white" : "bg-hero text-on-hero",
        )}
      >
        {shown.tone === "ok" ? <Icon name="check" size={16} strokeWidth={2.4} className="shrink-0 text-lime" /> : null}
        <span className="grow">{shown.text}</span>
        {shown.action && !leaving ? (
          <button
            type="button"
            onClick={() => {
              shown.action!.run();
              dismiss();
            }}
            className="min-h-9 shrink-0 rounded-xl px-3 font-semibold text-lime"
          >
            {shown.action.label}
          </button>
        ) : null}
      </div>
    </div>
  );
}
