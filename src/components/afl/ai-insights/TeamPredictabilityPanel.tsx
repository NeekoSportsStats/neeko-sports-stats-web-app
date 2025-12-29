import React, { useMemo } from "react";
import { Lock } from "lucide-react";
import type { FixtureMatch } from "@/components/afl/match-center/types";
import type { StatLens } from "@/components/afl/ai-insights/utils";
import { mean, cv } from "@/components/afl/ai-insights/utils";

/* -------------------------------------------------------------------------- */
/* TYPES                                                                      */
/* -------------------------------------------------------------------------- */

type Props = {
  match?: FixtureMatch;
  teams: any[];
  fixtures: FixtureMatch[];
  stat: StatLens;
};

/* -------------------------------------------------------------------------- */
/* HELPERS                                                                    */
/* -------------------------------------------------------------------------- */

function classifyStability(avgConf: number, vol: number) {
  if (avgConf >= 0.7 && vol <= 0.35) return "High";
  if (avgConf >= 0.6 && vol <= 0.5) return "Medium";
  return "Low";
}

function classifyVolatility(vol: number) {
  if (vol <= 0.35) return "Low";
  if (vol <= 0.55) return "Low–Moderate";
  if (vol <= 0.7) return "Elevated";
  return "High";
}

function expectedRange(meanScore: number, vol: number) {
  const spread = Math.round(meanScore * vol);
  return `${Math.max(40, Math.round(meanScore - spread))}–${Math.round(
    meanScore + spread
  )}`;
}

function aiRead(team: string, stability: string, vol: string) {
  if (stability === "High" && vol.includes("Low"))
    return `${team}'s system-driven scoring profile holds consistently under pressure.`;
  if (vol.includes("High"))
    return `${team} rely on surge scoring phases, increasing volatility in this matchup.`;
  return `${team} show a mixed scoring profile influenced by matchup dynamics.`;
}

/* -------------------------------------------------------------------------- */
/* COMPONENT                                                                  */
/* -------------------------------------------------------------------------- */

export default function TeamPredictabilityPanel({
  match,
  teams,
  fixtures,
  stat,
}: Props) {
  if (!match) return null;

  const { homeTeam, awayTeam } = match;

  const teamBlocks = useMemo(() => {
    return [homeTeam, awayTeam].map((teamName) => {
      const teamFixtures = fixtures.filter(
        (f) => f.homeTeam === teamName || f.awayTeam === teamName
      );

      // Mock scoring until real engine arrives
      const scores = teamFixtures.map(
        () => 70 + Math.random() * 30
      );

      const avg = mean(scores);
      const volatility = cv(scores);

      const stability = classifyStability(0.65, volatility);
      const volLabel = classifyVolatility(volatility);

      return {
        team: teamName,
        avg,
        volatility,
        stability,
        range: expectedRange(avg, volatility),
        tempo:
          volatility <= 0.4 ? "Strong" : volatility <= 0.6 ? "Mixed" : "Chaotic",
        defence:
          volatility <= 0.4
            ? "Low"
            : volatility <= 0.6
            ? "Moderate"
            : "High",
        ai: aiRead(teamName, stability, volLabel),
      };
    });
  }, [homeTeam, awayTeam, fixtures]);

  return (
    <div className="rounded-2xl border border-white/10 bg-black/40 overflow-hidden">
      {/* MATCH HEADER */}
      <div className="px-6 py-4 border-b border-white/10 text-center text-sm text-white/70">
        {homeTeam} <span className="mx-2 text-white/40">vs</span> {awayTeam}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 divide-y sm:divide-y-0 sm:divide-x divide-white/10">
        {teamBlocks.map((t) => (
          <div key={t.team} className="px-6 py-5 space-y-3">
            <h3 className="text-sm font-semibold tracking-widest uppercase text-white/80">
              {t.team} — Team AI Outlook
            </h3>

            <ul className="space-y-1 text-sm text-white/70">
              <li>
                <strong>Scoring stability:</strong> {t.stability}
              </li>
              <li>
                <strong>Volatility:</strong> {classifyVolatility(t.volatility)}
              </li>
              <li>
                <strong>Expected range:</strong> {t.range}
              </li>
              <li>
                <strong>Tempo control:</strong> {t.tempo}
              </li>
              <li>
                <strong>Defensive risk:</strong> {t.defence}
              </li>
            </ul>

            <div className="rounded-lg border border-white/10 bg-white/5 px-4 py-3 text-sm text-white/80">
              “{t.ai}”
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
