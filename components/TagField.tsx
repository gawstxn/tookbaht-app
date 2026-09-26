"use client";

import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { useStore } from "@/lib/store";
import { knownTags } from "@/lib/tags";
import { Icon } from "./ui/Icon";
import { Chip, PrimaryButton, SecondaryButton, Sheet, cx } from "./ui/primitives";

/** "# เที่ยวญี่ปุ่น" button on the add screen; opens a sheet to pick or type a trip / project tag. */
export function TagField({ value, onChange }: { value: string; onChange: (tag: string) => void }) {
  const { t } = useTranslation();
  const txs = useStore((s) => s.transactions);
  const tags = useMemo(() => knownTags(txs), [txs]);
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState(value);

  return (
    <>
      <button
        type="button"
        aria-haspopup="dialog"
        onClick={() => {
          setDraft(value);
          setOpen(true);
        }}
        className={cx("flex min-h-9 items-center gap-1.5 self-start rounded-full px-3 text-[13px] font-medium", value ? "bg-ink text-on-ink" : "border border-line bg-card text-muted")}
      >
        <Icon name="tag" size={14} strokeWidth={2.2} />
        {value || t("tags.add")}
      </button>
      <Sheet open={open} onClose={() => setOpen(false)} title={t("tags.pickTitle")}>
        <p className="text-sm text-muted">{t("tags.lead")}</p>
        <input
          value={draft}
          maxLength={40}
          onChange={(e) => setDraft(e.target.value)}
          placeholder={t("tags.placeholder")}
          aria-label={t("tags.pickTitle")}
          className="min-h-11 w-full rounded-xl border border-line bg-card px-3 text-[15px] outline-none"
        />
        {tags.length ? (
          <div className="flex flex-wrap gap-1.5">
            {tags.map((tag) => (
              <Chip key={tag} size="sm" on={draft.trim() === tag} onClick={() => setDraft(tag)}>
                {tag}
              </Chip>
            ))}
          </div>
        ) : null}
        <PrimaryButton
          onClick={() => {
            onChange(draft.trim());
            setOpen(false);
          }}
        >
          {t("common.save")}
        </PrimaryButton>
        {value ? (
          <SecondaryButton
            onClick={() => {
              onChange("");
              setOpen(false);
            }}
          >
            {t("tags.remove")}
          </SecondaryButton>
        ) : null}
      </Sheet>
    </>
  );
}
