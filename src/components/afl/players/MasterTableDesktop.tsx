import React, { useMemo, useState } from "react";
import {
  Lock,
  ChevronRight,
  ArrowRight,
  ChevronDown,
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

/* -------------------------------------------------------------------------- */
/* HELPERS                                                                    */
/* -------------------------------------------------------------------------- */

const cx = (...c: Array<string | false | undefined>) =>
  c.filter(Boolean).join(" ");

function getRowValues(key: string): number[] {
  let seed = 0;
  for (let i = 0; i < key.length; i++) seed += key.charCodeAt(i);
  return ROUND_LABELS.map((_, i) => 70 + ((seed + i * 13) % 40));
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

const fakeRate = () => Math.floor(50 + Math.random() * 50);

/* -------------------------------------------------------------------------- */
/* DESKTOP MASTER TABLE                                                       */
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

  const rows = useMemo(() => {
    return players
      .map((p) => {
        const values = getRowValues(String(p.id));
        return { player: p, values, stats: calcStats(values) };
      })
      .sort((a, b) => b.stats.total - a.stats.total);
  }, [players]);

  const visible = useMemo(() => {
    let list = rows;
    if (team !== "All") list = list.filter((r) => r.player.team === team);
    if (!expanded && !isPremium) list = list.slice(0, FREE_ROW_LIMIT);
    return list;
  }, [rows, team, expanded, isPremium]);

  const teams = useMemo(
    () => ["All", ...Array.from(new Set(players.map((p) => p.team)))],
    [players]
  );

  return (
    <div className="mt-10 rounded-3xl border border-neutral-800 bg-black/90 shadow-2xl overflow-hidden">
      {/* ================= HEADER ================= */}
      <div className="px-6 py-5 border-b border-neutral-800 space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <div className="text-[10px] uppercase tracking-[0.18em] text-yellow-300">
              Master Table
            </div>
            <h2 className="mt-1 text-xl font-semibold text-neutral-50">
              Full-season player trends
            </h2>
            <p className="mt-1 text-xs text-neutral-400">
              Season-long totals, averages and hit-rate performance
            </p>
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

        {/* TEAM FILTER */}
        <div className="flex justify-end">
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
        </div>
      </div>

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

          {/* STATS */}
          <div
            className="sticky right-0 z-20 bg-black/95 border-l border-neutral-800"
            style={{ width: RIGHT_COL_W }}
          >
            <div className="px-4 py-3 text-[10px] uppercase tracking-[0.18em] text-neutral-500">
              Stats & hit rate
            </div>

            {visible.map(({ player, stats }) => (
              <div
                key={player.id}
                className="px-4 border-t border-neutral-800"
                style={{ height: ROW_H }}
              >
                <div className="grid grid-cols-[120px_1fr] gap-4 h-full items-center">
                  <div className="space-y-0.5 text-[11px]">
                    {[
                      ["AVG", stats.avg],
                      ["MIN", stats.min],
                      ["MAX", stats.max],
                      ["GMS", stats.gms],
                    ].map(([l, v]) => (
                      <div key={l as string} className="flex justify-between">
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

                  <div className="border-l border-yellow-500/20 h-full" />

                  <div className="space-y-1">
                    {[60, 70, 80, 90].map((t) => {
                      const r = fakeRate();
                      return (
                        <div key={t} className="flex items-center gap-2">
                          <span className="w-8 text-[10px] text-neutral-400">
                            {t}+
                          </span>
                          <div className="flex-1 rounded-full bg-neutral-800 overflow-hidden">
                            <div
                              className="h-1 bg-gradient-to-r from-emerald-400 via-yellow-300 to-orange-400"
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

      {!isPremium && (
        <div className="flex justify-center py-6">
          <button
            onClick={() => setExpanded((v) => !v)}
            className="text-sm text-yellow-300 hover:underline"
          >
            {expanded ? "Show less" : "Show more"}
          </button>
        </div>
      )}
    </div>
  );
}
