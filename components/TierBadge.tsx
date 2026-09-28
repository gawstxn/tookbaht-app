import type { TIERS } from "@/lib/streak";

type Tier = (typeof TIERS)[number];

const VALUE: Record<Tier["key"], string> = { coin: "10", note20: "20", note50: "50", note100: "100", note500: "500", note1000: "1000" };

/** Light marks on the note's colour: engraving lines, the watermark window, borders. */
const mark = (pct: number) => ({ stroke: `color-mix(in oklab, var(--color-on-hero) ${pct}%, transparent)` });
const fillMark = (pct: number) => ({ fill: `color-mix(in oklab, var(--color-on-hero) ${pct}%, transparent)` });

/**
 * A tier drawn as its money: a gold coin, or a small banknote in the note's
 * colour with its value, an engraved wave and a watermark window. Drawn,
 * not copied, from real notes. `width` sets the size (the shape is 7:4).
 */
export function TierBadge({ tier, width = 56, className }: { tier: Tier; width?: number; className?: string }) {
  const value = VALUE[tier.key];
  return (
    <svg viewBox="0 0 56 32" width={width} height={(width * 32) / 56} aria-hidden="true" className={className} style={{ flexShrink: 0 }}>
      {tier.key === "coin" ? (
        <g>
          <circle cx="28" cy="16" r="15" fill={tier.tone} />
          <circle cx="28" cy="16" r="15" fill="none" strokeWidth="1.2" style={mark(35)} />
          <circle cx="28" cy="16" r="11.2" fill="none" strokeWidth="1" strokeDasharray="1.2 1.4" style={mark(45)} />
          <path d="M17.5 9.5a13 13 0 0 1 9-5" fill="none" strokeWidth="1.6" strokeLinecap="round" style={mark(55)} />
          <text x="28" y="20.2" textAnchor="middle" fontSize="11" fontWeight="700" className="font-mono" style={{ fill: "var(--color-on-hero)" }}>
            {value}
          </text>
        </g>
      ) : (
        <g>
          <rect x="0.5" y="2" width="55" height="28" rx="3.5" fill={tier.tone} />
          <rect x="2.5" y="4" width="51" height="24" rx="2" fill="none" strokeWidth="0.8" style={mark(35)} />
          {/* Engraved waves across the note. */}
          <path d="M3 21c5-4 9 4 14 0s9-4 14 0 9 4 14 0 6-3 8-1" fill="none" strokeWidth="0.7" style={mark(28)} />
          <path d="M3 24c5-4 9 4 14 0s9-4 14 0 9 4 14 0 6-3 8-1" fill="none" strokeWidth="0.7" style={mark(20)} />
          {/* Watermark window. */}
          <circle cx="41" cy="14" r="7.5" style={fillMark(18)} />
          <circle cx="41" cy="14" r="5" fill="none" strokeWidth="0.8" style={mark(40)} />
          {/* Security thread. */}
          <path d="M28 4v24" strokeWidth="1" strokeDasharray="2 1.5" style={mark(30)} />
          <text x="5.5" y="12.5" fontSize={value.length > 3 ? 7.5 : 9} fontWeight="700" className="font-mono" style={{ fill: "var(--color-on-hero)" }}>
            {value}
          </text>
          <text x="51" y="26" textAnchor="end" fontSize="5" fontWeight="700" className="font-mono" style={fillMark(70)}>
            {value}
          </text>
        </g>
      )}
    </svg>
  );
}
