"use client";

import { useState } from "react";
import { useTranslation } from "react-i18next";
import { lastPathExcept } from "@/lib/nav";
import { useStore } from "@/lib/store";
import { PrimaryButton, Sheet } from "./ui/primitives";

/** "แจ้งปัญหา": a message plus the app version and the screen before the profile. */
export function FeedbackSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { t } = useTranslation();
  const sendFeedback = useStore((s) => s.sendFeedback);
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [page, setPage] = useState("");
  const [wasOpen, setWasOpen] = useState(open);
  if (open !== wasOpen) {
    setWasOpen(open);
    if (open) setPage(lastPathExcept("/profile"));
  }

  return (
    <Sheet open={open} onClose={() => !busy && onClose()} title={t("feedback.title")}>
      <p className="text-sm text-muted">{t("feedback.lead")}</p>
      <textarea
        value={message}
        maxLength={2000}
        rows={5}
        onChange={(e) => setMessage(e.target.value)}
        placeholder={t("feedback.placeholder")}
        aria-label={t("feedback.title")}
        className="w-full resize-none rounded-xl border border-line bg-card px-3 py-2.5 text-[15px] outline-none"
      />
      <p className="text-xs leading-relaxed text-faint">
        {t("feedback.attached", { version: process.env.NEXT_PUBLIC_APP_VERSION, page: page || "—" })}
      </p>
      <PrimaryButton
        disabled={!message.trim() || busy}
        onClick={async () => {
          setBusy(true);
          const sent = await sendFeedback(message, page);
          setBusy(false);
          if (!sent) return;
          setMessage("");
          onClose();
        }}
      >
        {busy ? t("feedback.sending") : t("feedback.send")}
      </PrimaryButton>
    </Sheet>
  );
}
