/* -------------------------------------------------------------------------- */
/* LOCAL MOCK TYPES (UI-ONLY)                                                  */
/* -------------------------------------------------------------------------- */

export interface WeeklyPlayerStat {
  playerId: string;
  playerName: string;
  teamId: string;
  teamName: string;
  role: "PG" | "SG" | "SF" | "PF" | "C";
  round: string;
  venue: string;
  opponentTeamId: string;
  opponentTeamName: string;
  fantasy: number;
  points: number;
  rebounds: number;
  assists: number;
  threes: number;
}

export interface WeeklyTeamStat {
  teamId: string;
  teamName: string;
  round: string;
  venue: string;
  opponentTeamId: string;
  opponentTeamName: string;
  fantasyTotal: number;
  pointsTotal: number;
  reboundsTotal: number;
  assistsTotal: number;
  threesTotal: number;
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
  { id: "LAL", name: "Lakers" },
  { id: "GSW", name: "Warriors" },
];

const VENUES = [
  "Crypto.com Arena",
  "Chase Center",
  "TD Garden",
  "Madison Square Garden",
];

const rnd = (min: number, max: number) =>
  Math.round(min + Math.random() * (max - min));

function games(n = 14) {
  const out: string[] = [];
  for (let i = 1; i <= n; i++) out.push(`G${i}`);
  return out;
}

export const MOCK_CONTEXT: HeadToHeadContext = {
  homeTeamId: "LAL",
  awayTeamId: "GSW",
  venue: "Crypto.com Arena",
  roundLabel: "G10",
};

/* -------------------------------------------------------------------------- */
/* PLAYERS                                                                    */
/* -------------------------------------------------------------------------- */

const PLAYERS = [
  // Lakers (15)
  { id: "l1", name: "LeBron James", teamId: "LAL", teamName: "Lakers", role: "SF" as const },
  { id: "l2", name: "Anthony Davis", teamId: "LAL", teamName: "Lakers", role: "PF" as const },
  { id: "l3", name: "D'Angelo Russell", teamId: "LAL", teamName: "Lakers", role: "PG" as const },
  { id: "l4", name: "Austin Reaves", teamId: "LAL", teamName: "Lakers", role: "SG" as const },
  { id: "l5", name: "Rui Hachimura", teamId: "LAL", teamName: "Lakers", role: "PF" as const },
  { id: "l6", name: "Jarred Vanderbilt", teamId: "LAL", teamName: "Lakers", role: "PF" as const },
  { id: "l7", name: "Taurean Prince", teamId: "LAL", teamName: "Lakers", role: "SF" as const },
  { id: "l8", name: "Gabe Vincent", teamId: "LAL", teamName: "Lakers", role: "PG" as const },
  { id: "l9", name: "Cam Reddish", teamId: "LAL", teamName: "Lakers", role: "SF" as const },
  { id: "l10", name: "Jaxson Hayes", teamId: "LAL", teamName: "Lakers", role: "C" as const },
  { id: "l11", name: "Max Christie", teamId: "LAL", teamName: "Lakers", role: "SG" as const },
  { id: "l12", name: "Jalen Hood-Schifino", teamId: "LAL", teamName: "Lakers", role: "PG" as const },
  { id: "l13", name: "Christian Wood", teamId: "LAL", teamName: "Lakers", role: "C" as const },
  { id: "l14", name: "Maxwell Lewis", teamId: "LAL", teamName: "Lakers", role: "SF" as const },
  { id: "l15", name: "Colin Castleton", teamId: "LAL", teamName: "Lakers", role: "C" as const },

  // Warriors (15)
  { id: "w1", name: "Stephen Curry", teamId: "GSW", teamName: "Warriors", role: "PG" as const },
  { id: "w2", name: "Klay Thompson", teamId: "GSW", teamName: "Warriors", role: "SG" as const },
  { id: "w3", name: "Andrew Wiggins", teamId: "GSW", teamName: "Warriors", role: "SF" as const },
  { id: "w4", name: "Draymond Green", teamId: "GSW", teamName: "Warriors", role: "PF" as const },
  { id: "w5", name: "Kevon Looney", teamId: "GSW", teamName: "Warriors", role: "C" as const },
  { id: "w6", name: "Chris Paul", teamId: "GSW", teamName: "Warriors", role: "PG" as const },
  { id: "w7", name: "Jonathan Kuminga", teamId: "GSW", teamName: "Warriors", role: "PF" as const },
  { id: "w8", name: "Moses Moody", teamId: "GSW", teamName: "Warriors", role: "SG" as const },
  { id: "w9", name: "Gary Payton II", teamId: "GSW", teamName: "Warriors", role: "SG" as const },
  { id: "w10", name: "Brandin Podziemski", teamId: "GSW", teamName: "Warriors", role: "SG" as const },
  { id: "w11", name: "Trayce Jackson-Davis", teamId: "GSW", teamName: "Warriors", role: "C" as const },
  { id: "w12", name: "Cory Joseph", teamId: "GSW", teamName: "Warriors", role: "PG" as const },
  { id: "w13", name: "Lester Quinones", teamId: "GSW", teamName: "Warriors", role: "SG" as const },
  { id: "w14", name: "Usman Garuba", teamId: "GSW", teamName: "Warriors", role: "PF" as const },
  { id: "w15", name: "Jerome Robinson", teamId: "GSW", teamName: "Warriors", role: "SG" as const },
];

/* -------------------------------------------------------------------------- */
/* WEEKLY PLAYER STATS                                                        */
/* -------------------------------------------------------------------------- */

export const MOCK_WEEKLY_PLAYERS: WeeklyPlayerStat[] = (() => {
  const out: WeeklyPlayerStat[] = [];
  const gs = games();

  for (const g of gs) {
    const venue = VENUES[rnd(0, VENUES.length - 1)];

    for (const p of PLAYERS) {
      const oppTeamId = p.teamId === "LAL" ? "GSW" : "LAL";
      const oppTeamName = p.teamId === "LAL" ? "Warriors" : "Lakers";

      const basePoints =
        p.role === "PG" || p.role === "SG" ? rnd(12, 28) :
        p.role === "SF" ? rnd(14, 30) :
        p.role === "PF" ? rnd(10, 25) :
        rnd(8, 18);

      const baseRebounds =
        p.role === "C" || p.role === "PF" ? rnd(6, 14) :
        p.role === "SF" ? rnd(4, 8) :
        rnd(2, 5);

      const baseAssists =
        p.role === "PG" ? rnd(5, 12) :
        p.role === "SG" || p.role === "SF" ? rnd(2, 6) :
        rnd(1, 3);

      const baseThrees =
        p.role === "PG" || p.role === "SG" ? rnd(1, 5) :
        p.role === "SF" ? rnd(0, 4) :
        rnd(0, 2);

      const jitter = (n: number, j: number) =>
        Math.max(0, n + rnd(-j, j));

      const points = jitter(basePoints, 6);
      const rebounds = jitter(baseRebounds, 3);
      const assists = jitter(baseAssists, 2);
      const threes = jitter(baseThrees, 2);

      const fantasy = Math.round(
        points * 1.0 +
        rebounds * 1.2 +
        assists * 1.5 +
        threes * 0.5
      );

      out.push({
        playerId: p.id,
        playerName: p.name,
        teamId: p.teamId,
        teamName: p.teamName,
        role: p.role,
        round: g,
        venue,
        opponentTeamId: oppTeamId,
        opponentTeamName: oppTeamName,
        fantasy,
        points,
        rebounds,
        assists,
        threes,
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
  const gs = games();

  for (const g of gs) {
    for (const team of TEAMS) {
      const oppTeam = team.id === "LAL" ? TEAMS[1] : TEAMS[0];
      const venue = VENUES[rnd(0, VENUES.length - 1)];

      const q1For = rnd(24, 32);
      const q2For = rnd(22, 30);
      const q3For = rnd(24, 32);
      const q4For = rnd(26, 34);
      const pointsFor = q1For + q2For + q3For + q4For;

      const q1Ag = rnd(24, 32);
      const q2Ag = rnd(22, 30);
      const q3Ag = rnd(24, 32);
      const q4Ag = rnd(26, 34);
      const pointsAgainst = q1Ag + q2Ag + q3Ag + q4Ag;

      const fantasyTotal = rnd(300, 450);
      const pointsTotal = pointsFor;
      const reboundsTotal = rnd(38, 52);
      const assistsTotal = rnd(18, 30);
      const threesTotal = rnd(8, 18);

      out.push({
        teamId: team.id,
        teamName: team.name,
        round: g,
        venue,
        opponentTeamId: oppTeam.id,
        opponentTeamName: oppTeam.name,
        fantasyTotal,
        pointsTotal,
        reboundsTotal,
        assistsTotal,
        threesTotal,
        pointsFor,
        pointsAgainst,
        qPointsFor: [q1For, q2For, q3For, q4For],
        qPointsAgainst: [q1Ag, q2Ag, q3Ag, q4Ag],
      });
    }
  }

  return out;
})();
