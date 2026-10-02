"use client"

import { useRouter } from "next/navigation"
import { useEffect } from "react"
import { useStore } from "@/lib/store"

/* Pieces shared by the admin screens (see lib/admin.ts). */

/** True for admins; anyone else is sent back to the profile (the database refuses them anyway). */
export function useAdminOnly(): boolean {
  const router = useRouter()
  const isAdmin = useStore((s) => s.user?.role === "admin")
  const ready = useStore((s) => s.status === "ready")
  useEffect(() => {
    if (ready && !isAdmin) router.replace("/profile")
  }, [ready, isAdmin, router])
  return isAdmin
}

/** A small rounded label: "ระงับ", "ผู้ดูแล". */
export function Tag({ tone = "plain", children }: { tone?: "plain" | "danger" | "ok"; children: React.ReactNode }) {
  const cls =
    tone === "danger" ? "bg-expense-tint text-danger" : tone === "ok" ? "bg-income-tint text-income" : "bg-chip"
  return (
    <span className={`shrink-0 rounded-full px-2 py-px text-[11px] font-semibold whitespace-nowrap ${cls}`}>
      {children}
    </span>
  )
}

/** A label and its value on one line, inside a ListCard. */
export function InfoRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex min-h-11 items-center justify-between gap-3 text-sm">
      <span className="shrink-0 text-muted">{label}</span>
      <span className="min-w-0 truncate text-right font-semibold">{value}</span>
    </div>
  )
}
