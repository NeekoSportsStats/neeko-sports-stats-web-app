import React from "react";

export type TeamPredictRow = {
  team: string;
  rangeLow: number;
  rangeHigh: number;
  stability: "High" | "Medium" | "Low";
  volatility: "Low" | "Moderate" | "High";
  tempo: string;
  defence: string;
  ai: string;
};

export default function TeamPredictabilityPanel({
  teams,
}: {
  teams: TeamPredictRow[];
}) {
  return (
    <section className="mt-20 rounded-2xl border border-white/10 bg-black/40 px-6 py-5">
      <h2 className="text-lg font-semibold text-white">
        2. Team Score Predictability
      </h2>
      <p className="mt-1 text-sm text-white/60">
        Match-level scoring outlook and system stability.
      </p>

      <div className="mt-6 space-y-6">
        {teams.map((t) => (
          <div
            key={t.team}
            className="rounded-xl border border-white/10 bg-white/[0.03] px-5 py-4"
          >
            <div className="flex items-center justify-between">
              <h3 className="text-white font-semibold">{t.team}</h3>
              <span className="text-sm text-amber-300">
                {t.rangeLow} → {t.rangeHigh}
              </span>
            </div>

            <div className="mt-2 grid grid-cols-2 gap-4 text-sm text-white/70">
              <div>Stability: {t.stability}</div>
              <div>Volatility: {t.volatility}</div>
              <div>Tempo: {t.tempo}</div>
              <div>Defence: {t.defence}</div>
            </div>

            <div className="mt-3 text-sm text-white/80">{t.ai}</div>
          </div>
        ))}
      </div>
    </section>
  );
}
