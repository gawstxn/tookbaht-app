"use client";

import { useLayoutEffect, useRef, type InputHTMLAttributes } from "react";

/** "1234567.5" → "1,234,567.5" (the raw text stays without commas). */
export function groupDigits(raw: string): string {
  if (!raw) return "";
  const [int, dec] = raw.split(".");
  const grouped = int.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  return dec !== undefined ? `${grouped}.${dec}` : grouped;
}

/**
 * Money field that shows thousands separators while typing. `value` is the
 * raw text ("10000.5"); onChange gets the raw text too (commas removed), so
 * callers keep their own parsing. The caret stays where the user was typing.
 */
export function BahtInput({
  value,
  onChange,
  ...rest
}: Omit<InputHTMLAttributes<HTMLInputElement>, "value" | "onChange" | "inputMode"> & {
  value: string;
  onChange: (e: { target: { value: string } }) => void;
}) {
  const ref = useRef<HTMLInputElement>(null);
  // Digits (and the dot) before the caret, to put it back after regrouping.
  const caret = useRef<number | null>(null);

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el || caret.current === null || document.activeElement !== el) return;
    let left = caret.current;
    let i = 0;
    while (i < el.value.length && left > 0) {
      if (/[0-9.]/.test(el.value[i])) left--;
      i++;
    }
    el.setSelectionRange(i, i);
    caret.current = null;
  });

  return (
    <input
      {...rest}
      ref={ref}
      inputMode="decimal"
      value={groupDigits(value)}
      onChange={(e) => {
        const el = e.target;
        const pos = el.selectionStart ?? el.value.length;
        caret.current = el.value.slice(0, pos).replace(/[^0-9.]/g, "").length;
        onChange({ target: { value: el.value.replace(/,/g, "") } });
      }}
    />
  );
}
