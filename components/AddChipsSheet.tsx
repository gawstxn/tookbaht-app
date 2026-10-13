"use client"

import { useTranslation } from "react-i18next"
import { Icon, type IconName } from "./ui/Icon"
import { Sheet, Switch, cx } from "./ui/primitives"
import { chipHidden, chipOrder, moveChip, toggleChip, type AddChip } from "@/lib/addChips"
import { useStore } from "@/lib/store"

const META: Record<AddChip, { icon: IconName; label: string }> = {
  tag: { icon: "tag", label: "tags.add" },
  currency: { icon: "globe", label: "fxEntry.chip" },
  tax: { icon: "percent", label: "tax.mark" },
  split: { icon: "users", label: "split.action" },
  slip: { icon: "scan", label: "slip.read" },
}

/** Reorder the add screen's optional buttons and hide the ones the user never uses. */
export function AddChipsSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { t } = useTranslation()
  const prefs = useStore((s) => s.settings.addChips)
  const setSettings = useStore((s) => s.setSettings)
  const order = chipOrder(prefs)
  const hidden = chipHidden(prefs)
  const arrow = "flex h-11 w-11 shrink-0 items-center justify-center rounded-full disabled:opacity-30"

  return (
    <Sheet open={open} onClose={onClose} title={t("addChips.title")}>
      <p className="text-sm text-muted">{t("addChips.lead")}</p>
      <div className="flex flex-col rounded-[20px] border border-line bg-card px-3 py-0.5 [&>*:not(:last-child)]:border-b [&>*:not(:last-child)]:border-divider">
        {order.map((k, i) => {
          const label = t(META[k].label)
          const on = !hidden.includes(k)
          return (
            <div key={k} className="flex min-h-[60px] items-center gap-1">
              <button
                type="button"
                aria-label={`${label}: ${t("addChips.up")}`}
                disabled={i === 0}
                onClick={() => setSettings({ addChips: moveChip(prefs, k, -1) })}
                className={arrow}
              >
                <Icon name="chevronDown" size={18} strokeWidth={2.2} className="rotate-180" />
              </button>
              <button
                type="button"
                aria-label={`${label}: ${t("addChips.down")}`}
                disabled={i === order.length - 1}
                onClick={() => setSettings({ addChips: moveChip(prefs, k, 1) })}
                className={arrow}
              >
                <Icon name="chevronDown" size={18} strokeWidth={2.2} />
              </button>
              <span className={cx("flex min-w-0 grow items-center gap-2.5 pl-1", !on && "text-muted")}>
                <Icon name={META[k].icon} size={17} strokeWidth={2} />
                <span className="truncate text-[15px] font-medium">{label}</span>
              </span>
              <Switch checked={on} label={label} onChange={() => setSettings({ addChips: toggleChip(prefs, k) })} />
            </div>
          )
        })}
      </div>
    </Sheet>
  )
}
