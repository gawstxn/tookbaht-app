"use client";

import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { getSupabase } from "@/lib/supabase/client";
import { useStore, type Toast } from "@/lib/store";
import { Icon } from "./ui/Icon";
import { PrimaryButton, cx } from "./ui/primitives";

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
  const pathname = usePathname();
  const router = useRouter();
  const noData = NO_DATA_PATHS.some((p) => pathname.startsWith(p));
  const onOnboarding = pathname === "/onboarding";

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

  let content: React.ReactNode;
  if (noData) content = children;
  else if (status === "error") content = <LoadError />;
  // Plain background while loading: iOS already showed its launch image.
  else if (status !== "ready" || (needsOnboarding && !onOnboarding)) content = <div aria-busy="true" className="min-h-dvh" />;
  else content = children;

  return (
    <div className="relative mx-auto min-h-dvh w-full max-w-[430px] bg-paper">
      {content}
      <ToastHost />
    </div>
  );
}

function LoadError() {
  const retry = () => {
    const { userId, load } = useStore.getState();
    if (userId) void load(userId);
  };
  return (
    <main className="flex min-h-dvh flex-col items-center justify-center gap-4 px-6 text-center">
      <h1 className="font-serif text-xl font-bold">โหลดข้อมูลไม่สำเร็จ</h1>
      <p className="text-sm text-muted">ตรวจสอบการเชื่อมต่ออินเทอร์เน็ต แล้วลองอีกครั้ง</p>
      <PrimaryButton onClick={retry}>ลองอีกครั้ง</PrimaryButton>
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
          shown.tone === "error" ? "bg-danger text-white" : "bg-ink text-on-ink",
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
