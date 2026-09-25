"use client";

import { useRouter } from "next/navigation";
import type { ReactNode } from "react";
import { PushScreen } from "./app";
import { PushHeader } from "./ui/primitives";

/** Contact for data requests; set NEXT_PUBLIC_CONTACT_EMAIL to show it. */
export const CONTACT_EMAIL = process.env.NEXT_PUBLIC_CONTACT_EMAIL;

/** Plain reading layout for the terms and privacy pages (open to signed-out visitors). */
export function LegalPage({ title, updated, children }: { title: string; updated: string; children: ReactNode }) {
  const router = useRouter();
  return (
    <PushScreen>
      <PushHeader
        title={title}
        onBack={() => (window.history.length > 1 ? router.back() : router.replace("/login"))}
      />
      <p className="text-xs text-muted">ปรับปรุงล่าสุด {updated}</p>
      <article className="flex flex-col gap-5 pb-6 text-[15px] leading-relaxed [&_h2]:mb-1.5 [&_h2]:text-base [&_h2]:font-semibold [&_li]:ml-5 [&_li]:list-disc [&_p+p]:mt-2 [&_ul+p]:mt-3 [&_ul]:mt-1.5 [&_ul]:flex [&_ul]:flex-col [&_ul]:gap-1">
        {children}
      </article>
    </PushScreen>
  );
}
