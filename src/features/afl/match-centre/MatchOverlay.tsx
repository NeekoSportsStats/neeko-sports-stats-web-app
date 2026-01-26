import React, { useEffect, useRef, useState, useMemo } from "react";
import { X, MapPin, Clock } from "lucide-react";
import type { MatchData, PlayerData, TopPlayer } from "./getMatches";
import { getMatchPlayers, getTopPlayers } from "./getMatches";
import MatchScatter from "./MatchScatter";

interface MatchOverlayProps {
  match: MatchData;
  onClose: () => void;
}

function formatLocalTime(localIso: string | null, utcIso: string | null) {
  const iso = localIso || utcIso;
  if (!iso) return "TBC";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "TBC";
  return d.toLocaleString(undefined, { weekday: "short", hour: "numeric", minute: "2-digit" });
}

interface TeamTopPlayersProps {
  team: string;
  players: TopPlayer[];
}

function TeamTopPlayers({ team, players }: TeamTopPlayersProps) {
  return (
    <div className="rounded-2xl border border-white/10 bg-black/40 p-5">
      <div className="text-xs uppercase tracking-wider text-white/60 mb-3">
        {team} • Top 3 Players
      </div>
      {players.length === 0 ? (
        <div className="text-white/50">No data</div>
      ) : (
        <div className="space-y-3">
          {players.map((p, idx) => (
            <div
              key={idx}
              className="rounded-xl border border-white/10 bg-black/50 px-4 py-3"
            >
              <div className="flex items-center justify-between mb-2">
                <div className="text-white font-medium">{p.player}</div>
                <div className="text-[#F5C84C] font-bold">{p.fantasy_points}</div>
              </div>
              <div className="flex items-center gap-4 text-xs text-white/60">
                <span>Disposals: {p.disposals}</span>
                <span>Goals: {p.goals}</span>
                <span>Tackles: {p.tackles}</span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default function MatchOverlay({ match, onClose }: MatchOverlayProps) {
  const overlayRef = useRef<HTMLDivElement>(null);
  const [topPlayers, setTopPlayers] = useState<TopPlayer[]>([]);
  const [players, setPlayers] = useState<PlayerData[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [onClose]);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      try {
        const [tp, pl] = await Promise.all([
          getTopPlayers(match.season, match.roundNumber, match.matchIndex),
          getMatchPlayers(match.season, match.roundNumber, match.matchIndex),
        ]);
        setTopPlayers(tp);
        setPlayers(pl);

        if (tp.length === 0) {
          console.warn("No top players returned from SQL view", {
            season: match.season,
            round: match.roundNumber,
            matchIndex: match.matchIndex,
          });
        }
      } catch (e) {
        console.error("Overlay load failed:", e);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [match.season, match.roundNumber, match.matchIndex]);

  const playersByTeam = useMemo(() => {
    const teams = [...new Set(topPlayers.map((p) => p.team))];
    const map: Record<string, TopPlayer[]> = {};
    teams.forEach((team) => {
      map[team] = topPlayers
        .filter((p) => p.team === team)
        .sort((a, b) => b.fantasy_points - a.fantasy_points)
        .slice(0, 3);
    });
    return map;
  }, [topPlayers]);

  return (
    <div
      ref={overlayRef}
      className="fixed inset-0 z-[80] bg-black/70 backdrop-blur-sm flex items-start justify-center p-4 md:p-8 overflow-y-auto"
      onClick={(e) => {
        if (e.target === overlayRef.current) onClose();
      }}
    >
      <div className="w-full max-w-5xl rounded-2xl border border-white/10 bg-black/70 backdrop-blur-xl shadow-2xl overflow-hidden">
        <div className="flex items-center justify-between p-5 border-b border-white/10">
          <div>
            <div className="text-xs uppercase tracking-wider text-white/60">
              {match.roundLabel ?? "AFL"} • {match.season} • {match.status ?? ""}
            </div>
            <div className="text-2xl font-bold text-white">Match Detail</div>
          </div>
          <button
            onClick={onClose}
            className="h-10 w-10 rounded-xl border border-white/10 bg-white/5 hover:bg-white/10 flex items-center justify-center"
          >
            <X className="h-5 w-5 text-white/80" />
          </button>
        </div>

        <div className="p-6 space-y-6">
          <div className="rounded-2xl border border-white/10 bg-black/40 p-6">
            <div className="grid grid-cols-3 items-center gap-4">
              <div>
                <div className="text-white font-semibold text-xl">{match.homeTeam.name}</div>
                <div className="text-[#F5C84C] text-2xl font-bold">
                  {match.homeScore ?? "—"}
                </div>
              </div>
              <div className="text-center text-white/40 text-3xl font-black">VS</div>
              <div className="text-right">
                <div className="text-white font-semibold text-xl">{match.awayTeam.name}</div>
                <div className="text-[#F5C84C] text-2xl font-bold">
                  {match.awayScore ?? "—"}
                </div>
              </div>
            </div>

            <div className="mt-5 pt-5 border-t border-white/10 flex flex-wrap gap-5 text-sm text-white/70">
              <div className="flex items-center gap-2">
                <MapPin className="h-4 w-4 text-white/50" />
                <span>{match.venue ?? "TBC"}</span>
              </div>
              <div className="flex items-center gap-2">
                <Clock className="h-4 w-4 text-white/50" />
                <span>{formatLocalTime(match.gameTimeLocal, match.gameTime)}</span>
              </div>
            </div>
          </div>

          {loading ? (
            <div className="flex items-center justify-center py-10">
              <div className="flex flex-col items-center gap-3">
                <div className="w-10 h-10 border-4 border-yellow-400/20 border-t-yellow-400 rounded-full animate-spin" />
                <p className="text-white/50 text-sm">Loading players...</p>
              </div>
            </div>
          ) : (
            <>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {Object.entries(playersByTeam).map(([team, players]) => (
                  <TeamTopPlayers key={team} team={team} players={players} />
                ))}
              </div>

              <MatchScatter players={players} />

              <div className="rounded-2xl border border-[#F5C84C]/30 bg-gradient-to-r from-[#F5C84C]/20 to-transparent p-6">
                <div className="text-white font-semibold mb-1">AI Match Preview</div>
                <div className="text-white/70 text-sm">
                  Coming soon — will use player efficiency/volume and team context.
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
