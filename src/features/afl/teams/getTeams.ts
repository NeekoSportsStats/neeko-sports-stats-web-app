import { supabase } from "@/lib/supabaseClient";

export type StatLens = "fantasy" | "disposals" | "goals";

export interface RoundScore {
  round: string;
  score: number;
}

export interface TeamData {
  id: string;
  name: string;
  abbreviation: string;
  color: string;
  rounds: RoundScore[];
  stats: {
    avg: number;
    min: number;
    max: number;
    games: number;
    total: number;
    volatility: number;
  };
  hitRates: {
    threshold: number;
    percentage: number;
    count: number;
  }[];
}

export interface TeamsQueryParams {
  search?: string;
  lens?: StatLens;
}

function generateMockTeamData(): TeamData[] {
  const teams = [
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

  const teamsData: TeamData[] = teams.map((team, idx) => {
    const rounds: RoundScore[] = [];
    const roundCount = 10;

    for (let r = 0; r <= roundCount; r++) {
      const roundLabel = r === 0 ? "OR" : `R${r}`;
      const baseScore = 1600 + Math.random() * 400;
      const variance = (Math.random() - 0.5) * 200;
      const score = Math.max(1200, Math.round(baseScore + variance));
      rounds.push({ round: roundLabel, score });
    }

    const scores = rounds.filter(r => r.round !== "OR").map(r => r.score);
    const avg = scores.reduce((a, b) => a + b, 0) / scores.length;
    const min = Math.min(...scores);
    const max = Math.max(...scores);
    const total = scores.reduce((a, b) => a + b, 0);
    const variance = scores.reduce((sum, val) => sum + Math.pow(val - avg, 2), 0) / scores.length;
    const volatility = Math.sqrt(variance);

    const hitRates = [1600, 1700, 1800, 1900, 2000].map(threshold => {
      const count = scores.filter(s => s >= threshold).length;
      const percentage = (count / scores.length) * 100;
      return { threshold, percentage, count };
    });

    return {
      id: `team-${idx}`,
      name: team.name,
      abbreviation: team.abbreviation,
      color: team.color,
      rounds,
      stats: {
        avg: Math.round(avg),
        min,
        max,
        games: scores.length,
        total,
        volatility: Math.round(volatility),
      },
      hitRates,
    };
  });

  return teamsData.sort((a, b) => b.stats.avg - a.stats.avg);
}

export async function getTeams(params?: TeamsQueryParams): Promise<TeamData[]> {
  let teams = generateMockTeamData();

  if (params?.search) {
    const search = params.search.toLowerCase();
    teams = teams.filter(t =>
      t.name.toLowerCase().includes(search) ||
      t.abbreviation.toLowerCase().includes(search)
    );
  }

  return teams;
}

export async function getTeamById(id: string): Promise<TeamData | null> {
  const teams = await getTeams();
  return teams.find(t => t.id === id) || null;
}
