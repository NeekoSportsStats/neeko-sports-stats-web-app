import { MWSortKey } from "./types";

interface Props {
  value: MWSortKey;
  onChange: (key: MWSortKey) => void;
}

const OPTIONS: { key: MWSortKey; label: string; description: string }[] = [
  { key: "value_score",  label: "Value Score",       description: "Overall value relative to price" },
  { key: "price_rise",   label: "Biggest Rise",      description: "Highest expected price increase" },
  { key: "price_fall",   label: "Biggest Drop",      description: "Steepest expected price fall" },
  { key: "cash_gen",     label: "Cash Generation",   description: "Best cash cow growth rate" },
  { key: "projection",   label: "Projection",        description: "Highest projected fantasy score" },
  { key: "confidence",   label: "Confidence",        description: "Highest projection confidence" },
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
            title={opt.description}
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
