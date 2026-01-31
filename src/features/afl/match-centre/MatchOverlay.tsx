import React, { useEffect, useRef, useState, useMemo, useCallback } from "react";
import { X, MapPin, Clock } from "lucide-react";
import { fetchMatchPlayers, computeTop3, type MatchPlayer } from "@/lib/afl/matchCenter";
import MatchScatter from "./MatchScatter";

type MatchData = {
  vendor_game_id?: string;
  match_id?: string;
  season?: number;
  round_number?: number;
  round_label?: string;
  match_index?: number;
  venue?: string;
  status?: string;
  home_score?: number | null;
  away_score?: number | null;
  homeTeam: { name: string; color: string | null };
  awayTeam: { name: string; color: string | null };
  gameTime: string | null;
  gameTimeLocal: string | null;
  vendorGameId?: number;
  roundNumber?: number;
  roundLabel?: string;
  homeScore?: number | null;
  awayScore?: number | null;
};

interface MatchOverlayProps {
  match: MatchData;
  onClose: () => void;
}

type PlayerData = {
  player: string;
  team: string;
  teamColor?: string | null;
  disposals: number | null;
  fantasyPoints: number | null;
  goals?: number | null;
  position?: string | null;
};

function formatLocalTime(localIso: string | null, utcIso: string | null) {
  const iso = localIso || utcIso;
  if (!iso) return "TBC";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "TBC";
  return d.toLocaleString(undefined, { weekday: "short", hour: "numeric", minute: "2-digit" });
}

function adaptPlayer(mp: MatchPlayer): PlayerData {
  return {
    player: mp.player_name ?? "Unknown",
    team: mp.team_name ?? "Unknown",
    teamColor: mp.team_color ?? null,
    disposals: mp.disposals ?? 0,
    fantasyPoints: mp.fantasy_points ?? 0,
    goals: mp.goals ?? 0,
    position: mp.player_role ?? null,
  };
}

interface TeamTopPlayersProps {
  team: string;
  players: PlayerData[];
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
                <div className="text-[#F5C84C] font-bold">{p.fantasyPoints ?? 0}</div>
              </div>
              <div className="flex items-center gap-4 text-xs text-white/60">
                <span>Disposals: {p.disposals ?? 0}</span>
                <span>Goals: {p.goals ?? 0}</span>
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
  const [players, setPlayers] = useState<PlayerData[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [onClose]);

  const loadPlayers = useCallback(async () => {
    setLoading(true);
    try {
      const season = match.season ?? 2025;
      const roundNumber = match.round_number ?? match.roundNumber ?? 1;
      const matchIndex = match.match_index ?? 0;

      console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
      console.log("[MatchOverlay] SELECTED MATCH:");
      console.log("  Header shows:", match.homeTeam.name, "vs", match.awayTeam.name);
      console.log("  match.match_index:", match.match_index);
      console.log("  match.season:", match.season);
      console.log("  match.round_number:", match.round_number);
      console.log("  vendor_game_id:", match.vendor_game_id);
      console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");

      console.log("[MatchOverlay] Query params:", {
        season,
        roundNumber,
        matchIndex,
      });

      const rawPlayers = await fetchMatchPlayers(season, roundNumber, matchIndex);
      const adaptedPlayers = rawPlayers.map(adaptPlayer);

      const returnedTeams = [...new Set(adaptedPlayers.map((p) => p.team))];
      console.log("[MatchOverlay] Returned teams:", returnedTeams);
      console.log("[MatchOverlay] Returned player count:", adaptedPlayers.length);

      const expectedTeams = [match.homeTeam.name, match.awayTeam.name];
      const teamsMatch =
        returnedTeams.length === 2 &&
        expectedTeams.every((t) => returnedTeams.includes(t));

      if (!teamsMatch) {
        console.error("❌ TEAM MISMATCH DETECTED!");
        console.error("  Expected:", expectedTeams);
        console.error("  Got:", returnedTeams);
        console.error("  This means the matchIndex is incorrect or the data is wrong.");
      } else {
        console.log("✅ Teams match correctly!");
      }
      console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");

      setPlayers(adaptedPlayers);
    } catch (e) {
      console.error("Overlay load failed:", e);
      setPlayers([]);
    } finally {
      setLoading(false);
    }
  }, [match.season, match.round_number, match.roundNumber, match.match_index, match.vendor_game_id, match.homeTeam.name, match.awayTeam.name]);

  useEffect(() => {
    loadPlayers();
  }, [loadPlayers]);

  const { leftTop3, rightTop3, leftTeam, rightTeam } = useMemo(() => {
    const teams = [...new Set(players.map((p) => p.team))].filter(Boolean);

    if (teams.length !== 2) {
      console.warn(
        `[MatchOverlay] match_index=${match.match_index} has ${teams.length} teams:`,
        teams
      );
    }

    const [left, right] = teams;

    if (!left) {
      return { leftTop3: [], rightTop3: [], leftTeam: "", rightTeam: "" };
    }

    const leftPlayers = players.filter((p) => p.team === left);
    const rightPlayers = right ? players.filter((p) => p.team === right) : [];

    const leftTop = computeTop3(leftPlayers.map((p) => ({
      fantasy_points: p.fantasyPoints ?? 0,
      disposals: p.disposals ?? 0,
      player_name: p.player,
      team_name: p.team,
    })));

    const rightTop = computeTop3(rightPlayers.map((p) => ({
      fantasy_points: p.fantasyPoints ?? 0,
      disposals: p.disposals ?? 0,
      player_name: p.player,
      team_name: p.team,
    })));

    const leftTop3Adapted = leftTop.map((mp): PlayerData => ({
      player: mp.player_name ?? "Unknown",
      team: mp.team_name ?? "Unknown",
      disposals: mp.disposals ?? 0,
      fantasyPoints: mp.fantasy_points ?? 0,
      goals: 0,
      position: null,
    }));

    const rightTop3Adapted = rightTop.map((mp): PlayerData => ({
      player: mp.player_name ?? "Unknown",
      team: mp.team_name ?? "Unknown",
      disposals: mp.disposals ?? 0,
      fantasyPoints: mp.fantasy_points ?? 0,
      goals: 0,
      position: null,
    }));

    return {
      leftTop3: leftTop3Adapted,
      rightTop3: rightTop3Adapted,
      leftTeam: left,
      rightTeam: right ?? "",
    };
  }, [players, match.match_index]);

  const roundLabel = match.round_label ?? match.roundLabel ?? "AFL";
  const season = match.season ?? 2025;
  const status = match.status ?? "";
  const venue = match.venue ?? "TBC";
  const homeScore = match.home_score ?? match.homeScore ?? null;
  const awayScore = match.away_score ?? match.awayScore ?? null;

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
              {roundLabel} • {season} • {status}
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
                  {homeScore ?? "—"}
                </div>
              </div>
              <div className="text-center text-white/40 text-3xl font-black">VS</div>
              <div className="text-right">
                <div className="text-white font-semibold text-xl">{match.awayTeam.name}</div>
                <div className="text-[#F5C84C] text-2xl font-bold">
                  {awayScore ?? "—"}
                </div>
              </div>
            </div>

            <div className="mt-5 pt-5 border-t border-white/10 flex flex-wrap gap-5 text-sm text-white/70">
              <div className="flex items-center gap-2">
                <MapPin className="h-4 w-4 text-white/50" />
                <span>{venue}</span>
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
                <TeamTopPlayers team={leftTeam} players={leftTop3} />
                <TeamTopPlayers team={rightTeam} players={rightTop3} />
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
