import React, { useMemo, useState } from "react";
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

function getHitThresholds(stat: StatLens): number[] {
  if (stat === "Fantasy") return [80, 90, 100, 110];
  if (stat === "Disposals") return [15, 20, 25, 30];
  return [1, 2, 3, 4];
}

function calcHitRate(values: number[], threshold: number) {
  const hits = values.filter((v) => v >= threshold).length;
  return Math.round((hits / values.length) * 100);
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
  const [expanded, setExpanded] = useState(false);
  const [search, setSearch] = useState("");

  // 🔹 COMPACT ADD (state only, no behavior yet)
  const [compact, setCompact] = useState(false);

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

    if (!expanded && !isPremium) {
      list = list.slice(0, FREE_ROW_LIMIT);
    }

    return list;
  }, [rows, team, search, expanded, isPremium]);

  const teams = useMemo(
    () => ["All", ...Array.from(new Set(players.map((p) => p.team)))],
    [players]
  );

  const hitThresholds = getHitThresholds(selectedStat);

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

          {/* STAT LENS */}
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

        {/* 🔹 COMPACT BUTTON ROW (NEW, ISOLATED) */}
        <div className="flex justify-end">
          <button
            onClick={() => setCompact((v) => !v)}
            className={cx(
              "rounded-full px-4 py-1.5 text-xs border transition",
              compact
                ? "bg-yellow-400 text-black border-yellow-400 shadow-[0_0_12px_rgba(250,204,21,0.6)]"
                : "border-neutral-700 text-neutral-300 hover:bg-neutral-800"
            )}
          >
            Compact
          </button>
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
      {/* EVERYTHING BELOW IS UNCHANGED */}

      {/* ================= TABLE ================= */}
      <div className="relative overflow-x-auto scrollbar-none">
        <div
          className="flex text-[11px]"
          style={{
            minWidth:
              LEFT_COL_W +
              ROUND_LABELS.length * ROUND_COL_W +
              RIGHT_COL_W,
          }}
        >
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
                style={{ height: ROW_H }}
              >
                <div>
                  <div className="flex items-center gap-2 text-sm font-semibold text-neutral-50">
                    {player.name}
                    <ChevronRight className="h-4 w-4 text-neutral-600 group-hover:text-neutral-300" />
                  </div>
                  <div className="text-[10px] uppercase tracking-[0.16em] text-neutral-500">
                    {player.team} · {player.role}
                  </div>
                </div>
              </button>
            ))}
          </div>

          {/* ROUNDS */}
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

          {/* STATS & HIT RATE */}
          <div
            className="sticky right-0 z-20 bg-black/95 border-l border-neutral-800"
            style={{ width: RIGHT_COL_W }}
          >
            <div className="sticky top-0 z-10 px-4 py-3 bg-black/95 border-b border-neutral-800 text-[10px] uppercase tracking-[0.18em] text-neutral-500">
              Stats & hit rate
            </div>

            {visible.map(({ player, stats, values }) => (
              <div
                key={player.id}
                className="px-4 border-t border-neutral-800"
                style={{ height: ROW_H }}
              >
                <div className={cx("grid h-full items-center", SPACING.col3Grid)}>
                  {/* STATS */}
                  <div className={cx("flex flex-col justify-center", SPACING.statsGapY)}>
                    {[
                      ["AVG", stats.avg],
                      ["MIN", stats.min],
                      ["MAX", stats.max],
                      ["GMS", stats.gms],
                    ].map(([l, v]) => (
                      <div
                        key={l as string}
                        className="grid grid-cols-[32px_auto] items-center gap-2 text-[11px]"
                      >
                        <span className="text-neutral-500">{l}</span>
                        <span
                          className={cx(
                            "text-left",
                            l === "AVG" && "text-yellow-300 font-semibold"
                          )}
                        >
                          {v}
                        </span>
                      </div>
                    ))}
                  </div>

                  <div className={SPACING.dividerColor} />

                  {/* HIT RATE — REAL */}
                  <div className={cx("flex flex-col justify-center pl-3", SPACING.hitRateGapY)}>
                    {hitThresholds.map((t) => {
                      const r = calcHitRate(values, t);
                      return (
                        <div key={t} className="flex items-center gap-2">
                          <span className="w-8 text-[10px] text-neutral-400">
                            {t}+
                          </span>
                          <div className="flex-1 h-1 rounded-full bg-neutral-800 overflow-hidden">
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

      {/* SHOW MORE */}
      {!expanded && !isPremium && (
        <div className="py-6 text-center">
          <button
            onClick={() => setExpanded(true)}
            className="text-sm text-yellow-300 hover:underline"
          >
            Show more
          </button>
        </div>
      )}
    </div>
  );
}
