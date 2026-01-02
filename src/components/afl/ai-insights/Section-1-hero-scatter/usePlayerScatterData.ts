import { useMemo, useState, useEffect } from "react";
import type { FixtureMatch } from "@/components/afl/match-center/types";

export type LensKey = "fantasy" | "disposals" | "goals";
export type TeamFilter = "both" | "home" | "away";
export type LabelMode = "smart" | "all" | "none";

export type PlayerTrendPoint = { week: string; value: number };

export type PlayerPoint = {
  id: string;
  name: string;
  teamSide: "home" | "away";
  teamName: string;

  momentum: number;
  ceiling: number;

  trend?: PlayerTrendPoint[];
};

function rnd(min: number, max: number) {
  return Math.round(min + Math.random() * (max - min));
}

function genTrend(seed: number) {
  const weeks = ["R1", "R2", "R3", "R4", "R5", "R6", "R7", "R8", "R9", "R10", "R11", "R12"];
  let v = seed;
  return weeks.map((w, i) => {
    v = v + (i % 3 === 0 ? rnd(-12, 14) : rnd(-8, 10));
    return { week: w, value: Math.max(20, Math.min(130, v)) };
  });
}

export function usePlayerScatterData(args: { match?: FixtureMatch; initialLens?: LensKey }) {
  const homeTeam = (args.match as any)?.homeTeam?.name ?? "Richmond";
  const awayTeam = (args.match as any)?.awayTeam?.name ?? "Carlton";

  const [lens, setLens] = useState<LensKey>(args.initialLens ?? "fantasy");
  const [teamFilter, setTeamFilter] = useState<TeamFilter>("both");
  const [labelMode, setLabelMode] = useState<LabelMode>("smart");
  const [openId, setOpenId] = useState<string | null>(null);

  // ✅ Sync lens if parent changes the global stat selector
  useEffect(() => {
    if (args.initialLens && args.initialLens !== lens) {
      setLens(args.initialLens);
      setOpenId(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [args.initialLens]);

  const playersAll = useMemo<PlayerPoint[]>(() => {
    const home = [
      "Dustin Martin",
      "Tom Lynch",
      "Noah Balta",
      "Shai Bolton",
      "Toby Nankervis",
      "Jack Graham",
      "Jayden Short",
      "Nick Vlastuin",
    ];
    const away = [
      "Sam Walsh",
      "Patrick Cripps",
      "Charlie Curnow",
      "Jacob Weitering",
      "Christian Petracca",
      "George Hewett",
      "Zac Williams",
      "Adam Cerra",
    ];

    const mk = (name: string, side: "home" | "away", idx: number): PlayerPoint => {
      const base = 60 + (idx % 5) * 6 + (side === "away" ? 3 : 0);
      const momentum = Math.max(20, Math.min(95, base + rnd(-18, 18)));
      const ceiling = Math.max(20, Math.min(95, base + rnd(-22, 22)));
      return {
        id: `${side}-${idx}-${name.replace(/\s+/g, "-").toLowerCase()}`,
        name,
        teamSide: side,
        teamName: side === "home" ? homeTeam : awayTeam,
        momentum,
        ceiling,
        trend: genTrend(70 + idx * 3 + (side === "away" ? 4 : 0)),
      };
    };

    const out: PlayerPoint[] = [];
    home.forEach((n, i) => out.push(mk(n, "home", i)));
    away.forEach((n, i) => out.push(mk(n, "away", i)));

    if (!out.some((p) => p.name === "Max Gawn")) {
      out.push({
        id: "away-max-gawn",
        name: "Max Gawn",
        teamSide: "away",
        teamName: awayTeam,
        momentum: 62,
        ceiling: 81,
        trend: genTrend(78),
      });
    }

    return out;
  }, [homeTeam, awayTeam]);

  const playersVisible = useMemo(() => {
    let arr = playersAll;

    if (teamFilter !== "both") {
      arr = arr.filter((p) => p.teamSide === teamFilter);
    }

    // lens re-weight (still mock / deterministic-ish enough for UI)
    if (lens === "disposals") {
      arr = arr.map((p) => ({
        ...p,
        momentum: Math.max(20, Math.min(95, p.momentum + rnd(-6, 10))),
        ceiling: Math.max(20, Math.min(95, p.ceiling + rnd(-10, 8))),
      }));
    } else if (lens === "goals") {
      arr = arr.map((p) => ({
        ...p,
        momentum: Math.max(20, Math.min(95, p.momentum + rnd(-10, 6))),
        ceiling: Math.max(20, Math.min(95, p.ceiling + rnd(-6, 14))),
      }));
    }

    return arr;
  }, [playersAll, lens, teamFilter]);

  return {
    homeTeam,
    awayTeam,

    lens,
    setLens,

    teamFilter,
    setTeamFilter,

    labelMode,
    setLabelMode,

    playersVisible,
    playersAll,

    openId,
    setOpenId,
  };
}
