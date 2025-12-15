import React, { useMemo, useState } from "react";
import {
  Lock,
  ChevronRight,
  ArrowRight,
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
const LOCKED_PREVIEW_ROWS = 2;

const LEFT_COL_W = 220;
const ROUND_COL_W = 48;
const RIGHT_COL_W = 260;
const ROW_H = 84;

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
/* COMPONENT                                                                  */
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
  const [expanded, setExpanded] = useState(false);
  const [showUpgrade, setShowUpgrade] = useState(false);

  /* ---------------- DERIVED DATA ---------------- */

  const rows = useMemo(() => {
    return teams.map((t) => {
      const values = getValues(t, selectedStat);
      return {
        team: t,
        values,
        stats: calcStats(values),
        searchIndex: `${t.name} ${t.code}`.toLowerCase(),
      };
    });
  }, [teams, selectedStat]);

  const filtered = useMemo(() => {
    if (!isPremium || !search.trim()) return rows;
    const q = search.toLowerCase().trim();
    return rows.filter((r) => r.searchIndex.includes(q));
  }, [rows, search, isPremium]);

  const visibleRows =
    isPremium && expanded ? filtered : filtered.slice(0, FREE_ROW_LIMIT);

  const lockedRows =
    !isPremium && filtered.length > FREE_ROW_LIMIT
      ? filtered.slice(
          FREE_ROW_LIMIT,
          FREE_ROW_LIMIT + LOCKED_PREVIEW_ROWS
        )
      : [];

  const hitThresholds = getHitThresholds(selectedStat);

  /* -------------------------------------------------------------------------- */

  return (
    <>
      {/* ================= TABLE WRAPPER ================= */}
      <div className="mt-10 rounded-3xl border border-neutral-800 bg-black shadow-2xl overflow-hidden">
        {/* ================= HEADER ================= */}
        <div className="px-6 py-6 border-b border-neutral-800">
          <div className="flex justify-between items-start">
            <div>
              <div className="inline-flex rounded-full border border-yellow-500/60 px-3 py-1 text-xs text-yellow-200 uppercase tracking-[0.18em]">
                Teams Master Table
              </div>
              <h2 className="mt-3 text-xl font-semibold text-neutral-50">
                Full-season team trends
              </h2>
              <p className="text-xs text-neutral-400">
                Season-long totals, averages and hit-rate performance
              </p>
            </div>

            <div className="flex flex-col items-end gap-2">
              <div className="flex gap-2 rounded-full border border-neutral-700 bg-black p-1">
                {(["Fantasy", "Disposals", "Goals"] as StatLens[]).map((s) => (
                  <button
                    key={s}
                    onClick={() => setSelectedStat(s)}
                    className={cx(
                      "px-4 py-1.5 text-xs rounded-full transition",
                      selectedStat === s
                        ? "bg-yellow-400 text-black shadow-[0_0_16px_rgba(250,204,21,0.6)]"
                        : "text-neutral-300 hover:bg-neutral-800"
                    )}
                  >
                    {s}
                  </button>
                ))}
              </div>

              <div className="flex gap-2">
                <button
                  onClick={() => setCompact((v) => !v)}
                  className={cx(
                    "px-3 py-1 text-xs rounded-full border transition",
                    compact
                      ? "bg-yellow-400 text-black"
                      : "border-neutral-700 text-neutral-300"
                  )}
                >
                  Compact
                </button>

                <div
                  className={cx(
                    "flex items-center gap-2 rounded-xl border px-3 py-2",
                    isPremium
                      ? "border-neutral-700 bg-black"
                      : "border-neutral-800 bg-neutral-900"
                  )}
                >
                  <Search className="h-4 w-4 text-neutral-500" />
                  <input
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    disabled={!isPremium}
                    placeholder="Search team"
                    className="bg-transparent text-sm text-neutral-200 outline-none w-40 disabled:cursor-not-allowed"
                  />
                  {!isPremium && <Lock className="h-4 w-4 text-neutral-500" />}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* ================= TABLE ================= */}
        <div className="relative max-h-[65vh] overflow-x-auto overflow-y-auto">
          <div
            className="flex text-[11px]"
            style={{
              minWidth: compact
                ? LEFT_COL_W + RIGHT_COL_W * 2
                : LEFT_COL_W +
                  ROUND_LABELS.length * ROUND_COL_W +
                  RIGHT_COL_W,
            }}
          >
            {/* ================= TEAM COLUMN ================= */}
            <div
              className="sticky left-0 z-20 border-r border-neutral-800 bg-black"
              style={{ width: LEFT_COL_W }}
            >
              <div className="sticky top-0 px-5 py-3 text-[10px] uppercase tracking-[0.18em] text-neutral-500 border-b border-neutral-800 bg-black">
                Team
              </div>

              {visibleRows.map(({ team }) => (
                <button
                  key={team.id}
                  onClick={() => onSelectTeam(team)}
                  className="group w-full px-5 border-t border-neutral-800 flex items-center justify-between hover:bg-neutral-900/40"
                  style={{ height: ROW_H }}
                >
                  <div>
                    <div className="flex items-center gap-2 text-sm font-semibold text-neutral-50">
                      {team.name}
                      <ChevronRight className="h-4 w-4 text-neutral-600" />
                    </div>
                    <div className="mt-[1px] text-[10px] uppercase tracking-[0.16em] text-neutral-500">
                      {team.code}
                    </div>
                  </div>
                </button>
              ))}

              {!isPremium &&
                lockedRows.map((_, i) => (
                  <div
                    key={i}
                    onClick={() => setShowUpgrade(true)}
                    className="group relative px-5 border-t border-neutral-800 overflow-hidden cursor-pointer"
                    style={{ height: ROW_H }}
                  >
                    <div className="space-y-2 pt-4 opacity-40">
                      <div className="h-4 w-3/4 rounded bg-neutral-800" />
                      <div className="h-3 w-1/3 rounded bg-neutral-900" />
                    </div>

                    <div className="absolute inset-0 bg-gradient-to-r from-transparent via-yellow-400/20 to-transparent animate-[shimmer_2.2s_linear_infinite]" />
                    <div className="absolute inset-0 bg-gradient-to-br from-yellow-500/25 via-black/80 to-black/90 backdrop-blur-md" />

                    <div className="absolute inset-0 flex items-center justify-center opacity-60 group-hover:opacity-100 transition">
                      <div className="flex items-center gap-2 text-yellow-300">
                        <Lock className="h-4 w-4" />
                        <span className="text-xs tracking-wide">
                          Unlock insights
                        </span>
                      </div>
                    </div>
                  </div>
                ))}
            </div>

            {/* ================= ROUNDS ================= */}
            {!compact && (
              <div>
                <div className="sticky top-0 z-10 flex border-b border-neutral-800 bg-black">
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

                {visibleRows.map(({ team, values }) => (
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
            )}

            {/* ================= STATS ================= */}
            <div
              className="sticky right-0 z-10 border-l border-neutral-800 bg-black"
              style={{ width: compact ? RIGHT_COL_W * 2 : RIGHT_COL_W }}
            >
              <div className="sticky top-0 px-4 py-3 text-[10px] uppercase tracking-[0.18em] text-neutral-500 border-b border-neutral-800 bg-black">
                Stats & hit rate
              </div>

              {visibleRows.map(({ team, stats, values }) => (
                <div
                  key={team.id}
                  className="px-4 border-t border-neutral-800"
                  style={{ height: ROW_H }}
                >
                  <div className="grid grid-cols-[108px_1px_1fr] h-full items-center">
                    <div className="space-y-[2px]">
                      <div className="text-[11px]">
                        <span className="text-neutral-500">AVG</span>{" "}
                        <span className="text-yellow-300 font-semibold">
                          {stats.avg}
                        </span>
                      </div>
                      <div className="text-[11px] text-neutral-500">
                        MIN {stats.min}
                      </div>
                      <div className="text-[11px] text-neutral-500">
                        MAX {stats.max}
                      </div>
                      <div className="text-[11px] text-neutral-500">
                        GMS {stats.gms}
                      </div>
                    </div>

                    <div className="bg-yellow-500/10 h-full w-px" />

                    <div className="space-y-1 pl-3">
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
          </div>

          <div className="h-px bg-neutral-800 w-full" />
        </div>
      </div>

      {/* ================= UPGRADE POPUP ================= */}
      {!isPremium && showUpgrade && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-md">
          <div className="relative max-w-lg w-full rounded-3xl border border-yellow-500/30 bg-gradient-to-br from-black via-black to-yellow-950/30 p-8 shadow-2xl">
            <button
              onClick={() => setShowUpgrade(false)}
              className="absolute right-4 top-4 text-neutral-400 hover:text-neutral-200"
            >
              <X className="h-5 w-5" />
            </button>

            <div className="text-center">
              <div className="inline-flex mb-3 rounded-full border border-yellow-500/40 px-3 py-1 text-xs text-yellow-300 uppercase tracking-[0.18em]">
                Neeko+
              </div>
              <h3 className="text-lg font-semibold text-neutral-50">
                Unlock full teams insights
              </h3>
              <p className="mt-2 text-sm text-neutral-400">
                Full season stats, search, filters and premium analysis.
              </p>

              <a
                href="https://www.neekostats.com.au/neeko-plus"
                className="mt-6 inline-flex items-center justify-center gap-2 rounded-xl bg-yellow-400 px-6 py-3 text-sm font-semibold text-black shadow-[0_0_20px_rgba(250,204,21,0.5)] hover:brightness-110 transition"
              >
                Upgrade to Neeko+
                <ArrowRight className="h-4 w-4" />
              </a>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
