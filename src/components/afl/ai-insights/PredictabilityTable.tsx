import React, { useEffect, useMemo, useState } from "react";
import { Lock, X } from "lucide-react";
import type { PredictRow, PremiumMode } from "./types";
import { confLabel, volLabel } from "./utils";

/* -------------------------------------------------------------------------- */
/* TYPES                                                                      */
/* -------------------------------------------------------------------------- */

type Chip = "all" | "safe" | "ceiling" | "risky";

/* -------------------------------------------------------------------------- */
/* CONSTANTS                                                                  */
/* -------------------------------------------------------------------------- */

const FREE_ROWS = 3;
const TOTAL_ROWS = 10;
const PER_TEAM = 5;

/* -------------------------------------------------------------------------- */
/* HELPERS                                                                    */
/* -------------------------------------------------------------------------- */

const clamp = (n: number, min = 0, max = 1) =>
  Math.min(max, Math.max(min, n));

const pct = (n: number) => Math.round(clamp(n) * 100);

function rangeBarWidth(r: PredictRow) {
  if (
    typeof r.rangeLow !== "number" ||
    typeof r.rangeHigh !== "number" ||
    r.rangeHigh <= r.rangeLow
  )
    return 0;
  return pct((r.rangeHigh - r.rangeLow) / r.rangeHigh);
}

function teamBadge(team: string) {
  return (
    <span className="inline-flex items-center rounded-full border border-white/10 bg-white/5 px-2 py-0.5 text-[10px] text-white/70">
      {team}
    </span>
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
  hint?: string;
  contextLabel?: string;
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
    unlockLabel,
  } = props;

  const locked = mode !== "premium";
  const UNLOCK_LABEL = unlockLabel ?? "Unlock Neeko+";

  const [chip, setChip] = useState<Chip>("all");
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState<PredictRow | null>(null);

  /* -------------------------------------------------------------------------- */
  /* DEFAULT CHIP                                                              */
  /* -------------------------------------------------------------------------- */

  useEffect(() => {
    const s = statLabel.toLowerCase();
    if (s.includes("goal")) setChip("ceiling");
    else if (s.includes("disposal")) setChip("safe");
    else setChip("all");
  }, [statLabel]);

  /* -------------------------------------------------------------------------- */
  /* FILTER + RANK                                                             */
  /* -------------------------------------------------------------------------- */

  const ranked = useMemo(() => {
    let r = rows;

    if (chip === "safe") {
      r = r.filter(
        (x) => x.confidence01 >= 0.7 && x.volatility01 <= 0.4
      );
    }
    if (chip === "ceiling") {
      r = r.filter((x) => x.volatility01 >= 0.65);
    }
    if (chip === "risky") {
      r = r.filter((x) => x.confidence01 <= 0.45);
    }

    return [...r].sort((a, b) => b.confidence01 - a.confidence01);
  }, [rows, chip]);

  /* -------------------------------------------------------------------------- */
  /* TEAM SPLIT (5 + 5)                                                        */
  /* -------------------------------------------------------------------------- */

  const { homeTeam, awayTeam, visible } = useMemo(() => {
    if (!ranked.length) {
      return { homeTeam: "", awayTeam: "", visible: [] as PredictRow[] };
    }

    const home = ranked[0].team;
    const away = ranked.find((r) => r.team !== home)?.team ?? "";

    const homeRows = ranked.filter((r) => r.team === home).slice(0, PER_TEAM);
    const awayRows = ranked.filter((r) => r.team === away).slice(0, PER_TEAM);

    return {
      homeTeam: home,
      awayTeam: away,
      visible: [...homeRows, ...awayRows].slice(0, TOTAL_ROWS),
    };
  }, [ranked]);

  const isLockedRow = (i: number) => locked && i >= FREE_ROWS;

  /* -------------------------------------------------------------------------- */
  /* AI COPY                                                                   */
  /* -------------------------------------------------------------------------- */

  function aiSentence(r: PredictRow) {
    const c = r.confidence01;
    const v = r.volatility01;

    if (c >= 0.72 && v <= 0.4) {
      return "Strong role stability with repeatable scoring output. Expect a reliable floor unless game flow or role shifts materially.";
    }
    if (v >= 0.65) {
      return "High-variance profile with ceiling outcomes driven by matchup and game flow. Upside is real, but volatility is elevated.";
    }
    if (c <= 0.45) {
      return "Wide outcome distribution caused by role uncertainty or opposition pressure. Best suited to contrarian builds.";
    }
    return "Balanced profile with moderate confidence and variability. Suitable for neutral game scripts.";
  }

  /* -------------------------------------------------------------------------- */
  /* MODAL                                                                     */
  /* -------------------------------------------------------------------------- */

  function closeModal() {
    setOpen(false);
    setSelected(null);
  }

  useEffect(() => {
    if (!open) return;

    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") closeModal();
    };

    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", onKey);

    return () => {
      document.body.style.overflow = "";
      window.removeEventListener("keydown", onKey);
    };
  }, [open]);

  /* -------------------------------------------------------------------------- */
  /* RENDER                                                                    */
  /* -------------------------------------------------------------------------- */

  return (
    <div className="grid gap-4">
      {/* SNAPSHOT */}
      {insight && (
        <div className="rounded-xl border border-amber-400/20 bg-amber-500/10 px-4 py-3">
          <div className="text-[11px] uppercase tracking-wide text-amber-200/80">
            {contextLabel ?? "AI Round Snapshot"} · {statLabel}
          </div>
          <div className="mt-1 text-sm text-amber-50/90">{insight}</div>
          {matchContext && (
            <div className="mt-1 text-xs text-amber-100/50">
              Adjusted for {matchContext}
            </div>
          )}
        </div>
      )}

      {/* TABLE */}
      <div className="overflow-hidden rounded-xl border border-white/10">
        <div className="grid grid-cols-[40px_1.4fr_1fr_2fr] bg-[#0b0f18] px-4 py-2 text-[11px] uppercase text-white/50">
          <div>#</div>
          <div>Player</div>
          <div>Range</div>
          <div>AI Insight</div>
        </div>

        {visible.map((r, i) => {
          const lockedRow = isLockedRow(i);
          const isDivider = i === PER_TEAM && awayTeam;

          return (
            <React.Fragment key={r.id}>
              {isDivider && (
                <div className="px-4 py-2 text-[11px] uppercase tracking-wide text-white/40 bg-white/5">
                  {awayTeam}
                </div>
              )}

              <button
                onClick={() => {
                  if (lockedRow) return;
                  setSelected(r);
                  setOpen(true);
                }}
                className="relative grid w-full grid-cols-[40px_1.4fr_1fr_2fr] px-4 py-3 text-left hover:bg-white/5"
              >
                <div className="text-xs text-white/40">#{i + 1}</div>

                <div className={lockedRow ? "blur-sm" : ""}>
                  <div className="font-medium">{r.name}</div>
                  <div className="mt-1 flex gap-2 text-xs">
                    {teamBadge(r.team)}
                    <span className="rounded-full bg-emerald-500/15 px-2 py-0.5 text-emerald-300">
                      {confLabel(r.confidence01)}
                    </span>
                    <span className="rounded-full bg-sky-500/15 px-2 py-0.5 text-sky-300">
                      {volLabel(r.volatility01)}
                    </span>
                  </div>
                </div>

                <div className={lockedRow ? "blur-sm" : ""}>
                  <div className="flex justify-between text-xs text-white/60">
                    <span>{Math.round(r.rangeLow)}</span>
                    <span>{Math.round(r.rangeHigh)}</span>
                  </div>
                  <div className="mt-1 h-2 rounded-full bg-white/10">
                    <div
                      className="h-2 rounded-full bg-gradient-to-r from-amber-400 to-amber-300"
                      style={{ width: `${rangeBarWidth(r)}%` }}
                    />
                  </div>
                </div>

                <div className={`text-white/70 ${lockedRow ? "blur-sm" : ""}`}>
                  {aiSentence(r)}
                </div>

                {lockedRow && (
                  <div className="absolute inset-0 flex items-center justify-center bg-black/40 backdrop-blur">
                    <div className="flex items-center gap-2 rounded-full border border-amber-400/30 bg-amber-500/20 px-3 py-1 text-xs text-amber-200">
                      <Lock className="h-3.5 w-3.5" />
                      Neeko+
                    </div>
                  </div>
                )}
              </button>
            </React.Fragment>
          );
        })}
      </div>

      {/* MODAL */}
      {open && selected && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          onMouseDown={closeModal}
        >
          <div className="absolute inset-0 bg-black/70" />
          <div
            className="relative w-full max-w-lg rounded-2xl border border-white/10 bg-[#0b0f18] p-5"
            onMouseDown={(e) => e.stopPropagation()}
          >
            <div className="flex justify-between">
              <div>
                <div className="text-lg font-semibold">{selected.name}</div>
                <div className="mt-1 text-xs text-white/60">
                  {selected.team} · {statLabel}
                </div>
              </div>
              <button onClick={closeModal}>
                <X className="h-5 w-5 text-white/70" />
              </button>
            </div>

            <div className="mt-4 text-sm text-white/80">
              {aiSentence(selected)}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
