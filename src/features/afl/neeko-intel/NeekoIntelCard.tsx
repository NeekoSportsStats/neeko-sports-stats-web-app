import { Lock } from "lucide-react";

interface NeekoIntelCardProps {
  playerName: string;
  team: string;
  position?: string | null;
  projection: number | null;
  confidence?: number | null;
  label?: string | null;
  color?: string | null;
  reason?: string | null;
  captainRating?: string | null;
  captainScore?: number | null;
  locked: boolean;
  rank?: number;
  onClick?: () => void;
}

function fmt(v: number | null, decimals = 1): string {
  if (v == null) return "—";
  return Number(v).toFixed(decimals);
}

function fmtInt(v: number | null): string {
  if (v == null) return "—";
  return Math.round(Number(v)).toString();
}

export function NeekoIntelCard({
  playerName,
  team,
  position,
  projection,
  confidence,
  label,
  color,
  reason,
  captainRating,
  captainScore,
  locked,
  rank,
  onClick,
}: NeekoIntelCardProps) {
  const isElite = label === "ELITE CAPTAIN" || label === "CAPTAIN LOCK";

  return (
    <div
      onClick={locked ? undefined : onClick}
      className={`relative rounded-xl border p-4 transition-all duration-150 ${
        isElite
          ? "bg-[#120E00] border-[#F5C84C]/30"
          : "bg-[#111111] border-white/10"
      } ${locked ? "opacity-50 blur-sm select-none pointer-events-none" : onClick ? "cursor-pointer hover:bg-white/[0.04] hover:border-white/20" : ""}`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-2.5 min-w-0">
          {rank != null && (
            <span className="shrink-0 text-white/25 text-xs tabular-nums w-5 text-center">{rank}</span>
          )}
          <div className="min-w-0">
            <div className="font-semibold text-white text-sm leading-tight truncate">{playerName}</div>
            <div className="text-[11px] text-white/40 mt-0.5">
              {team}{position ? ` · ${position}` : ""}
            </div>
          </div>
        </div>

        {label && (
          <div
            className="shrink-0 rounded-full px-2.5 py-1 text-[10px] font-bold whitespace-nowrap"
            style={
              isElite
                ? {
                    color: "#F5C84C",
                    background: "linear-gradient(90deg, #3A2A00, #5A4200, #3A2A00)",
                    border: "1px solid #F5C84C",
                  }
                : color
                ? {
                    color,
                    backgroundColor: `${color}22`,
                    border: `1px solid ${color}66`,
                  }
                : {
                    color: "rgba(255,255,255,0.4)",
                    backgroundColor: "rgba(255,255,255,0.05)",
                    border: "1px solid rgba(255,255,255,0.1)",
                  }
            }
          >
            {label}
          </div>
        )}
      </div>

      <div className="flex items-end gap-5 mt-3">
        <div>
          <div className="text-[10px] text-white/35 uppercase tracking-wider mb-0.5">Projection</div>
          <div className="text-[#F5C84C] font-bold text-2xl tabular-nums leading-none">{fmt(projection)}</div>
        </div>

        {confidence != null && (
          <div>
            <div className="text-[10px] text-white/35 uppercase tracking-wider mb-0.5">Confidence</div>
            <div
              className={`text-sm font-semibold tabular-nums ${
                confidence >= 80
                  ? "text-green-400"
                  : confidence >= 65
                  ? "text-yellow-400"
                  : confidence >= 45
                  ? "text-orange-400"
                  : "text-red-400"
              }`}
            >
              {fmtInt(confidence)}%
            </div>
          </div>
        )}

        {captainScore != null && (
          <div>
            <div className="text-[10px] text-white/35 uppercase tracking-wider mb-0.5">Captain Score</div>
            <div className="text-sm font-semibold text-yellow-300 tabular-nums">{fmtInt(captainScore)}</div>
          </div>
        )}

        {captainRating && !captainScore && (
          <div>
            <div className="text-[10px] text-white/35 uppercase tracking-wider mb-0.5">Rating</div>
            <div className="text-sm font-semibold text-yellow-300">{captainRating}</div>
          </div>
        )}
      </div>

      {reason && (
        <p className="mt-3 text-[11px] text-white/50 leading-relaxed border-t border-white/5 pt-3 line-clamp-2">
          {reason}
        </p>
      )}
    </div>
  );
}

export function NeekoIntelCardLocked() {
  return (
    <div className="relative rounded-xl border border-white/10 bg-[#111111] p-4 flex items-center justify-between gap-3">
      <div className="flex-1">
        <div className="h-3 w-28 rounded bg-white/10 animate-pulse mb-2" />
        <div className="h-2.5 w-16 rounded bg-white/5 animate-pulse" />
        <div className="h-6 w-20 rounded bg-white/5 animate-pulse mt-3" />
      </div>
      <a
        href="/neeko-plus"
        onClick={(e) => e.stopPropagation()}
        className="shrink-0 flex items-center gap-1.5 bg-[#F5C84C]/15 text-[#F5C84C] text-xs font-semibold px-3 py-2 rounded-lg hover:bg-[#F5C84C]/25 transition-colors border border-[#F5C84C]/20"
      >
        <Lock size={11} />
        Unlock Neeko+
      </a>
    </div>
  );
}

export function NeekoIntelSkeletonCard() {
  return (
    <div className="rounded-xl border border-white/5 bg-[#111111] p-4 space-y-3 animate-pulse">
      <div className="flex items-center justify-between">
        <div className="space-y-1.5">
          <div className="h-3.5 w-32 rounded bg-white/10" />
          <div className="h-2.5 w-20 rounded bg-white/5" />
        </div>
        <div className="h-6 w-24 rounded-full bg-white/10" />
      </div>
      <div className="h-7 w-16 rounded bg-white/10" />
      <div className="h-2.5 w-full rounded bg-white/5" />
      <div className="h-2.5 w-3/4 rounded bg-white/5" />
    </div>
  );
}
