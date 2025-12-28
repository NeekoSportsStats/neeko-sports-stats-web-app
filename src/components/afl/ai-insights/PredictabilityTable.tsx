import React, { useEffect, useMemo, useState } from "react";
import { Lock, X } from "lucide-react";
import type { PredictRow, PremiumMode } from "./types";
import { confLabel, volLabel } from "./utils";

/* -------------------------------------------------------------------------- */
/* TYPES                                                                      */
/* -------------------------------------------------------------------------- */

type Chip = "all" | "safe" | "ceiling" | "risky";

type GroupedRow = PredictRow & {
  locked?: boolean;
};

/* -------------------------------------------------------------------------- */
/* HELPERS                                                                    */
/* -------------------------------------------------------------------------- */

const cx = (...c: Array<string | false | undefined>) =>
  c.filter(Boolean).join(" ");

function formatRange(lo?: number, hi?: number) {
  if (typeof lo === "number" && typeof hi === "number") {
    return `${lo}–${hi}`;
  }
  if (typeof lo === "number") return `${lo}–—`;
  if (typeof hi === "number") return `—–${hi}`;
  return "—";
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

  /* ---------------------------------------------------------------------- */
  /* STATE                                                                  */
  /* ---------------------------------------------------------------------- */

  const [chip, setChip] = useState<Chip>("all");
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState<PredictRow | null>(null);

  /* ---------------------------------------------------------------------- */
  /* FILTERING                                                              */
  /* ---------------------------------------------------------------------- */

  const filtered = useMemo(() => {
    let r = [...rows];

    if (chip === "safe") {
      r = r.filter((x) => x.confidence01 >= 0.7 && x.volatility01 <= 0.4);
    }
    if (chip === "ceiling") {
      r = r.filter((x) => x.volatility01 >= 0.65);
    }
    if (chip === "risky") {
      r = r.filter((x) => x.confidence01 <= 0.45);
    }

    return r.sort((a, b) => b.confidence01 - a.confidence01);
  }, [rows, chip]);

  /* ---------------------------------------------------------------------- */
  /* TEAM SPLIT + GATING                                                     */
  /* ---------------------------------------------------------------------- */

  const grouped = useMemo(() => {
    const map = new Map<string, GroupedRow[]>();

    filtered.forEach((r) => {
      const team = r.team ?? "Unknown";
      if (!map.has(team)) map.set(team, []);
      map.get(team)!.push(r);
    });

    return Array.from(map.entries()).map(([team, players]) => {
      const visibleCount = isPremium ? 5 : 2;

      return [
        team,
        players.slice(0, 5).map((p, i) => ({
          ...p,
          locked: !isPremium && i >= visibleCount,
        })),
      ] as const;
    });
  }, [filtered, isPremium]);

  /* ---------------------------------------------------------------------- */
  /* MODAL                                                                  */
  /* ---------------------------------------------------------------------- */

  function closeModal() {
    setOpen(false);
    setSelected(null);
  }

  useEffect(() => {
    if (!open) return;

    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") closeModal();
    };

    window.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [open]);

  /* ---------------------------------------------------------------------- */
  /* RENDER                                                                 */
  /* ---------------------------------------------------------------------- */

  return (
    <section id="player-predictability" className="scroll-mt-28">
      {/* SECTION HEADER */}
      <div className="mb-6">
        <div className="flex items-center gap-3">
          <span className="text-xs font-semibold tracking-widest text-yellow-400">
            1
          </span>
          <h2 className="text-xl font-semibold text-white">
            Player Score Predictability
          </h2>
        </div>

        <p className="mt-1 text-sm text-white/55">
          Expected scoring range and reliability for this matchup
        </p>

        {matchContext && (
          <div className="mt-2 text-xs text-white/45">
            {matchContext} · {statLabel}
          </div>
        )}
      </div>

      {/* AI SNAPSHOT */}
      {insight && (
        <div className="mb-6 rounded-xl border border-yellow-400/25 bg-gradient-to-br from-yellow-500/15 to-black/40 px-4 py-3">
          <div className="text-[11px] uppercase tracking-wider text-yellow-300/80">
            AI Snapshot
          </div>
          <div className="mt-1 text-sm text-white/85 leading-relaxed">
            {insight}
          </div>
        </div>
      )}

      {/* FILTER CHIPS */}
      <div className="mb-4 flex flex-wrap gap-2">
        {(["all", "safe", "ceiling", "risky"] as Chip[]).map((c) => (
          <button
            key={c}
            onClick={() => setChip(c)}
            className={cx(
              "rounded-full px-3 py-1 text-xs border transition",
              chip === c
                ? "bg-yellow-500/20 border-yellow-400/40 text-yellow-300"
                : "border-white/10 text-white/60 hover:bg-white/5"
            )}
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
      <div className="overflow-hidden rounded-xl border border-white/10 bg-black/30">
        {grouped.map(([team, players]) => (
          <div key={team}>
            <div className="bg-black/40 px-4 py-2 text-[11px] font-semibold uppercase tracking-wider text-white/55">
              {team}
            </div>

            {players.map((r) => (
              <button
                key={r.id}
                disabled={r.locked}
                onClick={() => {
                  if (r.locked) return;
                  setSelected(r);
                  setOpen(true);
                }}
                className={cx(
                  "grid w-full grid-cols-[1fr_140px] items-center px-4 py-3 text-left transition",
                  r.locked
                    ? "cursor-not-allowed bg-black/20"
                    : "hover:bg-white/[0.04]"
                )}
              >
                <div className={cx(r.locked && "opacity-60")}>
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-white">
                      {r.name}
                    </span>

                    {r.locked && (
                      <span className="inline-flex items-center gap-1 rounded-full border border-yellow-400/40 bg-yellow-400/10 px-2 py-0.5 text-[10px] text-yellow-300">
                        <Lock className="h-3 w-3" />
                        Locked
                      </span>
                    )}
                  </div>

                  <div className="mt-1 flex gap-1 text-[11px] text-white/55">
                    <span className="rounded-full border border-white/10 px-2 py-0.5">
                      {confLabel(r.confidence01)}
                    </span>
                    <span className="rounded-full border border-white/10 px-2 py-0.5">
                      {volLabel(r.volatility01)}
                    </span>
                  </div>
                </div>

                <div
                  className={cx(
                    "text-right text-sm text-white",
                    r.locked && "blur-sm select-none"
                  )}
                >
                  {formatRange(r.rangeLow, r.rangeHigh)}
                </div>
              </button>
            ))}
          </div>
        ))}
      </div>

      {/* CTA */}
      {!isPremium && (
        <div className="mt-4 rounded-lg border border-yellow-500/30 bg-gradient-to-br from-yellow-500/20 to-yellow-600/10 px-4 py-3">
          <div className="flex items-center justify-between gap-4">
            <div>
              <div className="text-sm font-semibold text-yellow-300">
                Unlock full player predictability
              </div>
              <div className="text-xs text-white/60">
                View all players, full ranges, and detailed AI reasoning.
              </div>
            </div>

            <a
              href="https://www.neekostats.com.au/neeko-plus"
              className="rounded-full border border-yellow-400/40 bg-yellow-400/20 px-4 py-2 text-sm font-medium text-yellow-200 hover:bg-yellow-400/30 transition"
            >
              Unlock Neeko+
            </a>
          </div>
        </div>
      )}

      {/* MODAL */}
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
                {formatRange(selected.rangeLow, selected.rangeHigh)}
              </div>

              <div className="mt-3 text-sm text-white/75">
                {selected.ai}
              </div>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
