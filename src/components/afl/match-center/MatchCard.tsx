import React from "react";
import type { FixtureMatch } from "./types";
import { cx, formatDateShort } from "./utils";

type Props = {
  match: FixtureMatch;
  // Keep Match Center non-AI: only navigation hooks
  onOpenMatch?: (m: FixtureMatch) => void;
  onOpenTeam?: (teamName: string) => void;
  showLadderBadges?: boolean;
  homePos?: number;
  awayPos?: number;
};

export default function MatchCard({
  match,
  onOpenMatch,
  onOpenTeam,
  showLadderBadges = true,
  homePos,
  awayPos,
}: Props) {
  return (
    <button
      type="button"
      onClick={() => onOpenMatch?.(match)}
      className={cx(
        "group w-full text-left rounded-2xl border border-amber-300/12 bg-white/[0.04] backdrop-blur-xl",
        "hover:bg-white/[0.06] hover:border-amber-300/18 transition-colors",
        "focus:outline-none focus:ring-2 focus:ring-amber-300/30"
      )}
    >
      <div className="p-4">
        {/* Top meta */}
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2 text-xs text-white/65">
            <span className="rounded-full border border-white/10 bg-black/20 px-2 py-1">
              {match.roundLabel}
            </span>
            <span>{formatDateShort(match.dateISO)}</span>
            <span className="text-white/30">•</span>
            <span>{match.timeLocal}</span>
          </div>

          <span
            className={cx(
              "rounded-full px-2 py-1 text-[11px] border",
              match.status === "live"
                ? "border-red-400/25 bg-red-400/10 text-red-200"
                : match.status === "final"
                ? "border-emerald-400/20 bg-emerald-400/10 text-emerald-200"
                : "border-white/10 bg-white/5 text-white/60"
            )}
          >
            {match.status === "live" ? "LIVE" : match.status === "final" ? "FINAL" : "UPCOMING"}
          </span>
        </div>

        {/* Teams */}
        <div className="mt-3 grid grid-cols-[1fr_auto_1fr] items-center gap-3">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <div className="h-9 w-9 rounded-xl bg-white/10 border border-white/10" />
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <span
                    className="truncate text-sm md:text-base font-semibold text-white"
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      onOpenTeam?.(match.homeTeam);
                    }}
                  >
                    {match.homeTeam}
                  </span>

                  {showLadderBadges && typeof homePos === "number" && (
                    <span className="rounded-full border border-white/10 bg-black/20 px-2 py-0.5 text-[11px] text-white/70">
                      #{homePos}
                    </span>
                  )}
                </div>
                <div className="text-xs text-white/55">Home</div>
              </div>
            </div>
          </div>

          <div className="text-xs text-white/35 font-semibold">vs</div>

          <div className="min-w-0">
            <div className="flex items-center gap-2 justify-end">
              <div className="min-w-0 text-right">
                <div className="flex items-center gap-2 justify-end">
                  {showLadderBadges && typeof awayPos === "number" && (
                    <span className="rounded-full border border-white/10 bg-black/20 px-2 py-0.5 text-[11px] text-white/70">
                      #{awayPos}
                    </span>
                  )}
                  <span
                    className="truncate text-sm md:text-base font-semibold text-white"
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      onOpenTeam?.(match.awayTeam);
                    }}
                  >
                    {match.awayTeam}
                  </span>
                </div>
                <div className="text-xs text-white/55">Away</div>
              </div>
              <div className="h-9 w-9 rounded-xl bg-white/10 border border-white/10" />
            </div>
          </div>
        </div>

        {/* Venue */}
        <div className="mt-3 flex items-center justify-between gap-3">
          <div className="text-xs text-white/60">
            <span className="text-white/40">Venue:</span> {match.venue}
          </div>
          <div className="text-xs text-amber-200/70 opacity-0 group-hover:opacity-100 transition-opacity">
            Open match →
          </div>
        </div>
      </div>
    </button>
  );
}
