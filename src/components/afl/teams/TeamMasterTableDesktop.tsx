import React, { useMemo, useState } from "react";
import {
  Lock,
  ChevronRight,
  ArrowRight,
  ChevronDown,
  Search,
  X,
} from "lucide-react";
import type { TeamRow } from "./mockTeams";
import type { StatLens } from "./TeamMasterTable";

/* -------------------------------------------------------------------------- */
/* CONSTANTS                                                                  */
/* -------------------------------------------------------------------------- */

const ROUND_LABELS = ["OR", ...Array.from({ length: 23 }, (_, i) => `R${i + 1}`)];

const FREE_ROW_LIMIT = 8;
const PREMIUM_PAGE_SIZE = 20;
const GHOST_ROW_COUNT = 2;

const LEFT_COL_W = 220;
const ROUND_COL_W = 48;
const RIGHT_COL_W = 260;
const ROW_H = 84;

/* -------------------- LOCKED SPACING TOKENS -------------------- */
const SPACING = {
  dividerColor: "bg-yellow-500/10",
  col3Grid: "grid-cols-[108px_1px_1fr]",
};

/* -------------------------------------------------------------------------- */
/* HELPERS                                                                    */
/* -------------------------------------------------------------------------- */

const cx = (...c: Array<string | false | undefined>) =>
  c.filter(Boolean).join(" ");

function getValues(team: TeamRow, stat: StatLens): number[] {
  if (stat === "Fantasy") return team.fantasy;
  if (stat === "Disposals") return team.disposals;
  return team.goals;
}

function calcStats(values: number[]) {
  const total = values.reduce((a, b) => a + b, 0);
  return {
    total,
    avg: Math.round(total / values.length),
    min: Math.min(...values),
    max: Math.max(...values),
    gms: values.length,
  };
}

function getHitThresholds(stat: StatLens): number[] {
  if (stat === "Fantasy") return [1800, 1900, 2000, 2100];
  if (stat === "Disposals") return [320, 350, 380, 400];
  return [8, 10, 12, 14];
}

function calcHitRate(values: number[], threshold: number) {
  const hits = values.filter((v) => v >= threshold).length;
  return Math.round((hits / values.length) * 100);
}

/* -------------------------------------------------------------------------- */
/* DESKTOP MASTER TABLE — TEAMS                                                */
/* -------------------------------------------------------------------------- */

export default function TeamMasterTableDesktop({
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
  const [search, setSearch] = useState("");
  const [compact, setCompact] = useState(false);
  const [premiumVisible, setPremiumVisible] = useState(PREMIUM_PAGE_SIZE);
  const [ctaOpen, setCtaOpen] = useState(false);

  /* ---------------- DERIVED DATA ---------------- */

  const rows = useMemo(() => {
    return teams
      .map((t) => {
        const values = getValues(t, selectedStat);
        return {
          team: t,
          values,
          stats: calcStats(values),
          searchIndex: `${t.name} ${t.code}`.toLowerCase(),
        };
      })
      .sort((a, b) => b.stats.total - a.stats.total);
  }, [teams, selectedStat]);

  const filtered = useMemo(() => {
    let list = rows;
    if (isPremium && search.trim()) {
      const q = search.toLowerCase().trim();
      list = list.filter((r) => r.searchIndex.includes(q));
    }
    return list;
  }, [rows, search, isPremium]);

  const visible = useMemo(() => {
    if (!isPremium) return filtered.slice(0, FREE_ROW_LIMIT);
    return filtered.slice(0, premiumVisible);
  }, [filtered, isPremium, premiumVisible]);

  const ghostRows = !isPremium
    ? Array.from({ length: GHOST_ROW_COUNT }, (_, i) => i)
    : [];

  const nonCompactMinWidth =
    LEFT_COL_W + ROUND_LABELS.length * ROUND_COL_W + RIGHT_COL_W;

  const hitThresholds = getHitThresholds(selectedStat);

  /* -------------------------------------------------------------------------- */
  /* RENDER                                                                     */
  /* -------------------------------------------------------------------------- */

  return (
    <div className="mt-10 rounded-3xl border border-neutral-800 bg-black/90 shadow-2xl overflow-hidden">
      {/* ================= HEADER ================= */}
      <div className="px-6 py-6 border-b border-neutral-800 space-y-3">
        <div className="flex items-start justify-between">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full border border-yellow-500/60 bg-black/80 px-3 py-1 text-xs text-yellow-200/90">
              <span className="uppercase tracking-[0.18em]">
                Teams Master Table
              </span>
            </div>
            <h2 className="mt-3 text-xl font-semibold text-neutral-50">
              Full-season team trends
            </h2>
          </div>

          <div className="flex gap-2 rounded-full border border-neutral-700 bg-black/80 p-1">
            {(["Fantasy", "Disposals", "Goals"] as StatLens[]).map((s) => (
              <button
                key={s}
                onClick={() => setSelectedStat(s)}
                className={cx(
                  "rounded-full px-4 py-1.5 text-xs transition",
                  selectedStat === s
                    ? "bg-yellow-400 text-black shadow-[0_0_16px_rgba(250,204,21,0.6)]"
                    : "text-neutral-300 hover:bg-neutral-800"
                )}
              >
                {s}
              </button>
            ))}
          </div>
        </div>

        <div className="flex items-start justify-between gap-3">
          <p className="text-xs text-neutral-400">
            Season-long totals, averages and hit-rate performance
          </p>

          <div className="flex flex-col items-end gap-2">
            <button
              onClick={() => setCompact((v) => !v)}
              className={cx(
                "rounded-full px-3 py-1 text-xs border transition",
                compact
                  ? "bg-yellow-400 text-black border-yellow-400 shadow-[0_0_10px_rgba(250,204,21,0.5)]"
                  : "border-neutral-700 text-neutral-300 hover:bg-neutral-800"
              )}
            >
              Compact
            </button>

            <div
              className={cx(
                "relative flex items-center rounded-xl border px-3 py-2",
                isPremium
                  ? "border-neutral-700 bg-black"
                  : "border-neutral-800 bg-neutral-900"
              )}
            >
              <Search className="h-4 w-4 text-neutral-500 mr-2" />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                disabled={!isPremium}
                placeholder="Search team"
                className="bg-transparent text-sm text-neutral-200 placeholder:text-neutral-500 outline-none w-40 disabled:cursor-not-allowed"
              />
              {!isPremium && <Lock className="h-4 w-4 text-neutral-500 ml-2" />}
            </div>
          </div>
        </div>
      </div>

      {/* ================= TABLE ================= */}
      <div className="relative max-h-[65vh] overflow-y-auto overflow-x-auto scrollbar-none">
        <div
          className="flex text-[11px]"
          style={{ minWidth: compact ? undefined : nonCompactMinWidth }}
        >
          {/* ================= TEAM COLUMN ================= */}
          <div
            className="sticky left-0 z-30 bg-black/95 border-r border-neutral-800"
            style={{ width: LEFT_COL_W }}
          >
            <div className="sticky top-0 z-40 px-5 py-3 text-[10px] uppercase tracking-[0.18em] text-neutral-500 border-b border-neutral-800 bg-black/95">
              Team
            </div>

            {visible.map(({ team }) => (
              <button
                key={team.id}
                onClick={() => onSelectTeam(team)}
                className="group w-full px-5 border-t border-neutral-800 flex items-center justify-between hover:bg-neutral-900/40 transition"
                style={{ height: ROW_H }}
              >
                <div className="min-w-0">
                  <div className="flex items-center gap-2 text-sm font-semibold text-neutral-50">
                    <span className="truncate">{team.name}</span>
                    <ChevronRight className="h-4 w-4 text-neutral-600 group-hover:text-neutral-200 transition" />
                  </div>
                  <div className="text-[10px] uppercase tracking-[0.16em] text-neutral-500 truncate">
                    {team.code}
                  </div>
                </div>
              </button>
            ))}

            {ghostRows.map((i) => (
              <div
                key={i}
                className="relative px-5 border-t border-neutral-800"
                style={{ height: ROW_H }}
              >
                <div className="absolute inset-0 bg-black/40 backdrop-blur-md" />
              </div>
            ))}
          </div>

          {/* ================= ROUNDS + STATS ================= */}
          {!compact && (
            <>
              {/* ROUNDS */}
              <div>
                <div className="sticky top-0 z-20 flex border-b border-neutral-800 bg-black/95">
                  {ROUND_LABELS.map((r) => (
                    <div
                      key={r}
                      className="py-3 text-center text-[10px] uppercase tracking-[0.18em] text-neutral-500"
                      style={{ width: ROUND_COL_W }}
                    >
                      {r}
                    </div>
                  ))}
                </div>

                {visible.map(({ team, values }) => (
                  <div
                    key={team.id}
                    className="flex border-t border-neutral-800"
                    style={{ height: ROW_H }}
                  >
                    {values.map((v, i) => (
                      <div
                        key={i}
                        className="flex items-center justify-center text-sm text-neutral-100"
                        style={{ width: ROUND_COL_W }}
                      >
                        {v}
                      </div>
                    ))}
                  </div>
                ))}
              </div>

              {/* STATS */}
              <div
                className="sticky right-0 z-20 bg-black/95 border-l border-neutral-800"
                style={{ width: RIGHT_COL_W }}
              >
                <div className="sticky top-0 z-30 px-4 py-3 bg-black/95 border-b border-neutral-800 text-[10px] uppercase tracking-[0.18em] text-neutral-500">
                  Stats & hit rate
                </div>

                {visible.map(({ team, stats, values }) => (
                  <div
                    key={team.id}
                    className="px-4 border-t border-neutral-800"
                    style={{ height: ROW_H }}
                  >
                    <div className={cx("grid h-full items-center", SPACING.col3Grid)}>
                      <div className="flex flex-col justify-center space-y-[2px]">
                        {[
                          ["AVG", stats.avg],
                          ["MIN", stats.min],
                          ["MAX", stats.max],
                          ["GMS", stats.gms],
                        ].map(([l, v]) => (
                          <div
                            key={l}
                            className="grid grid-cols-[32px_auto] gap-2 text-[11px]"
                          >
                            <span className="text-neutral-500">{l}</span>
                            <span
                              className={cx(
                                l === "AVG" && "text-yellow-300 font-semibold"
                              )}
                            >
                              {v}
                            </span>
                          </div>
                        ))}
                      </div>

                      <div className={SPACING.dividerColor} />

                      <div className="flex flex-col justify-center space-y-1 pl-3">
                        {hitThresholds.map((t) => {
                          const r = calcHitRate(values, t);
                          return (
                            <div key={t} className="flex items-center gap-2">
                              <span className="w-10 text-[10px] text-neutral-400">
                                {t}+
                              </span>
                              <div className="flex-1 h-1 bg-neutral-800 rounded-full overflow-hidden">
                                <div
                                  className="h-full bg-gradient-to-r from-emerald-400 via-yellow-300 to-orange-400"
                                  style={{ width: `${r}%` }}
                                />
                              </div>
                              <span className="w-8 text-right text-[10px] text-neutral-300">
                                {r}%
                              </span>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      </div>

      {/* ================= CTA ================= */}
      {!isPremium && (
        <div className="flex justify-center py-10 border-t border-neutral-800">
          <button
            onClick={() => setCtaOpen(true)}
            className="rounded-3xl border border-yellow-500/30 bg-gradient-to-r from-yellow-500/25 via-yellow-500/10 to-transparent px-6 py-4 shadow-2xl max-w-lg w-full flex items-center justify-between"
          >
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
    </div>
  );
}
