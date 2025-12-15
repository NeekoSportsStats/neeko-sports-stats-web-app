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

  const base = stat === "Fantasy" ? 70 : stat === "Disposals" ? 18 : 1;
  const range = stat === "Fantasy" ? 40 : stat === "Disposals" ? 20 : 4;

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
  const [compact, setCompact] = useState(false);

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

    if (team !== "All") list = list.filter((r) => r.player.team === team);
    if (isPremium && search.trim()) {
      const q = search.toLowerCase().trim();
      list = list.filter((r) => r.searchIndex.includes(q));
    }
    if (!expanded && !isPremium) list = list.slice(0, FREE_ROW_LIMIT);

    return list;
  }, [rows, team, search, expanded, isPremium]);

  const hitThresholds = getHitThresholds(selectedStat);
  const COMPACT_STATS_W = ROUND_LABELS.length * ROUND_COL_W + RIGHT_COL_W;

  return (
    <div className="mt-10 rounded-3xl border border-neutral-800 bg-black/90 shadow-2xl overflow-hidden">
      {/* HEADER unchanged */}
      {/* TABLE */}
      <div className="relative overflow-x-auto scrollbar-none">
        <div
          className="flex text-[11px]"
          style={{
            minWidth: LEFT_COL_W + (compact ? COMPACT_STATS_W : ROUND_LABELS.length * ROUND_COL_W + RIGHT_COL_W),
          }}
        >
          {/* PLAYER COLUMN */}
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
                className="w-full px-5 border-t border-neutral-800 flex items-center justify-between hover:bg-neutral-900/40"
                style={{ height: ROW_H }}
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

          {/* NON-COMPACT MODE (unchanged behaviour) */}
          {!compact && (
            <>
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

              <div
                className="sticky right-0 z-20 bg-black/95 border-l border-neutral-800"
                style={{ width: RIGHT_COL_W }}
              >
                <div className="px-4 py-3 border-b border-neutral-800 text-[10px] uppercase tracking-[0.18em] text-neutral-500">
                  Stats & hit rate
                </div>

                {visible.map(({ stats, values }, i) => (
                  <div key={i} className="border-t border-neutral-800 px-4" style={{ height: ROW_H }}>
                    <div className={cx("grid h-full items-center", SPACING.col3Grid)}>
                      <div className="flex flex-col justify-center space-y-[2px]">
                        {[
                          ["AVG", stats.avg],
                          ["MIN", stats.min],
                          ["MAX", stats.max],
                          ["GMS", stats.gms],
                        ].map(([l, v]) => (
                          <div key={l} className="grid grid-cols-[32px_auto] gap-2">
                            <span className="text-neutral-500">{l}</span>
                            <span className={l === "AVG" ? "text-yellow-300 font-semibold" : ""}>{v}</span>
                          </div>
                        ))}
                      </div>

                      <div className={SPACING.dividerColor} />

                      <div className="flex flex-col justify-center space-y-1 pl-3">
                        {hitThresholds.map((t) => {
                          const r = calcHitRate(values, t);
                          return (
                            <div key={t} className="flex items-center gap-2">
                              <span className="w-8 text-[10px] text-neutral-400">{t}+</span>
                              <div className="flex-1 h-1 bg-neutral-800 rounded-full overflow-hidden">
                                <div className="h-full bg-gradient-to-r from-emerald-400 via-yellow-300 to-orange-400" style={{ width: `${r}%` }} />
                              </div>
                              <span className="w-8 text-right text-[10px] text-neutral-300">{r}%</span>
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

          {/* COMPACT MODE */}
          {compact && (
            <div style={{ width: COMPACT_STATS_W }}>
              <div className="px-4 py-3 border-b border-neutral-800 text-[10px] uppercase tracking-[0.18em] text-neutral-500">
                Stats & hit rate
              </div>

              {visible.map(({ stats, values }, i) => (
                <div key={i} className="border-t border-neutral-800 px-4" style={{ height: ROW_H }}>
                  <div className="grid h-full items-center gap-4 grid-cols-[repeat(8,minmax(0,1fr))]">
                    {[
                      ["AVG", stats.avg],
                      ["MIN", stats.min],
                      ["MAX", stats.max],
                      ["GMS", stats.gms],
                    ].map(([l, v]) => (
                      <div key={l} className="flex justify-center gap-1">
                        <span className="text-neutral-500">{l}</span>
                        <span className="text-neutral-100 font-medium">{v}</span>
                      </div>
                    ))}

                    {hitThresholds.map((t) => {
                      const r = calcHitRate(values, t);
                      return (
                        <div key={t} className="flex items-center gap-2">
                          <span className="text-[10px] text-neutral-400">{t}+</span>
                          <div className="flex-1 h-1 bg-neutral-800 rounded-full overflow-hidden">
                            <div className="h-full bg-gradient-to-r from-emerald-400 via-yellow-300 to-orange-400" style={{ width: `${r}%` }} />
                          </div>
                          <span className="text-[10px] text-neutral-300">{r}%</span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {!expanded && !isPremium && (
        <div className="py-6 text-center">
          <button onClick={() => setExpanded(true)} className="text-sm text-yellow-300 hover:underline">
            Show more
          </button>
        </div>
      )}
    </div>
  );
}
