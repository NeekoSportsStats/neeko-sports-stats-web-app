import { supabase } from "@/lib/supabaseClient";

export type MatchStatus = "upcoming" | "live" | "final";

export interface TeamInfo {
  id: string;
  name: string;
  abbreviation: string;
  color: string;
  ladderPosition?: number;
  momentum?: number;
  ceiling?: number;
  recentForm?: string[];
}

export interface PlayerInfo {
  id: string;
  name: string;
  role: string;
  avgScore: number;
  recentForm: number[];
}

export interface MatchData {
  id: string;
  round: string;
  season: number;
  match_index: number; // Added to support double-header rounds (e.g., R24 2025)
  status: MatchStatus;
  homeTeam: TeamInfo;
  awayTeam: TeamInfo;
  venue: string;
  date: string;
  time: string;
  homeTopPlayers?: PlayerInfo[];
  awayTopPlayers?: PlayerInfo[];
  aiSummary?: string;
}

export interface MatchesQueryParams {
  season?: number;
  round?: string;
}

const AFL_TEAMS = [
  { name: "Adelaide Crows", abbreviation: "ADE", color: "#002B5C" },
  { name: "Brisbane Lions", abbreviation: "BRL", color: "#A30046" },
  { name: "Carlton Blues", abbreviation: "CAR", color: "#0E1E2D" },
  { name: "Collingwood Magpies", abbreviation: "COL", color: "#000000" },
  { name: "Essendon Bombers", abbreviation: "ESS", color: "#CC2031" },
  { name: "Fremantle Dockers", abbreviation: "FRE", color: "#2A0D45" },
  { name: "Geelong Cats", abbreviation: "GEE", color: "#001F3D" },
  { name: "Gold Coast Suns", abbreviation: "GCS", color: "#C8102E" },
  { name: "GWS Giants", abbreviation: "GWS", color: "#F15A22" },
  { name: "Hawthorn Hawks", abbreviation: "HAW", color: "#4D2004" },
  { name: "Melbourne Demons", abbreviation: "MEL", color: "#CC2031" },
  { name: "North Melbourne Kangaroos", abbreviation: "NTH", color: "#003F87" },
  { name: "Port Adelaide Power", abbreviation: "POR", color: "#008AAB" },
  { name: "Richmond Tigers", abbreviation: "RIC", color: "#FFD200" },
  { name: "St Kilda Saints", abbreviation: "STK", color: "#ED0F05" },
  { name: "Sydney Swans", abbreviation: "SYD", color: "#ED171F" },
  { name: "West Coast Eagles", abbreviation: "WCE", color: "#00209F" },
  { name: "Western Bulldogs", abbreviation: "WBD", color: "#014896" },
];

const VENUES = [
  "Adelaide Oval",
  "MCG",
  "Marvel Stadium",
  "Optus Stadium",
  "Gabba",
  "SCG",
  "GIANTS Stadium",
  "Kardinia Park",
  "Metricon Stadium",
  "Marvel Stadium",
];

const PLAYER_NAMES = [
  "Marcus Bontempelli", "Patrick Cripps", "Christian Petracca", "Lachie Neale",
  "Clayton Oliver", "Jack Steele", "Touk Miller", "Andrew Brayshaw",
  "Zach Merrett", "Callum Mills", "Max Gawn", "Brodie Grundy",
  "Nick Daicos", "Isaac Heeney", "Chad Warner", "Errol Gulden",
  "Jordan Dawson", "Sam Walsh", "Travis Boak", "Jeremy Cameron",
];

function generateMockMatches(season: number, round: string): MatchData[] {
  const matches: MatchData[] = [];
  const teamsShuffled = [...AFL_TEAMS].sort(() => Math.random() - 0.5);
  const matchCount = 9;

  for (let i = 0; i < matchCount; i++) {
    const homeTeam = teamsShuffled[i * 2];
    const awayTeam = teamsShuffled[i * 2 + 1];

    if (!homeTeam || !awayTeam) continue;

    const homeInfo: TeamInfo = {
      id: `team-${i * 2}`,
      name: homeTeam.name,
      abbreviation: homeTeam.abbreviation,
      color: homeTeam.color,
      ladderPosition: Math.floor(Math.random() * 18) + 1,
      momentum: Math.random() * 100,
      ceiling: Math.random() * 100,
      recentForm: ["W", "L", "W", "W", "L"].slice(0, 5),
    };

    const awayInfo: TeamInfo = {
      id: `team-${i * 2 + 1}`,
      name: awayTeam.name,
      abbreviation: awayTeam.abbreviation,
      color: awayTeam.color,
      ladderPosition: Math.floor(Math.random() * 18) + 1,
      momentum: Math.random() * 100,
      ceiling: Math.random() * 100,
      recentForm: ["L", "W", "W", "L", "W"].slice(0, 5),
    };

    const homeTopPlayers: PlayerInfo[] = [];
    const awayTopPlayers: PlayerInfo[] = [];

    for (let j = 0; j < 3; j++) {
      homeTopPlayers.push({
        id: `player-${i}-home-${j}`,
        name: PLAYER_NAMES[Math.floor(Math.random() * PLAYER_NAMES.length)],
        role: ["MID", "FWD", "DEF"][Math.floor(Math.random() * 3)],
        avgScore: Math.floor(70 + Math.random() * 40),
        recentForm: Array(5).fill(0).map(() => Math.floor(60 + Math.random() * 50)),
      });

      awayTopPlayers.push({
        id: `player-${i}-away-${j}`,
        name: PLAYER_NAMES[Math.floor(Math.random() * PLAYER_NAMES.length)],
        role: ["MID", "FWD", "DEF"][Math.floor(Math.random() * 3)],
        avgScore: Math.floor(70 + Math.random() * 40),
        recentForm: Array(5).fill(0).map(() => Math.floor(60 + Math.random() * 50)),
      });
    }

    const dayOffset = i % 3;
    const matchDate = new Date(2025, 2, 21 + dayOffset);
    const dateStr = matchDate.toLocaleDateString("en-AU", {
      weekday: "short",
      month: "short",
      day: "numeric",
    });
    const timeOptions = ["7:20 PM", "7:50 PM", "1:10 PM", "3:20 PM", "4:35 PM"];
    const time = timeOptions[i % timeOptions.length];

    matches.push({
      id: `match-${season}-${round}-${i}-match1`, // Include match_index in ID for uniqueness
      round,
      season,
      match_index: 1, // Default to 1 for regular rounds
      status: "upcoming",
      homeTeam: homeInfo,
      awayTeam: awayInfo,
      venue: VENUES[i % VENUES.length],
      date: dateStr,
      time,
      homeTopPlayers,
      awayTopPlayers,
      aiSummary: `${homeInfo.name} enters this clash with strong recent form, while ${awayInfo.name} looks to bounce back. Key battles in the midfield will determine the outcome.`,
    });
  }

  return matches;
}

export async function getMatches(params?: MatchesQueryParams): Promise<MatchData[]> {
  const season = params?.season || 2025;
  const round = params?.round || "R1";

  const matches = generateMockMatches(season, round);
  return matches;
}

export async function getMatchById(id: string): Promise<MatchData | null> {
  const allMatches = await getMatches();
  return allMatches.find((m) => m.id === id) || null;
}

export function getAvailableSeasons(): number[] {
  return [2025, 2026];
}

export function getAvailableRounds(): string[] {
  return ["OR", ...Array.from({ length: 24 }, (_, i) => `R${i + 1}`)];
}
