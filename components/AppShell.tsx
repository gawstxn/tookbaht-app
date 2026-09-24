"use client";

import { usePathname, useRouter } from "next/navigation";
import { useEffect } from "react";
import { getSupabase } from "@/lib/supabase/client";
import { useStore } from "@/lib/store";
import { PrimaryButton } from "./ui/primitives";

/** Screens that work without a session or before any data exists. */
const NO_DATA_PATHS = ["/login", "/auth/"];

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
  else if (status !== "ready" || (needsOnboarding && !onOnboarding)) content = <div aria-busy="true" className="min-h-dvh" />;
  else content = children;

  return (
    <div className="relative mx-auto min-h-dvh w-full max-w-[430px] bg-paper">
      {content}
      <SyncToast />
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

function SyncToast() {
  const error = useStore((s) => s.syncError);
  const dismiss = useStore((s) => s.dismissError);

  useEffect(() => {
    if (!error) return;
    const t = setTimeout(dismiss, 4000);
    return () => clearTimeout(t);
  }, [error, dismiss]);

  if (!error) return null;
  return (
    <div role="alert" className="fixed inset-x-0 top-[calc(12px+env(safe-area-inset-top))] z-[60] mx-auto flex max-w-[430px] justify-center px-4">
      <button type="button" onClick={dismiss} className="animate-fade rounded-2xl bg-ink px-4 py-3 text-left text-sm text-on-ink shadow-hero">
        {error}
      </button>
    </div>
  );
}
