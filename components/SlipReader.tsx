"use client";

import { useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { todayISO } from "@/lib/format";
import { OcrUnsupportedError, readSlipText } from "@/lib/ocr";
import { parseSlip, type SlipFields } from "@/lib/slip";
import { useStore } from "@/lib/store";
import { Icon } from "./ui/Icon";
import { Bar, SecondaryButton, Sheet } from "./ui/primitives";

/**
 * "อ่านสลิป" chip on the add screen: pick a slip photo, read it on the device
 * and hand back what was found (the user checks it before saving).
 */
export function SlipReader({ onRead }: { onRead: (fields: SlipFields) => void }) {
  const { t } = useTranslation();
  const notify = useStore((s) => s.notify);
  const input = useRef<HTMLInputElement>(null);
  const [state, setState] = useState<"idle" | "loading" | "reading">("idle");
  const [progress, setProgress] = useState(0);
  const cancelled = useRef(false);

  const read = async (file: File | undefined) => {
    if (!file) return;
    cancelled.current = false;
    setProgress(0);
    setState("loading");
    try {
      const text = await readSlipText(file, (p) => {
        setState("reading");
        setProgress(p);
      });
      if (cancelled.current) return;
      const fields = parseSlip(text, todayISO());
      setState("idle");
      if (!fields.amount && !fields.date) return notify(t("slip.nothing"), { tone: "error" });
      onRead(fields);
    } catch (e) {
      console.error(e);
      setState("idle");
      if (!cancelled.current) notify(t(e instanceof OcrUnsupportedError ? "slip.unsupported" : "slip.failed"), { tone: "error" });
    }
  };

  return (
    <>
      <button
        type="button"
        onClick={() => input.current?.click()}
        className="flex min-h-9 items-center gap-1.5 self-start rounded-full border border-line bg-card px-3 text-[13px] font-medium text-muted"
      >
        <Icon name="scan" size={14} strokeWidth={2.2} />
        {t("slip.read")}
      </button>
      {/* The system photo picker: the one place (with restoring a backup) the app opens a native chooser. */}
      <input
        ref={input}
        type="file"
        accept="image/*"
        hidden
        onChange={(e) => {
          void read(e.target.files?.[0]);
          e.target.value = "";
        }}
      />
      <Sheet
        open={state !== "idle"}
        onClose={() => {
          cancelled.current = true;
          setState("idle");
        }}
        title={t("slip.title")}
      >
        <p className="text-sm text-muted">{state === "loading" ? t("slip.loading") : t("slip.reading")}</p>
        <Bar value={state === "loading" ? 0.05 : progress} height={6} track="var(--color-divider)" color="var(--color-income)" />
        <p className="text-xs leading-relaxed text-faint">{t("slip.private")}</p>
        <SecondaryButton
          onClick={() => {
            cancelled.current = true;
            setState("idle");
          }}
        >
          {t("common.cancel")}
        </SecondaryButton>
      </Sheet>
    </>
  );
}
