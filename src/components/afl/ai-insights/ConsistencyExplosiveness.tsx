import React, { useMemo, useState } from "react";
import type { ConsistencyExplosivenessRow, PremiumMode } from "./types";
import { CEStack } from "./MetricPills";
import { Lock } from "lucide-react";
import { cx } from "./utils";

export function ConsistencyExplosiveness(props: {
  titleLeft: string;
  rows: ConsistencyExplosivenessRow[];
  mode: PremiumMode;
  maxRows?: number;
}) {
  const { rows, mode, maxRows = 10, titleLeft } = props;
  const locked = mode !== "premium";
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
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search…"
          className="w-48 rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-sm text-white placeholder:text-white/35 outline-none focus:border-amber-400/35"
        />
      </div>

      <div className="grid gap-2">
        {filtered.map((r) => (
          <div key={r.id} className="rounded-2xl border border-white/10 bg-white/5 p-3">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="truncate text-sm font-semibold text-white">{r.name}</div>
                <div className="mt-2">
                  <CEStack consistency01={r.consistency01} explosiveness01={r.explosiveness01} />
                </div>
              </div>

              {locked ? (
                <span className="inline-flex items-center gap-1 rounded-full border border-amber-400/25 bg-amber-500/10 px-2 py-0.5 text-[11px] text-amber-200">
                  <Lock className="h-3 w-3" /> locked
                </span>
              ) : null}
            </div>

            <div className="relative mt-2">
              {locked ? (
                <div className="relative select-none">
                  <div className="line-clamp-2 blur-[6px] opacity-80 text-sm text-white/80">
                    {r.aiSummary}
                  </div>
                  <div className="pointer-events-none absolute inset-0 rounded-xl bg-gradient-to-r from-black/0 via-black/10 to-black/0" />
                </div>
              ) : (
                <div className="line-clamp-2 text-sm text-white/80">{r.aiSummary}</div>
              )}
            </div>
          </div>
        ))}
      </div>

      {locked ? (
        <div className="rounded-xl border border-amber-400/20 bg-amber-500/10 px-3 py-2 text-sm text-amber-100/90">
          Unlock full AI explanations with <span className="font-semibold">Neeko+</span>.
        </div>
      ) : null}
    </div>
  );
}
