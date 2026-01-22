import React, { useMemo, useState } from "react";
import { Search, Grid3X3, Calendar } from "lucide-react";
import PlayerGrid from "./PlayerGrid";
import PlayerOverlay from "./PlayerOverlay";
import { getAvailableTeams, getPlayers, PlayerData, StatLens } from "./getPlayers";
import { cn } from "@/lib/utils";

type Season = "2025" | "2026";

export default function AFLPlayersPage() {
  const [lens, setLens] = useState<StatLens>("fantasy");
  const [season, setSeason] = useState<Season>("2025");
  const [team, setTeam] = useState<string>("All Teams");
  const [query, setQuery] = useState<string>("");
  const [selected, setSelected] = useState<PlayerData | null>(null);

  const teams = useMemo(() => getAvailableTeams(), []);
  const allPlayers = useMemo(() => getPlayers(lens), [lens]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return allPlayers.filter((p) => {
      const teamOk = team === "All Teams" ? true : p.team === team;
      if (!teamOk) return false;
      if (!q) return true;
      return (
        p.name.toLowerCase().includes(q) ||
        p.team.toLowerCase().includes(q) ||
        p.role.toLowerCase().includes(q)
      );
    });
  }, [allPlayers, team, query]);

  return (
    <div className="min-h-screen">
      <div className="mx-auto max-w-7xl px-4 md:px-8 py-10">
        {/* HERO */}
        <div className="mb-6">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full border border-yellow-400/30 bg-yellow-500/10 text-yellow-200">
            <Grid3X3 className="h-4 w-4" />
            <span className="text-[11px] uppercase tracking-[0.22em] font-semibold">
              Master Grid
            </span>
          </div>

          <h1 className="mt-4 text-4xl md:text-5xl font-extrabold text-white">
            Full Season Player Ledger
          </h1>
          <p className="mt-2 text-white/55 max-w-2xl">
            Track every player's form, ceiling and consistency across the entire season.
          </p>
        </div>

        {/* FILTER BAR */}
        <div
          className={cn(
            "rounded-2xl border border-white/10 bg-black/35 backdrop-blur-xl",
            "px-4 py-4 md:px-5 md:py-5"
          )}
        >
          <div className="flex flex-col lg:flex-row lg:items-center gap-3 lg:gap-4">
            <div className="flex gap-3 flex-col sm:flex-row sm:items-center flex-1">
              <select
                value={team}
                onChange={(e) => setTeam(e.target.value)}
                className="h-11 rounded-xl bg-black/50 border border-white/10 text-white/80 px-3 outline-none focus:border-yellow-400/50"
              >
                {teams.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </select>

              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-white/35" />
                <input
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Search player, team or role"
                  className="w-full h-11 pl-10 pr-3 rounded-xl bg-black/50 border border-white/10 text-white/80 placeholder:text-white/30 outline-none focus:border-yellow-400/50"
                />
              </div>
            </div>

            {/* Season pills */}
            <div className="flex items-center gap-2">
              <Calendar className="h-4 w-4 text-white/40" />
              {(["2025", "2026"] as Season[]).map((s) => {
                const active = season === s;
                return (
                  <button
                    key={s}
                    onClick={() => setSeason(s)}
                    className={cn(
                      "px-3 h-9 rounded-full border text-sm font-semibold transition-all",
                      active
                        ? "bg-white/10 text-white border-white/20"
                        : "bg-black/40 border-white/10 text-white/50 hover:border-white/20"
                    )}
                  >
                    {s}
                  </button>
                );
              })}
            </div>

            {/* Lens pills */}
            <div className="flex items-center gap-2 justify-between sm:justify-start">
              {(["fantasy", "disposals", "goals"] as StatLens[]).map((l) => {
                const active = lens === l;
                return (
                  <button
                    key={l}
                    onClick={() => setLens(l)}
                    className={cn(
                      "px-4 h-10 rounded-full border text-sm font-semibold transition-all",
                      active
                        ? "bg-yellow-400 text-black border-yellow-300 shadow-[0_0_18px_rgba(250,204,21,0.60)]"
                        : "bg-black/40 border-white/15 text-white/70 hover:border-yellow-400/50"
                    )}
                  >
                    {l === "fantasy" ? "Fantasy" : l === "disposals" ? "Disposals" : "Goals"}
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* GRID OR COMING SOON */}
        <div className="mt-6">
          {season === "2026" ? (
            <div className="rounded-2xl border border-white/10 bg-black/30 backdrop-blur-xl p-12 text-center">
              <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-yellow-500/10 border border-yellow-400/30 mb-6">
                <Calendar className="h-8 w-8 text-yellow-400" />
              </div>
              <h3 className="text-2xl font-bold text-white mb-3">2026 Season Coming Soon</h3>
              <p className="text-white/55 max-w-md mx-auto">
                Full data will be released after Round 1.
              </p>
            </div>
          ) : (
            <PlayerGrid players={filtered} lens={lens} onPlayerSelect={setSelected} />
          )}
        </div>
      </div>

      {/* OVERLAY */}
      {selected && (
        <PlayerOverlay
          player={selected}
          lens={lens}
          onLensChange={(l) => setLens(l)}
          onClose={() => setSelected(null)}
        />
      )}
    </div>
  );
}
