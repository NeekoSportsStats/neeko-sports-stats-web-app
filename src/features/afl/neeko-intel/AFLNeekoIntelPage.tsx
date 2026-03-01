import { useState, useEffect } from "react";
import { Lock, Crown, Zap, TrendingUp, TrendingDown, Shield, Star, Swords, RefreshCw } from "lucide-react";
import { supabase } from "@/lib/supabaseClient";
import { useAuth } from "@/lib/auth";
import {
  NeekoIntelCard,
  NeekoIntelCardLocked,
  NeekoIntelSkeletonCard,
} from "./NeekoIntelCard";

// ─── Types ────────────────────────────────────────────────────────────────────

interface RankingRow {
  player_id: string | null;
  player_name: string;
  team: string;
  position: string | null;
  projection_final: number | null;
  projection_confidence: number | null;
  consistency_score: number | null;
  ai_recommendation: string | null;
  recommendation_color: string | null;
  recommendation_why: string | null;
  captain_score: number | null;
  captain_rating: string | null;
  upside_rating: number | null;
  risk_rating: number | null;
  updated_at?: string | null;
}

interface CaptainRow {
  player_id: string | null;
  player_name: string;
  team: string;
  projection_final: number | null;
  ceiling_estimate: number | null;
  consistency_score: number | null;
  captain_score: number | null;
  captain_rating: string | null;
  captain_confidence: number | null;
}

interface MatchPrediction {
  match_id: number;
  home_team: string;
  away_team: string;
  round_number: number;
  season: number;
  predicted_home_score: number | null;
  predicted_away_score: number | null;
  predicted_margin: number | null;
  confidence: string | null;
  ai_summary: string | null;
  prediction_explanation: string | null;
  updated_at: string | null;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const FREE_PREVIEW_COUNT = 2;

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmt(v: number | null, decimals = 1): string {
  if (v == null) return "—";
  return Number(v).toFixed(decimals);
}

function fmtInt(v: number | null): string {
  if (v == null) return "—";
  return Math.round(Number(v)).toString();
}

function relativeTime(iso: string | null): string {
  if (!iso) return "recently";
  const diff = Date.now() - new Date(iso).getTime();
  const hours = Math.floor(diff / 3600000);
  if (hours < 1) return "just now";
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

function confidenceColor(v: number | null): string {
  if (v == null) return "text-white/30";
  if (v >= 80) return "text-green-400";
  if (v >= 65) return "text-yellow-400";
  if (v >= 45) return "text-orange-400";
  return "text-red-400";
}

// ─── Section Header ───────────────────────────────────────────────────────────

function SectionHeader({
  icon,
  title,
  subtitle,
  locked,
}: {
  icon: React.ReactNode;
  title: string;
  subtitle?: string;
  locked?: boolean;
}) {
  return (
    <div className="flex items-center gap-3 mb-4">
      <div className="flex items-center justify-center w-9 h-9 rounded-lg bg-[#F5C84C]/10 text-[#F5C84C] shrink-0">
        {icon}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <h2 className="text-base font-bold text-white">{title}</h2>
          {locked && <Lock size={12} className="text-[#F5C84C]/50 shrink-0" />}
        </div>
        {subtitle && <p className="text-[11px] text-white/35 mt-0.5">{subtitle}</p>}
      </div>
    </div>
  );
}

// ─── Section Shell ────────────────────────────────────────────────────────────

function Section({ children }: { children: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-white/[0.07] bg-[#0d0d0d] p-5">
      {children}
    </div>
  );
}

// ─── Upgrade CTA Banner ───────────────────────────────────────────────────────

function UpgradeCTABanner() {
  return (
    <div className="rounded-2xl overflow-hidden relative">
      <div className="bg-gradient-to-r from-[#3A2A00] via-[#5A4200] to-[#3A2A00] border border-[#F5C84C]/30 p-6 flex flex-col sm:flex-row items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Crown size={18} className="text-[#F5C84C]" />
            <span className="text-[#F5C84C] font-bold text-lg">Unlock Full Neeko Intel</span>
          </div>
          <p className="text-white/60 text-sm">
            Access all breakouts, risers, captain picks, match projections and AI reasoning for every player.
          </p>
        </div>
        <a
          href="/neeko-plus"
          className="shrink-0 bg-[#F5C84C] text-[#070707] font-bold text-sm px-6 py-3 rounded-xl hover:bg-[#FFD84C] transition-colors whitespace-nowrap"
        >
          Upgrade to Neeko+
        </a>
      </div>
    </div>
  );
}

// ─── Match Card ───────────────────────────────────────────────────────────────

function MatchPredictionCard({
  match,
  locked,
}: {
  match: MatchPrediction;
  locked: boolean;
}) {
  const homeWin =
    match.predicted_home_score != null &&
    match.predicted_away_score != null &&
    match.predicted_home_score > match.predicted_away_score;

  return (
    <div
      className={`rounded-xl border border-white/10 bg-[#111111] p-4 transition-all ${
        locked ? "blur-sm opacity-50 select-none pointer-events-none" : ""
      }`}
    >
      <div className="flex items-center justify-between gap-2 mb-3">
        <span className="text-[10px] text-white/30 uppercase tracking-wider">
          Round {match.round_number} · {match.season}
        </span>
        {match.confidence && (
          <span
            className={`text-[10px] font-semibold uppercase tracking-wide px-2 py-0.5 rounded-full border ${
              match.confidence === "HIGH"
                ? "text-green-400 border-green-400/30 bg-green-400/10"
                : match.confidence === "MEDIUM"
                ? "text-yellow-400 border-yellow-400/30 bg-yellow-400/10"
                : "text-orange-400 border-orange-400/30 bg-orange-400/10"
            }`}
          >
            {match.confidence}
          </span>
        )}
      </div>

      <div className="flex items-center justify-between gap-2">
        <div className={`flex-1 text-center ${homeWin ? "opacity-100" : "opacity-50"}`}>
          <div className="font-bold text-white text-sm leading-tight">{match.home_team}</div>
          <div className={`text-2xl font-black tabular-nums mt-1 ${homeWin ? "text-[#F5C84C]" : "text-white/60"}`}>
            {fmt(match.predicted_home_score, 0)}
          </div>
        </div>

        <div className="text-center shrink-0 px-2">
          <div className="text-white/20 text-xs font-bold">VS</div>
          {match.predicted_margin != null && (
            <div className="text-[10px] text-white/30 mt-1">
              {homeWin ? "+" : "-"}{Math.abs(Math.round(Number(match.predicted_margin)))} pts
            </div>
          )}
        </div>

        <div className={`flex-1 text-center ${!homeWin ? "opacity-100" : "opacity-50"}`}>
          <div className="font-bold text-white text-sm leading-tight">{match.away_team}</div>
          <div className={`text-2xl font-black tabular-nums mt-1 ${!homeWin ? "text-[#F5C84C]" : "text-white/60"}`}>
            {fmt(match.predicted_away_score, 0)}
          </div>
        </div>
      </div>

      {(match.ai_summary || match.prediction_explanation) && (
        <p className="mt-3 text-[11px] text-white/45 leading-relaxed border-t border-white/5 pt-3 line-clamp-3">
          {match.ai_summary ?? match.prediction_explanation}
        </p>
      )}
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function AFLNeekoIntelPage() {
  const { isPremium } = useAuth();

  const [allRows, setAllRows] = useState<RankingRow[]>([]);
  const [captains, setCaptains] = useState<CaptainRow[]>([]);
  const [matches, setMatches] = useState<MatchPrediction[]>([]);
  const [loading, setLoading] = useState(true);
  const [lastUpdated, setLastUpdated] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      setLoading(true);
      try {
        const [rankRes, captainRes, matchRes] = await Promise.all([
          supabase
            .from("v_rankings_master")
            .select(
              "player_id, player_name, team, position, projection_final, projection_confidence, consistency_score, ai_recommendation, recommendation_color, recommendation_why, captain_score, captain_rating, upside_rating, risk_rating"
            )
            .not("ai_recommendation", "is", null)
            .order("projection_final", { ascending: false })
            .limit(200),

          supabase
            .from("v_captain_recommendations")
            .select("player_id, player_name, team, projection_final, ceiling_estimate, consistency_score, captain_score, captain_rating, captain_confidence")
            .order("captain_score", { ascending: false })
            .limit(20),

          supabase
            .from("v_ai_match_predictions_preview")
            .select("match_id, home_team, away_team, round_number, season, predicted_home_score, predicted_away_score, predicted_margin, confidence, ai_summary, prediction_explanation, updated_at")
            .order("round_number", { ascending: false })
            .limit(9),
        ]);

        if (rankRes.data) {
          setAllRows(rankRes.data as RankingRow[]);
          const anyUpdated = (rankRes.data as RankingRow[]).find((r) => (r as unknown as { updated_at?: string }).updated_at);
          if (anyUpdated) setLastUpdated((anyUpdated as unknown as { updated_at: string }).updated_at);
        }
        if (captainRes.data) setCaptains(captainRes.data as CaptainRow[]);
        if (matchRes.data) {
          setMatches(matchRes.data as MatchPrediction[]);
          const first = (matchRes.data as MatchPrediction[])[0];
          if (first?.updated_at && !lastUpdated) setLastUpdated(first.updated_at);
        }
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  const breakouts = allRows
    .filter((r) =>
      r.ai_recommendation === "MUST START" ||
      r.ai_recommendation === "HIGH CONFIDENCE"
    )
    .slice(0, 5);

  const risks = allRows
    .filter((r) =>
      r.ai_recommendation === "HIGH RISK" ||
      r.ai_recommendation === "AVOID"
    )
    .sort((a, b) => (b.risk_rating ?? 0) - (a.risk_rating ?? 0))
    .slice(0, 5);

  const risers = allRows
    .filter((r) => (r.upside_rating ?? 0) >= 20 && r.ai_recommendation !== "AVOID")
    .sort((a, b) => (b.upside_rating ?? 0) - (a.upside_rating ?? 0))
    .slice(0, 5);

  const fallers = allRows
    .filter((r) => r.ai_recommendation === "HIGH RISK" || r.ai_recommendation === "AVOID")
    .sort((a, b) => (b.risk_rating ?? 0) - (a.risk_rating ?? 0))
    .slice(0, 5);

  const topCaptains = captains.slice(0, 5);

  const isEmpty = !loading && allRows.length === 0;

  function renderCards(
    rows: RankingRow[],
    keyField: "breakout" | "risk" | "risers" | "fallers"
  ) {
    const freeCount = isPremium ? rows.length : FREE_PREVIEW_COUNT;

    if (loading) {
      return Array.from({ length: 3 }).map((_, i) => (
        <NeekoIntelSkeletonCard key={i} />
      ));
    }

    if (rows.length === 0) {
      return (
        <div className="text-center py-6 text-white/30 text-sm">
          Neeko Intel generating...
        </div>
      );
    }

    return (
      <>
        {rows.map((row, idx) => {
          const locked = idx >= freeCount;
          if (locked) return <NeekoIntelCardLocked key={`${keyField}-locked-${idx}`} />;
          return (
            <NeekoIntelCard
              key={row.player_id ?? row.player_name + idx}
              rank={idx + 1}
              playerName={row.player_name}
              team={row.team}
              position={row.position}
              projection={row.projection_final}
              confidence={row.projection_confidence}
              label={row.ai_recommendation}
              color={row.recommendation_color}
              reason={row.recommendation_why}
              locked={false}
            />
          );
        })}
      </>
    );
  }

  return (
    <div className="min-h-screen bg-[#070707] text-white">
      {/* Hero Header */}
      <div className="border-b border-white/[0.06] bg-[#0a0a0a]">
        <div className="max-w-7xl mx-auto px-4 py-6 sm:py-8">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div>
              <div className="flex items-center gap-2.5 mb-1">
                <div className="w-2 h-2 rounded-full bg-[#F5C84C] animate-pulse" />
                <span className="text-[11px] text-[#F5C84C]/70 font-semibold uppercase tracking-widest">
                  AFL · 2026
                </span>
              </div>
              <h1 className="text-3xl sm:text-4xl font-black text-white tracking-tight">
                Neeko Intel
              </h1>
              <p className="text-white/40 text-sm mt-1">
                AI-powered fantasy intelligence · Updated {relativeTime(lastUpdated)}
              </p>
            </div>

            <div className="flex items-center gap-3">
              {!isPremium && (
                <a
                  href="/neeko-plus"
                  className="flex items-center gap-2 bg-[#F5C84C] text-[#070707] font-bold text-sm px-4 py-2.5 rounded-xl hover:bg-[#FFD84C] transition-colors"
                >
                  <Crown size={14} />
                  Unlock All Intel
                </a>
              )}
              {isPremium && (
                <div className="flex items-center gap-1.5 text-[#F5C84C] text-xs font-semibold bg-[#F5C84C]/10 px-3 py-2 rounded-lg border border-[#F5C84C]/20">
                  <Crown size={12} />
                  Neeko+ Active
                </div>
              )}
            </div>
          </div>

          {/* Free preview banner */}
          {!isPremium && (
            <div className="mt-4 flex items-center gap-2 bg-[#F5C84C]/5 border border-[#F5C84C]/15 rounded-xl px-4 py-3">
              <Lock size={13} className="text-[#F5C84C]/60 shrink-0" />
              <p className="text-[12px] text-white/50">
                Showing <span className="text-[#F5C84C] font-semibold">{FREE_PREVIEW_COUNT} free picks</span> per section.{" "}
                <a href="/neeko-plus" className="text-[#F5C84C] font-semibold hover:underline">
                  Upgrade to Neeko+
                </a>{" "}
                for full access.
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Page Content */}
      <div className="max-w-7xl mx-auto px-4 py-6 space-y-6">

        {isEmpty && (
          <div className="text-center py-16">
            <RefreshCw size={32} className="text-white/20 mx-auto mb-3 animate-spin" />
            <p className="text-white/40 text-sm">Neeko Intel generating...</p>
            <p className="text-white/25 text-xs mt-1">Check back shortly</p>
          </div>
        )}

        {!isEmpty && (
          <>
            {/* ── Breakouts / Must Starts ── */}
            <Section>
              <SectionHeader
                icon={<Zap size={16} />}
                title="Breakouts & Must Starts"
                subtitle="Players with elite projections and high confidence"
                locked={!isPremium}
              />
              <div className="space-y-3">
                {renderCards(breakouts, "breakout")}
              </div>
            </Section>

            {/* ── Captain Picks ── */}
            <Section>
              <SectionHeader
                icon={<Crown size={16} />}
                title="Captain Picks"
                subtitle="Top-ranked captain options sorted by captain score"
                locked={!isPremium}
              />
              <div className="space-y-3">
                {loading ? (
                  Array.from({ length: 3 }).map((_, i) => <NeekoIntelSkeletonCard key={i} />)
                ) : topCaptains.length === 0 ? (
                  <div className="text-center py-6 text-white/30 text-sm">Neeko Intel generating...</div>
                ) : (
                  topCaptains.map((row, idx) => {
                    const locked = !isPremium && idx >= FREE_PREVIEW_COUNT;
                    if (locked) return <NeekoIntelCardLocked key={`cap-locked-${idx}`} />;
                    return (
                      <NeekoIntelCard
                        key={row.player_id ?? row.player_name + idx}
                        rank={idx + 1}
                        playerName={row.player_name}
                        team={row.team}
                        projection={row.projection_final}
                        label={row.captain_rating}
                        captainScore={row.captain_score}
                        color="#F5C84C"
                        locked={false}
                      />
                    );
                  })
                )}
              </div>
            </Section>

            {/* ── Risers / Fallers ── */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
              <Section>
                <SectionHeader
                  icon={<TrendingUp size={16} />}
                  title="Risers"
                  subtitle="Highest upside plays this round"
                  locked={!isPremium}
                />
                <div className="space-y-3">
                  {renderCards(risers, "risers")}
                </div>
              </Section>

              <Section>
                <SectionHeader
                  icon={<TrendingDown size={16} />}
                  title="Fallers"
                  subtitle="High risk players to consider avoiding"
                  locked={!isPremium}
                />
                <div className="space-y-3">
                  {renderCards(fallers, "fallers")}
                </div>
              </Section>
            </div>

            {/* ── Risk / Avoid ── */}
            <Section>
              <SectionHeader
                icon={<Shield size={16} />}
                title="Risk & Avoid"
                subtitle="Players flagged as high risk or to avoid this round"
                locked={!isPremium}
              />
              <div className="space-y-3">
                {renderCards(risks, "risk")}
              </div>
            </Section>

            {/* ── Match Projections ── */}
            <Section>
              <SectionHeader
                icon={<Swords size={16} />}
                title="Match Projections"
                subtitle="AI-predicted scores and match analysis"
                locked={!isPremium}
              />
              {loading ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  {Array.from({ length: 3 }).map((_, i) => <NeekoIntelSkeletonCard key={i} />)}
                </div>
              ) : matches.length === 0 ? (
                <div className="text-center py-6 text-white/30 text-sm">Neeko Intel generating...</div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  {matches.map((m, idx) => {
                    const locked = !isPremium && idx >= 1;
                    if (locked) {
                      return (
                        <div key={m.match_id} className="relative">
                          <MatchPredictionCard match={m} locked={true} />
                          <div className="absolute inset-0 flex items-center justify-center">
                            <a
                              href="/neeko-plus"
                              className="flex items-center gap-1.5 bg-[#F5C84C]/15 text-[#F5C84C] text-xs font-semibold px-3 py-2 rounded-lg hover:bg-[#F5C84C]/25 transition-colors border border-[#F5C84C]/20"
                            >
                              <Lock size={11} />
                              Unlock Neeko+
                            </a>
                          </div>
                        </div>
                      );
                    }
                    return <MatchPredictionCard key={m.match_id} match={m} locked={false} />;
                  })}
                </div>
              )}
            </Section>

            {/* ── Upgrade CTA (free users only) ── */}
            {!isPremium && <UpgradeCTABanner />}

            {/* ── Elite Captains highlight (premium) ── */}
            {isPremium && (() => {
              const elites = allRows.filter(
                (r) => r.ai_recommendation === "ELITE CAPTAIN" || r.ai_recommendation === "CAPTAIN LOCK"
              );
              if (elites.length === 0) return null;
              return (
                <Section>
                  <SectionHeader
                    icon={<Star size={16} />}
                    title="Elite Captain Locks"
                    subtitle="The highest-rated captain options in the competition"
                  />
                  <div className="space-y-3">
                    {elites.map((row, idx) => (
                      <NeekoIntelCard
                        key={row.player_id ?? row.player_name + idx}
                        rank={idx + 1}
                        playerName={row.player_name}
                        team={row.team}
                        position={row.position}
                        projection={row.projection_final}
                        confidence={row.projection_confidence}
                        label={row.ai_recommendation}
                        color={row.recommendation_color}
                        reason={row.recommendation_why}
                        captainScore={row.captain_score}
                        locked={false}
                      />
                    ))}
                  </div>
                </Section>
              );
            })()}
          </>
        )}

        {/* Bottom padding */}
        <div className="h-6" />
      </div>
    </div>
  );
}
