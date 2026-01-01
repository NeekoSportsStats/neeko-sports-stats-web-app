// Section-1-hero-scatter/usePlayerScatterData.ts
import { useMemo, useState } from "react";
import type { FixtureMatch } from "@/components/afl/match-center/types";

export type LensKey = "fantasy" | "disposals" | "goals";
export type TeamFilter = "both" | "home" | "away";
export type LabelMode = "smart" | "all" | "none";

export type PlayerPoint = {
  id: string;
  name: string;
  teamSide: "home" | "away";
  teamName: string;
  momentum: number;
  ceiling: number;
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

export default function usePlayerScatterData(match?: FixtureMatch) {
  const home = String((match as any)?.homeTeam ?? "Home");
  const away = String((match as any)?.awayTeam ?? "Away");

  const [lens, setLens] = useState<LensKey>("fantasy");
  const [teamFilter, setTeamFilter] = useState<TeamFilter>("both");
  const [labelMode, setLabelMode] = useState<LabelMode>("smart");
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const players = useMemo<PlayerPoint[]>(() => {
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

  const visible = useMemo(
    () =>
      players.filter(
        (p) => teamFilter === "both" || p.teamSide === teamFilter
      ),
    [players, teamFilter]
  );

  const selected =
    visible.find((p) => p.id === selectedId) ?? visible[0] ?? null;

  return {
    lens,
    setLens,
    teamFilter,
    setTeamFilter,
    labelMode,
    setLabelMode,
    players: visible,
    selected,
    selectedId,
    setSelectedId,
  };
}
