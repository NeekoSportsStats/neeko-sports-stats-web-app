import React, { useEffect, useState } from "react";
import { getRoundMomentumData } from "../data/getRoundMomentumData";
import { Flame, TrendingUp, Activity } from "lucide-react";

export default function RoundSummary() {
  const [stat, setStat] = useState<"fantasy" | "disposals" | "goals">("fantasy");
  const [data, setData] = useState<any>(null);

  useEffect(() => {
    getRoundMomentumData(2025, stat).then(setData);
  }, [stat]);

  if (!data) return null;

  return (
    <section className="rounded-3xl border border-yellow-500/20 bg-black/80 px-6 py-6">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-yellow-300">Round Snapshot</h2>

        <div className="flex gap-2">
          {["fantasy", "disposals", "goals"].map((l) => (
            <button
              key={l}
              onClick={() => setStat(l as any)}
              className={`px-3 py-1.5 rounded-full text-xs border ${
                stat === l ? "bg-yellow-400 text-black border-yellow-300" : "bg-black/40 border-white/20 text-white/70"
              }`}
            >
              {l}
            </button>
          ))}
        </div>
      </div>

      <div className="mt-5 grid grid-cols-3 gap-6 text-sm">
        <div>
          <Flame className="text-yellow-400 mb-2" />
          <p className="text-yellow-300 font-bold">{data.topScore.value}</p>
          <p className="text-xs text-white/50">{data.topScore.playerName}</p>
        </div>

        <div>
          <TrendingUp className="text-yellow-400 mb-2" />
          <p className="text-yellow-300 font-bold">+{data.biggestOverperformer.diff.toFixed(1)}</p>
          <p className="text-xs text-white/50">{data.biggestOverperformer.playerName}</p>
        </div>

        <div>
          <Activity className="text-yellow-400 mb-2" />
          <p className="text-yellow-300 font-bold">{data.roundAverage}</p>
          <p className="text-xs text-white/50">League Avg</p>
        </div>
      </div>

      <div className="mt-4 space-y-1 text-xs text-white/55">
        {data.keyPoints.map((k: string, i: number) => (
          <div key={i}>{k}</div>
        ))}
      </div>
    </section>
  );
}