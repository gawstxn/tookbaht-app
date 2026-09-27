"use client";

import { useState } from "react";
import { useTranslation } from "react-i18next";
import { TAX_TYPES, type TaxType } from "@/lib/tax";
import { Icon } from "./ui/Icon";
import { Chip, PrimaryButton, SecondaryButton, Sheet, cx } from "./ui/primitives";

/** "ลดหย่อนภาษี" button on the add screen: mark an expense as a tax deduction of some kind. */
export function TaxField({ value, onChange }: { value?: TaxType; onChange: (v: TaxType | undefined) => void }) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<TaxType | undefined>(value);
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
        <Icon name="percent" size={14} strokeWidth={2.2} />
        {value ? t(`tax.type.${value}`) : t("tax.mark")}
      </button>
      <Sheet open={open} onClose={() => setOpen(false)} title={t("tax.pickTitle")}>
        <p className="text-sm text-muted">{t("tax.pickLead")}</p>
        <div className="flex flex-wrap gap-2">
          {TAX_TYPES.map(({ key }) => (
            <Chip key={key} size="sm" on={draft === key} onClick={() => setDraft(key)}>
              {t(`tax.type.${key}`)}
            </Chip>
          ))}
        </div>
        <PrimaryButton
          disabled={!draft}
          onClick={() => {
            onChange(draft);
            setOpen(false);
          }}
        >
          {t("common.save")}
        </PrimaryButton>
        {value ? (
          <SecondaryButton
            onClick={() => {
              onChange(undefined);
              setOpen(false);
            }}
          >
            {t("tax.unmark")}
          </SecondaryButton>
        ) : null}
      </Sheet>
    </>
  );
}
