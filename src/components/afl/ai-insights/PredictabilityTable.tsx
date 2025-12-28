import React, { useMemo, useState, useCallback } from "react";
import { Lock, X } from "lucide-react";
import type { PredictRow, PremiumMode } from "./types";
import { confLabel, volLabel, clamp } from "./utils";

type SortKey = "confidence" | "volatility" | "ceiling";
type Chip = "all" | "safe" | "ceiling" | "risky";

const cx = (...c: Array<string | false | undefined>) => c.filter(Boolean).join(" ");

/**
 * PredictabilityTable
 * - Shows 10 matchup picks (expected range + confidence/volatility) for the selected match + stat lens
 * - Free: first 3 rows readable
 * - Locked: remaining rows blurred + non-interactive, with Neeko+ CTA overlay
 * - Modal: richer breakdown + distribution strip
 */
export default function PredictabilityTable(props: {
  rows: PredictRow[];
  mode: PremiumMode;
  statLabel: string;
  matchContext?: string;
  insight?: string;

  hint?: string;
  contextLabel?: string;
}) {
  const { rows, mode, statLabel, matchContext, insight, hint, contextLabel } = props;

  const locked = mode !== "premium";

  // Requirements
  const TOTAL_MATCHUP_ROWS = 10;
  const FREE_PREVIEW_COUNT = 3;

  const [chip, setChip] = useState<Chip>("all");
  const [sort] = useState<SortKey>("confidence"); // keep state for future, no UI control right now
  const [openId, setOpenId] = useState<string | null>(null);

  const fmtRange = useCallback((lo: number, hi: number) => {
    const a = Math.round(Number(lo ?? 0));
    const b = Math.round(Number(hi ?? 0));
    // Always show both (requested), but keep it tight.
    return `${a}\u2013${b}`; // en-dash
  }, []);

  const confidenceBand = useCallback((c01: number) => confLabel(clamp(c01, 0, 1)), []);
  const volatilityBand = useCallback((v01: number) => volLabel(clamp(v01, 0, 1)), []);

  // --- Filtering / Sorting ---
  const filtered = useMemo(() => {
    const r = (rows ?? []).slice(0, TOTAL_MATCHUP_ROWS);

    const passChip = (x: PredictRow) => {
      const c = clamp(x.confidence01 ?? 0, 0, 1);
      const v = clamp(x.volatility01 ?? 0, 0, 1);

      if (chip === "safe") return c >= 0.62 && v <= 0.55;
      if (chip === "ceiling") return v >= 0.62 && c >= 0.38;
      if (chip === "risky") return c <= 0.48 && v >= 0.55;
      return true;
    };

    const out = r.filter(passChip);

    const sortKey = sort;
    out.sort((a, b) => {
      const ac = clamp(a.confidence01 ?? 0, 0, 1);
      const bc = clamp(b.confidence01 ?? 0, 0, 1);
      const av = clamp(a.volatility01 ?? 0, 0, 1);
      const bv = clamp(b.volatility01 ?? 0, 0, 1);
      const aceil = Math.max(a.rangeLow ?? 0, a.rangeHigh ?? 0);
      const bceil = Math.max(b.rangeLow ?? 0, b.rangeHigh ?? 0);

      if (sortKey === "confidence") return bc - ac || av - bv;
      if (sortKey === "volatility") return bv - av || bc - ac;
      return bceil - aceil || bc - ac;
    });

    return out;
  }, [rows, chip, sort]);

  const snap = useMemo(() => {
    // Simple card text if not provided
    if (insight && insight.trim().length) return insight;
    const cAvg =
      filtered.length ? filtered.reduce((s, r) => s + clamp(r.confidence01 ?? 0, 0, 1), 0) / filtered.length : 0;
    const vAvg =
      filtered.length ? filtered.reduce((s, r) => s + clamp(r.volatility01 ?? 0, 0, 1), 0) / filtered.length : 0;

    const cLabel = confidenceBand(cAvg);
    const vLabel = volatilityBand(vAvg);

    return `Across both teams, this matchup shows ${cLabel.toLowerCase()} role reliability with ${vLabel.toLowerCase()} volatility. Use confidence for safer floors, and volatility for ceiling leverage.`;
  }, [filtered, insight, confidenceBand, volatilityBand]);

  const selected = useMemo(() => filtered.find((r) => r.id === openId) ?? null, [filtered, openId]);

  // --- UI helpers ---
  const TeamPill = ({ team }: { team?: string }) => {
    const t = (team ?? "").trim();
    if (!t) return null;
    return (
      <span className="inline-flex items-center rounded-full border border-white/10 bg-white/[0.04] px-2 py-0.5 text-[11px] leading-4 text-white/70">
        {t}
      </span>
    );
  };

  const MetricPill = ({ label, tone }: { label: string; tone: "gold" | "blue" }) => (
    <span
      className={cx(
        "inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] leading-4",
        tone === "gold"
          ? "border-[rgba(255,200,60,0.25)] bg-[rgba(255,200,60,0.10)] text-[rgba(255,215,120,0.95)]"
          : "border-white/10 bg-white/[0.04] text-white/70"
      )}
    >
      {label}
    </span>
  );

  const DistributionStrip = ({ lo, hi, c01, v01 }: { lo: number; hi: number; c01: number; v01: number }) => {
    const a = Math.round(lo);
    const b = Math.round(hi);
    const mid = Math.round((a + b) / 2);

    const width = Math.max(1, Math.abs(b - a));
    const midPct = clamp((mid - a) / width, 0, 1);

    return (
      <div className="mt-4">
        <div className="mb-2 flex items-end justify-between text-[11px] text-white/50">
          <span>Floor</span>
          <span>Median</span>
          <span>Ceiling</span>
        </div>

        <div className="relative h-3 w-full rounded-full bg-white/10">
          {/* band */}
          <div
            className="absolute inset-y-0 rounded-full bg-[linear-gradient(90deg,rgba(255,200,60,0.10),rgba(255,200,60,0.55),rgba(255,200,60,0.10))]"
            style={{ left: "0%", right: "0%" }}
          />
          {/* median tick */}
          <div
            className="absolute top-[-4px] h-5 w-[2px] rounded-full bg-[rgba(255,215,120,0.95)]"
            style={{ left: `${midPct * 100}%` }}
          />
        </div>

        <div className="mt-2 flex items-center justify-between text-[12px] tabular-nums text-white">
          <span>{a}</span>
          <span>{mid}</span>
          <span>{b}</span>
        </div>

        <div className="mt-3 flex flex-wrap gap-2">
          <MetricPill label={`Confidence: ${confidenceBand(c01)}`} tone="gold" />
          <MetricPill label={`Volatility: ${volatilityBand(v01)}`} tone="blue" />
        </div>
      </div>
    );
  };

  return (
    <div className="w-full">
      {/* SECTION HEADER */}
      <div className="mb-3">
        <div className="flex flex-wrap items-center gap-2">
          <h3 className="text-[18px] font-semibold text-white">
            1. Player Score Predictability
            <span className="ml-2 inline-flex items-center gap-1 rounded-full border border-[rgba(255,200,60,0.25)] bg-[rgba(255,200,60,0.10)] px-2 py-0.5 text-[12px] font-medium text-[rgba(255,215,120,0.95)]">
              <Lock className="h-3.5 w-3.5" />
              Neeko+
            </span>
          </h3>
        </div>

        <div className="mt-0.5 text-[13px] text-white/60">
          Top 5 players per team for this matchup.
          {hint ? <span className="ml-2 text-white/40">{hint}</span> : null}
        </div>
      </div>

      {/* SNAPSHOT */}
      <div className="mb-4 rounded-2xl border border-[rgba(255,200,60,0.18)] bg-[rgba(255,200,60,0.08)] px-4 py-3">
        <div className="text-[11px] tracking-[0.18em] text-[rgba(255,215,120,0.85)]">AI ROUND SNAPSHOT · {statLabel}</div>
        <div className="mt-2 text-[13px] leading-relaxed text-white/80">{snap}</div>
        <div className="mt-2 text-[12px] text-white/45">
          Adjusted for <span className="text-white/65">{matchContext ?? contextLabel ?? "selected matchup"}</span>
        </div>
      </div>

      {/* CHIPS */}
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={() => setChip("all")}
          className={cx(
            "rounded-full border px-3 py-1 text-[12px] transition",
            chip === "all"
              ? "border-[rgba(255,200,60,0.35)] bg-[rgba(255,200,60,0.12)] text-[rgba(255,215,120,0.95)]"
              : "border-white/10 bg-white/[0.03] text-white/60 hover:bg-white/[0.06]"
          )}
        >
          All
        </button>
        <button
          type="button"
          onClick={() => setChip("safe")}
          className={cx(
            "rounded-full border px-3 py-1 text-[12px] transition",
            chip === "safe"
              ? "border-[rgba(255,200,60,0.35)] bg-[rgba(255,200,60,0.12)] text-[rgba(255,215,120,0.95)]"
              : "border-white/10 bg-white/[0.03] text-white/60 hover:bg-white/[0.06]"
          )}
        >
          Safe Picks
        </button>
        <button
          type="button"
          onClick={() => setChip("ceiling")}
          className={cx(
            "rounded-full border px-3 py-1 text-[12px] transition",
            chip === "ceiling"
              ? "border-[rgba(255,200,60,0.35)] bg-[rgba(255,200,60,0.12)] text-[rgba(255,215,120,0.95)]"
              : "border-white/10 bg-white/[0.03] text-white/60 hover:bg-white/[0.06]"
          )}
        >
          Ceiling Plays
        </button>
        <button
          type="button"
          onClick={() => setChip("risky")}
          className={cx(
            "rounded-full border px-3 py-1 text-[12px] transition",
            chip === "risky"
              ? "border-[rgba(255,200,60,0.35)] bg-[rgba(255,200,60,0.12)] text-[rgba(255,215,120,0.95)]"
              : "border-white/10 bg-white/[0.03] text-white/60 hover:bg-white/[0.06]"
          )}
        >
          Risky
        </button>

        <div className="ml-auto hidden text-[12px] text-white/40 md:block">
          Tip: Confidence = safety. Volatility = upside.
        </div>
      </div>

      {/* TABLE */}
      <div className="overflow-hidden rounded-2xl border border-white/10 bg-white/[0.03]">
        {/* header */}
        <div className="grid grid-cols-[56px_minmax(180px,1.4fr)_120px_minmax(220px,2fr)] gap-0 border-b border-white/10 bg-[#071021]/60 px-4 py-2 text-[11px] tracking-[0.16em] text-white/55">
          <div>#</div>
          <div>PLAYER</div>
          <div className="text-right">RANGE</div>
          <div className="hidden md:block">AI INSIGHT</div>
        </div>

        <div className="divide-y divide-white/10">
          {filtered.map((r, i) => {
            const isLocked = locked && i >= FREE_PREVIEW_COUNT;

            return (
              <button
                key={r.id}
                type="button"
                onClick={() => {
                  if (isLocked) return;
                  setOpenId(r.id);
                }}
                className={cx(
                  "group w-full text-left px-4 py-3 transition",
                  isLocked ? "cursor-not-allowed" : "hover:bg-white/[0.04]"
                )}
              >
                <div
                  className={cx(
                    "relative grid grid-cols-[56px_minmax(180px,1.4fr)_120px_minmax(220px,2fr)] items-center gap-0",
                    isLocked && "select-none"
                  )}
                >
                  {/* # */}
                  <div className={cx("text-[12px] tabular-nums", isLocked ? "text-white/30" : "text-white/55")}>
                    #{i + 1}
                  </div>

                  {/* PLAYER */}
                  <div className={cx("min-w-0", isLocked && "opacity-40")}>
                    <div className="flex flex-wrap items-center gap-2">
                      <div className="truncate text-[14px] font-semibold text-white">{r.name}</div>
                      <TeamPill team={(r as any).team} />
                    </div>

                    <div className="mt-1 flex flex-wrap items-center gap-2">
                      <MetricPill label={confidenceBand(r.confidence01)} tone="gold" />
                      <MetricPill label={volatilityBand(r.volatility01)} tone="blue" />
                    </div>
                  </div>

                  {/* RANGE */}
                  <div className={cx("text-right font-semibold tabular-nums", isLocked ? "text-white/30" : "text-white")}>
                    {fmtRange(r.rangeLow, r.rangeHigh)}
                  </div>

                  {/* AI INSIGHT */}
                  <div className={cx("hidden min-w-0 md:block", isLocked && "opacity-35")}>
                    <div className="truncate text-[13px] text-white/70">{r.ai}</div>
                  </div>
                  {/* LOCK OVERLAY */}
                  {isLocked ? (
                    <div className="absolute inset-0 rounded-xl bg-black/30 backdrop-blur-[2px]">
                      <div className="absolute inset-x-0 top-1/2 flex -translate-y-1/2 items-center justify-center">
                        <span className="inline-flex items-center gap-2 rounded-full border border-[rgba(255,200,60,0.30)] bg-[rgba(255,200,60,0.10)] px-3 py-1 text-[12px] text-[rgba(255,215,120,0.95)]">
                          <Lock className="h-4 w-4" />
                          Neeko+
                        </span>
                      </div>
                    </div>
                  ) : null}
                </div>
              </button>
            );
          })}
        </div>

        {/* FOOTER CTA */}
        {locked ? (
          <div className="flex flex-col gap-2 border-t border-[rgba(255,200,60,0.18)] bg-[rgba(255,200,60,0.06)] px-4 py-3 md:flex-row md:items-center md:justify-between">
            <div className="text-[13px] text-[rgba(255,215,120,0.90)]">
              You&apos;re viewing top {FREE_PREVIEW_COUNT} picks only.
              <div className="text-[12px] text-white/50">Unlock full projections, ranges and matchup reasoning with Neeko+.</div>
            </div>
            <button
              type="button"
              className="inline-flex items-center justify-center gap-2 rounded-full border border-[rgba(255,200,60,0.30)] bg-[rgba(255,200,60,0.12)] px-4 py-2 text-[13px] font-medium text-[rgba(255,215,120,0.95)] hover:bg-[rgba(255,200,60,0.18)]"
            >
              <Lock className="h-4 w-4" />
              Unlock Neeko+
            </button>
          </div>
        ) : null}
      </div>

      {/* MODAL */}
      {selected ? (
        <div className="fixed inset-0 z-[80] flex items-center justify-center p-4">
          <button
            type="button"
            className="absolute inset-0 bg-black/60"
            onClick={() => setOpenId(null)}
            aria-label="Close"
          />
          <div className="relative w-full max-w-[620px] rounded-2xl border border-white/10 bg-[#071021] p-5 shadow-2xl">
            <button
              type="button"
              onClick={() => setOpenId(null)}
              className="absolute right-3 top-3 rounded-full border border-white/10 bg-white/[0.03] p-2 text-white/70 hover:bg-white/[0.06]"
              aria-label="Close"
            >
              <X className="h-4 w-4" />
            </button>

            <div className="text-[18px] font-semibold text-white">{selected.name}</div>
            <div className="mt-1 text-[12px] text-white/50">
              {statLabel} · {matchContext ?? contextLabel ?? "Matchup"}
              {(selected as any).team ? ` · ${(selected as any).team}` : ""}
            </div>

            <div className="mt-3 rounded-xl border border-white/10 bg-white/[0.03] p-4 text-[13px] leading-relaxed text-white/80">
              {selected.ai}
            </div>

            <DistributionStrip
              lo={selected.rangeLow}
              hi={selected.rangeHigh}
              c01={selected.confidence01}
              v01={selected.volatility01}
            />

            <div className="mt-4 text-[12px] text-white/40">Tip: Press Esc or click outside to close.</div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
