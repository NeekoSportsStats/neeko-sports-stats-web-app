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

export default function PlayerTrendModal(props: {
  open: boolean;
  onClose: () => void;
  player: PlayerPoint | null;
  allPlayers: PlayerPoint[];
  lens: LensKey;
}) {
  const { open, onClose, player, allPlayers, lens } = props;

  const [compareId, setCompareId] = useState<string>("");

  // Reset compare when opening / player changes
  useEffect(() => {
    if (!open) return;
    setCompareId("");
  }, [open, player?.id]);

  const compare = useMemo(() => {
    if (!compareId) return null;
    return allPlayers.find((p) => p.id === compareId) ?? null;
  }, [allPlayers, compareId]);

  const lensLabel = useMemo(() => {
    if (lens === "disposals") return "Disposals";
    if (lens === "goals") return "Goals";
    return "Fantasy";
  }, [lens]);

  // -------- Deterministic weekly series (mock but stable) --------
  // 12 rounds + "Next" projection band
  const rounds = useMemo(() => Array.from({ length: 12 }, (_, i) => `R${i + 1}`), []);

  const makeSeries = (seedKey: string) => {
    // deterministic pseudo-rand
    let h = 0;
    for (let i = 0; i < seedKey.length; i++) h = (h << 5) - h + seedKey.charCodeAt(i);
    h = Math.abs(h);

    const base =
      lens === "goals" ? 1.6 :
      lens === "disposals" ? 22 :
      78;

    const amp =
      lens === "goals" ? 2.2 :
      lens === "disposals" ? 10 :
      18;

    const series = rounds.map((_, i) => {
      // smooth-ish wiggle
      const t = (h % 97) / 97;
      const w1 = Math.sin((i + 1) * (0.55 + t));
      const w2 = Math.cos((i + 1) * (0.25 + t * 0.3));
      const noise = (w1 * 0.65 + w2 * 0.35);
      const v = base + amp * (0.55 + 0.45 * noise);
      return Math.max(0, v);
    });

    // Projection band for "Next"
    const last = series[series.length - 1] ?? base;
    const expected = last * (0.98 + ((h % 11) / 100)); // small drift
    const spread = (lens === "goals" ? 1.2 : lens === "disposals" ? 6 : 10) * (0.9 + ((h % 7) / 20));
    const low = Math.max(0, expected - spread);
    const high = expected + spread;

    return { series, expected, low, high };
  };

  const pData = useMemo(() => {
    if (!player) return null;
    return makeSeries(`${player.id}:${player.team}:${lens}`);
  }, [player, lens]);

  const cData = useMemo(() => {
    if (!compare) return null;
    return makeSeries(`${compare.id}:${compare.team}:${lens}`);
  }, [compare, lens]);

  // Team + league averages (mock but stable)
  const leagueAvg = useMemo(() => {
    if (!pData) return null;
    const m = pData.series.reduce((a, b) => a + b, 0) / Math.max(1, pData.series.length);
    return m * 0.92;
  }, [pData]);

  const teamAvg = useMemo(() => {
    if (!pData || !player) return null;
    const boost = player.side === "home" ? 1.02 : 0.98;
    const m = pData.series.reduce((a, b) => a + b, 0) / Math.max(1, pData.series.length);
    return m * boost;
  }, [pData, player]);

  // -------- Chart layout (SVG, no libs) --------
  const CW = 860;
  const CH = 320;
  const PADX = 44;
  const PADY = 28;

  const allVals = useMemo(() => {
    const vals: number[] = [];
    if (pData) vals.push(...pData.series, pData.low, pData.high, pData.expected);
    if (cData) vals.push(...cData.series, cData.low, cData.high, cData.expected);
    if (leagueAvg != null) vals.push(leagueAvg);
    if (teamAvg != null) vals.push(teamAvg);
    return vals;
  }, [pData, cData, leagueAvg, teamAvg]);

  const minV = useMemo(() => {
    if (!allVals.length) return 0;
    const m = Math.min(...allVals);
    return Math.floor(m * 0.9);
  }, [allVals]);

  const maxV = useMemo(() => {
    if (!allVals.length) return 100;
    const m = Math.max(...allVals);
    return Math.ceil(m * 1.12);
  }, [allVals]);

  const x = (i: number) => PADX + (i / Math.max(1, rounds.length)) * (CW - PADX * 2);
  const y = (v: number) => PADY + (1 - (v - minV) / Math.max(1e-6, (maxV - minV))) * (CH - PADY * 2);

  const pathFrom = (arr: number[]) => {
    if (!arr.length) return "";
    return arr
      .map((v, i) => `${i === 0 ? "M" : "L"} ${x(i)} ${y(v)}`)
      .join(" ");
  };

  const overlayOpen = open && !!player;

  if (!overlayOpen) return null;

  return (
    <div className="fixed inset-0 z-[80]">
      {/* Backdrop */}
      <button
        type="button"
        aria-label="Close"
        onClick={onClose}
        className="absolute inset-0 bg-black/70 backdrop-blur-sm"
      />

      {/* Modal */}
      <div className="absolute left-1/2 top-[7%] w-[min(980px,92vw)] -translate-x-1/2 rounded-3xl border border-white/12 bg-[#0b0b0b] shadow-[0_0_0_1px_rgba(255,255,255,0.05)]">
        <div className="flex items-start justify-between gap-4 border-b border-white/10 px-5 py-4">
          <div className="min-w-0">
            <div className="text-[11px] tracking-[0.28em] text-white/55">PLAYER TREND</div>
            <div className="mt-1 truncate text-xl font-semibold text-white">{player?.name}</div>
            <div className="mt-1 text-sm text-white/60">
              {player?.team} · <span className="text-white/75">{lensLabel}</span>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="rounded-full border border-white/10 bg-white/5 p-2 text-white/70 hover:bg-white/10"
            aria-label="Close modal"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Body */}
        <div className="px-5 py-5">
          {/* Compare row */}
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="text-sm text-white/70">
              Weekly trend + projection band · next round shaded
            </div>

            <div className="flex items-center gap-2">
              <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-2 text-xs text-white/70">
                <ArrowLeftRight className="h-4 w-4 text-white/60" />
                Compare
                <select
                  value={compareId}
                  onChange={(e) => setCompareId(e.target.value)}
                  className="ml-2 rounded-full border border-white/10 bg-black/40 px-3 py-1 text-xs text-white/85"
                >
                  <option value="">None</option>
                  {allPlayers
                    .filter((p) => p.id !== player?.id)
                    .map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name} · {p.team}
                      </option>
                    ))}
                </select>
              </div>
            </div>
          </div>

          {/* Chart */}
          <div className="mt-4 overflow-hidden rounded-2xl border border-white/10 bg-black/35">
            <svg viewBox={`0 0 ${CW} ${CH}`} className="w-full">
              {/* grid */}
              {[0.25, 0.5, 0.75].map((t) => {
                const yy = PADY + t * (CH - PADY * 2);
                return (
                  <line
                    key={t}
                    x1={PADX}
                    y1={yy}
                    x2={CW - PADX}
                    y2={yy}
                    stroke="white"
                    opacity={0.12}
                  />
                );
              })}

              {/* Next round shading */}
              <rect
                x={x(rounds.length - 1)}
                y={PADY}
                width={(CW - PADX * 2) / Math.max(1, rounds.length)}
                height={CH - PADY * 2}
                fill="#fbbf24"
                opacity={0.08}
              />

              {/* league avg */}
              {leagueAvg != null ? (
                <>
                  <line
                    x1={PADX}
                    y1={y(leagueAvg)}
                    x2={CW - PADX}
                    y2={y(leagueAvg)}
                    stroke="white"
                    opacity={0.20}
                    strokeDasharray="5 5"
                  />
                  <text x={PADX + 6} y={y(leagueAvg) - 6} fontSize={11} fill="rgba(255,255,255,0.55)">
                    League avg
                  </text>
                </>
              ) : null}

              {/* team avg */}
              {teamAvg != null ? (
                <>
                  <line
                    x1={PADX}
                    y1={y(teamAvg)}
                    x2={CW - PADX}
                    y2={y(teamAvg)}
                    stroke="#60a5fa"
                    opacity={0.22}
                    strokeDasharray="6 6"
                  />
                  <text x={PADX + 6} y={y(teamAvg) + 14} fontSize={11} fill="rgba(96,165,250,0.60)">
                    Team avg
                  </text>
                </>
              ) : null}

              {/* projection band */}
              {pData ? (
                <>
                  <line
                    x1={x(rounds.length - 1)}
                    y1={y(pData.low)}
                    x2={x(rounds.length - 1) + (CW - PADX * 2) / Math.max(1, rounds.length)}
                    y2={y(pData.low)}
                    stroke="#fbbf24"
                    opacity={0.28}
                  />
                  <line
                    x1={x(rounds.length - 1)}
                    y1={y(pData.high)}
                    x2={x(rounds.length - 1) + (CW - PADX * 2) / Math.max(1, rounds.length)}
                    y2={y(pData.high)}
                    stroke="#fbbf24"
                    opacity={0.28}
                  />
                  <rect
                    x={x(rounds.length - 1)}
                    y={y(pData.high)}
                    width={(CW - PADX * 2) / Math.max(1, rounds.length)}
                    height={Math.max(2, y(pData.low) - y(pData.high))}
                    fill="#fbbf24"
                    opacity={0.10}
                  />
                </>
              ) : null}

              {/* main line */}
              {pData ? (
                <>
                  <path d={pathFrom(pData.series)} fill="none" stroke="#fbbf24" strokeWidth={2.5} />
                  {pData.series.map((v, i) => (
                    <circle key={i} cx={x(i)} cy={y(v)} r={3.6} fill="#fbbf24" opacity={0.9} />
                  ))}
                </>
              ) : null}

              {/* compare line */}
              {cData ? (
                <>
                  <path d={pathFrom(cData.series)} fill="none" stroke="#34d399" strokeWidth={2} opacity={0.95} />
                  {cData.series.map((v, i) => (
                    <circle key={i} cx={x(i)} cy={y(v)} r={3.1} fill="#34d399" opacity={0.85} />
                  ))}
                </>
              ) : null}

              {/* x labels */}
              {rounds.map((r, i) => (
                <text
                  key={r}
                  x={x(i)}
                  y={CH - 10}
                  textAnchor="middle"
                  fontSize={11}
                  fill="rgba(255,255,255,0.45)"
                >
                  {r}
                </text>
              ))}
            </svg>
          </div>

          {/* Projection summary + AI lines */}
          {pData ? (
            <div className="mt-4 grid grid-cols-1 gap-3 lg:grid-cols-[1fr,1fr]">
              <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
                <div className="text-[11px] tracking-[0.26em] text-white/55">NEXT ROUND BAND</div>
                <div className="mt-2 flex flex-wrap gap-4 text-sm">
                  <div className="text-white/85">
                    Expected: <span className="font-semibold text-white">{Math.round(pData.expected)}</span>
                  </div>
                  <div className="text-white/70">
                    Low: <span className="font-semibold text-white">{Math.round(pData.low)}</span>
                  </div>
                  <div className="text-white/70">
                    High: <span className="font-semibold text-white">{Math.round(pData.high)}</span>
                  </div>
                </div>
                <div className="mt-2 text-xs text-white/55">
                  Band is deterministic mock for now (premium-safe). Real data can drop in later without layout changes.
                </div>
              </div>

              <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
                <div className="text-[11px] tracking-[0.26em] text-white/55">AI TREND NOTES</div>
                <ul className="mt-2 space-y-1.5 text-sm text-white/70">
                  <li>
                    • Trend shape suggests{" "}
                    <span className="text-white/85 font-medium">
                      {player?.momentum >= 65 ? "accelerating form" : "mixed role signal"}
                    </span>{" "}
                    over the last month.
                  </li>
                  <li>
                    • Ceiling marker implies{" "}
                    <span className="text-white/85 font-medium">
                      {player?.ceiling >= 70 ? "true spike potential" : "more capped outcomes"}
                    </span>{" "}
                    under this lens.
                  </li>
                  <li>• Use compare to sanity-check against a direct matchup alternative.</li>
                </ul>
              </div>
            </div>
          ) : null}
        </div>
      </div>

      {/* Mobile sizing tweak */}
      <style>{`
        @media (max-width: 640px) {
          .fixed.inset-0.z-\\[80\\] > div.absolute.left-1\\/2.top-\\[7\\%\\] {
            top: 4% !important;
            width: 94vw !important;
          }
        }
      `}</style>
    </div>
  );
}
