// Section-1-hero-scatter/usePlayerScatterData.ts
import { useEffect, useMemo, useState } from "react";
import type { FixtureMatch } from "@/components/afl/match-center/types";

export type LensKey = "fantasy" | "disposals" | "goals";
export type TeamFilter = "both" | "home" | "away";
export type LabelMode = "smart" | "all" | "none";

export type PlayerPoint = {
  id: string;
  name: string;
  teamSide: "home" | "away";
  teamName: string;
  momentum: number; // 0..100
  ceiling: number;  // 0..100
};

function hash(s: string) {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h << 5) - h + s.charCodeAt(i);
  return Math.abs(h);
}

function seeded(seed: number) {
  let t = seed + 0x6d2b79f5;
  return () => {
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

type Opts = {
  initialLens?: LensKey;
};

export default function usePlayerScatterData(match?: FixtureMatch, opts?: Opts) {
  const home = String((match as any)?.homeTeam ?? "Home");
  const away = String((match as any)?.awayTeam ?? "Away");

  const [lens, setLens] = useState<LensKey>(opts?.initialLens ?? "fantasy");
  const [teamFilter, setTeamFilter] = useState<TeamFilter>("both");
  const [labelMode, setLabelMode] = useState<LabelMode>("smart");
  const [selectedId, setSelectedId] = useState<string | null>(null);

  // keep lens in sync if parent passes a new initialLens
  useEffect(() => {
    if (opts?.initialLens && opts.initialLens !== lens) {
      setLens(opts.initialLens);
      setSelectedId(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [opts?.initialLens]);

  const playersAll = useMemo<PlayerPoint[]>(() => {
    const base = [
      "Patrick Cripps",
      "Sam Walsh",
      "Nick Daicos",
      "Christian Petracca",
      "Zach Merrett",
      "Caleb Serong",
      "Errol Gulden",
      "Clayton Oliver",
      "Jeremy Cameron",
      "Max Gawn",
    ];

    return base.map((name, i) => {
      const side: "home" | "away" = i % 2 === 0 ? "home" : "away";
      const teamName = side === "home" ? home : away;
      const r = seeded(hash(`${name}:${lens}`));

      return {
        id: `${name}-${lens}`,
        name,
        teamSide: side,
        teamName,
        momentum: Math.round(35 + r() * 55),
        ceiling: Math.round(40 + r() * 50),
      };
    });
  }, [home, away, lens]);

  const players = useMemo(
    () =>
      playersAll.filter(
        (p) => teamFilter === "both" || p.teamSide === teamFilter
      ),
    [playersAll, teamFilter]
  );

  const selected = players.find((p) => p.id === selectedId) ?? null;

  return {
    lens,
    setLens,
    teamFilter,
    setTeamFilter,
    labelMode,
    setLabelMode,
    players,
    playersAll, // sometimes useful for rail comparisons, etc.
    selected,
    selectedId,
    setSelectedId,
    home,
    away,
  };
}
