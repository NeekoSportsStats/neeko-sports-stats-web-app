import React, { useMemo, useState } from "react";
import { Lock } from "lucide-react";
import type { PredictRow, PremiumMode } from "./types";
import { confLabel, fmtRange, volLabel } from "./utils";

export default function PredictabilityTable(props: {
  rows: PredictRow[];
  mode: PremiumMode;
  maxRows?: number;
  hint?: string;
  insight?: string;
  contextLabel?: string;
}) {
  const { rows, mode, maxRows = 12, hint, insight, contextLabel } = props;
  const locked = mode !== "premium";
  const [q, setQ] = useState("");

  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase();
    const r = s ? rows.filter((x) => x.name.toLowerCase().includes(s)) : rows;
    return r.slice(0, maxRows);
  }, [rows, q, maxRows]);

  return (
    <div className="grid gap-3">
    {insight ? (
      <div className="rounded-2xl border border-amber-400/15 bg-amber-500/10 p-3 sm:p-4">
        <div className="flex items-start gap-3">
          <div className="mt-0.5 inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-amber-400/20 bg-black/20">
            <span className="text-amber-200">🧠</span>
          </div>
          <div className="min-w-0">
            {contextLabel ? (
              <div className="text-[11px] uppercase tracking-wide text-amber-200/80">
                {contextLabel}
              </div>
            ) : null}
            <div className="mt-0.5 text-sm text-amber-50/90">{insight}</div>
          </div>
        </div>
      </div>
    ) : null}

      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="text-sm text-white/70">{hint ?? "Search"}</div>
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search…"
          className="w-48 rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-sm text-white placeholder:text-white/35 outline-none focus:border-amber-400/35"
        />
      </div>

      <div className="overflow-hidden rounded-2xl border border-white/10">
        <div className="grid grid-cols-[1.2fr_0.9fr_0.9fr_1.6fr] bg-white/5 px-3 py-2 text-[11px] uppercase tracking-wide text-white/55">
          <div>Name</div>
          <div>Range</div>
          <div>Signals</div>
          <div>AI Insight</div>
        </div>

        <div className="divide-y divide-white/10">
          {filtered.map((r) => (
            <div key={r.id} className="grid grid-cols-[1.2fr_0.9fr_0.9fr_1.6fr] px-3 py-3">
              <div className="min-w-0">
                <div className="truncate text-sm font-medium text-white">{r.name}</div>
                <div className="mt-1 flex flex-wrap gap-1.5 text-[11px] text-white/70">
                  <span className="rounded-full border border-white/10 bg-white/5 px-2 py-0.5">
                    Confidence: <span className="text-white">{confLabel(r.confidence01)}</span>
                  </span>
                  <span className="rounded-full border border-white/10 bg-white/5 px-2 py-0.5">
                    Volatility: <span className="text-white">{volLabel(r.volatility01)}</span>
                  </span>
                </div>
              </div>

              <div className="flex items-center">
                {locked ? (
                  <span className="inline-flex items-center gap-1 rounded-full border border-amber-400/25 bg-amber-500/10 px-2 py-0.5 text-[11px] text-amber-200">
                    <Lock className="h-3 w-3" /> locked
                  </span>
                ) : (
                  <span className="text-sm text-white/90">{fmtRange(r.rangeLow, r.rangeHigh)}</span>
                )}
              </div>

              <div className="flex items-center">
                <div className="grid gap-1">
                  <div className="text-[12px] text-white/85">{confLabel(r.confidence01)}</div>
                  <div className="text-[12px] text-white/65">{volLabel(r.volatility01)}</div>
                </div>
              </div>

              <div className="relative">
                {locked ? (
                  <div className="relative select-none">
                    <div className="line-clamp-2 blur-[6px] opacity-80 text-sm text-white/80">
                      {r.ai}
                    </div>
                    <div className="pointer-events-none absolute inset-0 rounded-xl bg-gradient-to-r from-black/0 via-black/10 to-black/0" />
                  </div>
                ) : (
                  <div className="line-clamp-2 text-sm text-white/80">{r.ai}</div>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      {locked ? (
        <div className="rounded-xl border border-amber-400/20 bg-amber-500/10 px-3 py-2 text-sm text-amber-100/90">
          Unlock ranges + full AI explanations with <span className="font-semibold">Neeko+</span>.
        </div>
      ) : null}
    </div>
  );
}
