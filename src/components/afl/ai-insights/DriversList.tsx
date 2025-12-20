import React from "react";
import { Lock } from "lucide-react";
import type { DriverRow, PremiumMode } from "./types";
import { clamp } from "./utils";

function meter(v01: number) {
  const w = Math.round(clamp(v01, 0, 1) * 100);
  return (
    <div className="h-2 w-full overflow-hidden rounded-full bg-white/10">
      <div className="h-full bg-amber-400/60" style={{ width: `${w}%` }} />
    </div>
  );
}

export default function DriversList(props: { rows: DriverRow[]; mode: PremiumMode }) {
  const locked = props.mode !== "premium";
  return (
    <div className="grid gap-3">
      <div className="grid gap-2">
        {props.rows.map((d) => (
          <div key={d.key} className="rounded-2xl border border-white/10 bg-white/5 p-3">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="text-sm font-semibold text-white">{d.title}</div>
                <div className="mt-2 grid gap-2 sm:grid-cols-2">
                  <div>
                    <div className="mb-1 flex items-center justify-between text-[11px] text-white/65">
                      <span>Influence</span>
                      <span className="text-white/80">{Math.round(d.influence01 * 100)}%</span>
                    </div>
                    {meter(d.influence01)}
                  </div>
                  <div>
                    <div className="mb-1 flex items-center justify-between text-[11px] text-white/65">
                      <span>Stability</span>
                      <span className="text-white/80">{Math.round(d.stability01 * 100)}%</span>
                    </div>
                    {meter(d.stability01)}
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
                  <div className="line-clamp-2 blur-[6px] opacity-80 text-sm text-white/80">{d.ai}</div>
                  <div className="pointer-events-none absolute inset-0 rounded-xl bg-gradient-to-r from-black/0 via-black/10 to-black/0" />
                </div>
              ) : (
                <div className="line-clamp-2 text-sm text-white/80">{d.ai}</div>
              )}
            </div>
          </div>
        ))}
      </div>

      {locked ? (
        <div className="rounded-xl border border-amber-400/20 bg-amber-500/10 px-3 py-2 text-sm text-amber-100/90">
          Unlock full driver explanations with <span className="font-semibold">Neeko+</span>.
        </div>
      ) : null}
    </div>
  );
}
