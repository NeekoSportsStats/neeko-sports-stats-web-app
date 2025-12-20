import React, { useMemo, useState } from "react";
import type { PredictabilityRow, PremiumMode } from "./types";
import { cx, formatRange, labelConfidence, labelVolatility } from "./utils";
import { ConfidencePill, VolatilityPill } from "./MetricPills";
import { Lock } from "lucide-react";

export function PredictabilityTable(props: {
  titleLeft: string;
  rows: PredictabilityRow[];
  mode: PremiumMode;
  maxRows?: number;
}) {
  const { titleLeft, rows, mode, maxRows = 12 } = props;
  const [query, setQuery] = useState("");

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const r = q ? rows.filter((x) => x.name.toLowerCase().includes(q)) : rows;
    return r.slice(0, maxRows);
  }, [rows, query, maxRows]);

  return (
    <div className="grid gap-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="text-sm text-white/70">{titleLeft}</div>
        <div className="relative">
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search…"
            className="w-48 rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-sm text-white placeholder:text-white/35 outline-none focus:border-amber-400/35"
          />
        </div>
      </div>

      <div className="overflow-hidden rounded-2xl border border-white/10">
        <div className="grid grid-cols-[1.2fr_0.9fr_0.9fr_1.6fr] gap-0 bg-white/5 px-3 py-2 text-[11px] uppercase tracking-wide text-white/55">
          <div>Name</div>
          <div>Range</div>
          <div>Signals</div>
          <div>AI Insight</div>
        </div>

        <div className="divide-y divide-white/10">
          {filtered.map((r) => {
            const locked = mode !== "premium";
            return (
              <div key={r.id} className="grid grid-cols-[1.2fr_0.9fr_0.9fr_1.6fr] gap-0 px-3 py-3">
                <div className="min-w-0">
                  <div className="truncate text-sm font-medium text-white">{r.name}</div>
                  <div className="mt-1 flex flex-wrap gap-1.5">
                    <ConfidencePill value01={r.confidence01} />
                    <VolatilityPill value01={r.volatility01} />
                  </div>
                </div>

                <div className="flex items-center">
                  {locked ? (
                    <span className="inline-flex items-center gap-1 rounded-full border border-amber-400/25 bg-amber-500/10 px-2 py-0.5 text-[11px] text-amber-200">
                      <Lock className="h-3 w-3" /> locked
                    </span>
                  ) : (
                    <span className="text-sm text-white/90">{formatRange(r.rangeLow, r.rangeHigh, 0)}</span>
                  )}
                </div>

                <div className="flex items-center">
                  <div className="grid gap-1">
                    <div className="text-[12px] text-white/85">
                      {labelConfidence(r.confidence01)}
                    </div>
                    <div className="text-[12px] text-white/65">
                      {labelVolatility(r.volatility01)}
                    </div>
                  </div>
                </div>

                <div className="relative">
                  <div className={cx("text-sm text-white/80", locked ? "select-none" : "")}>
                    {locked ? (
                      <div className="relative">
                        <div className="line-clamp-2 blur-[6px] opacity-80">
                          {r.aiSummary}
                        </div>
                        <div className="pointer-events-none absolute inset-0 rounded-xl bg-gradient-to-r from-black/0 via-black/10 to-black/0" />
                      </div>
                    ) : (
                      <div className="line-clamp-2">{r.aiSummary}</div>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {mode !== "premium" ? (
        <div className="rounded-xl border border-amber-400/20 bg-amber-500/10 px-3 py-2 text-sm text-amber-100/90">
          Unlock ranges + full AI explanations with <span className="font-semibold">Neeko+</span>.
        </div>
      ) : null}
    </div>
  );
}
