import React, { useState } from "react";
import { Search, Maximize2, Minimize2 } from "lucide-react";
import { TeamData, StatLens } from "./getTeams";

interface TeamTableProps {
  teams: TeamData[];
  onSelectTeam: (team: TeamData) => void;
  lens: StatLens;
  onLensChange: (lens: StatLens) => void;
  search: string;
  onSearchChange: (search: string) => void;
}

export default function TeamTable({
  teams,
  onSelectTeam,
  lens,
  onLensChange,
  search,
  onSearchChange,
}: TeamTableProps) {
  const [isCompact, setIsCompact] = useState(false);

  const lensOptions: { value: StatLens; label: string }[] = [
    { value: "fantasy", label: "Fantasy" },
    { value: "disposals", label: "Disposals" },
    { value: "goals", label: "Goals" },
  ];

  const allRounds = teams.length > 0 ? teams[0].rounds.map(r => r.round) : [];

  return (
    <div className="space-y-4">
      <div className="flex flex-col lg:flex-row gap-4 items-start lg:items-center justify-between rounded-xl border border-white/10 bg-black/40 backdrop-blur-xl p-4">
        <div className="relative flex-1 w-full lg:w-auto lg:max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-white/40" />
          <input
            type="text"
            placeholder="Search team name or abbreviation"
            value={search}
            onChange={(e) => onSearchChange(e.target.value)}
            className="w-full pl-10 pr-4 py-2 rounded-lg border border-white/10 bg-black/60 text-white text-sm placeholder:text-white/40 focus:outline-none focus:ring-2 focus:ring-yellow-400/50"
          />
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <div className="flex gap-2">
            {lensOptions.map((option) => (
              <button
                key={option.value}
                onClick={() => onLensChange(option.value)}
                className={`px-3.5 py-1.5 rounded-full border text-xs font-medium transition-all ${
                  lens === option.value
                    ? "bg-yellow-400 text-black border-yellow-300 shadow-[0_0_20px_rgba(250,204,21,0.7)]"
                    : "bg-black/40 border-white/20 text-white/70 hover:border-yellow-400/60"
                }`}
              >
                {option.label}
              </button>
            ))}
          </div>

          <button
            onClick={() => setIsCompact(!isCompact)}
            className="p-2 rounded-lg border border-white/10 bg-black/60 text-white/70 hover:text-white hover:border-yellow-400/60 transition-all"
            title={isCompact ? "Comfortable view" : "Compact view"}
          >
            {isCompact ? <Maximize2 className="h-4 w-4" /> : <Minimize2 className="h-4 w-4" />}
          </button>
        </div>
      </div>

      <div className="rounded-xl border border-white/10 bg-black/40 backdrop-blur-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="border-b border-white/10">
              <tr className="bg-white/5">
                <th className="sticky left-0 z-10 bg-black/80 backdrop-blur-xl px-4 py-3 text-left text-xs font-semibold text-white/70 uppercase tracking-wider border-r border-white/10">
                  Team
                </th>
                {allRounds.map((round) => (
                  <th
                    key={round}
                    className="px-3 py-3 text-center text-xs font-semibold text-white/70 uppercase tracking-wider min-w-[70px]"
                  >
                    {round}
                  </th>
                ))}
                <th className="sticky right-0 z-10 bg-black/80 backdrop-blur-xl px-4 py-3 text-left text-xs font-semibold text-white/70 uppercase tracking-wider border-l border-white/10 min-w-[200px]">
                  Stats & Hit Rate
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {teams.length === 0 ? (
                <tr>
                  <td colSpan={allRounds.length + 2} className="px-4 py-12 text-center text-white/50">
                    No teams found matching your search
                  </td>
                </tr>
              ) : (
                teams.map((team) => (
                  <tr
                    key={team.id}
                    onClick={() => onSelectTeam(team)}
                    className="hover:bg-white/5 cursor-pointer transition-colors group"
                  >
                    <td className={`sticky left-0 z-10 bg-black/80 backdrop-blur-xl border-r border-white/10 group-hover:bg-white/5 ${
                      isCompact ? "px-3 py-2" : "px-4 py-4"
                    }`}>
                      <div className="flex items-center gap-3">
                        <div
                          className="w-1 h-10 rounded-full"
                          style={{ backgroundColor: team.color }}
                        />
                        <div>
                          <div className={`font-medium text-white ${isCompact ? "text-sm" : ""}`}>
                            {team.name}
                          </div>
                          <div className={`text-white/50 ${isCompact ? "text-xs" : "text-sm"}`}>
                            {team.abbreviation}
                          </div>
                        </div>
                      </div>
                    </td>

                    {team.rounds.map((round) => (
                      <td
                        key={round.round}
                        className={`text-center ${isCompact ? "px-2 py-2" : "px-3 py-4"}`}
                      >
                        <div
                          className={`inline-flex items-center justify-center rounded-md font-semibold ${
                            isCompact ? "text-xs px-2 py-1 min-w-[52px]" : "text-sm px-2.5 py-1.5 min-w-[60px]"
                          } ${
                            round.score >= 1800
                              ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/40"
                              : round.score >= 1600
                              ? "bg-yellow-500/20 text-yellow-300 border border-yellow-500/40"
                              : "bg-red-500/20 text-red-300 border border-red-500/40"
                          }`}
                        >
                          {round.score}
                        </div>
                      </td>
                    ))}

                    <td className={`sticky right-0 z-10 bg-black/80 backdrop-blur-xl border-l border-white/10 group-hover:bg-white/5 ${
                      isCompact ? "px-3 py-2" : "px-4 py-4"
                    }`}>
                      <div className="space-y-2">
                        <div className="flex items-center gap-3 text-xs">
                          <span className="text-white/50">AVG</span>
                          <span className="font-semibold text-yellow-400">{team.stats.avg}</span>
                          <span className="text-white/30">·</span>
                          <span className="text-white/50">MIN</span>
                          <span className="text-white">{team.stats.min}</span>
                          <span className="text-white/30">·</span>
                          <span className="text-white/50">MAX</span>
                          <span className="text-white">{team.stats.max}</span>
                        </div>
                        <div className="space-y-1">
                          {team.hitRates.slice(0, 3).map((hr) => (
                            <div key={hr.threshold} className="flex items-center gap-2">
                              <span className="text-[10px] text-white/40 w-10">{hr.threshold}+</span>
                              <div className="flex-1 h-1.5 bg-white/10 rounded-full overflow-hidden">
                                <div
                                  className="h-full bg-gradient-to-r from-yellow-400 to-yellow-500"
                                  style={{ width: `${hr.percentage}%` }}
                                />
                              </div>
                              <span className="text-[10px] text-white/50 w-10 text-right">
                                {Math.round(hr.percentage)}%
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {teams.length > 0 && (
        <div className="text-center text-sm text-white/50">
          Showing {teams.length} team{teams.length !== 1 ? "s" : ""}
        </div>
      )}
    </div>
  );
}
