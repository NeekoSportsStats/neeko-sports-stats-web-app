import React, { useMemo, useState, useEffect } from "react";
import {
  Lock,
  ChevronRight,
  ArrowRight,
  ChevronDown,
  Search,
} from "lucide-react";
import type { PlayerRow, StatLens } from "./MasterTable";

/* -------------------------------------------------------------------------- */
/* CONSTANTS                                                                  */
/* -------------------------------------------------------------------------- */

const ROUND_LABELS = ["OR", ...Array.from({ length: 23 }, (_, i) => `R${i + 1}`)];
const FREE_ROW_LIMIT = 8;

const LEFT_COL_W = 220;
const ROUND_COL_W = 48;
const RIGHT_COL_W = 260;

const ROW_H = 84;
const ROW_H_COMPACT = 56;

/* -------------------- LOCKED SPACING TOKENS -------------------- */
const SPACING = {
  statsGapY: "space-y-[2px]",
  statRowGapX: "gap-1",
  hitRateGapY: "space-y-1",
  dividerColor: "bg-yellow-500/10",
  col3Grid: "grid-cols-[108px_1px_1fr]",
};

/* -------------------------------------------------------------------------- */
/* HELPERS                                                                    */
/* -------------------------------------------------------------------------- */

const cx = (...c: Array<string | false | undefined>) =>
  c.filter(Boolean).join(" ");

function buildSearchIndex(p: PlayerRow) {
  return `${p.name} ${p.team} ${p.role}`.toLowerCase();
}

function getRowValues(key: string, stat: StatLens): number[] {
  let seed = 0;
  for (let i = 0; i < key.length; i++) seed += key.charCodeAt(i);

  const base =
    stat === "Fantasy" ? 70 : stat === "Disposals" ? 18 : 1;

  const range =
    stat === "Fantasy" ? 40 : stat === "Disposals" ? 20 : 4;

  return ROUND_LABELS.map((_, i) => base + ((seed + i * 13) % range));
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

/* ---------------- HIT RATE (STAT AWARE) ---------------- */

function getHitRate(stat: StatLens, threshold: number) {
  let min = 50;
  let max = 90;

  if (stat === "Fantasy") {
    min = 65;
    max = 90;
  }

  if (stat === "Disposals") {
    min = 55;
    max = 85;
  }

  if (stat === "Goals") {
    min = 30;
    max = 75;
  }

  const variance = (threshold - 60) * 0.8;
  const base = min + Math.random() * (max - min);

  return Math.max(0, Math.min(100, Math.round(base - variance)));
}

/* -------------------------------------------------------------------------- */
/* COMPONENT                                                                  */
/* -------------------------------------------------------------------------- */

export default function MasterTableDesktop({
  players,
  selectedStat,
  setSelectedStat,
  isPremium,
  onSelectPlayer,
}: {
  players: PlayerRow[];
  selectedStat: StatLens;
  setSelectedStat: (s: StatLens) => void;
  isPremium: boolean;
  onSelectPlayer: (p: PlayerRow) => void;
}) {
  const [team, setTeam] = useState("All");
  const [expanded, setExpanded] = useState(FREE_ROW_LIMIT);
  const [search, setSearch] = useState("");

  /* ---------------- COMPACT MODE ---------------- */
  const [compact, setCompact] = useState(false);

  useEffect(() => {
    const saved = localStorage.getItem("neeko-master-compact");
    if (saved === "1") setCompact(true);
  }, []);

  useEffect(() => {
    localStorage.setItem("neeko-master-compact", compact ? "1" : "0");
  }, [compact]);

  /* ---------------- DERIVED ROW DATA ---------------- */
  const rows = useMemo(() => {
    return players
      .map((p) => {
        const values = getRowValues(String(p.id), selectedStat);
        return {
          player: p,
          values,
          stats: calcStats(values),
          searchIndex: buildSearchIndex(p),
        };
      })
      .sort((a, b) => b.stats.total - a.stats.total);
  }, [players, selectedStat]);

  const visible = useMemo(() => {
    let list = rows;

    if (team !== "All") {
      list = list.filter((r) => r.player.team === team);
    }

    if (isPremium && search.trim()) {
      const q = search.toLowerCase().trim();
      list = list.filter((r) => r.searchIndex.includes(q));
    }

    if (!isPremium) {
      list = list.slice(0, expanded);
    }

    return list;
  }, [rows, team, search, expanded, isPremium]);

  const teams = useMemo(
    () => ["All", ...Array.from(new Set(players.map((p) => p.team)))],
    [players]
  );

  return (
    <div className="mt-10 rounded-3xl border border-neutral-800 bg-black/90 shadow-2xl overflow-hidden">
      {/* ================= HEADER ================= */}
      <div className="px-6 py-6 border-b border-neutral-800 space-y-4">
        <div className="flex items-start justify-between">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full border border-yellow-500/60 bg-black/80 px-3 py-1 text-xs text-yellow-200/90">
              <span className="uppercase tracking-[0.18em]">Master Table</span>
            </div>

            <h2 className="mt-3 text-xl font-semibold text-neutral-50">
              Full-season player trends
            </h2>

            <p className="mt-1 text-xs text-neutral-400">
              Season-long totals, averages and hit-rate performance
            </p>
          </div>

          {/* STAT LENS + COMPACT */}
          <div className="flex gap-2 rounded-full border border-neutral-700 bg-black/80 p-1">
            {(["Fantasy", "Disposals", "Goals"] as StatLens[]).map((s) => (
              <button
                key={s}
                onClick={() => setSelectedStat(s)}
                className={cx(
                  "rounded-full px-4 py-1.5 text-xs transition",
                  selectedStat === s
                    ? "bg-yellow-400 text-black"
                    : "text-neutral-300 hover:bg-neutral-800"
                )}
              >
                {s}
              </button>
            ))}

            <button
              onClick={() => setCompact((v) => !v)}
              className={cx(
                "ml-2 rounded-full px-4 py-1.5 text-xs border transition",
                compact
                  ? "border-yellow-400 bg-yellow-400 text-black"
                  : "border-neutral-700 text-neutral-300 hover:bg-neutral-800"
              )}
            >
              Compact
            </button>
          </div>
        </div>

        {/* FILTER ROW */}
        <div className="flex items-center justify-between gap-4">
          {/* TEAM FILTER */}
          <div
            className={cx(
              "relative flex items-center gap-2 rounded-xl border px-3 py-2 text-sm",
              isPremium
                ? "border-neutral-700 bg-black text-neutral-200"
                : "border-neutral-800 bg-neutral-900 text-neutral-500"
            )}
          >
            <span className="text-xs">Team</span>
            <select
              disabled={!isPremium}
              value={team}
              onChange={(e) => setTeam(e.target.value)}
              className="bg-transparent text-sm outline-none appearance-none pr-6"
            >
              {teams.map((t) => (
                <option key={t}>{t}</option>
              ))}
            </select>
            {isPremium ? (
              <ChevronDown className="h-4 w-4 absolute right-2" />
            ) : (
              <Lock className="h-4 w-4 absolute right-2" />
            )}
          </div>

          {/* SEARCH */}
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
              placeholder="Search player, team or role"
              className="bg-transparent text-sm text-neutral-200 placeholder:text-neutral-500
                         outline-none w-48 disabled:cursor-not-allowed"
            />
            {!isPremium && (
              <Lock className="h-4 w-4 text-neutral-500 ml-2" />
            )}
          </div>
        </div>
      </div>

      {/* ================= TABLE ================= */}
      <div className="relative overflow-x-auto scrollbar-none">
        <div className="flex text-[11px]">
          {/* PLAYER */}
          <div
            className="sticky left-0 z-30 bg-black/95 border-r border-neutral-800"
            style={{ width: LEFT_COL_W }}
          >
            <div className="px-5 py-3 text-[10px] uppercase tracking-[0.18em] text-neutral-500">
              Player
            </div>

            {visible.map(({ player }) => (
              <button
                key={player.id}
                onClick={() => onSelectPlayer(player)}
                className="group w-full px-5 border-t border-neutral-800 flex items-center justify-between hover:bg-neutral-900/40 transition"
                style={{ height: compact ? ROW_H_COMPACT : ROW_H }}
              >
                <div>
                  <div className="flex items-center gap-2 text-sm font-semibold text-neutral-50">
                    {player.name}
                    <ChevronRight className="h-4 w-4 text-neutral-600" />
                  </div>
                  <div className="text-[10px] uppercase tracking-[0.16em] text-neutral-500">
                    {player.team} · {player.role}
                  </div>
                </div>
              </button>
            ))}
          </div>

          {/* ROUNDS (HIDDEN IN COMPACT) */}
          {!compact && (
            <div>
              <div className="flex border-b border-neutral-800">
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

              {visible.map(({ player, values }) => (
                <div
                  key={player.id}
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

          {/* STATS & HIT RATE */}
          <div
            className="sticky right-0 z-20 bg-black/95 border-l border-neutral-800"
            style={{ width: compact ? RIGHT_COL_W + ROUND_LABELS.length * ROUND_COL_W : RIGHT_COL_W }}
          >
            {visible.map(({ player, stats }) => (
              <div
                key={player.id}
                className="px-4 border-t border-neutral-800 flex items-center gap-4 text-[11px]"
                style={{ height: compact ? ROW_H_COMPACT : ROW_H }}
              >
                {compact ? (
                  <>
                    <span>AVG {stats.avg}</span>
                    <span>MIN {stats.min}</span>
                    <span>MAX {stats.max}</span>
                    <span>GMS {stats.gms}</span>
                    {[60, 70, 80, 90].map((t) => {
                      const r = getHitRate(selectedStat, t);
                      return (
                        <span key={t}>{t}+ {r}%</span>
                      );
                    })}
                  </>
                ) : (
                  <div className={cx("grid h-full items-center", SPACING.col3Grid)}>
                    {/* ORIGINAL GRID (UNCHANGED) */}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* CTA */}
      {!isPremium && (
        <div className="flex justify-center py-10 border-t border-neutral-800">
          <button
            onClick={() => (window.location.href = "/neeko-plus")}
            className="rounded-3xl border border-yellow-500/30
                       bg-gradient-to-r from-yellow-500/25 via-yellow-500/10 to-transparent
                       px-6 py-4 shadow-2xl max-w-lg w-full
                       flex items-center justify-between"
          >
            <div>
              <div className="text-[10px] uppercase tracking-[0.18em] text-yellow-300">
                Neeko+
              </div>
              <div className="text-sm font-semibold text-yellow-100">
                Unlock full player table
              </div>
              <div className="text-xs text-neutral-300">
                Search, team filters & full season insights
              </div>
            </div>
            <ArrowRight className="h-5 w-5 text-yellow-300" />
          </button>
        </div>
      )}

      {/* SHOW MORE (+20) */}
      {!isPremium && expanded < rows.length && (
        <div className="py-6 text-center">
          <button
            onClick={() => setExpanded((v) => v + 20)}
            className="text-sm text-yellow-300 hover:underline"
          >
            Show more
          </button>
        </div>
      )}
    </div>
  );
}
