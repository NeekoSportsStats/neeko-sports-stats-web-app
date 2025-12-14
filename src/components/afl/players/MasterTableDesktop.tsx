import React, { useMemo, useState } from "react";
import { Lock, ChevronRight, ArrowRight, Search } from "lucide-react";
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

const fakeValue = () => Math.floor(70 + Math.random() * 40);
const fakeRate = () => Math.floor(50 + Math.random() * 50);

const Skeleton = () => (
  <div className="h-3 w-full rounded-full bg-neutral-700/40 animate-pulse" />
);

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
  const [teamFilter, setTeamFilter] = useState<string>("All");
  const [search, setSearch] = useState("");
  const [expanded, setExpanded] = useState(false);

  const filteredPlayers = useMemo(() => {
    let list = players;

    if (teamFilter !== "All") {
      list = list.filter((p) => p.team === teamFilter);
    }

    if (isPremium && search) {
      list = list.filter((p) =>
        p.name.toLowerCase().includes(search.toLowerCase())
      );
    }

    if (!expanded && !isPremium) {
      list = list.slice(0, FREE_ROW_LIMIT);
    }

    return list;
  }, [players, teamFilter, search, expanded, isPremium]);

  const teams = useMemo(
    () => ["All", ...Array.from(new Set(players.map((p) => p.team)))],
    [players]
  );

  return (
    <div className="mt-10 rounded-3xl border border-neutral-800 bg-black/90 shadow-2xl overflow-hidden">
      {/* ================= HEADER ================= */}
      <div className="px-6 py-5 border-b border-neutral-800 space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <div className="text-[10px] uppercase tracking-[0.18em] text-yellow-300">
              Master Table
            </div>
            <h2 className="mt-1 text-xl font-semibold text-neutral-50">
              Full-season player trends
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

        {/* FILTER BAR */}
        <div className="flex items-center justify-between gap-4">
          {/* Team Filter */}
          <div className="flex gap-2 flex-wrap">
            {teams.map((t) => (
              <button
                key={t}
                onClick={() => setTeamFilter(t)}
                className={cx(
                  "rounded-full px-3 py-1 text-[11px] border transition",
                  teamFilter === t
                    ? "bg-yellow-400 text-black border-yellow-400"
                    : "border-neutral-700 text-neutral-300 hover:bg-neutral-800"
                )}
              >
                {t}
              </button>
            ))}
          </div>

          {/* Search (Premium only) */}
          {isPremium && (
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-neutral-500" />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search player…"
                className="pl-9 pr-3 py-2 text-sm rounded-xl bg-black border border-neutral-700 text-neutral-200 placeholder:text-neutral-500 focus:outline-none focus:border-yellow-400"
              />
            </div>
          )}
        </div>
      </div>

      {/* ================= TABLE ================= */}
      <div className="relative">
        <div className="overflow-x-auto scrollbar-none">
          <div
            className="flex text-[11px]"
            style={{
              minWidth:
                LEFT_COL_W +
                ROUND_LABELS.length * ROUND_COL_W +
                RIGHT_COL_W,
            }}
          >
            {/* LEFT */}
            <div
              className="sticky left-0 z-30 bg-black/95 border-r border-neutral-800"
              style={{ width: LEFT_COL_W }}
            >
              <div className="px-5 py-3 text-[10px] uppercase tracking-[0.18em] text-neutral-500">
                Player
              </div>

              {filteredPlayers.map((p, i) => (
                <button
                  key={p.id}
                  onClick={() => onSelectPlayer(p)}
                  className="group w-full px-5 border-t border-neutral-800 flex items-center justify-between transition hover:bg-neutral-900/40 hover:-translate-y-[1px]"
                  style={{ height: ROW_H }}
                >
                  <div>
                    <div className="text-sm font-semibold text-neutral-50">
                      {p.name}
                    </div>
                    <div className="text-[10px] uppercase tracking-[0.16em] text-neutral-500">
                      {p.team} · {p.role}
                    </div>
                  </div>
                  <ChevronRight className="h-4 w-4 text-neutral-500 group-hover:text-neutral-300" />
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

              {filteredPlayers.map((_, i) => (
                <div
                  key={i}
                  className="flex border-t border-neutral-800"
                  style={{ height: ROW_H }}
                >
                  {ROUND_LABELS.map((_, j) => (
                    <div
                      key={j}
                      className="flex items-center justify-center text-sm text-neutral-100"
                      style={{ width: ROUND_COL_W }}
                    >
                      {fakeValue()}
                    </div>
                  ))}
                </div>
              ))}
            </div>

            {/* RIGHT */}
            <div
              className="sticky right-0 z-20 bg-black/95 border-l border-neutral-800"
              style={{ width: RIGHT_COL_W }}
            >
              <div className="px-4 py-3 text-[10px] uppercase tracking-[0.18em] text-neutral-500">
                Stats & hit rate
              </div>

              {filteredPlayers.map((_, i) => (
                <div
                  key={i}
                  className="px-4 border-t border-neutral-800"
                  style={{ height: ROW_H }}
                >
                  <div className="grid grid-cols-[120px_1fr] gap-4 h-full items-center">
                    {/* STATS */}
                    <div className="space-y-0.5 text-[11px] text-neutral-300 pr-3">
                      {[
                        ["AVG", fakeValue()],
                        ["MIN", fakeValue()],
                        ["MAX", fakeValue()],
                        ["GMS", 23],
                      ].map(([label, value]) => (
                        <div
                          key={label as string}
                          className="flex justify-between"
                        >
                          <span className="text-neutral-500">
                            {label as string}
                          </span>
                          <span
                            className={cx(
                              label === "AVG" &&
                                "text-yellow-300 font-semibold"
                            )}
                          >
                            {value as number}
                          </span>
                        </div>
                      ))}
                    </div>

                    {/* GOLD HAIRLINE DIVIDER */}
                    <div className="absolute right-[140px] top-3 bottom-3 w-px bg-gradient-to-b from-transparent via-yellow-500/20 to-transparent" />

                    {/* HIT RATE */}
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

        {/* SHOW MORE */}
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
    </div>
  );
}
