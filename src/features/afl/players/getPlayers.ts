import { supabase } from "@/lib/supabaseClient";

export type StatLens = "fantasy" | "disposals" | "goals";

export interface RoundScore {
  round: string;
  score: number;
}

export interface PlayerData {
  id: string;
  name: string;
  team: string;
  role: string;
  teamColor?: string;
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

export interface PlayersQueryParams {
  team?: string;
  search?: string;
  lens?: StatLens;
}

function generateMockPlayerData(): PlayerData[] {
  const teams = [
    { name: "Adelaide", color: "#002B5C" },
    { name: "Brisbane", color: "#A30046" },
    { name: "Carlton", color: "#0E1E2D" },
    { name: "Collingwood", color: "#000000" },
    { name: "Essendon", color: "#CC2031" },
    { name: "Fremantle", color: "#2A0D45" },
    { name: "Geelong", color: "#001F3D" },
    { name: "Gold Coast", color: "#C8102E" },
    { name: "GWS", color: "#F15A22" },
    { name: "Hawthorn", color: "#4D2004" },
    { name: "Melbourne", color: "#CC2031" },
    { name: "North Melbourne", color: "#003F87" },
    { name: "Port Adelaide", color: "#008AAB" },
    { name: "Richmond", color: "#FFD200" },
    { name: "St Kilda", color: "#ED0F05" },
    { name: "Sydney", color: "#ED171F" },
    { name: "West Coast", color: "#00209F" },
    { name: "Western Bulldogs", color: "#014896" },
  ];

  const roles = ["MID", "FWD", "DEF", "RUC"];
  const firstNames = ["Jack", "Tom", "Lachie", "Sam", "Bailey", "Nick", "Toby", "Max", "Marcus", "Zach"];
  const lastNames = ["Smith", "Jones", "Williams", "Brown", "Davis", "Wilson", "Moore", "Taylor", "Anderson", "Thomas"];

  const players: PlayerData[] = [];

  teams.forEach((team, teamIdx) => {
    for (let i = 0; i < 6; i++) {
      const firstName = firstNames[Math.floor(Math.random() * firstNames.length)];
      const lastName = lastNames[Math.floor(Math.random() * lastNames.length)];
      const role = roles[Math.floor(Math.random() * roles.length)];

      const rounds: RoundScore[] = [];
      const roundCount = 10;

      for (let r = 0; r <= roundCount; r++) {
        const roundLabel = r === 0 ? "OR" : `R${r}`;
        const baseScore = 60 + Math.random() * 40;
        const variance = (Math.random() - 0.5) * 30;
        const score = Math.max(20, Math.round(baseScore + variance));
        rounds.push({ round: roundLabel, score });
      }

      const scores = rounds.filter(r => r.round !== "OR").map(r => r.score);
      const avg = scores.reduce((a, b) => a + b, 0) / scores.length;
      const min = Math.min(...scores);
      const max = Math.max(...scores);
      const total = scores.reduce((a, b) => a + b, 0);
      const variance = scores.reduce((sum, val) => sum + Math.pow(val - avg, 2), 0) / scores.length;
      const volatility = Math.sqrt(variance);

      const hitRates = [60, 70, 80, 90, 100].map(threshold => {
        const count = scores.filter(s => s >= threshold).length;
        const percentage = (count / scores.length) * 100;
        return { threshold, percentage, count };
      });

      players.push({
        id: `${teamIdx}-${i}`,
        name: `${firstName} ${lastName}`,
        team: team.name,
        role,
        teamColor: team.color,
        rounds,
        stats: {
          avg: Math.round(avg * 10) / 10,
          min,
          max,
          games: scores.length,
          total,
          volatility: Math.round(volatility * 10) / 10,
        },
        hitRates,
      });
    }
  });

  return players.sort((a, b) => b.stats.avg - a.stats.avg);
}

export async function getPlayers(params?: PlayersQueryParams): Promise<PlayerData[]> {
  let players = generateMockPlayerData();

  if (params?.team && params.team !== "All Teams") {
    players = players.filter(p => p.team === params.team);
  }

  if (params?.search) {
    const search = params.search.toLowerCase();
    players = players.filter(p =>
      p.name.toLowerCase().includes(search) ||
      p.team.toLowerCase().includes(search) ||
      p.role.toLowerCase().includes(search)
    );
  }

  return players;
}

export async function getPlayerById(id: string): Promise<PlayerData | null> {
  const players = await getPlayers();
  return players.find(p => p.id === id) || null;
}

export function getAvailableTeams(): string[] {
  return [
    "All Teams",
    "Adelaide",
    "Brisbane",
    "Carlton",
    "Collingwood",
    "Essendon",
    "Fremantle",
    "Geelong",
    "Gold Coast",
    "GWS",
    "Hawthorn",
    "Melbourne",
    "North Melbourne",
    "Port Adelaide",
    "Richmond",
    "St Kilda",
    "Sydney",
    "West Coast",
    "Western Bulldogs",
  ];
}
