import type { WeeklyPlayerStat, WeeklyTeamStat, HeadToHeadContext } from "./types";

// This mock is only to make the page render immediately.
// Replace with your real week-by-week ingestion.
const TEAMS = [
  { id: "COLL", name: "Collingwood" },
  { id: "CARL", name: "Carlton" },
  { id: "SYD", name: "Sydney" },
  { id: "GEE", name: "Geelong" },
];

const VENUES = ["MCG", "Marvel", "SCG", "GMHBA"];

const rnd = (min: number, max: number) => Math.round(min + Math.random() * (max - min));

function rounds(n = 12) {
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

const PLAYERS = [
  { id: "p1", name: "Nick Daicos", teamId: "COLL", teamName: "Collingwood", role: "MID" as const },
  { id: "p2", name: "Jordan De Goey", teamId: "COLL", teamName: "Collingwood", role: "MID" as const },
  { id: "p3", name: "Brody Mihocek", teamId: "COLL", teamName: "Collingwood", role: "FWD" as const },
  { id: "p4", name: "Darcy Moore", teamId: "COLL", teamName: "Collingwood", role: "DEF" as const },
  { id: "p5", name: "Patrick Cripps", teamId: "CARL", teamName: "Carlton", role: "MID" as const },
  { id: "p6", name: "Sam Walsh", teamId: "CARL", teamName: "Carlton", role: "MID" as const },
  { id: "p7", name: "Charlie Curnow", teamId: "CARL", teamName: "Carlton", role: "FWD" as const },
  { id: "p8", name: "Jacob Weitering", teamId: "CARL", teamName: "Carlton", role: "DEF" as const },
];

export const MOCK_WEEKLY_PLAYERS: WeeklyPlayerStat[] = (() => {
  const out: WeeklyPlayerStat[] = [];
  const rs = rounds(14);

  for (const r of rs) {
    const venue = VENUES[rnd(0, VENUES.length - 1)];
    for (const p of PLAYERS) {
      const oppTeamId = p.teamId === "COLL" ? "CARL" : "COLL";
      const oppTeamName = p.teamId === "COLL" ? "Carlton" : "Collingwood";

      const baseFantasy =
        p.role === "MID" ? rnd(80, 120) :
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

      // add small variance per round
      const jitter = (n: number, j: number) => Math.max(0, n + rnd(-j, j));

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
        fantasy: jitter(baseFantasy, p.role === "MID" ? 18 : 15),
        disposals: jitter(baseDisp, p.role === "MID" ? 7 : 5),
        goals: jitter(baseGoals, p.role === "FWD" ? 2 : 1),
        tog: rnd(70, 92),
        cbas: p.role === "MID" ? rnd(8, 24) : rnd(0, 6),
      });
    }
  }
  return out;
})();

export const MOCK_WEEKLY_TEAMS: WeeklyTeamStat[] = (() => {
  const out: WeeklyTeamStat[] = [];
  const rs = rounds(14);

  for (const r of rs) {
    const venue = VENUES[rnd(0, VENUES.length - 1)];

    const mk = (teamId: string, oppId: string) => {
      const tName = TEAMS.find((t) => t.id === teamId)?.name ?? teamId;
      const oName = TEAMS.find((t) => t.id === oppId)?.name ?? oppId;

      const baseGoals = teamId === "COLL" ? rnd(10, 16) : rnd(9, 15);
      const baseDisp = teamId === "COLL" ? rnd(360, 420) : rnd(350, 415);
      const baseF = teamId === "COLL" ? rnd(1500, 1650) : rnd(1450, 1630);

      const q = [rnd(18, 32), rnd(18, 32), rnd(18, 34), rnd(18, 34)] as [number, number, number, number];
      const qa = [rnd(18, 32), rnd(18, 32), rnd(18, 34), rnd(18, 34)] as [number, number, number, number];

      const pointsFor = q.reduce((a, b) => a + b, 0);
      const pointsAgainst = qa.reduce((a, b) => a + b, 0);

      return {
        teamId,
        teamName: tName,
        round: r,
        venue,
        opponentTeamId: oppId,
        opponentTeamName: oName,
        fantasyTotal: baseF + rnd(-90, 90),
        disposalsTotal: baseDisp + rnd(-35, 35),
        goalsTotal: baseGoals + rnd(-3, 3),
        pointsFor,
        pointsAgainst,
        qPointsFor: q,
        qPointsAgainst: qa,
      } as WeeklyTeamStat;
    };

    out.push(mk("COLL", "CARL"));
    out.push(mk("CARL", "COLL"));
  }

  return out;
})();
