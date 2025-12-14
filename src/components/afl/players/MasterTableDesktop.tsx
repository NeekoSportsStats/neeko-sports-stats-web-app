import React, { useMemo, useState } from "react";
import { Search, ChevronRight, ArrowRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import type { PlayerRow, StatLens } from "./MasterTable";

/* -------------------------------------------------------------------------- */
/* 🔒 LOCKED SPACING TOKENS                                                   */
/* -------------------------------------------------------------------------- */

const ROW_H = 84;
const ROW_H_COMPACT = 64;

const STAT_LABEL = "text-[10px]";
const STAT_VALUE = "text-[11px]";
const STAT_ROW_GAP = "gap-[2px]";
const STAT_STACK_GAP = "space-y-[1px]";
const HITRATE_STACK_GAP = "space-y-1";

const COL_HOVER_BG = "bg-yellow-500/5";

/* -------------------------------------------------------------------------- */

const ROUND_LABELS = ["OR", ...Array.from({ length: 23 }, (_, i) => `R${i + 1}`)];
const FREE_ROW_LIMIT = 8;

const LEFT_W = 220;
const ROUND_W = 48;
const RIGHT_W = 280;

/* -------------------------------------------------------------------------- */

const cx = (...c: Array<string | false | undefined>) =>
  c.filter(Boolean).join(" ");

const fakeRate = () => Math.floor(50 + Math.random() * 50);

/* -------------------------------------------------------------------------- */
/* SAFE SERIES ACCESS — NO SCHEMA ASSUMPTIONS                                 */
/* -------------------------------------------------------------------------- */

function getSeries(row: PlayerRow, lens: StatLens): number[] {
  // Case 1: lens array directly on row: row["Fantasy"] = number[]
  const direct = (row as any)?.[lens];
  if (Array.isArray(direct)) return direct as number[];

  // Case 2: rounds array: row.rounds = [{ Fantasy: 90, ... }, ...]
  const rounds = (row as any)?.rounds;
  if (Array.isArray(rounds)) {
    return rounds
      .map((r: any) => r?.[lens])
      .filter((v: any): v is number => typeof v === "number");
  }

  return [];
}

/* -------------------------------------------------------------------------- */
/* COMPONENT                                                                  */
/* -------------------------------------------------------------------------- */

export default function MasterTableDesktop(props: {
  rows?: unknown; // accept unknown to prevent runtime crash on bad shape
  players?: unknown; // allow parent to pass players instead of rows
  lens: StatLens;
  isPremium: boolean;
}) {
  const { lens, isPremium } = props;

  // ✅ HARD GUARD: always coerce to array
  const baseRows: PlayerRow[] = useMemo(() => {
    if (Array.isArray(props.rows)) return props.rows as PlayerRow[];
    if (Array.isArray(props.players)) return props.players as PlayerRow[];
    return [];
  }, [props.rows, props.players]);

  const [showAll, setShowAll] = useState(false);
  const [search, setSearch] = useState("");
  const [compact, setCompact] = useState(false);
  const [hoverCol, setHoverCol] = useState<number | null>(null);

  /* ------------------------------------------------------------------------ */
  /* SORT BY TOTAL SEASON OUTPUT                                              */
  /* ------------------------------------------------------------------------ */

  const sorted = useMemo(() => {
    // baseRows is always an array now, so no “not iterable” possible
    return [...baseRows].sort((a, b) => {
      const ta = getSeries(a, lens).reduce((s, v) => s + v, 0);
      const tb = getSeries(b, lens).reduce((s, v) => s + v, 0);
      return tb - ta;
    });
  }, [baseRows, lens]);

  const filtered = useMemo(() => {
    if (!isPremium || !search) return sorted;
    const q = search.toLowerCase();
    return sorted.filter((p) => (p?.name ?? "").toLowerCase().includes(q));
  }, [sorted, search, isPremium]);

  const visible = showAll ? filtered : filtered.slice(0, FREE_ROW_LIMIT);

  return (
    <section className="relative rounded-3xl border border-yellow-500/30 bg-black shadow-[0_0_60px_rgba(0,0,0,0.85)]">
      {/* ------------------------------------------------------------------ */}
      {/* HEADER                                                             */}
      {/* ------------------------------------------------------------------ */}

      <div className="px-6 pt-6 pb-4 border-b border-neutral-800">
        {/* Pill (AI Insights style) */}
        <div className="inline-flex items-center rounded-full border border-yellow-500/50 bg-black/80 px-3 py-1 text-[10px] uppercase tracking-[0.18em] text-yellow-200">
          Master Table
        </div>

        <div className="mt-3 flex flex-wrap items-center justify-between gap-4">
          <div>
            <h2 className="text-xl font-semibold text-neutral-50">
              Full-season player trends
            </h2>
            <p className="mt-1 text-sm text-neutral-400">
              Season-long totals, averages and hit-rate performance
            </p>
          </div>

          <div className="flex items-center gap-3">
            {isPremium && (
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-neutral-500" />
                <input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search player"
                  className="pl-9 pr-3 py-2 rounded-xl bg-black border border-neutral-700 text-sm text-neutral-200 placeholder:text-neutral-500 focus:outline-none focus:border-yellow-400"
                />
              </div>
            )}

            <Button
              variant="outline"
              onClick={() => setCompact((v) => !v)}
              className="border-neutral-700 text-xs"
            >
              {compact ? "Comfort" : "Compact"}
            </Button>
          </div>
        </div>
      </div>

      {/* ------------------------------------------------------------------ */}
      {/* TABLE HEADER (STICKY)                                               */}
      {/* ------------------------------------------------------------------ */}

      <div className="sticky top-0 z-10 bg-black">
        <div
          className="grid border-b border-neutral-800 text-[10px] uppercase tracking-widest text-neutral-500"
          style={{
            gridTemplateColumns: `${LEFT_W}px repeat(${ROUND_LABELS.length}, ${ROUND_W}px) ${RIGHT_W}px`,
          }}
        >
          <div className="px-4 py-2">Player</div>

          {ROUND_LABELS.map((r, i) => (
            <div
              key={r}
              onMouseEnter={() => setHoverCol(i)}
              onMouseLeave={() => setHoverCol(null)}
              className={cx("py-2 text-center", hoverCol === i && COL_HOVER_BG)}
            >
              {r}
            </div>
          ))}

          <div className="px-4 py-2 border-l border-neutral-800 sticky right-0 bg-black">
            Stats &amp; Hit Rate
          </div>
        </div>
      </div>

      {/* ------------------------------------------------------------------ */}
      {/* ROWS                                                                */}
      {/* ------------------------------------------------------------------ */}

      <div>
        {visible.map((player) => {
          const series = getSeries(player, lens);

          const avg = series.length
            ? Math.round(series.reduce((a, b) => a + b, 0) / series.length)
            : 0;
          const min = series.length ? Math.min(...series) : 0;
          const max = series.length ? Math.max(...series) : 0;
          const gms = series.length;

          return (
            <div
              key={(player as any).id ?? (player as any).name}
              className={cn(
                "grid border-b border-neutral-800 transition",
                "hover:bg-neutral-900/40 hover:-translate-y-[1px]"
              )}
              style={{
                height: compact ? ROW_H_COMPACT : ROW_H,
                gridTemplateColumns: `${LEFT_W}px repeat(${ROUND_LABELS.length}, ${ROUND_W}px) ${RIGHT_W}px`,
              }}
            >
              {/* PLAYER */}
              <div className="px-4 flex items-center">
                <div>
                  <div className="flex items-center gap-1 text-sm font-medium text-neutral-100">
                    {player.name}
                    <ChevronRight className="h-4 w-4 text-neutral-500" />
                  </div>
                  <div className="mt-0.5 text-[11px] uppercase tracking-wider text-neutral-500">
                    {(player as any).team ?? ""}
                    {"pos" in (player as any) && (player as any).pos ? (
                      <> · {(player as any).pos}</>
                    ) : null}
                    {"role" in (player as any) && !(player as any).pos && (player as any).role ? (
                      <> · {(player as any).role}</>
                    ) : null}
                  </div>
                </div>
              </div>

              {/* ROUNDS */}
              {ROUND_LABELS.map((_, i) => (
                <div
                  key={i}
                  onMouseEnter={() => setHoverCol(i)}
                  onMouseLeave={() => setHoverCol(null)}
                  className={cx(
                    "flex items-center justify-center text-sm text-neutral-200",
                    hoverCol === i && COL_HOVER_BG
                  )}
                >
                  {series[i] ?? "–"}
                </div>
              ))}

              {/* STATS + HIT RATE (sticky column) */}
              <div className="border-l border-neutral-800 px-3 flex items-center sticky right-0 bg-black">
                <div className="grid grid-cols-[110px_1px_1fr] w-full items-center">
                  {/* STATS (tighter label→value spacing) */}
                  <div className={cx("flex flex-col", STAT_STACK_GAP)}>
                    {[
                      ["AVG", avg],
                      ["MIN", min],
                      ["MAX", max],
                      ["GMS", gms],
                    ].map(([label, value]) => (
                      <div
                        key={label}
                        className={cx("flex justify-between", STAT_ROW_GAP, STAT_LABEL, STAT_VALUE)}
                      >
                        <span className="text-neutral-500">{label}</span>
                        <span className={label === "AVG" ? "text-yellow-300" : "text-neutral-200"}>
                          {value as number}
                        </span>
                      </div>
                    ))}
                  </div>

                  {/* Divider */}
                  <div className="h-full bg-yellow-500/10 mx-2" />

                  {/* HIT RATE */}
                  <div className={cx("flex flex-col", HITRATE_STACK_GAP)}>
                    {[60, 70, 80, 90].map((t) => {
                      const r = fakeRate();
                      return (
                        <div key={t} className="flex items-center gap-2">
                          <span className="w-6 text-[10px] text-neutral-400">{t}+</span>
                          <div className="flex-1 h-1 rounded-full bg-neutral-800 overflow-hidden">
                            <div
                              className="h-full bg-gradient-to-r from-emerald-400 via-yellow-300 to-orange-400"
                              style={{ width: `${r}%` }}
                            />
                          </div>
                          <span className="w-8 text-right text-[10px] text-neutral-300">{r}%</span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* ------------------------------------------------------------------ */}
      {/* SHOW MORE                                                           */}
      {/* ------------------------------------------------------------------ */}

      {!showAll && filtered.length > FREE_ROW_LIMIT && (
        <div className="py-6 flex justify-center">
          <button
            onClick={() => setShowAll(true)}
            className="text-yellow-300 text-sm hover:underline"
          >
            Show more
          </button>
        </div>
      )}

      {/* ------------------------------------------------------------------ */}
      {/* CTA (AI Insights style)                                             */}
      {/* ------------------------------------------------------------------ */}

      {!isPremium && (
        <div className="px-6 pb-8">
          <button
            onClick={() => (window.location.href = "/neeko-plus")}
            className="group w-full rounded-3xl border border-yellow-500/30 bg-gradient-to-r from-yellow-500/15 via-yellow-500/0 to-transparent px-6 py-4 flex items-center justify-between hover:brightness-110"
          >
            <div>
              <div className="text-[10px] uppercase tracking-[0.18em] text-yellow-200/80">
                Neeko+
              </div>
              <div className="mt-1 text-sm font-semibold text-yellow-100">
                Unlock full player table
              </div>
              <p className="mt-1 text-xs text-neutral-300">
                Search, team filters & full season insights
              </p>
            </div>

            <div className="flex h-9 w-9 items-center justify-center rounded-full border border-yellow-400/50 bg-black/60 shadow-[0_0_14px_rgba(250,204,21,0.6)] group-hover:-translate-y-0.5 group-hover:translate-x-0.5 transition">
              <ArrowRight className="h-4 w-4 text-yellow-300" />
            </div>
          </button>
        </div>
      )}
    </section>
  );
}
