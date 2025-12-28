/* -------------------------------------------------------------------------- */
/* LOCAL MOCK TYPES (UI-ONLY)                                                  */
/* -------------------------------------------------------------------------- */

export interface WeeklyPlayerStat {
  playerId: string;
  playerName: string;
  teamId: string;
  teamName: string;
  role: "MID" | "FWD" | "DEF" | "RUC";
  round: string;
  venue: string;
  opponentTeamId: string;
  opponentTeamName: string;
  fantasy: number;
  disposals: number;
  goals: number;
  tog: number;
  cbas: number;
}

export interface WeeklyTeamStat {
  teamId: string;
  teamName: string;
  round: string;
  venue: string;
  opponentTeamId: string;
  opponentTeamName: string;
  fantasyTotal: number;
  disposalsTotal: number;
  goalsTotal: number;
  pointsFor: number;
  pointsAgainst: number;
  qPointsFor: [number, number, number, number];
  qPointsAgainst: [number, number, number, number];
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
  { id: "COLL", name: "Collingwood" },
  { id: "CARL", name: "Carlton" },
];

const VENUES = ["MCG", "Marvel", "SCG", "GMHBA"];

const rnd = (min: number, max: number) =>
  Math.round(min + Math.random() * (max - min));

function rounds(n = 14) {
  const out: string[] = [];
  for (let i = 1; i <= n; i++) out.push(`R${i}`);
  return out;
}

export const MOCK_CONTEXT: HeadToHeadContext = {
  homeTeamId: "COLL",
  awayTeamId: "CARL",
  venue: "MCG",
  roundLabel: "R12",
};

/* -------------------------------------------------------------------------- */
/* PLAYERS                                                                    */
/* -------------------------------------------------------------------------- */

const PLAYERS = [
  // Collingwood (15)
  { id: "c1", name: "Nick Daicos", teamId: "COLL", teamName: "Collingwood", role: "MID" as const },
  { id: "c2", name: "Jordan De Goey", teamId: "COLL", teamName: "Collingwood", role: "MID" as const },
  { id: "c3", name: "Jack Crisp", teamId: "COLL", teamName: "Collingwood", role: "MID" as const },
  { id: "c4", name: "Tom Mitchell", teamId: "COLL", teamName: "Collingwood", role: "MID" as const },
  { id: "c5", name: "Scott Pendlebury", teamId: "COLL", teamName: "Collingwood", role: "MID" as const },
  { id: "c6", name: "Brody Mihocek", teamId: "COLL", teamName: "Collingwood", role: "FWD" as const },
  { id: "c7", name: "Jamie Elliott", teamId: "COLL", teamName: "Collingwood", role: "FWD" as const },
  { id: "c8", name: "Darcy Moore", teamId: "COLL", teamName: "Collingwood", role: "DEF" as const },
  { id: "c9", name: "Isaac Quaynor", teamId: "COLL", teamName: "Collingwood", role: "DEF" as const },
  { id: "c10", name: "Brayden Maynard", teamId: "COLL", teamName: "Collingwood", role: "DEF" as const },
  { id: "c11", name: "Jeremy Howe", teamId: "COLL", teamName: "Collingwood", role: "DEF" as const },
  { id: "c12", name: "Billy Frampton", teamId: "COLL", teamName: "Collingwood", role: "DEF" as const },
  { id: "c13", name: "Bobby Hill", teamId: "COLL", teamName: "Collingwood", role: "FWD" as const },
  { id: "c14", name: "Lachie Schultz", teamId: "COLL", teamName: "Collingwood", role: "FWD" as const },
  { id: "c15", name: "Will Hoskin-Elliott", teamId: "COLL", teamName: "Collingwood", role: "FWD" as const },

  // Carlton (15)
  { id: "b1", name: "Patrick Cripps", teamId: "CARL", teamName: "Carlton", role: "MID" as const },
  { id: "b2", name: "Sam Walsh", teamId: "CARL", teamName: "Carlton", role: "MID" as const },
  { id: "b3", name: "Adam Cerra", teamId: "CARL", teamName: "Carlton", role: "MID" as const },
  { id: "b4", name: "George Hewett", teamId: "CARL", teamName: "Carlton", role: "MID" as const },
  { id: "b5", name: "Matt Kennedy", teamId: "CARL", teamName: "Carlton", role: "MID" as const },
  { id: "b6", name: "Charlie Curnow", teamId: "CARL", teamName: "Carlton", role: "FWD" as const },
  { id: "b7", name: "Harry McKay", teamId: "CARL", teamName: "Carlton", role: "FWD" as const },
  { id: "b8", name: "Zac Williams", teamId: "CARL", teamName: "Carlton", role: "DEF" as const },
  { id: "b9", name: "Jacob Weitering", teamId: "CARL", teamName: "Carlton", role: "DEF" as const },
  { id: "b10", name: "Mitch McGovern", teamId: "CARL", teamName: "Carlton", role: "DEF" as const },
  { id: "b11", name: "Adam Saad", teamId: "CARL", teamName: "Carlton", role: "DEF" as const },
  { id: "b12", name: "Nick Newman", teamId: "CARL", teamName: "Carlton", role: "DEF" as const },
  { id: "b13", name: "Blake Acres", teamId: "CARL", teamName: "Carlton", role: "MID" as const },
  { id: "b14", name: "Matthew Owies", teamId: "CARL", teamName: "Carlton", role: "FWD" as const },
  { id: "b15", name: "Jack Martin", teamId: "CARL", teamName: "Carlton", role: "FWD" as const },
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
      const oppTeamId = p.teamId === "COLL" ? "CARL" : "COLL";
      const oppTeamName = p.teamId === "COLL" ? "Carlton" : "Collingwood";

      const baseFantasy =
        p.role === "MID" ? rnd(85, 125) :
        p.role === "FWD" ? rnd(55, 95) :
        rnd(60, 95);

      const baseDisp =
        p.role === "MID" ? rnd(22, 36) :
        p.role === "FWD" ? rnd(10, 20) :
        rnd(14, 26);

      const baseGoals =
        p.role === "FWD" ? rnd(1, 5) :
        p.role === "MID" ? rnd(0, 2) :
        rnd(0, 1);

      const jitter = (n: number, j: number) =>
        Math.max(0, n + rnd(-j, j));

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
        fantasy: jitter(baseFantasy, 18),
        disposals: jitter(baseDisp, 7),
        goals: jitter(baseGoals, 2),
        tog: rnd(70, 92),
        cbas: p.role === "MID" ? rnd(8, 24) : rnd(0, 6),
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

      const q = [
        rnd(18, 32),
        rnd(18, 32),
        rnd(18, 34),
        rnd(18, 34),
      ] as [number, number, number, number];

      const qa = [
        rnd(18, 32),
        rnd(18, 32),
        rnd(18, 34),
        rnd(18, 34),
      ] as [number, number, number, number];

      return {
        teamId,
        teamName: tName,
        round: r,
        venue,
        opponentTeamId: oppId,
        opponentTeamName: oName,
        fantasyTotal: rnd(1450, 1650),
        disposalsTotal: rnd(350, 420),
        goalsTotal: rnd(9, 16),
        pointsFor: q.reduce((a, b) => a + b, 0),
        pointsAgainst: qa.reduce((a, b) => a + b, 0),
        qPointsFor: q,
        qPointsAgainst: qa,
      };
    };

    out.push(mk("COLL", "CARL"));
    out.push(mk("CARL", "COLL"));
  }

  return out;
})();
