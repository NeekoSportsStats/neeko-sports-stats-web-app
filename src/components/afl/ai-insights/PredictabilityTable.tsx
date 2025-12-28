import React, { useEffect, useMemo, useState } from "react";
import { Lock, X } from "lucide-react";
import type { PredictRow, PremiumMode } from "./types";
import { confLabel, volLabel } from "./utils";

/* -------------------------------------------------------------------------- */
/* TYPES                                                                      */
/* -------------------------------------------------------------------------- */

type Chip = "all" | "safe" | "ceiling" | "risky";

/* -------------------------------------------------------------------------- */
/* HELPERS                                                                    */
/* -------------------------------------------------------------------------- */

const cx = (...c: Array<string | false | undefined>) =>
  c.filter(Boolean).join(" ");

function rangeLabel(r: PredictRow) {
  if (typeof r.rangeLow === "number" && typeof r.rangeHigh === "number") {
    return `${Math.round(r.rangeLow)}–${Math.round(r.rangeHigh)}`;
  }
  if (typeof r.rangeLow === "number") return `${Math.round(r.rangeLow)}+`;
  if (typeof r.rangeHigh === "number") return `≤${Math.round(r.rangeHigh)}`;
  return "—";
}

/* -------------------------------------------------------------------------- */
/* DISTRIBUTION STRIP                                                         */
/* -------------------------------------------------------------------------- */

function DistributionStrip(props: {
  low?: number;
  high?: number;
  confidence01: number;
  locked?: boolean;
}) {
  const { low, high, confidence01, locked } = props;

  if (locked) {
    return (
      <div className="mt-2 h-[6px] rounded-full bg-white/10 relative overflow-hidden">
        <div className="absolute inset-0 bg-white/20 blur-sm" />
      </div>
    );
  }

  if (typeof low !== "number" || typeof high !== "number") {
    return (
      <div className="mt-2 h-[6px] rounded-full bg-white/10" />
    );
  }

  const width = Math.max(8, Math.min(100, high - low));
  const medianPos = Math.round(confidence01 * 100);

  return (
    <div className="mt-2 relative h-[6px] rounded-full bg-white/10">
      {/* Range bar */}
      <div
        className="absolute top-0 h-[6px] rounded-full bg-amber-400/70"
        style={{
          left: "0%",
          width: `${width}%`,
        }}
      />

      {/* Median marker */}
      <div
        className="absolute top-[-2px] h-[10px] w-[2px] bg-white"
        style={{ left: `${medianPos}%` }}
      />
    </div>
  );
}
/* -------------------------------------------------------------------------- */
/* COMPONENT                                                                  */
/* -------------------------------------------------------------------------- */

export default function PredictabilityTable(props: {
  rows: PredictRow[];
  mode: PremiumMode;
  statLabel: string;
  matchContext?: string;
  insight?: string;
}) {
  const { rows, mode, statLabel, matchContext, insight } = props;

  const isPremium = mode === "premium";
  const MAX_PER_TEAM = 5;
  const FREE_PER_TEAM = 2;

  const [chip, setChip] = useState<Chip>("all");
  const [open, setOpen] = useState<PredictRow | null>(null);

  const filtered = useMemo(() => {
    if (chip === "safe") {
      return rows.filter(
        (r) => r.confidence01 >= 0.7 && r.volatility01 <= 0.4
      );
    }
    if (chip === "ceiling") {
      return rows.filter((r) => r.volatility01 >= 0.65);
    }
    if (chip === "risky") {
      return rows.filter((r) => r.confidence01 <= 0.45);
    }
    return rows;
  }, [rows, chip]);

  const grouped = useMemo(() => {
    const out: Record<string, PredictRow[]> = {};
    for (const r of filtered) {
      const t = r.team ?? "Unknown";
      if (!out[t]) out[t] = [];
      if (out[t].length < MAX_PER_TEAM) out[t].push(r);
    }
    return out;
  }, [filtered]);

  return (
    <div className="grid gap-5">
      {/* TABLE */}
      <div className="overflow-hidden rounded-xl border border-white/10">
        <div className="grid grid-cols-[1.6fr_0.8fr_2.2fr] bg-[#0b0f18] px-4 py-2 text-[11px] uppercase tracking-wide text-white/40">
          <div>Player</div>
          <div className="text-right">Range</div>
          <div>Insight</div>
        </div>

        <div className="divide-y divide-white/10">
          {Object.entries(grouped).map(([team, list]) => {
            let freeUsed = 0;

            return (
              <div key={team}>
                {/* TEAM HEADER */}
                <div className="px-4 py-2 bg-white/[0.035] border-y border-white/10">
                  <div className="text-xs font-semibold text-white/80 uppercase">
                    {team}
                  </div>
                  <div className="text-[11px] text-white/40">
                    Predictability distribution · {FREE_PER_TEAM} free
                  </div>
                </div>

                {list.map((r) => {
                  const free = freeUsed < FREE_PER_TEAM;
                  if (free) freeUsed++;

                  const locked = !isPremium && !free;
                  const w = Math.round(r.confidence01 * 100);

                  return (
                    <button
                      key={r.id}
                      onClick={() => !locked && setOpen(r)}
                      className={cx(
                        "grid grid-cols-[1.6fr_0.8fr_2.2fr] px-4 py-3 text-left transition",
                        locked
                          ? "cursor-default"
                          : "hover:bg-white/5"
                      )}
                    >
                      {/* PLAYER */}
                      <div>
                        <div className="flex items-center gap-2">
                          <div className="text-sm font-medium text-white">
                            {r.name}
                          </div>
                          {locked && (
                            <span className="rounded-full border border-amber-400/30 bg-amber-500/10 px-2 py-0.5 text-[10px] text-amber-200">
                              <Lock className="h-3 w-3 inline mr-1" />
                              locked
                            </span>
                          )}
                        </div>

                        <div className="mt-1 flex gap-1 text-[11px] text-white/60">
                          <span className="rounded-full border border-white/10 px-2 py-0.5">
                            {confLabel(r.confidence01)}
                          </span>
                          <span className="rounded-full border border-white/10 px-2 py-0.5">
                            {volLabel(r.volatility01)}
                          </span>
                        </div>

                        {/* DISTRIBUTION STRIP */}
                        <DistributionStrip
                          low={r.rangeLow}
                          high={r.rangeHigh}
                          confidence01={r.confidence01}
                          locked={locked}
                        />
                      </div>

                      {/* RANGE */}
                      <div
                        className={cx(
                          "flex items-center justify-end text-sm font-medium",
                          locked
                            ? "blur-sm text-white/40"
                            : "text-white"
                        )}
                      >
                        {rangeLabel(r)}
                      </div>

                      {/* AI */}
                      <div
                        className={cx(
                          "text-sm text-white/70",
                          locked && "blur-sm"
                        )}
                      >
                        {r.ai}
                      </div>
                    </button>
                  );
                })}
              </div>
            );
          })}
        </div>
      </div>

      {/* MODAL — enhanced with full distribution */}
      {open && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          onMouseDown={() => setOpen(null)}
        >
          <div className="absolute inset-0 bg-black/70" />
          <div
            className="relative w-full max-w-lg rounded-2xl border border-white/10 bg-[#0b0f18] p-4"
            onMouseDown={(e) => e.stopPropagation()}
          >
            <div className="flex justify-between">
              <div>
                <div className="text-base font-semibold text-white">
                  {open.name}
                </div>
                <div className="text-xs text-white/60">{statLabel}</div>
              </div>
              <button onClick={() => setOpen(null)}>
                <X className="h-4 w-4 text-white/70" />
              </button>
            </div>

            <div className="mt-4 rounded-xl border border-white/10 bg-white/5 p-3">
              <div className="text-lg font-semibold text-white">
                {rangeLabel(open)}
              </div>

              <DistributionStrip
                low={open.rangeLow}
                high={open.rangeHigh}
                confidence01={open.confidence01}
              />

              <div className="mt-3 text-sm text-white/75">{open.ai}</div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
