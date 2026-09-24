"use client";

import { usePathname, useRouter } from "next/navigation";
import { useEffect, useSyncExternalStore } from "react";
import { useStore } from "@/lib/store";

const subscribe = (cb: () => void) => useStore.persist.onFinishHydration(cb);
const getHydrated = () => useStore.persist.hasHydrated();
const getServer = () => false;

/**
 * Loads saved data from localStorage, then guards routes:
 * signed-out users only see /login, signed-in users skip it.
 */
export function AppShell({ children }: { children: React.ReactNode }) {
  const hydrated = useSyncExternalStore(subscribe, getHydrated, getServer);
  const user = useStore((s) => s.user);
  const runAutoLog = useStore((s) => s.runAutoLog);
  const pathname = usePathname();
  const router = useRouter();
  const onLogin = pathname === "/login";
  const mustRedirect = hydrated && ((!user && !onLogin) || (!!user && onLogin));

  useEffect(() => {
    void useStore.persist.rehydrate();
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    if (!user && !onLogin) router.replace("/login");
    else if (user && onLogin) router.replace("/");
    else if (user) runAutoLog();
  }, [hydrated, user, onLogin, router, runAutoLog]);

  return (
    <div className="relative mx-auto min-h-dvh w-full max-w-[430px] bg-paper">
      {hydrated && !mustRedirect ? children : <div aria-busy="true" className="min-h-dvh" />}
    </div>
  );
}
