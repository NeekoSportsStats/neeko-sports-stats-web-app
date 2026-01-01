import React, { useEffect, useMemo, useState } from "react";
import { X, ArrowLeftRight } from "lucide-react";

type LensKey = "fantasy" | "disposals" | "goals";

export type PlayerPoint = {
  id: string;
  name: string;
  team: string;
  side: "home" | "away";
  momentum: number;
  ceiling: number;
};

type Props = {
  open: boolean;
  onClose: () => void;
  player: PlayerPoint | null;
  allPlayers: PlayerPoint[];
  lens: LensKey;
};

export default function PlayerTrendModal({
  open,
  onClose,
  player,
  allPlayers,
  lens,
}: Props) {
  const [compareId, setCompareId] = useState<string>("");

  /* ------------------------------ lifecycle ------------------------------ */

  useEffect(() => {
    if (!open) return;
    setCompareId("");
  }, [open, player?.id]);

  // ESC to close (desktop)
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  const compare = useMemo(
    () => allPlayers.find((p) => p.id === compareId) ?? null,
    [allPlayers, compareId]
  );

  const lensLabel =
    lens === "disposals" ? "Disposals" : lens === "goals" ? "Goals" : "Fantasy";

  if (!open || !player) return null;

  /* --------------------------- deterministic data -------------------------- */

  const rounds = Array.from({ length: 12 }, (_, i) => `R${i + 1}`);

  const makeSeries = (seed: string) => {
    let h = 0;
    for (let i = 0; i < seed.length; i++) h = (h << 5) - h + seed.charCodeAt(i);
    h = Math.abs(h);

    const base = lens === "goals" ? 1.5 : lens === "disposals" ? 22 : 78;
    const amp = lens === "goals" ? 2.2 : lens === "disposals" ? 10 : 18;

    const series = rounds.map((_, i) => {
      const w =
        Math.sin((i + 1) * 0.55 + h * 0.001) +
        Math.cos((i + 1) * 0.25 + h * 0.002);
      return Math.max(0, base + amp * (0.55 + 0.25 * w));
    });

    const last = series.at(-1) ?? base;
    const spread = lens === "goals" ? 1.2 : lens === "disposals" ? 6 : 10;

    return {
      series,
      expected: last * 1.01,
      low: Math.max(0, last - spread),
      high: last + spread,
    };
  };

  const primary = makeSeries(`${player.id}:${lens}`);
  const secondary = compare ? makeSeries(`${compare.id}:${lens}`) : null;

  /* ------------------------------- chart math ------------------------------ */

  const W = 860;
  const H = 320;
  const PX = 44;
  const PY = 28;

  const allVals = [
    ...primary.series,
    primary.low,
    primary.high,
    ...(secondary?.series ?? []),
  ];

  const minV = Math.floor(Math.min(...allVals) * 0.9);
  const maxV = Math.ceil(Math.max(...allVals) * 1.12);

  const x = (i: number) =>
    PX + (i / Math.max(1, rounds.length)) * (W - PX * 2);
  const y = (v: number) =>
    PY + (1 - (v - minV) / (maxV - minV)) * (H - PY * 2);

  const pathFrom = (arr: number[]) =>
    arr.map((v, i) => `${i === 0 ? "M" : "L"} ${x(i)} ${y(v)}`).join(" ");

  /* ------------------------------- render --------------------------------- */

  return (
    <div className="fixed inset-0 z-[80]">
      {/* backdrop */}
      <button
        onClick={onClose}
        className="absolute inset-0 bg-black/70 backdrop-blur-sm"
        aria-label="Close modal"
      />

      {/* modal / bottom sheet */}
      <div
        className="
          absolute left-1/2 top-[8%] w-[min(980px,92vw)] -translate-x-1/2
          rounded-3xl border border-white/12 bg-[#0b0b0b]
          shadow-[0_0_0_1px_rgba(255,255,255,0.05)]
          max-sm:bottom-0 max-sm:top-auto max-sm:w-full max-sm:rounded-t-3xl
        "
      >
        {/* drag handle (mobile) */}
        <div className="hidden max-sm:flex justify-center pt-3">
          <div className="h-1 w-10 rounded-full bg-white/25" />
        </div>

        {/* header */}
        <div className="flex items-start justify-between gap-4 border-b border-white/10 px-5 py-4">
          <div>
            <div className="text-[11px] tracking-[0.28em] text-white/55">
              PLAYER TREND
            </div>
            <div className="mt-1 text-xl font-semibold text-white">
              {player.name}
            </div>
            <div className="mt-1 text-sm text-white/60">
              {player.team} · {lensLabel}
            </div>
          </div>

          <button
            onClick={onClose}
            className="rounded-full border border-white/10 bg-white/5 p-2 text-white/70 hover:bg-white/10"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* body */}
        <div className="px-5 py-5 max-sm:pb-8">
          {/* compare */}
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="text-sm text-white/70">
              Weekly trend + projection band
            </div>

            <div className="flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-2 text-xs text-white/70">
              <ArrowLeftRight className="h-4 w-4" />
              <select
                value={compareId}
                onChange={(e) => setCompareId(e.target.value)}
                className="ml-2 rounded-full border border-white/10 bg-black/40 px-3 py-1 text-xs"
              >
                <option value="">Compare</option>
                {allPlayers
                  .filter((p) => p.id !== player.id)
                  .map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
              </select>
            </div>
          </div>

          {/* chart */}
          <div className="mt-4 overflow-hidden rounded-2xl border border-white/10 bg-black/35">
            <svg viewBox={`0 0 ${W} ${H}`} className="w-full">
              {/* grid */}
              {[0.25, 0.5, 0.75].map((t) => {
                const yy = PY + t * (H - PY * 2);
                return (
                  <line
                    key={t}
                    x1={PX}
                    y1={yy}
                    x2={W - PX}
                    y2={yy}
                    stroke="white"
                    opacity={0.12}
                  />
                );
              })}

              {/* next round shading */}
              <rect
                x={x(rounds.length - 1)}
                y={PY}
                width={(W - PX * 2) / rounds.length}
                height={H - PY * 2}
                fill="#fbbf24"
                opacity={0.08}
              />

              {/* projection band */}
              <rect
                x={x(rounds.length - 1)}
                y={y(primary.high)}
                width={(W - PX * 2) / rounds.length}
                height={Math.max(2, y(primary.low) - y(primary.high))}
                fill="#fbbf24"
                opacity={0.14}
              />

              {/* primary */}
              <path
                d={pathFrom(primary.series)}
                stroke="#fbbf24"
                strokeWidth={2.5}
                fill="none"
              />

              {/* compare */}
              {secondary && (
                <path
                  d={pathFrom(secondary.series)}
                  stroke="#34d399"
                  strokeWidth={2}
                  fill="none"
                />
              )}

              {/* x labels */}
              {rounds.map((r, i) => (
                <text
                  key={r}
                  x={x(i)}
                  y={H - 10}
                  textAnchor="middle"
                  fontSize={11}
                  fill="rgba(255,255,255,0.45)"
                >
                  {r}
                </text>
              ))}
            </svg>
          </div>

          {/* summary */}
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
              <div className="text-[11px] tracking-[0.26em] text-white/55">
                NEXT ROUND
              </div>
              <div className="mt-2 text-sm text-white/85">
                Expected <b>{Math.round(primary.expected)}</b> · Low{" "}
                <b>{Math.round(primary.low)}</b> · High{" "}
                <b>{Math.round(primary.high)}</b>
              </div>
              <div className="mt-1 text-xs text-white/50">
                Deterministic mock — safe for free users
              </div>
            </div>

            <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4 text-sm text-white/70">
              • Momentum trend shows{" "}
              <b>{player.momentum >= 65 ? "acceleration" : "mixed signal"}</b>
              <br />• Ceiling suggests{" "}
              <b>{player.ceiling >= 70 ? "true spike potential" : "capped range"}</b>
              <br />• Compare to validate role confidence
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
