import { useEffect, useState } from "react";
import { Crown, Lock, ArrowRight } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/lib/supabaseClient";

interface CaptainRow {
  player_id: number | null;
  player_name: string;
  team: string;
  projection_final: number | null;
  captain_score: number | null;
  captain_rating: string | null;
  captain_confidence: number | null;
}

function fmt(v: number | null | undefined, decimals = 1): string {
  if (v == null) return "—";
  const n = Number(v);
  if (isNaN(n)) return "—";
  return n.toFixed(decimals);
}

export function CaptainTeaserCard({ isPremium }: { isPremium: boolean }) {
  const [topCaptain, setTopCaptain] = useState<CaptainRow | null>(null);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      const { data } = await supabase.rpc("get_captain_recommendations_free");
      if (!cancelled) {
        const rows = (data as CaptainRow[]) ?? [];
        setTopCaptain(rows[0] ?? null);
        setLoading(false);
      }
    }
    load();
    return () => { cancelled = true; };
  }, []);

  const conf = topCaptain?.captain_confidence;
  const confColor =
    conf == null ? "text-white/40"
    : conf >= 90 ? "text-[#F5C84C]"
    : conf >= 80 ? "text-green-400"
    : "text-orange-400";

  return (
    <div className="px-4 pb-4 md:px-8">
      <div className="rounded-xl border border-[#F5C84C]/20 bg-gradient-to-r from-[#1a1408] to-[#0d0d0d] p-4 flex flex-col sm:flex-row sm:items-center gap-4">

        {/* Left — label */}
        <div className="flex items-center gap-2 shrink-0">
          <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-[#F5C84C]/15 text-[#F5C84C]">
            <Crown size={15} />
          </div>
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-widest text-[#F5C84C]/60">Top Captain</p>
            <p className="text-[11px] text-white/30">This Round</p>
          </div>
        </div>

        {/* Center — player info */}
        <div className="flex-1 min-w-0">
          {loading ? (
            <div className="space-y-1.5">
              <div className="h-3.5 w-32 rounded bg-white/10 animate-pulse" />
              <div className="h-2.5 w-20 rounded bg-white/5 animate-pulse" />
            </div>
          ) : topCaptain ? (
            <div className="flex items-center gap-4 flex-wrap">
              <div className="min-w-0">
                <p className="text-sm font-bold text-white leading-tight truncate">{topCaptain.player_name}</p>
                <p className="text-[11px] text-white/40">{topCaptain.team}</p>
              </div>
              <div className="flex items-center gap-3 shrink-0">
                <div>
                  <p className="text-[10px] text-white/30 mb-0.5">Proj</p>
                  <p className="text-xs font-bold text-[#F5C84C] tabular-nums">{fmt(topCaptain.projection_final)}</p>
                </div>
                {conf != null && (
                  <div>
                    <p className="text-[10px] text-white/30 mb-0.5">Conf</p>
                    <p className={`text-xs font-bold tabular-nums ${confColor}`}>{Math.round(conf)}%</p>
                  </div>
                )}
                {topCaptain.captain_score != null && (
                  <div>
                    <p className="text-[10px] text-white/30 mb-0.5">Score</p>
                    <p className="text-xs font-bold text-white/70 tabular-nums">{fmt(topCaptain.captain_score)}</p>
                  </div>
                )}
              </div>
            </div>
          ) : (
            <p className="text-xs text-white/30">Captain data generating…</p>
          )}
        </div>

        {/* Right — CTA */}
        {!isPremium ? (
          <a
            href="/neeko-plus"
            className="shrink-0 flex items-center gap-1.5 bg-[#F5C84C]/10 border border-[#F5C84C]/30 text-[#F5C84C] font-semibold text-xs px-3 py-2 rounded-lg hover:bg-[#F5C84C]/20 transition-colors whitespace-nowrap"
          >
            <Lock size={11} />
            Unlock Full Neeko Intel
          </a>
        ) : (
          <button
            onClick={() => navigate("/sports/afl/neeko-intel")}
            className="shrink-0 flex items-center gap-1.5 bg-[#F5C84C]/10 border border-[#F5C84C]/30 text-[#F5C84C] font-semibold text-xs px-3 py-2 rounded-lg hover:bg-[#F5C84C]/20 transition-colors whitespace-nowrap"
          >
            Full Neeko Intel
            <ArrowRight size={11} />
          </button>
        )}
      </div>
    </div>
  );
}
