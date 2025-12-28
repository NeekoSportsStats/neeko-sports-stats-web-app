import React, { useEffect, useMemo, useState } from "react";
import { Lock, X } from "lucide-react";
import type { PredictRow, PremiumMode } from "./types";
import { confLabel, volLabel } from "./utils";

/* -------------------------------------------------------------------------- */
/* CONSTANTS                                                                  */
/* -------------------------------------------------------------------------- */

const FREE_PER_TEAM = 2;
const TOTAL_PER_TEAM = 5;

/* -------------------------------------------------------------------------- */
/* TYPES                                                                      */
/* -------------------------------------------------------------------------- */

type Chip = "all" | "safe" | "ceiling" | "risky";

type PlaceholderRow = {
  __placeholder: true;
  key: string;
};

/* -------------------------------------------------------------------------- */
/* COMPONENT                                                                  */
/* -------------------------------------------------------------------------- */

export default function PredictabilityTable(props: {
  rows: PredictRow[];
  mode: PremiumMode;
  statLabel: string;
  matchContext?: string;
  insight?: string;
  hint?: string;
  contextLabel?: string;
  onUnlock?: () => void;
  unlockLabel?: string;
}) {
  const {
    rows,
    mode,
    statLabel,
    matchContext,
    insight,
    hint,
    contextLabel,
    onUnlock,
    unlockLabel,
  } = props;

  const locked = mode !== "premium";
  const UNLOCK_LABEL = unlockLabel ?? "Unlock Neeko+";

  /* -------------------------------------------------------------------------- */
  /* STATE                                                                     */
  /* -------------------------------------------------------------------------- */

  const [chip, setChip] = useState<Chip>("all");
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState<PredictRow | null>(null);

  /* -------------------------------------------------------------------------- */
  /* GROUP BY TEAM                                                             */
  /* -------------------------------------------------------------------------- */

  const byTeam = useMemo(() => {
    const map = new Map<string, PredictRow[]>();
    for (const r of rows) {
      if (!map.has(r.team)) map.set(r.team, []);
      map.get(r.team)!.push(r);
    }
    return map;
  }, [rows]);

  /* -------------------------------------------------------------------------- */
  /* SORT + FILTER (WITHIN TEAM)                                                */
  /* -------------------------------------------------------------------------- */

  const processed = useMemo(() => {
    const out: Array<PredictRow | PlaceholderRow> = [];

    for (const [, teamRows] of byTeam) {
      let r = [...teamRows];

      if (chip === "safe") {
        r = r.filter((x) => x.confidence01 >= 0.7 && x.volatility01 <= 0.4);
      } else if (chip === "ceiling") {
        r = r.filter((x) => x.volatility01 >= 0.65);
      } else if (chip === "risky") {
        r = r.filter((x) => x.confidence01 <= 0.45);
      }

      r.sort((a, b) => b.confidence01 - a.confidence01);
      r = r.slice(0, TOTAL_PER_TEAM);

      const visible = locked ? r.slice(0, FREE_PER_TEAM) : r;
      out.push(...visible);

      if (locked) {
        const hidden = r.length - visible.length;
        for (let i = 0; i < hidden; i++) {
          out.push({ __placeholder: true, key: `${r[0]?.team}-locked-${i}` });
        }
      }
    }

    return out;
  }, [byTeam, chip, locked]);

  /* -------------------------------------------------------------------------- */
  /* HELPERS                                                                   */
  /* -------------------------------------------------------------------------- */

  function fmtRange(r: PredictRow) {
    if (typeof r.rangeLow === "number" && typeof r.rangeHigh === "number") {
      return `${r.rangeLow} → ${r.rangeHigh}`;
    }
    return "—";
  }

  function closeModal() {
    setOpen(false);
    setSelected(null);
  }

  /* -------------------------------------------------------------------------- */
  /* MODAL ESC + SCROLL LOCK                                                    */
  /* -------------------------------------------------------------------------- */

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && closeModal();
    window.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [open]);
  /* -------------------------------------------------------------------------- */
  /* RENDER                                                                     */
  /* -------------------------------------------------------------------------- */

  return (
    <div className="grid gap-4">
      {/* AI SNAPSHOT */}
      {insight && (
        <div className="rounded-xl border border-amber-400/20 bg-amber-500/10 px-4 py-3">
          <div className="text-[11px] uppercase tracking-wide text-amber-200/80">
            {contextLabel ?? "AI Player Predictability"} · {statLabel}
          </div>
          <div className="mt-1 text-sm text-amber-50/90">{insight}</div>
          {matchContext && (
            <div className="mt-1 text-xs text-amber-100/50">
              Adjusted for {matchContext}
            </div>
          )}
        </div>
      )}

      {/* FILTERS */}
      <div className="flex flex-wrap gap-2">
        {(["all", "safe", "ceiling", "risky"] as Chip[]).map((c) => (
          <button
            key={c}
            onClick={() => setChip(c)}
            className={`rounded-full px-3 py-1 text-xs ${
              chip === c
                ? "bg-amber-500/20 text-amber-200 border border-amber-400/30"
                : "border border-white/10 text-white/60 hover:bg-white/5"
            }`}
          >
            {c === "all"
              ? "All"
              : c === "safe"
              ? "Safe Picks"
              : c === "ceiling"
              ? "Ceiling Plays"
              : "Risky"}
          </button>
        ))}
      </div>

      {/* TABLE */}
      <div className="overflow-hidden rounded-xl border border-white/10">
        <div className="grid grid-cols-[40px_1.4fr_0.8fr_2fr] bg-[#0b0f18] px-3 py-2 text-[11px] uppercase tracking-wide text-white/50">
          <div>#</div>
          <div>Player</div>
          <div className="text-right pr-2">Range</div>
          <div>Insight</div>
        </div>

        <div className="divide-y divide-white/10">
          {processed.map((row, i) => {
            if ((row as PlaceholderRow).__placeholder) {
              return (
                <div
                  key={(row as PlaceholderRow).key}
                  className="grid grid-cols-[40px_1.4fr_0.8fr_2fr] px-3 py-3 opacity-50 blur-[2px]"
                >
                  <div>—</div>
                  <div className="h-4 w-32 rounded bg-white/10" />
                  <div className="text-right pr-2">—</div>
                  <div className="h-3 w-40 rounded bg-white/10" />
                </div>
              );
            }

            const r = row as PredictRow;
            const w = Math.round(r.confidence01 * 100);

            return (
              <button
                key={r.id}
                onClick={() => {
                  setSelected(r);
                  setOpen(true);
                }}
                className="grid grid-cols-[40px_1.4fr_0.8fr_2fr] px-3 py-3 text-left hover:bg-white/6"
              >
                <div className="text-xs text-white/40">#{i + 1}</div>

                <div>
                  <div className="text-sm font-medium text-white">
                    {r.name}
                  </div>
                  <div className="mt-1 flex gap-1 text-[11px] text-white/60">
                    <span className="rounded-full border border-white/10 px-2 py-0.5">
                      {confLabel(r.confidence01)}
                    </span>
                    <span className="rounded-full border border-white/10 px-2 py-0.5">
                      {volLabel(r.volatility01)}
                    </span>
                  </div>
                  <div className="mt-2 h-[6px] w-full rounded-full bg-white/10">
                    <div
                      className="h-[6px] rounded-full bg-amber-400"
                      style={{ width: `${w}%` }}
                    />
                  </div>
                </div>

                <div className="flex items-center justify-end pr-2 text-sm text-white">
                  {fmtRange(r)}
                </div>

                <div className="text-sm text-white/70">{r.ai}</div>
              </button>
            );
          })}
        </div>
      </div>

      {/* CTA */}
      {locked && (
        <div className="rounded-xl border border-amber-400/20 bg-amber-500/10 px-3 py-2 flex items-center justify-between gap-3 backdrop-blur">
          <div className="text-sm text-amber-100">
            Unlock full player predictability with Neeko+.
          </div>
          <button
            onClick={onUnlock}
            className="inline-flex items-center gap-2 rounded-full border border-amber-400/30 bg-amber-500/20 px-3 py-1.5"
          >
            <Lock className="h-4 w-4" />
            {UNLOCK_LABEL}
          </button>
        </div>
      )}

      {/* MODAL (UNCHANGED) */}
      {open && selected && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          onMouseDown={closeModal}
        >
          <div className="absolute inset-0 bg-black/70" />
          <div
            className="relative w-full max-w-lg rounded-2xl border border-white/10 bg-[#0b0f18] p-4"
            onMouseDown={(e) => e.stopPropagation()}
          >
            <div className="flex justify-between">
              <div>
                <div className="text-base font-semibold text-white">
                  {selected.name}
                </div>
                <div className="text-xs text-white/60">
                  {statLabel}
                  {matchContext ? ` · ${matchContext}` : ""}
                </div>
              </div>
              <button onClick={closeModal}>
                <X className="h-4 w-4 text-white/70" />
              </button>
            </div>

            <div className="mt-4 rounded-xl border border-white/10 bg-white/5 p-3">
              <div className="text-sm font-semibold text-white">
                {fmtRange(selected)}
              </div>
              <div className="mt-2 h-2 rounded-full bg-white/10">
                <div
                  className="h-2 rounded-full bg-amber-400"
                  style={{ width: `${Math.round(selected.confidence01 * 100)}%` }}
                />
              </div>
              <div className="mt-3 text-sm text-white/75">
                {selected.ai}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
