import React, { useMemo } from "react";
import type { PlayerPoint, LensKey, TeamFilter } from "./usePlayerScatterData";
import { Lock } from "lucide-react";

function score(p: PlayerPoint) {
  return p.momentum + p.ceiling;
}

function quadrantOf(p: PlayerPoint) {
  if (p.momentum >= 50 && p.ceiling >= 50) return "finale";
  if (p.momentum < 50 && p.ceiling >= 50) return "volatile";
  if (p.momentum >= 50 && p.ceiling < 50) return "safe";
  return "low";
}

export default function PlayerImpactHeroScatterMobile(props: {
  homeTeam: string;
  awayTeam: string;

  players: PlayerPoint[];
  allPlayers: PlayerPoint[];

  selectedId: string | null;
  lens: LensKey;
  teamFilter: TeamFilter;
  locked: boolean;

  onChangeLens: (v: LensKey) => void;
  onChangeTeam: (v: TeamFilter) => void;

  onSelectPlayer: (id: string) => void;
}) {
  const ranked = useMemo(
    () => [...props.players].sort((a, b) => score(b) - score(a)),
    [props.players]
  );

  const top = ranked.slice(0, 3);
  const finale = ranked.filter((p) => quadrantOf(p) === "finale").slice(0, 3);

  return (
    <section className="rounded-3xl border border-amber-400/20 bg-gradient-to-b from-[#0c0c0c] to-black p-4">
      <div className="mb-3">
        <div className="text-xs tracking-[0.24em] text-amber-300">PLAYER IMPACT MAP</div>
        <div className="mt-1 text-lg font-semibold text-white">Momentum vs Ceiling</div>
        <div className="mt-1 text-sm text-white/60">
          {props.homeTeam} vs {props.awayTeam} · Analyst view
        </div>

        {props.locked ? (
          <div className="mt-2 inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.03] px-3 py-1 text-xs text-white/55">
            <Lock className="h-3.5 w-3.5" />
            Neeko+ insight locked
          </div>
        ) : null}
      </div>

      {/* Controls */}
      <div className="mb-3 flex flex-wrap gap-2 text-xs">
        {(["fantasy", "disposals", "goals"] as LensKey[]).map((l) => (
          <button
            key={l}
            onClick={() => props.onChangeLens(l)}
            className={`rounded-full px-3 py-1 border ${
              props.lens === l
                ? "border-amber-400/40 bg-amber-400/10 text-amber-200"
                : "border-white/10 bg-white/[0.02] text-white/70"
            }`}
          >
            {l}
          </button>
        ))}

        <span className="mx-1 opacity-30">|</span>

        {(["both", "home", "away"] as TeamFilter[]).map((t) => (
          <button
            key={t}
            onClick={() => props.onChangeTeam(t)}
            className={`rounded-full px-3 py-1 border ${
              props.teamFilter === t
                ? "border-white/40 text-white"
                : "border-white/10 bg-white/[0.02] text-white/70"
            }`}
          >
            {t}
          </button>
        ))}
      </div>

      {/* Top lists */}
      <div className="mb-3 grid grid-cols-1 gap-3">
        <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-3">
          <div className="text-sm font-semibold text-white">Top targets</div>
          <div className="mt-2 space-y-2">
            {top.map((p) => (
              <button
                key={p.id}
                onClick={() => props.onSelectPlayer(p.id)}
                className="flex w-full items-center justify-between rounded-xl border border-white/10 bg-black/25 px-3 py-2 text-left"
              >
                <div>
                  <div className="text-sm text-white">{p.name}</div>
                  <div className="text-xs text-white/55">{p.teamName}</div>
                </div>
                <div className="text-xs text-white/65">
                  {p.momentum} · {p.ceiling}
                </div>
              </button>
            ))}
          </div>
        </div>

        <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-3">
          <div className="text-sm font-semibold text-white">Finale targets</div>
          <div className="mt-1 text-xs text-white/55">High momentum, high ceiling</div>
          <div className="mt-2 space-y-2">
            {finale.length ? (
              finale.map((p) => (
                <button
                  key={p.id}
                  onClick={() => props.onSelectPlayer(p.id)}
                  className="flex w-full items-center justify-between rounded-xl border border-white/10 bg-black/25 px-3 py-2 text-left"
                >
                  <div>
                    <div className="text-sm text-white">{p.name}</div>
                    <div className="text-xs text-white/55">{p.teamName}</div>
                  </div>
                  <div className="text-xs text-white/65">
                    {p.momentum} · {p.ceiling}
                  </div>
                </button>
              ))
            ) : (
              <div className="text-xs text-white/45">No players in this filter.</div>
            )}
          </div>
        </div>
      </div>

      {/* Player grid */}
      <div className="rounded-2xl border border-white/10 bg-black/40 p-3">
        <div className="grid grid-cols-2 gap-3">
          {props.players.map((p) => {
            const selected = p.id === props.selectedId;

            return (
              <button
                key={p.id}
                onClick={() => props.onSelectPlayer(p.id)}
                className={`flex flex-col rounded-xl border p-3 text-left transition ${
                  selected
                    ? "border-amber-400/50 bg-amber-400/10"
                    : "border-white/10 bg-black/30"
                }`}
              >
                <div className="text-sm font-medium text-white">{p.name}</div>
                <div className="mt-1 text-xs text-white/60">
                  Momentum {p.momentum} · Ceiling {p.ceiling}
                </div>
              </button>
            );
          })}
        </div>
      </div>
    </section>
  );
}
