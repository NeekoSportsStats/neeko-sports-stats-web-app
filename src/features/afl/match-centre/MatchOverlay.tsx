import React, { useEffect, useRef, useState } from "react";
import { X, MapPin, Clock } from "lucide-react";
import type { MatchData, PlayerData } from "./getMatches";
import { getMatchPlayers } from "./getMatches";
import MatchScatter from "./MatchScatter";
import { supabase } from "@/lib/supabaseClient";

interface MatchOverlayProps {
  match: MatchData;
  onClose: () => void;
}

type TopPlayer = {
  player: string;
  team: string;
  fantasyPoints: number;
};

async function getTop3Players(
  season: number,
  roundNumber: number,
  matchIndex: number,
  homeTeamName: string,
  awayTeamName: string
): Promise<{ home: TopPlayer[]; away: TopPlayer[] }> {
  const { data, error } = await supabase
    .schema("afl")
    .from("v_match_center_top_players_2025")
    .select("player, team, fantasy_points, team_rank, match_index, season, round_number")
    .eq("season", season)
    .eq("round_number", roundNumber)
    .eq("match_index", matchIndex)
    .lte("team_rank", 3)
    .order("team_rank", { ascending: true });

  if (error || !data) return { home: [], away: [] };

  const home: TopPlayer[] = [];
  const away: TopPlayer[] = [];

  for (const r of data as any[]) {
    const item: TopPlayer = {
      player: r.player,
      team: r.team,
      fantasyPoints: Number(r.fantasy_points ?? 0),
    };

    if (r.team === homeTeamName) home.push(item);
    else if (r.team === awayTeamName) away.push(item);
  }

  return { home, away };
}

function formatLocalTime(localIso: string | null, utcIso: string | null) {
  const iso = localIso || utcIso;
  if (!iso) return "TBC";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "TBC";
  return d.toLocaleString(undefined, { weekday: "short", hour: "numeric", minute: "2-digit" });
}

export default function MatchOverlay({ match, onClose }: MatchOverlayProps) {
  const overlayRef = useRef<HTMLDivElement>(null);
  const [topPlayers, setTopPlayers] = useState<{ home: TopPlayer[]; away: TopPlayer[] }>({
    home: [],
    away: [],
  });
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
          getTop3Players(
            match.season,
            match.roundNumber,
            match.matchIndex,
            match.homeTeam.name,
            match.awayTeam.name
          ),
          getMatchPlayers(match.season, match.roundNumber, match.matchIndex),
        ]);
        setTopPlayers(tp);
        setPlayers(pl);
      } catch (e) {
        console.error("Overlay load failed:", e);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [match.season, match.roundNumber, match.matchIndex, match.homeTeam.name, match.awayTeam.name]);

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

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="rounded-2xl border border-white/10 bg-black/40 p-5">
              <div className="text-xs uppercase tracking-wider text-white/60 mb-3">
                {match.homeTeam.name} • Top 3 Players
              </div>
              {loading ? (
                <div className="text-white/60">Loading…</div>
              ) : topPlayers.home.length === 0 ? (
                <div className="text-white/50">No data</div>
              ) : (
                <div className="space-y-3">
                  {topPlayers.home.map((p, idx) => (
                    <div
                      key={idx}
                      className="rounded-xl border border-white/10 bg-black/50 px-4 py-3 flex items-center justify-between"
                    >
                      <div className="text-white font-medium">{p.player}</div>
                      <div className="text-[#F5C84C] font-bold">{p.fantasyPoints}</div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="rounded-2xl border border-white/10 bg-black/40 p-5">
              <div className="text-xs uppercase tracking-wider text-white/60 mb-3">
                {match.awayTeam.name} • Top 3 Players
              </div>
              {loading ? (
                <div className="text-white/60">Loading…</div>
              ) : topPlayers.away.length === 0 ? (
                <div className="text-white/50">No data</div>
              ) : (
                <div className="space-y-3">
                  {topPlayers.away.map((p, idx) => (
                    <div
                      key={idx}
                      className="rounded-xl border border-white/10 bg-black/50 px-4 py-3 flex items-center justify-between"
                    >
                      <div className="text-white font-medium">{p.player}</div>
                      <div className="text-[#F5C84C] font-bold">{p.fantasyPoints}</div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          <MatchScatter players={players} />

          <div className="rounded-2xl border border-[#F5C84C]/30 bg-gradient-to-r from-[#F5C84C]/20 to-transparent p-6">
            <div className="text-white font-semibold mb-1">AI Match Preview</div>
            <div className="text-white/70 text-sm">
              Coming soon — will use player efficiency/volume and team context.
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
