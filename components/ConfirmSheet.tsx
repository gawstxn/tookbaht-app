"use client";

import { useTranslation } from "react-i18next";
import { PrimaryButton, SecondaryButton, Sheet } from "./ui/primitives";

/**
 * "Delete …?" drawer: a short explanation, a red confirm button and a way
 * back. Shown in place of the sheet that asked (hide that one while this is open).
 */
export function ConfirmSheet({
  open,
  onClose,
  title,
  lead,
  confirmLabel,
  onConfirm,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  lead: string;
  confirmLabel: string;
  onConfirm: () => void;
}) {
  const { t } = useTranslation();
  return (
    <Sheet open={open} onClose={onClose} title={title} titleClassName="text-danger">
      <p className="text-sm text-muted">{lead}</p>
      <PrimaryButton once tone="danger" onClick={onConfirm}>
        {confirmLabel}
      </PrimaryButton>
      <SecondaryButton onClick={onClose}>{t("common.cancel")}</SecondaryButton>
    </Sheet>
  );
}
