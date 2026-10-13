"use client"

import Link from "next/link"
import { useTranslation } from "react-i18next"
import { Icon } from "./ui/Icon"
import { todayISO } from "@/lib/format"
import { checkDue, checkMonth } from "@/lib/monthCheck"
import { useStore } from "@/lib/store"

/** Around the end of the month: invite the user to compare balances with the real ones. */
export function MonthCheckCard() {
  const { t } = useTranslation()
  const checked = useStore((s) => s.settings.balanceCheckedMonth)
  const setSettings = useStore((s) => s.setSettings)
  const today = todayISO()
  if (!checkDue(today, checked)) return null
  return (
    <div className="flex items-center gap-3 rounded-[20px] border border-line bg-card px-3.5 py-3">
      <Link href="/accounts/check" className="flex min-w-0 grow items-center gap-3">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-chip">
          <Icon name="check" size={18} strokeWidth={2.2} />
        </span>
        <span className="flex min-w-0 flex-col">
          <span className="text-[15px] font-semibold">{t("monthCheck.cardTitle")}</span>
          <span className="text-xs text-muted">{t("monthCheck.cardBody")}</span>
        </span>
      </Link>
      <button
        type="button"
        onClick={() => setSettings({ balanceCheckedMonth: checkMonth(today) ?? undefined })}
        className="shrink-0 rounded-full px-2.5 py-2 text-xs font-medium text-muted"
      >
        {t("monthCheck.dismiss")}
      </button>
    </div>
  )
}
