import React, { useMemo, useState } from "react";
import { Search, Lock, ArrowRight, ChevronRight } from "lucide-react";
import type { TeamRow } from "./mockTeams";
import type { StatLens } from "./TeamMasterTable";

/* -------------------------------------------------------------------------- */
/* CONSTANTS                                                                  */
/* -------------------------------------------------------------------------- */

const FREE_ROW_LIMIT = 8;
const PAGE_SIZE = 10;

/* -------------------------------------------------------------------------- */
/* MOBILE MASTER TABLE — TEAMS                                                 */
/* -------------------------------------------------------------------------- */

export default function TeamMasterTableMobile({
  teams,
  selectedStat,
  setSelectedStat,
  isPremium,
  query,
  setQuery,
  onSelectTeam,
}: {
  teams: TeamRow[];
  selectedStat: StatLens;
  setSelectedStat: (s: StatLens) => void;
  isPremium: boolean;
  query: string;
  setQuery: (v: string) => void;
  onSelectTeam: (t: TeamRow) => void;
}) {
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);

  /* ---------------- DERIVED DATA ---------------- */

  const filtered = useMemo(() => {
    let list = teams;
    if (isPremium && query.trim()) {
      const q = query.toLowerCase();
      list = list.filter((t) => t.name.toLowerCase().includes(q));
    }
    return list;
  }, [teams, query, isPremium]);

  const visible = filtered.slice(0, visibleCount);

  /* -------------------------------------------------------------------------- */
  /* RENDER                                                                     */
  /* -------------------------------------------------------------------------- */

  return (
    <>
      {/* ================= HEADER ================= */}
      <div className="mt-6 rounded-3xl border border-neutral-800 bg-black/80 px-4 py-4 shadow-xl">
        <div className="inline-flex items-center gap-2 rounded-full border border-yellow-500/30 bg-yellow-500/10 px-3 py-1">
          <span className="text-[10px] uppercase tracking-[0.18em] text-yellow-200">
            Teams Master Table
          </span>
        </div>

        {/* STAT LENSES */}
        <div className="mt-4 flex gap-2 rounded-full border border-neutral-700 bg-black/80 px-2 py-1 text-[11px]">
          {(["Fantasy", "Disposals", "Goals"] as StatLens[]).map((s) => (
            <button
              key={s}
              onClick={() => setSelectedStat(s)}
              className={
                selectedStat === s
                  ? "rounded-full bg-yellow-400 px-3 py-1.5 text-black"
                  : "rounded-full bg-neutral-900 px-3 py-1.5 text-neutral-300"
              }
            >
              {s}
            </button>
          ))}
        </div>

        {/* SEARCH */}
        <div className="mt-3">
          {isPremium ? (
            <div className="flex items-center gap-2 rounded-2xl border border-neutral-800 bg-black/70 px-3 py-2">
              <Search className="h-4 w-4 text-neutral-400" />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search teams…"
                className="w-full bg-transparent text-[12px] text-neutral-200 outline-none"
              />
            </div>
          ) : (
            <div className="flex items-center gap-2 rounded-2xl border border-neutral-800 bg-black/60 px-3 py-2">
              <Lock className="h-4 w-4 text-neutral-500" />
              <span className="text-[12px] text-neutral-500">
                Search is Neeko+ only
              </span>
            </div>
          )}
        </div>
      </div>

      {/* ================= TABLE ================= */}
      <div className="mt-4 rounded-3xl border border-neutral-800 bg-black/90 shadow-xl overflow-hidden">
        {visible.map((team, idx) => {
          const gated = !isPremium && idx >= FREE_ROW_LIMIT;

          const values =
            selectedStat === "Fantasy"
              ? team.fantasy
              : selectedStat === "Disposals"
              ? team.disposals
              : team.goals;

          return (
            <div
              key={team.id}
              className="relative flex items-center justify-between px-4 py-4 border-b border-neutral-800"
            >
              <button
                disabled={gated}
                onClick={() => onSelectTeam(team)}
                className="flex items-center gap-2 text-left"
              >
                <span className="text-[15px] font-semibold text-neutral-50">
                  {team.name}
                </span>
                {!gated && (
                  <ChevronRight className="h-4 w-4 text-neutral-500" />
                )}
              </button>

              <span className="text-sm text-neutral-300">
                {values[values.length - 1]}
              </span>

              {gated && (
                <div className="absolute inset-0 bg-black/50 backdrop-blur-md" />
              )}
            </div>
          );
        })}
      </div>

      {/* ================= LOAD MORE ================= */}
      {visible.length < filtered.length && (
        <div className="mt-4 flex justify-center">
          <button
            onClick={() =>
              setVisibleCount((c) =>
                Math.min(c + PAGE_SIZE, filtered.length)
              )
            }
            className="rounded-full bg-neutral-800 px-6 py-2 text-neutral-200"
          >
            Show more
          </button>
        </div>
      )}

      {/* ================= CTA ================= */}
      {!isPremium && (
        <div className="mt-6 flex justify-center">
          <button className="rounded-3xl border border-yellow-500/30 bg-gradient-to-r from-yellow-500/25 via-yellow-500/10 to-transparent px-6 py-4 shadow-2xl max-w-lg w-full flex items-center justify-between">
            <div>
              <div className="text-[10px] uppercase tracking-[0.18em] text-yellow-300">
                Neeko+
              </div>
              <div className="text-sm font-semibold text-yellow-100">
                Unlock full teams table
              </div>
            </div>
            <ArrowRight className="h-5 w-5 text-yellow-300" />
          </button>
        </div>
      )}
    </>
  );
}
