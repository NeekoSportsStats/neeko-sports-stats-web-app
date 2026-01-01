import React from "react";
import { Lock } from "lucide-react";
import type { QuarterFlowRow, PremiumMode } from "./types";

function meter(v01: number) {
  const w = Math.round(v01 * 100);
  return (
    <div className="h-2 w-full overflow-hidden rounded-full bg-white/10">
      <div className="h-full bg-amber-400/60" style={{ width: `${w}%` }} />
    </div>
  );
}

export default function QuarterFlowGrid(props: { rows: QuarterFlowRow[]; mode: PremiumMode }) {
  const locked = props.mode !== "premium";
  return (
    <div className="grid gap-3">
      <div className="grid gap-2 sm:grid-cols-2">
        {props.rows.map((r) => (
          <div key={r.q} className="rounded-2xl border border-white/10 bg-white/5 p-3">
            <div className="flex items-center justify-between">
              <div className="text-sm font-semibold text-white">{r.q}</div>
              {locked ? (
                <span className="inline-flex items-center gap-1 rounded-full border border-amber-400/25 bg-amber-500/10 px-2 py-0.5 text-[11px] text-amber-200">
                  <Lock className="h-3 w-3" /> locked
                </span>
              ) : null}
            </div>

            <div className="mt-2 grid gap-2">
              <div>
                <div className="mb-1 flex items-center justify-between text-[11px] text-white/65">
                  <span>Swing Risk</span>
                  <span className="text-white/80">{Math.round(r.swing01 * 100)}%</span>
                </div>
                {meter(r.swing01)}
              </div>

              <div>
                <div className="mb-1 flex items-center justify-between text-[11px] text-white/65">
                  <span>Decisiveness</span>
                  <span className="text-white/80">{Math.round(r.decisive01 * 100)}%</span>
                </div>
                {meter(r.decisive01)}
              </div>

              <div className="relative mt-1">
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
          </div>
        ))}
      </div>

      {locked ? (
        <div className="rounded-xl border border-amber-400/20 bg-amber-500/10 px-3 py-2 text-sm text-amber-100/90">
          Unlock quarter swing risk + AI explanation with <span className="font-semibold">Neeko+</span>.
        </div>
      ) : null}
    </div>
  );
}
