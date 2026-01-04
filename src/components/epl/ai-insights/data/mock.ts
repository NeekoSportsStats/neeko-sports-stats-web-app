/* -------------------------------------------------------------------------- */
/* LOCAL MOCK TYPES (UI-ONLY)                                                  */
/* -------------------------------------------------------------------------- */

export interface WeeklyPlayerStat {
  playerId: string;
  playerName: string;
  teamId: string;
  teamName: string;
  role: "FWD" | "MID" | "DEF" | "GK";
  round: string;
  venue: string;
  opponentTeamId: string;
  opponentTeamName: string;
  fantasy: number;
  goals: number;
  assists: number;
  shots: number;
  shotsOnTarget: number;
  xg: number;
}

export interface WeeklyTeamStat {
  teamId: string;
  teamName: string;
  round: string;
  venue: string;
  opponentTeamId: string;
  opponentTeamName: string;
  fantasyTotal: number;
  goalsTotal: number;
  assistsTotal: number;
  shotsTotal: number;
  pointsFor: number;
  pointsAgainst: number;
  halfPointsFor: [number, number];
  halfPointsAgainst: [number, number];
}

export interface HeadToHeadContext {
  homeTeamId: string;
  awayTeamId: string;
  venue: string;
  roundLabel: string;
}

/* -------------------------------------------------------------------------- */
/* MOCK CONTEXT                                                               */
/* -------------------------------------------------------------------------- */

const TEAMS = [
  { id: "MCI", name: "Manchester City" },
  { id: "ARS", name: "Arsenal" },
];

const VENUES = ["Etihad Stadium", "Emirates Stadium", "Old Trafford", "Anfield"];

const rnd = (min: number, max: number) =>
  Math.round(min + Math.random() * (max - min));

function rounds(n = 14) {
  const out: string[] = [];
  for (let i = 1; i <= n; i++) out.push(`GW${i}`);
  return out;
}

export const MOCK_CONTEXT: HeadToHeadContext = {
  homeTeamId: "MCI",
  awayTeamId: "ARS",
  venue: "Etihad Stadium",
  roundLabel: "GW12",
};

/* -------------------------------------------------------------------------- */
/* PLAYERS                                                                    */
/* -------------------------------------------------------------------------- */

const PLAYERS = [
  // Manchester City (15)
  { id: "c1", name: "Erling Haaland", teamId: "MCI", teamName: "Manchester City", role: "FWD" as const },
  { id: "c2", name: "Kevin De Bruyne", teamId: "MCI", teamName: "Manchester City", role: "MID" as const },
  { id: "c3", name: "Bernardo Silva", teamId: "MCI", teamName: "Manchester City", role: "MID" as const },
  { id: "c4", name: "Phil Foden", teamId: "MCI", teamName: "Manchester City", role: "MID" as const },
  { id: "c5", name: "Jack Grealish", teamId: "MCI", teamName: "Manchester City", role: "MID" as const },
  { id: "c6", name: "Julian Alvarez", teamId: "MCI", teamName: "Manchester City", role: "FWD" as const },
  { id: "c7", name: "Rodri", teamId: "MCI", teamName: "Manchester City", role: "MID" as const },
  { id: "c8", name: "Ruben Dias", teamId: "MCI", teamName: "Manchester City", role: "DEF" as const },
  { id: "c9", name: "John Stones", teamId: "MCI", teamName: "Manchester City", role: "DEF" as const },
  { id: "c10", name: "Kyle Walker", teamId: "MCI", teamName: "Manchester City", role: "DEF" as const },
  { id: "c11", name: "Josko Gvardiol", teamId: "MCI", teamName: "Manchester City", role: "DEF" as const },
  { id: "c12", name: "Nathan Ake", teamId: "MCI", teamName: "Manchester City", role: "DEF" as const },
  { id: "c13", name: "Jeremy Doku", teamId: "MCI", teamName: "Manchester City", role: "FWD" as const },
  { id: "c14", name: "Mateo Kovacic", teamId: "MCI", teamName: "Manchester City", role: "MID" as const },
  { id: "c15", name: "Ederson", teamId: "MCI", teamName: "Manchester City", role: "GK" as const },

  // Arsenal (15)
  { id: "a1", name: "Bukayo Saka", teamId: "ARS", teamName: "Arsenal", role: "FWD" as const },
  { id: "a2", name: "Martin Odegaard", teamId: "ARS", teamName: "Arsenal", role: "MID" as const },
  { id: "a3", name: "Gabriel Jesus", teamId: "ARS", teamName: "Arsenal", role: "FWD" as const },
  { id: "a4", name: "Gabriel Martinelli", teamId: "ARS", teamName: "Arsenal", role: "FWD" as const },
  { id: "a5", name: "Declan Rice", teamId: "ARS", teamName: "Arsenal", role: "MID" as const },
  { id: "a6", name: "Kai Havertz", teamId: "ARS", teamName: "Arsenal", role: "FWD" as const },
  { id: "a7", name: "Thomas Partey", teamId: "ARS", teamName: "Arsenal", role: "MID" as const },
  { id: "a8", name: "William Saliba", teamId: "ARS", teamName: "Arsenal", role: "DEF" as const },
  { id: "a9", name: "Gabriel Magalhaes", teamId: "ARS", teamName: "Arsenal", role: "DEF" as const },
  { id: "a10", name: "Ben White", teamId: "ARS", teamName: "Arsenal", role: "DEF" as const },
  { id: "a11", name: "Oleksandr Zinchenko", teamId: "ARS", teamName: "Arsenal", role: "DEF" as const },
  { id: "a12", name: "Takehiro Tomiyasu", teamId: "ARS", teamName: "Arsenal", role: "DEF" as const },
  { id: "a13", name: "Leandro Trossard", teamId: "ARS", teamName: "Arsenal", role: "FWD" as const },
  { id: "a14", name: "Jorginho", teamId: "ARS", teamName: "Arsenal", role: "MID" as const },
  { id: "a15", name: "David Raya", teamId: "ARS", teamName: "Arsenal", role: "GK" as const },
];

/* -------------------------------------------------------------------------- */
/* WEEKLY PLAYER STATS                                                        */
/* -------------------------------------------------------------------------- */

export const MOCK_WEEKLY_PLAYERS: WeeklyPlayerStat[] = (() => {
  const out: WeeklyPlayerStat[] = [];
  const rs = rounds();

  for (const r of rs) {
    const venue = VENUES[rnd(0, VENUES.length - 1)];

    for (const p of PLAYERS) {
      const oppTeamId = p.teamId === "MCI" ? "ARS" : "MCI";
      const oppTeamName = p.teamId === "MCI" ? "Arsenal" : "Manchester City";

      const baseFantasy =
        p.role === "FWD" ? rnd(65, 115) :
        p.role === "MID" ? rnd(55, 95) :
        p.role === "GK" ? rnd(40, 70) :
        rnd(45, 75);

      const baseGoals =
        p.role === "FWD" ? rnd(0, 2) :
        p.role === "MID" ? rnd(0, 1) :
        0;

      const baseAssists =
        p.role === "MID" ? rnd(0, 2) :
        p.role === "FWD" ? rnd(0, 1) :
        0;

      const baseShots =
        p.role === "FWD" ? rnd(2, 6) :
        p.role === "MID" ? rnd(1, 4) :
        rnd(0, 1);

      const baseShotsOnTarget =
        p.role === "FWD" ? rnd(1, 3) :
        p.role === "MID" ? rnd(0, 2) :
        0;

      const baseXg =
        p.role === "FWD" ? (rnd(5, 25) / 10) :
        p.role === "MID" ? (rnd(2, 15) / 10) :
        (rnd(0, 5) / 10);

      const jitter = (n: number, j: number) =>
        Math.max(0, n + rnd(-j, j));

      const jitterDecimal = (n: number, j: number) =>
        Math.max(0, n + (rnd(-j * 10, j * 10) / 10));

      out.push({
        playerId: p.id,
        playerName: p.name,
        teamId: p.teamId,
        teamName: p.teamName,
        role: p.role,
        round: r,
        venue,
        opponentTeamId: oppTeamId,
        opponentTeamName: oppTeamName,
        fantasy: jitter(baseFantasy, 22),
        goals: jitter(baseGoals, 1),
        assists: jitter(baseAssists, 1),
        shots: jitter(baseShots, 2),
        shotsOnTarget: jitter(baseShotsOnTarget, 1),
        xg: jitterDecimal(baseXg, 0.8),
      });
    }
  }

  return out;
})();

/* -------------------------------------------------------------------------- */
/* WEEKLY TEAM STATS                                                          */
/* -------------------------------------------------------------------------- */

export const MOCK_WEEKLY_TEAMS: WeeklyTeamStat[] = (() => {
  const out: WeeklyTeamStat[] = [];
  const rs = rounds();

  for (const r of rs) {
    const venue = VENUES[rnd(0, VENUES.length - 1)];

    const mk = (teamId: string, oppId: string) => {
      const tName = TEAMS.find((t) => t.id === teamId)?.name ?? teamId;
      const oName = TEAMS.find((t) => t.id === oppId)?.name ?? oppId;

      const h = [
        rnd(0, 2),
        rnd(0, 3),
      ] as [number, number];

      const ha = [
        rnd(0, 2),
        rnd(0, 3),
      ] as [number, number];

      return {
        teamId,
        teamName: tName,
        round: r,
        venue,
        opponentTeamId: oppId,
        opponentTeamName: oName,
        fantasyTotal: rnd(1200, 1700),
        goalsTotal: rnd(1, 4),
        assistsTotal: rnd(1, 4),
        shotsTotal: rnd(10, 20),
        pointsFor: h.reduce((a, b) => a + b, 0),
        pointsAgainst: ha.reduce((a, b) => a + b, 0),
        halfPointsFor: h,
        halfPointsAgainst: ha,
      };
    };

    out.push(mk("MCI", "ARS"));
    out.push(mk("ARS", "MCI"));
  }

  return out;
})();
