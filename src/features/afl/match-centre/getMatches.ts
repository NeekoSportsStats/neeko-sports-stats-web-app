import { supabase } from "@/lib/supabaseClient";

export type TeamMini = {
  name: string;
  color?: string | null;
};

export type MatchData = {
  vendorGameId: number;
  season: number;
  roundNumber: number;
  roundLabel: string | null;
  matchIndex: number;
  venue: string | null;
  status: string | null;
  homeScore: number | null;
  awayScore: number | null;
  gameTime: string | null;
  gameTimeLocal: string | null;
  homeTeam: TeamMini;
  awayTeam: TeamMini;
};

export type DayGroup = {
  season: number;
  roundNumber: number;
  roundLabel: string | null;
  matchDay: string;
  dayLabel: string;
  matches: MatchData[];
};

export type PlayerData = {
  player: string;
  team: string;
  teamColor?: string | null;
  disposals: number | null;
  fantasyPoints: number | null;
  goals?: number | null;
  position?: string | null;
};

export type TopPlayer = {
  season: number;
  round_number: number;
  match_index: number;
  team: string;
  opponent: string;
  player: string;
  fantasy_points: number;
  disposals: number;
  goals: number;
  tackles: number;
};

function formatDayLabel(isoDate: string) {
  const d = new Date(isoDate + "T00:00:00");
  return d.toLocaleDateString(undefined, {
    weekday: "long",
    day: "numeric",
    month: "long",
  });
}

function safeNum(v: any): number | null {
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

export async function getRoundMatches(season: number, roundNumber: number): Promise<DayGroup[]> {
  const { data, error } = await supabase
    .schema("afl")
    .from("v_match_center_round_days")
    .select("*")
    .eq("season", season)
    .eq("round_number", roundNumber)
    .order("match_day", { ascending: true });

  if (error) throw error;
  if (!data || data.length === 0) return [];

  console.log(`[getRoundMatches] Loading S${season} R${roundNumber}`);

  return data.map((row: any) => {
    const matchDay: string = row.match_day;
    const matchesRaw: any[] = Array.isArray(row.matches) ? row.matches : [];

    const matches: MatchData[] = matchesRaw.map((m: any) => {
      const matchIndex = Number(m.match_index ?? 0);
      const homeTeam = m.home_team ?? m.home_team_name ?? "Home";
      const awayTeam = m.away_team ?? m.away_team_name ?? "Away";

      console.log(`[getRoundMatches]   ${homeTeam} vs ${awayTeam} | matchIndex: ${matchIndex} | raw: ${m.match_index}`);

      return {
        vendorGameId: Number(m.vendor_game_id),
        season: Number(row.season),
        roundNumber: Number(row.round_number),
        roundLabel: row.round_label ?? null,
        matchIndex: matchIndex,
        venue: m.venue ?? null,
        status: m.status ?? null,
        homeScore: safeNum(m.home_score),
        awayScore: safeNum(m.away_score),
        gameTime: m.game_time ?? null,
        gameTimeLocal: m.game_time_local ?? null,
        homeTeam: {
          name: homeTeam,
          color: m.home_color ?? null,
        },
        awayTeam: {
          name: awayTeam,
          color: m.away_color ?? null,
        },
      };
    });

    return {
      season: Number(row.season),
      roundNumber: Number(row.round_number),
      roundLabel: row.round_label ?? null,
      matchDay,
      dayLabel: formatDayLabel(matchDay),
      matches,
    } satisfies DayGroup;
  });
}

export async function getMatchPlayers(
  season: number,
  roundNumber: number,
  matchIndex: number
): Promise<PlayerData[]> {
  console.log(`[getMatchPlayers] Querying canonical view: season=${season}, round=${roundNumber}, matchIndex=${matchIndex}`);

  const { data, error } = await supabase
    .schema("afl")
    .from("v_match_center_players_2025_canonical")
    .select("player_name, team_name, team_color, disposals, fantasy_points, goals, player_role")
    .eq("season", season)
    .eq("round_number", roundNumber)
    .eq("match_index", matchIndex)
    .order("fantasy_points", { ascending: false });

  if (error) {
    console.error("[getMatchPlayers] Query error:", error);
    throw error;
  }

  const teams = [...new Set((data ?? []).map((r: any) => r.team_name))];
  console.log(`[getMatchPlayers] Returned ${data?.length ?? 0} players from teams:`, teams);

  if (teams.length !== 2) {
    console.warn(`[getMatchPlayers] ⚠️ Expected exactly 2 teams, got ${teams.length}:`, teams);
  }

  if (data && data.length !== 46) {
    console.warn(`[getMatchPlayers] ⚠️ Expected ~46 players, got ${data.length}`);
  }

  console.log("[MatchCentre]", {
    season,
    roundNumber,
    matchIndex,
    teams,
    playerCount: data?.length ?? 0,
  });

  return (data ?? []).map((r: any) => ({
    player: r.player_name,
    team: r.team_name,
    teamColor: r.team_color ?? null,
    disposals: safeNum(r.disposals),
    fantasyPoints: safeNum(r.fantasy_points),
    goals: safeNum(r.goals),
    position: r.player_role ?? null,
  }));
}

export async function getTopPlayers(
  season: number,
  roundNumber: number,
  matchIndex: number
): Promise<TopPlayer[]> {
  const { data, error } = await supabase
    .schema("afl")
    .from("v_match_center_top3_players_2025")
    .select("season, round_number, match_index, team_abbr, player_name, fantasy_points, disposals, goals")
    .eq("season", season)
    .eq("round_number", roundNumber)
    .eq("match_index", matchIndex)
    .order("team_abbr", { ascending: true })
    .order("fantasy_points", { ascending: false });

  if (error) throw error;

  const teams = [...new Set((data ?? []).map((r: any) => r.team_abbr))];
  const opponent = teams.length === 2
    ? (team: string) => teams.find(t => t !== team) ?? ""
    : () => "";

  return (data ?? []).map((r: any) => ({
    season: r.season,
    round_number: r.round_number,
    match_index: r.match_index,
    team: r.team_abbr,
    opponent: opponent(r.team_abbr),
    player: r.player_name,
    fantasy_points: r.fantasy_points ?? 0,
    disposals: r.disposals ?? 0,
    goals: r.goals ?? 0,
    tackles: 0,
  }));
}
