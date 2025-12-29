import React, { useMemo } from "react";
import type { FixtureMatch } from "@/components/afl/match-center/types";
import type { StatLens } from "./utils";

/* -------------------------------------------------------------------------- */
/* TYPES                                                                      */
/* -------------------------------------------------------------------------- */

type Props = {
  match: FixtureMatch | undefined;
  teams: any[];
  stat: StatLens;
  fixtures: FixtureMatch[];
};

type TeamOutlook = {
  team: string;
  stability: "High" | "Medium" | "Low";
  volatility: "Low" | "Low–Moderate" | "Moderate" | "Elevated";
  rangeLow: number;
  rangeHigh: number;
  tempo: "Strong" | "Moderate" | "Inconsistent";
  defensiveRisk: "Low" | "Moderate" | "Moderate–High" | "High";
  aiRead: string;
};

/* -------------------------------------------------------------------------- */
/* HELPERS                                                                    */
/* -------------------------------------------------------------------------- */

function computeTeamOutlook(team: string): TeamOutlook {
  // ⚠️ Deterministic heuristic logic for now
  // (AI-ready later without changing UI)

  if (team.toLowerCase().includes("richmond")) {
    return {
      team,
      stability: "High",
      volatility: "Low–Moderate",
      rangeLow: 78,
      rangeHigh: 92,
      tempo: "Strong",
      defensiveRisk: "Low",
      aiRead:
        "Richmond’s system-driven scoring profile holds well against Carlton’s pressure, keeping their floor intact even under contested conditions.",
    };
  }

  if (team.toLowerCase().includes("carlton")) {
    return {
      team,
      stability: "Medium",
      volatility: "Elevated",
      rangeLow: 72,
      rangeHigh: 98,
      tempo: "Inconsistent",
      defensiveRisk: "Moderate–High",
      aiRead:
        "Carlton rely on surge scoring runs, increasing volatility when momentum shifts against them in this matchup.",
    };
  }

  // Fallback (safe generic)
  return {
    team,
    stability: "Medium",
    volatility: "Moderate",
    rangeLow: 75,
    rangeHigh: 95,
    tempo: "Moderate",
    defensiveRisk: "Moderate",
    aiRead:
      "This team shows a balanced scoring profile with moderate variance influenced by game tempo and opposition pressure.",
  };
}

/* -------------------------------------------------------------------------- */
/* COMPONENT                                                                  */
/* -------------------------------------------------------------------------- */

export default function TeamPredictabilityPanel({
  match,
}: Props) {
  const outlooks = useMemo(() => {
    if (!match) return [];

    return [
      computeTeamOutlook(match.homeTeam),
      computeTeamOutlook(match.awayTeam),
    ];
  }, [match]);

  if (!match) return null;

  return (
    <div className="space-y-8">
      {/* MATCH HEADER */}
      <div className="flex items-center justify-center gap-4 text-sm text-white/70">
        <span className="font-semibold text-white">
          {match.homeTeam}
        </span>
        <span className="opacity-50">vs</span>
        <span className="font-semibold text-white">
          {match.awayTeam}
        </span>
      </div>

      {/* TEAM OUTLOOKS */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {outlooks.map((o) => (
          <div
            key={o.team}
            className="rounded-2xl border border-white/10 bg-black/40 p-5"
          >
            <h3 className="text-sm font-semibold tracking-wide text-white mb-4">
              {o.team} — Team AI Outlook
            </h3>

            <div className="space-y-2 text-sm text-white/70">
              <div className="flex justify-between">
                <span>Scoring stability</span>
                <span className="text-white">{o.stability}</span>
              </div>

              <div className="flex justify-between">
                <span>Volatility</span>
                <span className="text-white">{o.volatility}</span>
              </div>

              <div className="flex justify-between">
                <span>Expected range</span>
                <span className="text-white font-semibold">
                  {o.rangeLow} → {o.rangeHigh}
                </span>
              </div>

              <div className="flex justify-between">
                <span>Tempo control</span>
                <span className="text-white">{o.tempo}</span>
              </div>

              <div className="flex justify-between">
                <span>Defensive risk</span>
                <span className="text-white">{o.defensiveRisk}</span>
              </div>
            </div>

            <div className="mt-4 rounded-xl border border-white/10 bg-white/5 p-4 text-sm text-white/80">
              <div className="text-xs uppercase tracking-wide text-white/40 mb-1">
                AI read
              </div>
              {o.aiRead}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
