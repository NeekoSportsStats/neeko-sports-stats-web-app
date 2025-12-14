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

/* -------------------- LOCKED SPACING TOKENS -------------------- */
const ROW_H = 84;

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

  /* ---------------- DERIVED ROW DATA ---------------- */
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

    if (search) {
      list = list.filter((r) =>
        r.player.name.toLowerCase().includes(search.toLowerCase())
      );
    }

    if (!expanded && !isPremium) list = list.slice(0, FREE_ROW_LIMIT);

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

        {/* FILTER ROW */}
        <div className="flex items-center gap-4">
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

          {/* SEARCH (ADDED — LOCKED WHEN FREE) */}
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
              placeholder="Search player"
              className="bg-transparent text-sm text-neutral-200 placeholder:text-neutral-500 outline-none w-40"
            />
            {!isPremium && (
              <Lock className="h-4 w-4 text-neutral-500 ml-2" />
            )}
          </div>
        </div>
      </div>

      {/* ================= TABLE ================= */}
      {/* (unchanged — omitted here for brevity, identical to your working version) */}

      {/* CTA + Show more (unchanged) */}
    </div>
  );
}
