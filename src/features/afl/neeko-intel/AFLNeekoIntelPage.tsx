import { useState, useEffect } from "react";
import {
  Lock,
  Crown,
  Zap,
  TrendingUp,
  TrendingDown,
  Star,
  RefreshCw,
  Swords,
  Lightbulb,
  AlertTriangle,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import {
  NeekoIntelCard,
  NeekoIntelSkeletonCard,
} from "./NeekoIntelCard";

// ─── Types ────────────────────────────────────────────────────────────────────

interface MasterRow {
  player_id: number | null;
  player_name: string;
  team: string;
  position: string | null;
  projection_final: number | null;
  ceiling_estimate: number | null;
  floor_estimate: number | null;
  consistency_score: number | null;
  form_rating: number | null;
  matchup_rating: number | null;
  upside_rating: number | null;
  risk_rating: number | null;
  projection_confidence: number | null;
  ai_recommendation: string | null;
  ai_analysis: string | null;
  recommendation_color: string | null;
  recommendation_why: string | null;
  captain_score: number | null;
  captain_rating: string | null;
  // Phase 4
  neeko_score: number | null;
  ceiling_probability_pct: number | null;
  bust_probability_pct: number | null;
  matchup_tier: string | null;
  trend_tag: string | null;
  role_tag: string | null;
  // Phase 4.5
  neeko_tier: string | null;
  volatility_tag: string | null;
  trend_strength: number | null;
}

interface MatchRow {
  id: string | null;
  match_id: string | null;
  home_team: string;
  away_team: string;
  round_number: number | null;
  season: number | null;
  prediction: string | null;
  predicted_home_score: number | null;
  predicted_away_score: number | null;
  predicted_margin: number | null;
  predicted_total: number | null;
  confidence: number | null;
  ai_summary: string | null;
  prediction_explanation: string | null;
  updated_at: string | null;
}

interface RoundInsightRow {
  player_name: string;
  team: string;
  position: string | null;
  projection_final: number | null;
  headline: string;
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

function Section({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={`rounded-2xl border border-white/[0.07] bg-[#0d0d0d] p-4 md:p-6 ${className}`}>
      {children}
    </div>
  );
}

function SectionError({ onRetry }: { onRetry?: () => void }) {
  return (
    <div className="flex items-center justify-center gap-3 py-6 rounded-xl border border-white/5 bg-white/[0.02]">
      <RefreshCw size={13} className="text-white/20 shrink-0" />
      <span className="text-white/30 text-sm">Temporarily unavailable</span>
      {onRetry && (
        <button
          onClick={onRetry}
          className="text-[11px] text-[#F5C84C]/70 hover:text-[#F5C84C] transition-colors underline"
        >
          retry
        </button>
      )}
    </div>
  );
}

function SectionEmpty({ message }: { message: string }) {
  return (
    <div className="flex items-center justify-center gap-2 py-6 rounded-xl border border-white/5 bg-white/[0.02]">
      <span className="text-white/25 text-sm text-center">{message}</span>
    </div>
  );
}

function LockedCard() {
  return (
    <div className="relative rounded-xl border border-white/[0.06] bg-white/[0.02] p-4 overflow-hidden">
      <div className="absolute inset-0 backdrop-blur-[2px] bg-[#0d0d0d]/60 flex items-center justify-center z-10 rounded-xl">
        <div className="flex flex-col items-center gap-1.5 text-center px-4">
          <Lock size={15} className="text-[#F5C84C]/60" />
          <span className="text-[11px] text-white/50 font-medium">
            Unlock with{" "}
            <a href="/neeko-plus" className="text-[#F5C84C] hover:underline font-semibold">
              Neeko+
            </a>
          </span>
        </div>
      </div>
      <div className="blur-sm select-none pointer-events-none space-y-2">
        <div className="h-3 w-3/4 rounded bg-white/10" />
        <div className="h-3 w-1/2 rounded bg-white/5" />
        <div className="h-3 w-2/3 rounded bg-white/5" />
      </div>
    </div>
  );
}

// ─── Player Card List ─────────────────────────────────────────────────────────

const FREE_VISIBLE = 1;
const FREE_BLURRED = 2;

function PlayerCardList({
  rows,
  loading,
  error,
  isPremium,
  emptyMessage = "No data detected yet — check back soon",
  onRetry,
}: {
  rows: MasterRow[];
  loading: boolean;
  error: boolean;
  isPremium: boolean;
  emptyMessage?: string;
  onRetry?: () => void;
}) {
  if (loading) {
    return (
      <div className="space-y-3">
        {Array.from({ length: 3 }).map((_, i) => <NeekoIntelSkeletonCard key={i} />)}
      </div>
    );
  }
  if (error) return <SectionError onRetry={onRetry} />;
  if (rows.length === 0) return <SectionEmpty message={emptyMessage} />;

  return (
    <div className="space-y-3">
      {rows.map((row, idx) => {
        const isLocked = !isPremium && idx >= FREE_VISIBLE;
        if (isLocked && idx >= FREE_VISIBLE + FREE_BLURRED) return null;
        if (isLocked) return <LockedCard key={row.player_id ?? row.player_name + idx} />;
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
            reason={isPremium ? row.recommendation_why : null}
            captainScore={row.captain_score}
            locked={false}
            neekoScore={row.neeko_score}
            ceilingPct={isPremium ? row.ceiling_probability_pct : null}
            bustPct={isPremium ? row.bust_probability_pct : null}
            matchupTier={row.matchup_tier}
            trendTag={row.trend_tag}
            neekoTier={row.neeko_tier}
            volatilityTag={isPremium ? row.volatility_tag : null}
            trendStrength={isPremium ? row.trend_strength : null}
          />
        );
      })}
    </div>
  );
}

// ─── Match Projection Card ────────────────────────────────────────────────────

function MatchProjectionCard({ match }: { match: MatchRow }) {
  const margin = match.predicted_margin != null ? Math.abs(Math.round(match.predicted_margin)) : null;
  const winner =
    match.predicted_margin != null
      ? match.predicted_margin > 0
        ? match.home_team
        : match.away_team
      : null;
  const conf = match.confidence;

  return (
    <div className="rounded-xl border border-white/10 bg-[#111111] p-4 flex flex-col h-full">
      <div className="flex items-start justify-between gap-3 mb-3">
        <div className="min-w-0 flex-1">
          <div className="font-semibold text-white text-sm leading-tight">
            {match.home_team}{" "}
            <span className="text-white/30 font-normal">vs</span>{" "}
            {match.away_team}
          </div>
          <div className="text-[11px] text-white/40 mt-0.5">
            R{match.round_number ?? "—"} · {match.season ?? 2026} · AFL match score prediction
          </div>
        </div>
        {conf != null && (
          <div
            className={`shrink-0 rounded-full px-2.5 py-1 text-[10px] font-bold whitespace-nowrap ${
              conf >= 75
                ? "text-green-400 bg-green-400/10 border border-green-400/30"
                : conf >= 55
                ? "text-yellow-400 bg-yellow-400/10 border border-yellow-400/30"
                : "text-orange-400 bg-orange-400/10 border border-orange-400/30"
            }`}
          >
            {Math.round(conf)}% conf.
          </div>
        )}
      </div>

      <div className="flex items-end gap-5 flex-1">
        {winner && margin != null && (
          <div>
            <div className="text-[10px] text-white/35 uppercase tracking-wider mb-0.5">Winner</div>
            <div className="text-[#F5C84C] font-bold text-base leading-none">{winner}</div>
          </div>
        )}
        {margin != null && (
          <div>
            <div className="text-[10px] text-white/35 uppercase tracking-wider mb-0.5">Margin</div>
            <div className="text-white font-semibold text-sm tabular-nums">{margin} pts</div>
          </div>
        )}
        {match.predicted_home_score != null && match.predicted_away_score != null && (
          <div>
            <div className="text-[10px] text-white/35 uppercase tracking-wider mb-0.5">Scores</div>
            <div className="text-white/60 text-sm tabular-nums">
              {Math.round(match.predicted_home_score)} – {Math.round(match.predicted_away_score)}
            </div>
          </div>
        )}
      </div>

      {(match.ai_summary || match.prediction_explanation) && (
        <p className="mt-3 text-[11px] text-white/50 leading-relaxed border-t border-white/5 pt-3 line-clamp-3">
          {match.ai_summary ?? match.prediction_explanation}
        </p>
      )}
    </div>
  );
}

function MatchCardList({
  rows,
  loading,
  error,
  isPremium,
  onRetry,
}: {
  rows: MatchRow[];
  loading: boolean;
  error: boolean;
  isPremium: boolean;
  onRetry?: () => void;
}) {
  if (loading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
        {Array.from({ length: 3 }).map((_, i) => <NeekoIntelSkeletonCard key={i} />)}
      </div>
    );
  }
  if (error) return <SectionError onRetry={onRetry} />;
  if (rows.length === 0) {
    return <SectionEmpty message="Match projections generating — check back before round starts" />;
  }

  const visible = isPremium ? rows : rows.slice(0, 1);
  const locked = !isPremium ? rows.slice(1, 3) : [];

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3 items-stretch">
      {visible.map((match, idx) => (
        <MatchProjectionCard
          key={match.id ?? match.match_id ?? `${match.home_team}-${idx}`}
          match={match}
        />
      ))}
      {locked.map((_, idx) => (
        <LockedCard key={`locked-match-${idx}`} />
      ))}
    </div>
  );
}

// ─── Round Insight Banner ─────────────────────────────────────────────────────

function RoundInsightBanner({ row }: { row: RoundInsightRow | null }) {
  if (!row) return null;
  return (
    <div className="rounded-2xl border border-[#F5C84C]/20 bg-gradient-to-r from-[#1a1408] to-[#0d0d0d] p-4 md:p-5">
      <div className="flex items-start gap-3">
        <div className="flex items-center justify-center w-9 h-9 rounded-lg bg-[#F5C84C]/15 text-[#F5C84C] shrink-0 mt-0.5">
          <Lightbulb size={16} />
        </div>
        <div>
          <div className="text-[10px] text-[#F5C84C]/60 font-semibold uppercase tracking-widest mb-1">
            Round Insight
          </div>
          <p className="text-white/80 text-sm font-medium leading-snug">{row.headline}</p>
          {row.projection_final != null && (
            <div className="mt-2 flex items-center gap-3 text-[11px] text-white/40">
              <span>{row.team}</span>
              <span>·</span>
              <span>{row.position}</span>
              <span>·</span>
              <span className="text-[#F5C84C] font-semibold">
                {Math.round(row.projection_final)} pts projected
              </span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Elite Captain Hero ───────────────────────────────────────────────────────

function EliteCaptainHero({
  rows,
  loading,
  isPremium,
}: {
  rows: MasterRow[];
  loading: boolean;
  isPremium: boolean;
}) {
  if (loading) {
    return (
      <div className="rounded-2xl border border-[#F5C84C]/20 bg-gradient-to-r from-[#1a1408] to-[#0a0a0a] p-4 md:p-6 animate-pulse">
        <div className="h-4 w-48 rounded bg-white/10 mb-4" />
        <div className="h-20 rounded-xl bg-white/5" />
      </div>
    );
  }

  const elite = rows.filter(
    (r) => r.captain_rating === "ELITE CAPTAIN" || r.captain_rating === "CAPTAIN LOCK"
  );
  if (elite.length === 0) return null;

  return (
    <div className="rounded-2xl border border-[#F5C84C]/30 bg-gradient-to-r from-[#1a1408] to-[#0a0a0a] p-4 md:p-6">
      <div className="flex items-center gap-3 mb-5">
        <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-[#F5C84C]/15 text-[#F5C84C] shrink-0">
          <Star size={18} />
        </div>
        <div>
          <h2 className="text-base font-bold text-[#F5C84C]">Elite Captain Locks</h2>
          <p className="text-[11px] text-white/40 mt-0.5">
            Highest-probability captains this round
          </p>
        </div>
      </div>
      <div className="space-y-3">
        {elite.map((row, idx) => (
          <NeekoIntelCard
            key={row.player_id ?? row.player_name + idx}
            rank={idx + 1}
            playerName={row.player_name}
            team={row.team}
            position={row.position}
            projection={row.projection_final}
            confidence={row.projection_confidence}
            label={row.captain_rating}
            color="#F5C84C"
            reason={isPremium ? row.recommendation_why : null}
            captainScore={row.captain_score}
            locked={false}
            neekoScore={row.neeko_score}
            ceilingPct={isPremium ? row.ceiling_probability_pct : null}
            bustPct={isPremium ? row.bust_probability_pct : null}
            matchupTier={row.matchup_tier}
            trendTag={row.trend_tag}
            neekoTier={row.neeko_tier}
            volatilityTag={isPremium ? row.volatility_tag : null}
            trendStrength={isPremium ? row.trend_strength : null}
          />
        ))}
      </div>
    </div>
  );
}

// ─── Upgrade CTA ──────────────────────────────────────────────────────────────

function UpgradeCTABanner() {
  return (
    <div className="rounded-2xl overflow-hidden">
      <div className="bg-gradient-to-r from-[#3A2A00] via-[#5A4200] to-[#3A2A00] border border-[#F5C84C]/30 p-6 flex flex-col sm:flex-row items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Crown size={18} className="text-[#F5C84C]" />
            <span className="text-[#F5C84C] font-bold text-lg">Unlock Full Neeko Intel</span>
          </div>
          <p className="text-white/60 text-sm">
            Full Neeko Scores, Ceiling%, Bust%, AI reasoning, match projections and every player ranked.
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

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function AFLNeekoIntelPage() {
  const { isPremium } = useAuth();

  const [allData, setAllData] = useState<MasterRow[]>([]);
  const [matches, setMatches] = useState<MatchRow[]>([]);
  const [roundInsight, setRoundInsight] = useState<RoundInsightRow | null>(null);

  const [loading, setLoading] = useState(true);
  const [matchesLoading, setMatchesLoading] = useState(true);
  const [fetchError, setFetchError] = useState(false);
  const [matchesError, setMatchesError] = useState(false);

  async function loadPlayers() {
    setLoading(true);
    setFetchError(false);
    const { data, error } = await supabase
      .from("v_neeko_intel_master_2026")
      .select(
        "player_id,player_name,team,position,projection_final,ceiling_estimate,floor_estimate," +
        "consistency_score,form_rating,matchup_rating,upside_rating,risk_rating,projection_confidence," +
        "ai_recommendation,ai_analysis,recommendation_color,recommendation_why," +
        "captain_score,captain_rating," +
        "neeko_score,ceiling_probability_pct,bust_probability_pct,matchup_tier,trend_tag,role_tag," +
        "neeko_tier,volatility_tag,trend_strength"
      );
    if (error || !data) {
      console.error("[NeekoIntel] player load error:", error?.message, error?.details);
      setFetchError(true);
    } else {
      setAllData(data as MasterRow[]);
    }
    setLoading(false);
  }

  async function loadMatches() {
    setMatchesLoading(true);
    setMatchesError(false);
    const { data, error } = await supabase
      .from("v_neeko_match_predictions")
      .select("*");
    if (error || !data) {
      console.error("[NeekoIntel] match load error:", error?.message, error?.details);
      setMatchesError(true);
    } else {
      setMatches(data as MatchRow[]);
    }
    setMatchesLoading(false);
  }

  useEffect(() => {
    async function loadRoundInsight() {
      const { data } = await supabase
        .from("v_neeko_intel_round_insight")
        .select("*")
        .maybeSingle();
      if (data) setRoundInsight(data as RoundInsightRow);
    }

    loadPlayers();
    loadMatches();
    loadRoundInsight();
  }, []);

  // ── Section: Captain Picks ─────────────────────────────────────────────────
  const captains = [...allData]
    .filter((p) => p.captain_score != null)
    .sort((a, b) => (b.captain_score ?? 0) - (a.captain_score ?? 0))
    .slice(0, 10);

  // ── Section: Breakouts This Week ──────────────────────────────────────────
  const breakouts = [...allData]
    .filter(
      (p) =>
        p.trend_tag === "Rising" ||
        ((p.upside_rating ?? 0) >= 12 && (p.neeko_score ?? 0) >= 70)
    )
    .sort((a, b) => (b.neeko_score ?? 0) - (a.neeko_score ?? 0))
    .slice(0, 10);

  // ── Section: Risers ───────────────────────────────────────────────────────
  const risers = [...allData]
    .filter((p) => p.trend_tag === "Rising" && (p.neeko_score ?? 0) >= 65)
    .sort((a, b) => (b.neeko_score ?? 0) - (a.neeko_score ?? 0))
    .slice(0, 10);

  // ── Section: Fallers ──────────────────────────────────────────────────────
  const fallers = [...allData]
    .filter(
      (p) =>
        p.trend_tag === "Falling" ||
        (p.bust_probability_pct ?? 0) >= 60
    )
    .sort((a, b) => (b.bust_probability_pct ?? 0) - (a.bust_probability_pct ?? 0))
    .slice(0, 10);

  // ── Section: Risk / Avoid ─────────────────────────────────────────────────
  const risk = [...allData]
    .filter(
      (p) =>
        (p.bust_probability_pct ?? 0) >= 55 ||
        (p.risk_rating ?? 0) >= 70
    )
    .sort((a, b) => (b.bust_probability_pct ?? 0) - (a.bust_probability_pct ?? 0))
    .slice(0, 10);

  return (
    <div className="min-h-screen bg-[#070707] text-white">

      {/* ── Hero Header ── */}
      <div className="border-b border-white/[0.06] bg-[#0a0a0a]">
        <div className="max-w-7xl mx-auto px-4 py-6 sm:py-8">
          <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
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
                AI-powered fantasy intelligence · Updated automatically
              </p>
            </div>

            <div className="flex items-center gap-3 shrink-0">
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

          {!isPremium && (
            <div className="mt-4 flex items-center gap-2 bg-[#F5C84C]/5 border border-[#F5C84C]/15 rounded-xl px-4 py-3">
              <Lock size={13} className="text-[#F5C84C]/60 shrink-0" />
              <p className="text-[12px] text-white/50">
                Showing{" "}
                <span className="text-[#F5C84C] font-semibold">1 free pick</span> per section.{" "}
                <a href="/neeko-plus" className="text-[#F5C84C] font-semibold hover:underline">
                  Upgrade to Neeko+
                </a>{" "}
                for Neeko Score, Ceiling%, Bust% and full access.
              </p>
            </div>
          )}
        </div>
      </div>

      {/* ── Page Content ── */}
      <div className="max-w-7xl mx-auto px-4 py-6 space-y-6">

        {fetchError && (
          <div className="text-center py-16">
            <RefreshCw size={32} className="text-white/20 mx-auto mb-3" />
            <p className="text-white/40 text-sm">Neeko Intel temporarily unavailable</p>
            <p className="text-white/25 text-xs mt-1 mb-4">Check your connection and try again</p>
            <button
              onClick={() => loadPlayers()}
              className="text-[#F5C84C]/70 hover:text-[#F5C84C] text-sm underline transition-colors"
            >
              Retry
            </button>
          </div>
        )}

        {!fetchError && (
          <>
            {/* ── Round Insight ── */}
            {!loading && <RoundInsightBanner row={roundInsight} />}

            {/* ── Elite Captain Locks Hero ── */}
            <EliteCaptainHero rows={captains} loading={loading} isPremium={isPremium} />

            {/* ── Captain Picks ── */}
            <Section>
              <SectionHeader
                icon={<Crown size={16} />}
                title="Captain Picks"
                subtitle="Top-ranked captain options by captain score"
                locked={!isPremium}
              />
              <PlayerCardList
                rows={captains}
                loading={loading}
                error={fetchError}
                isPremium={isPremium}
                emptyMessage="No strong captain picks detected yet"
                onRetry={loadPlayers}
              />
            </Section>

            {/* ── Match Projections ── */}
            <Section>
              <SectionHeader
                icon={<Swords size={16} />}
                title="Match Projections"
                subtitle="AFL match score predictions — not fantasy points"
                locked={!isPremium}
              />
              <MatchCardList
                rows={matches}
                loading={matchesLoading}
                error={matchesError}
                isPremium={isPremium}
                onRetry={loadMatches}
              />
            </Section>

            {/* ── Breakouts This Week ── */}
            <Section>
              <SectionHeader
                icon={<Zap size={16} />}
                title="Breakouts This Week"
                subtitle="Rising trend or high Neeko Score with strong upside — speculative pop targets"
                locked={!isPremium}
              />
              <PlayerCardList
                rows={breakouts}
                loading={loading}
                error={fetchError}
                isPremium={isPremium}
                emptyMessage="No strong breakout candidates detected yet — check back closer to round"
                onRetry={loadPlayers}
              />
            </Section>

            {/* ── Risers / Fallers ── */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <Section>
                <SectionHeader
                  icon={<TrendingUp size={16} />}
                  title="Risers"
                  subtitle="Rising trend + Neeko Score ≥ 65 — form improving"
                  locked={!isPremium}
                />
                <PlayerCardList
                  rows={risers}
                  loading={loading}
                  error={fetchError}
                  isPremium={isPremium}
                  emptyMessage="No strong risers detected — check back after early scoring"
                  onRetry={loadPlayers}
                />
              </Section>

              <Section>
                <SectionHeader
                  icon={<TrendingDown size={16} />}
                  title="Fallers"
                  subtitle="Falling trend or high Bust% — consider avoiding"
                  locked={!isPremium}
                />
                <PlayerCardList
                  rows={fallers}
                  loading={loading}
                  error={fetchError}
                  isPremium={isPremium}
                  emptyMessage="No notable fallers this round"
                  onRetry={loadPlayers}
                />
              </Section>
            </div>

            {/* ── Risk & Avoid ── */}
            <Section>
              <SectionHeader
                icon={<AlertTriangle size={16} />}
                title="Risk & Avoid"
                subtitle="Bust% ≥ 55 or Risk Rating ≥ 70 — high chance of underperforming"
                locked={!isPremium}
              />
              <PlayerCardList
                rows={risk}
                loading={loading}
                error={fetchError}
                isPremium={isPremium}
                emptyMessage="No specific avoid flags this round"
                onRetry={loadPlayers}
              />
            </Section>

            {/* ── Upgrade CTA (free users) ── */}
            {!isPremium && <UpgradeCTABanner />}
          </>
        )}

        <div className="h-6" />
      </div>
    </div>
  );
}
