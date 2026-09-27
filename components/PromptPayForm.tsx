"use client";

import { useState } from "react";
import { useTranslation } from "react-i18next";
import { promptPayKind } from "@/lib/promptpay";
import { useStore } from "@/lib/store";
import { PrimaryButton } from "./ui/primitives";

/**
 * The user's PromptPay ID field and save button (Profile, and the QR sheet
 * when none is set yet). With `required`, an empty field can't be saved;
 * otherwise saving it empty removes the ID.
 */
export function PromptPayForm({ required, saveLabel, onSaved }: { required?: boolean; saveLabel?: string; onSaved?: () => void }) {
  const { t } = useTranslation();
  const current = useStore((s) => s.settings.promptPayId);
  const setSettings = useStore((s) => s.setSettings);
  const notify = useStore((s) => s.notify);
  const [text, setText] = useState(current ?? "");
  const empty = !text.trim();
  const valid = empty ? !required : promptPayKind(text) !== null;

  return (
    <>
      <div className="flex flex-col gap-1">
        <input
          value={text}
          inputMode="numeric"
          maxLength={20}
          onChange={(e) => setText(e.target.value.replace(/[^0-9 +-]/g, ""))}
          placeholder={t("promptpay.placeholder")}
          aria-label={t("promptpay.row")}
          className="min-h-11 w-full rounded-xl border border-line bg-card px-3 font-mono text-[15px] outline-none"
        />
        {!empty && !valid ? <span className="pl-0.5 text-xs text-danger">{t("promptpay.invalid")}</span> : null}
      </div>
      <PrimaryButton
        disabled={!valid}
        onClick={() => {
          const id = text.replace(/\D/g, "");
          setSettings({ promptPayId: id || undefined });
          notify(t(id ? "promptpay.saved" : "promptpay.cleared"));
          onSaved?.();
        }}
      >
        {saveLabel ?? t("common.save")}
      </PrimaryButton>
    </>
  );
}
