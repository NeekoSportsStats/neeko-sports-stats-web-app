import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Trophy, Brain, TrendingUp, Crown, ChevronRight, ArrowRight, Star, Zap, Shield } from "lucide-react";
import { supabase } from "@/lib/supabaseClient";
import { useAuth } from "@/lib/auth";

interface RankingRow {
  player_id: number;
  player_name: string;
  team: string;
  projection_final: number | null;
  form_rating: string | null;
  ai_recommendation: string | null;
}

interface InsightRow {
  player_id: number;
  player_name: string;
  team: string;
  projection_final: number | null;
  ceiling_estimate: number | null;
  floor_estimate: number | null;
  trend_3_vs_10: number | null;
  consistency_score: number | null;
}

const formColors: Record<string, string> = {
  Elite: "text-yellow-400",
  Strong: "text-emerald-400",
  Average: "text-neutral-400",
  Risky: "text-red-400",
};

const recColors: Record<string, { text: string; bg: string }> = {
  "Must Start":    { text: "text-emerald-300", bg: "bg-emerald-500/15 border-emerald-500/30" },
  "Strong Play":   { text: "text-yellow-300",  bg: "bg-yellow-500/15 border-yellow-500/30" },
  "Risky Play":    { text: "text-orange-300",  bg: "bg-orange-500/15 border-orange-500/30" },
  "Avoid":         { text: "text-red-300",     bg: "bg-red-500/15 border-red-500/30" },
};

export default function Index() {
  const { isPremium } = useAuth();
  const [rankings, setRankings] = useState<RankingRow[]>([]);
  const [insights, setInsights] = useState<InsightRow[]>([]);
  const [loadingRankings, setLoadingRankings] = useState(true);
  const [loadingInsights, setLoadingInsights] = useState(true);

  useEffect(() => {
    async function fetchRankings() {
      const { data } = await supabase
        .from("v_rankings_free")
        .select("player_id, player_name, team, projection_final, form_rating, ai_recommendation")
        .order("projection_final", { ascending: false })
        .limit(10);
      setRankings((data as RankingRow[]) || []);
      setLoadingRankings(false);
    }
    fetchRankings();
  }, []);

  useEffect(() => {
    async function fetchInsights() {
      const { data } = await supabase
        .from("v_insights_free")
        .select("player_id, player_name, team, projection_final, ceiling_estimate, floor_estimate, trend_3_vs_10, consistency_score")
        .order("projection_final", { ascending: false })
        .limit(3);
      setInsights((data as InsightRow[]) || []);
      setLoadingInsights(false);
    }
    fetchInsights();
  }, []);

  const getTrendLabel = (val: number | null) => {
    if (val == null) return null;
    if (val >= 5) return { label: "Trending Up", color: "text-emerald-400" };
    if (val <= -5) return { label: "Trending Down", color: "text-red-400" };
    return { label: "Stable", color: "text-neutral-400" };
  };

  return (
    <div className="min-h-screen bg-[#070707] text-white">

      {/* ── HERO ─────────────────────────────────────────────── */}
      <section className="relative overflow-hidden min-h-[60vh] flex items-center">
        <div
          className="absolute inset-0"
          style={{
            backgroundImage: "url(/hero.jpg)",
            backgroundSize: "cover",
            backgroundPosition: "center",
          }}
        />
        <div className="absolute inset-0 bg-gradient-to-b from-black/70 via-black/60 to-[#070707]" />

        <div className="relative z-10 w-full max-w-5xl mx-auto px-4 py-24 text-center">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full border border-yellow-400/40 bg-yellow-400/10 text-yellow-300 text-xs font-semibold uppercase tracking-wider mb-6">
            <Zap className="h-3 w-3" />
            AFL 2026 Season Live
          </div>

          <h1 className="text-5xl md:text-7xl font-extrabold mb-4 leading-tight">
            Neeko Sports Stats
          </h1>
          <p className="text-xl md:text-2xl text-white/70 font-medium mb-10 max-w-2xl mx-auto">
            Elite AFL Fantasy Intelligence
          </p>

          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <Button
              asChild
              size="lg"
              className="bg-yellow-400 text-black hover:bg-yellow-300 font-bold text-base px-8 py-5 rounded-xl"
            >
              <Link to="/sports/afl/rankings">
                View Player Rankings
                <ArrowRight className="h-4 w-4 ml-2" />
              </Link>
            </Button>
            {!isPremium && (
              <Button
                asChild
                size="lg"
                variant="outline"
                className="border-white/20 text-white hover:bg-white/10 font-semibold text-base px-8 py-5 rounded-xl"
              >
                <Link to="/neeko-plus">
                  <Crown className="h-4 w-4 mr-2" />
                  Get Neeko+
                </Link>
              </Button>
            )}
          </div>
        </div>
      </section>

      {/* ── TOP 10 RANKINGS TEASER ───────────────────────────── */}
      <section className="py-20 bg-[#0a0a0a]">
        <div className="max-w-4xl mx-auto px-4">
          <div className="flex items-center justify-between mb-8">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <Trophy className="h-5 w-5 text-yellow-400" />
                <span className="text-yellow-400 text-sm font-semibold uppercase tracking-wider">Live Rankings</span>
              </div>
              <h2 className="text-3xl md:text-4xl font-bold">Top 10 Players</h2>
              <p className="text-white/50 mt-1 text-sm">Ranked by projected fantasy score</p>
            </div>
            <Button
              asChild
              variant="outline"
              className="hidden sm:flex border-white/15 text-white/70 hover:text-white hover:bg-white/5 rounded-lg"
            >
              <Link to="/sports/afl/rankings">
                Full Rankings
                <ChevronRight className="h-4 w-4 ml-1" />
              </Link>
            </Button>
          </div>

          <div className="rounded-2xl border border-white/10 overflow-hidden bg-[#111111]">
            {/* Table header */}
            <div className="grid grid-cols-[2.5rem_1fr_auto_auto] gap-3 px-4 py-3 border-b border-white/10 text-xs font-semibold uppercase tracking-wider text-white/40">
              <span>#</span>
              <span>Player</span>
              <span className="text-right hidden sm:block">Form</span>
              <span className="text-right">Projection</span>
            </div>

            {loadingRankings ? (
              <div className="divide-y divide-white/5">
                {Array.from({ length: 10 }).map((_, i) => (
                  <div key={i} className="grid grid-cols-[2.5rem_1fr_auto_auto] gap-3 px-4 py-3.5 animate-pulse">
                    <div className="h-4 w-5 bg-white/10 rounded" />
                    <div className="space-y-1.5">
                      <div className="h-4 w-32 bg-white/10 rounded" />
                      <div className="h-3 w-20 bg-white/5 rounded" />
                    </div>
                    <div className="h-4 w-14 bg-white/10 rounded hidden sm:block" />
                    <div className="h-4 w-12 bg-white/10 rounded ml-auto" />
                  </div>
                ))}
              </div>
            ) : (
              <div className="divide-y divide-white/5">
                {rankings.map((p, idx) => {
                  const rec = p.ai_recommendation ? recColors[p.ai_recommendation] : null;
                  const formColor = p.form_rating ? (formColors[p.form_rating] ?? "text-neutral-400") : "text-neutral-500";
                  return (
                    <div
                      key={p.player_id}
                      className="grid grid-cols-[2.5rem_1fr_auto_auto] gap-3 px-4 py-3.5 hover:bg-white/[0.03] transition-colors items-center"
                    >
                      <span className={`text-sm font-bold tabular-nums ${idx < 3 ? "text-yellow-400" : "text-white/30"}`}>
                        {idx + 1}
                      </span>
                      <div>
                        <div className="font-semibold text-sm text-white leading-tight">{p.player_name}</div>
                        <div className="text-xs text-white/40 mt-0.5">{p.team}</div>
                      </div>
                      <div className="hidden sm:flex items-center gap-2">
                        {p.form_rating && (
                          <span className={`text-xs font-medium ${formColor}`}>{p.form_rating}</span>
                        )}
                        {rec && p.ai_recommendation && (
                          <span className={`text-xs font-semibold px-2 py-0.5 rounded-full border ${rec.bg} ${rec.text}`}>
                            {p.ai_recommendation}
                          </span>
                        )}
                      </div>
                      <div className="text-right">
                        <span className="text-sm font-bold text-yellow-400 tabular-nums">
                          {p.projection_final != null ? Math.round(p.projection_final) : "—"}
                        </span>
                        <div className="text-xs text-white/30">pts</div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          <div className="mt-5 sm:hidden text-center">
            <Button
              asChild
              variant="outline"
              className="border-white/15 text-white/70 hover:text-white hover:bg-white/5 rounded-lg w-full"
            >
              <Link to="/sports/afl/rankings">
                View Full Rankings
                <ChevronRight className="h-4 w-4 ml-1" />
              </Link>
            </Button>
          </div>
        </div>
      </section>

      {/* ── INSIGHTS TEASER ──────────────────────────────────── */}
      <section className="py-20 bg-[#070707] border-t border-white/5">
        <div className="max-w-4xl mx-auto px-4">
          <div className="flex items-center gap-2 mb-1">
            <Brain className="h-5 w-5 text-sky-400" />
            <span className="text-sky-400 text-sm font-semibold uppercase tracking-wider">AI Insights</span>
          </div>
          <div className="flex items-end justify-between mb-8">
            <div>
              <h2 className="text-3xl md:text-4xl font-bold">Top Picks This Round</h2>
              <p className="text-white/50 mt-1 text-sm">AI-powered projections with ceiling & floor</p>
            </div>
            <Button
              asChild
              variant="outline"
              className="hidden sm:flex border-white/15 text-white/70 hover:text-white hover:bg-white/5 rounded-lg"
            >
              <Link to="/sports/afl/ai-analysis">
                Full Insights
                <ChevronRight className="h-4 w-4 ml-1" />
              </Link>
            </Button>
          </div>

          <div className="grid sm:grid-cols-3 gap-4">
            {loadingInsights ? (
              Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="rounded-2xl border border-white/10 bg-[#111111] p-5 animate-pulse space-y-3">
                  <div className="h-4 w-28 bg-white/10 rounded" />
                  <div className="h-3 w-16 bg-white/5 rounded" />
                  <div className="h-8 w-16 bg-white/10 rounded mt-4" />
                  <div className="flex gap-2 mt-2">
                    <div className="h-3 w-14 bg-white/5 rounded" />
                    <div className="h-3 w-14 bg-white/5 rounded" />
                  </div>
                </div>
              ))
            ) : (
              insights.map((p, idx) => {
                const trend = getTrendLabel(p.trend_3_vs_10);
                return (
                  <div
                    key={p.player_id}
                    className="rounded-2xl border border-white/10 bg-[#111111] p-5 hover:border-white/20 transition-colors"
                  >
                    <div className="flex items-start justify-between mb-3">
                      <div>
                        <div className="font-bold text-sm text-white">{p.player_name}</div>
                        <div className="text-xs text-white/40 mt-0.5">{p.team}</div>
                      </div>
                      {idx === 0 && (
                        <Star className="h-4 w-4 text-yellow-400 shrink-0 mt-0.5" />
                      )}
                    </div>

                    <div className="text-3xl font-extrabold text-yellow-400 tabular-nums mb-1">
                      {p.projection_final != null ? Math.round(p.projection_final) : "—"}
                    </div>
                    <div className="text-xs text-white/30 mb-3">projected pts</div>

                    <div className="flex flex-wrap gap-x-3 gap-y-1 text-xs text-white/50">
                      {p.ceiling_estimate != null && (
                        <span>Ceil <span className="text-emerald-400 font-semibold">{Math.round(p.ceiling_estimate)}</span></span>
                      )}
                      {p.floor_estimate != null && (
                        <span>Floor <span className="text-red-400 font-semibold">{Math.round(p.floor_estimate)}</span></span>
                      )}
                    </div>

                    {trend && (
                      <div className={`text-xs font-medium mt-2 ${trend.color}`}>
                        {trend.label}
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>

          {/* Lock prompt for non-premium */}
          {!isPremium && (
            <div className="mt-8 rounded-2xl border border-white/10 bg-[#111111] p-6 text-center">
              <Shield className="h-8 w-8 text-white/20 mx-auto mb-3" />
              <p className="text-white/50 text-sm mb-4">
                Full AI breakdowns, matchup ratings, and risk analysis are available with Neeko+
              </p>
              <Button
                asChild
                className="bg-yellow-400 text-black hover:bg-yellow-300 font-bold rounded-xl px-6"
              >
                <Link to="/neeko-plus">
                  Unlock Full Insights
                </Link>
              </Button>
            </div>
          )}

          <div className="mt-5 sm:hidden text-center">
            <Button
              asChild
              variant="outline"
              className="border-white/15 text-white/70 hover:text-white hover:bg-white/5 rounded-lg w-full"
            >
              <Link to="/sports/afl/ai-analysis">
                View All AI Insights
                <ChevronRight className="h-4 w-4 ml-1" />
              </Link>
            </Button>
          </div>
        </div>
      </section>

      {/* ── NEEKO+ CTA ───────────────────────────────────────── */}
      {!isPremium && (
        <section className="py-20 bg-[#0a0a0a] border-t border-white/5">
          <div className="max-w-3xl mx-auto px-4 text-center">
            <Crown className="h-12 w-12 text-yellow-400 mx-auto mb-5" />
            <h2 className="text-3xl md:text-4xl font-bold mb-3">Neeko+ Premium</h2>
            <p className="text-white/50 text-lg mb-2 max-w-xl mx-auto">
              Unlock every ranking, full AI breakdowns, matchup ratings, ceiling/floor data, and captain recommendations.
            </p>
            <p className="text-yellow-400 font-bold text-xl mb-8">$5.99 / week — cancel anytime</p>

            <div className="grid sm:grid-cols-3 gap-4 mb-10 text-left">
              {[
                { icon: Trophy,    label: "Full Rankings",      desc: "All 200+ players ranked with projections" },
                { icon: Brain,     label: "AI Analysis",        desc: "Deep-dive breakdowns & match predictions" },
                { icon: TrendingUp, label: "Captain Intel",     desc: "Top captain picks ranked & scored" },
              ].map(({ icon: Icon, label, desc }) => (
                <div key={label} className="rounded-xl border border-white/10 bg-[#111111] p-4">
                  <Icon className="h-5 w-5 text-yellow-400 mb-2" />
                  <div className="font-semibold text-sm text-white mb-1">{label}</div>
                  <div className="text-xs text-white/40">{desc}</div>
                </div>
              ))}
            </div>

            <Button
              asChild
              size="lg"
              className="bg-yellow-400 text-black hover:bg-yellow-300 font-bold text-base px-10 py-5 rounded-xl"
            >
              <Link to="/neeko-plus">
                <Crown className="h-4 w-4 mr-2" />
                Upgrade Now
              </Link>
            </Button>
          </div>
        </section>
      )}

      {/* ── FOOTER ───────────────────────────────────────────── */}
      <footer className="border-t border-white/5 bg-[#070707] py-8">
        <div className="max-w-4xl mx-auto px-4">
          <div className="flex flex-col sm:flex-row justify-between items-center gap-4">
            <p className="text-xs text-white/30">
              © {new Date().getFullYear()} Neeko Sports Stats. All rights reserved.
            </p>
            <div className="flex gap-5 text-xs">
              {[
                { label: "Policies", to: "/policies" },
                { label: "Contact",  to: "/contact" },
                { label: "About",    to: "/about" },
                { label: "FAQ",      to: "/faq" },
              ].map((l) => (
                <Link key={l.to} to={l.to} className="text-white/30 hover:text-white/70 transition-colors">
                  {l.label}
                </Link>
              ))}
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
