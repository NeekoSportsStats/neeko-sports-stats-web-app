export type SortKey = "trade_score" | "projection" | "expected_price_change" | "breakeven" | "risk_pct";

interface Props {
  value: SortKey;
  onChange: (key: SortKey) => void;
}

const OPTIONS: { key: SortKey; label: string }[] = [
  { key: "trade_score",            label: "Trade Score" },
  { key: "projection",             label: "Projection" },
  { key: "expected_price_change",  label: "Price Growth" },
  { key: "breakeven",              label: "Breakeven" },
  { key: "risk_pct",               label: "Risk" },
];

export function MarketWatchSort({ value, onChange }: Props) {
  return (
    <div className="flex items-center gap-2 flex-wrap">
      <span className="text-[10px] text-white/30 uppercase tracking-wider shrink-0">Sort by</span>
      <div className="flex items-center gap-1.5 flex-wrap">
        {OPTIONS.map(opt => (
          <button
            key={opt.key}
            onClick={() => onChange(opt.key)}
            className={`text-[11px] px-2.5 py-1 rounded-lg border transition-colors ${
              value === opt.key
                ? "bg-[#F5C84C]/15 border-[#F5C84C]/30 text-[#F5C84C] font-semibold"
                : "bg-white/[0.03] border-white/8 text-white/40 hover:text-white/70 hover:border-white/15"
            }`}
          >
            {opt.label}
          </button>
        ))}
      </div>
    </div>
  );
}
