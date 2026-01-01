import React, { useMemo, useState } from "react";
import { Lock } from "lucide-react";
import type { ConsistencyRow, PremiumMode } from "./types";
import { clamp } from "./utils";

function meter(v01: number) {
  const w = Math.round(clamp(v01, 0, 1) * 100);
  return (
    <div className="h-2 w-full overflow-hidden rounded-full bg-white/10">
      <div className="h-full bg-amber-400/60" style={{ width: `${w}%` }} />
    </div>
  );
}

export default function ConsistencyList(props: { rows: ConsistencyRow[]; mode: PremiumMode; maxRows?: number; hideSearch?: boolean; titleLeft?: string }) {
  const locked = props.mode !== "premium";
  const [q, setQ] = useState("");

  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase();
    const r = s ? props.rows.filter((x) => x.name.toLowerCase().includes(s)) : props.rows;
    return r.slice(0, props.maxRows ?? 10);
  }, [props.rows, q, props.maxRows]);

  return (
    <div className="grid gap-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="text-sm text-white/70">{props.titleLeft ?? "Searchable list"}</div>
        {props.hideSearch ? null : (
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search…"
          className="w-48 rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-sm text-white placeholder:text-white/35 outline-none focus:border-amber-400/35"
        />
      )}
      </div>

      <div className="grid gap-2">
        {filtered.map((r) => (
          <div key={r.id} className="rounded-2xl border border-white/10 bg-white/5 p-3">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="truncate text-sm font-semibold text-white">{r.name}</div>

                <div className="mt-2 grid gap-2 sm:grid-cols-2">
                  <div>
                    <div className="mb-1 flex items-center justify-between text-[11px] text-white/65">
                      <span>Consistency</span>
                      <span className="text-white/80">{Math.round(r.consistency01 * 100)}%</span>
                    </div>
                    {meter(r.consistency01)}
                  </div>

                  <div>
                    <div className="mb-1 flex items-center justify-between text-[11px] text-white/65">
                      <span>Explosiveness</span>
                      <span className="text-white/80">{Math.round(r.explosiveness01 * 100)}%</span>
                    </div>
                    {meter(r.explosiveness01)}
                  </div>
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
                  <div className="line-clamp-2 blur-[6px] opacity-80 text-sm text-white/80">{r.ai}</div>
                  <div className="pointer-events-none absolute inset-0 rounded-xl bg-gradient-to-r from-black/0 via-black/10 to-black/0" />
                </div>
              ) : (
                <div className="line-clamp-2 text-sm text-white/80">{r.ai}</div>
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
