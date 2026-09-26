"use client";

import { useTranslation } from "react-i18next";
import { MONO_TONES } from "@/lib/constants";
import { Chip } from "./ui/primitives";

/** A steady colour per name, so a friend keeps the same tile. */
export function personTone(name: string) {
  let h = 0;
  for (const ch of name.trim().toLocaleLowerCase()) h = (h * 31 + ch.codePointAt(0)!) >>> 0;
  return MONO_TONES[h % MONO_TONES.length];
}

/** A friend's name with quick picks from names used before. */
export function PersonField({ value, onChange, names, label }: { value: string; onChange: (v: string) => void; names: string[]; label?: string }) {
  const { t } = useTranslation();
  return (
    <div className="flex flex-col gap-2">
      <input
        value={value}
        maxLength={60}
        onChange={(e) => onChange(e.target.value)}
        placeholder={t("ious.personPlaceholder")}
        aria-label={label ?? t("ious.person")}
        className="min-h-11 w-full rounded-xl border border-line bg-card px-3 text-[15px] outline-none"
      />
      {names.length ? (
        <div className="flex flex-wrap gap-1.5">
          {names.map((n) => (
            <Chip key={n} size="sm" on={n === value.trim()} onClick={() => onChange(n)}>
              {n}
            </Chip>
          ))}
        </div>
      ) : null}
    </div>
  );
}
