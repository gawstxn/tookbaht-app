"use client"

import { useState } from "react"
import { useTranslation } from "react-i18next"
import { CUSTOM_CATEGORY_ICONS } from "@/lib/constants"
import { useStore } from "@/lib/store"
import { Icon, type IconName } from "./ui/Icon"
import { PrimaryButton, SecondaryButton, Sheet, cx } from "./ui/primitives"

export const MAX_CUSTOM_CATEGORIES = 30
export type CategoryDraft = { key?: string; type: "in" | "out"; label: string; icon: IconName }

/**
 * Add or edit one of the user's own categories. Used on the categories screen
 * and from "+ เพิ่มหมวด" on the add screen; `onSaved` gets the category key.
 */
export function CategoryEditSheet({
  draft: initial,
  onClose,
  onSaved,
  onDelete,
}: {
  draft: CategoryDraft | null
  onClose: () => void
  onSaved?: (key: string) => void
  onDelete?: (key: string) => void
}) {
  const { t } = useTranslation()
  const all = useStore((s) => s.settings.customCategories) ?? []
  const setSettings = useStore((s) => s.setSettings)
  const notify = useStore((s) => s.notify)
  // Edited copy of the draft; reset whenever a new one is opened. Kept after closing so the sheet doesn't empty while it slides away.
  const [draft, setDraft] = useState<CategoryDraft | null>(initial)
  const [opened, setOpened] = useState(initial)
  if (initial !== opened) {
    setOpened(initial)
    if (initial) setDraft(initial)
  }
  const label = draft?.label.trim() ?? ""
  const taken =
    !!draft &&
    all.some(
      (c) =>
        !c.hidden &&
        c.key !== draft.key &&
        c.type === draft.type &&
        c.label.trim().toLocaleLowerCase() === label.toLocaleLowerCase(),
    )
  const full = !draft?.key && all.filter((c) => !c.hidden).length >= MAX_CUSTOM_CATEGORIES
  const canSave = label.length > 0 && !taken && !full

  const save = () => {
    if (!draft || !canSave) return
    let key = draft.key
    if (key) {
      setSettings({ customCategories: all.map((c) => (c.key === key ? { ...c, label, icon: draft.icon } : c)) })
      notify(t("cats.saved", { name: label }))
    } else {
      key = `c-${crypto.randomUUID().slice(0, 8)}`
      setSettings({ customCategories: [...all, { key, type: draft.type, label, icon: draft.icon }] })
      notify(t("cats.added", { name: label }))
    }
    onSaved?.(key)
    onClose()
  }

  return (
    <Sheet open={!!initial} onClose={onClose} title={draft?.key ? t("cats.edit") : t("cats.add")}>
      {draft ? (
        <>
          <div className="flex flex-col gap-1">
            <label htmlFor="cat-name" className="pl-0.5 text-[11px] text-muted">
              {t("cats.name")}
            </label>
            <input
              id="cat-name"
              value={draft.label}
              maxLength={24}
              onChange={(e) => setDraft({ ...draft, label: e.target.value })}
              placeholder={t(draft.type === "in" ? "cats.namePlaceholderIn" : "cats.namePlaceholder")}
              className="min-h-11 w-full rounded-xl border border-line bg-card px-3 text-[15px] outline-none"
            />
            {taken ? <span className="pl-0.5 text-xs text-danger">{t("cats.taken")}</span> : null}
            {full ? (
              <span className="pl-0.5 text-xs text-danger">{t("cats.full", { count: MAX_CUSTOM_CATEGORIES })}</span>
            ) : null}
          </div>
          <div className="flex flex-col gap-2">
            <span className="pl-0.5 text-[11px] text-muted">{t("cats.icon")}</span>
            <div className="grid grid-cols-6 gap-2">
              {CUSTOM_CATEGORY_ICONS.map((icon, i) => (
                <button
                  key={icon}
                  type="button"
                  aria-label={t("cats.iconN", { n: i + 1 })}
                  aria-pressed={draft.icon === icon}
                  onClick={() => setDraft({ ...draft, icon })}
                  className={cx(
                    "flex aspect-square items-center justify-center rounded-xl border",
                    draft.icon === icon ? "border-ink bg-ink text-on-ink" : "border-line bg-card",
                  )}
                >
                  <Icon name={icon} size={20} strokeWidth={2} />
                </button>
              ))}
            </div>
          </div>
          <PrimaryButton disabled={!canSave} onClick={save}>
            {draft.key ? t("cats.saveEdit") : t("cats.add")}
          </PrimaryButton>
          {draft.key && onDelete ? (
            <SecondaryButton tone="danger" onClick={() => onDelete(draft.key!)}>
              {t("cats.delete")}
            </SecondaryButton>
          ) : null}
        </>
      ) : null}
    </Sheet>
  )
}
