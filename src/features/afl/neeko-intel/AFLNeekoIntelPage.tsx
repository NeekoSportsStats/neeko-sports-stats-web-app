import { useState, useEffect } from "react";
import {
  Lock,
  Crown,
  Zap,
  TrendingUp,
  TrendingDown,
  Shield,
  Star,
  Swords,
  RefreshCw,
} from "lucide-react";
import { supabase } from "@/lib/supabaseClient";
import { useAuth } from "@/lib/auth";
import {
  NeekoIntelCard,
  NeekoIntelSkeletonCard,
} from "./NeekoIntelCard";

// ─── Types ────────────────────────────────────────────────────────────────────

interface BreakoutRow {
  player_id: string | null;
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
}

interface CaptainRow {
  player_id: string | null;
  player_name: string;
  team: string;
  position: string | null;
  projection_final: number | null;
  ceiling_estimate: number | null;
  floor_estimate: number | null;
  consistency_score: number | null;
  form_rating: number | null;
  matchup_rating: number | null;
  projection_confidence: number | null;
  ai_recommendation: string | null;
  recommendation_color: string | null;
  recommendation_why: string | null;
  captain_score: number | null;
  captain_rating: string | null;
}

interface RiskRow {
  player_id: string | null;
  player_name: string;
  team: string;
  position: string | null;
  projection_final: number | null;
  floor_estimate: number | null;
  consistency_score: number | null;
  form_rating: number | null;
  matchup_rating: number | null;
  risk_rating: number | null;
  projection_confidence: number | null;
  ai_recommendation: string | null;
  recommendation_color: string | null;
  recommendation_why: string | null;
}

interface RiserRow {
  player_id: string | null;
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
  recommendation_color: string | null;
  recommendation_why: string | null;
  captain_score: number | null;
}

interface FallerRow {
  player_id: string | null;
  player_name: string;
  team: string;
  position: string | null;
  projection_final: number | null;
  floor_estimate: number | null;
  consistency_score: number | null;
  form_rating: number | null;
  matchup_rating: number | null;
  risk_rating: number | null;
  projection_confidence: number | null;
  ai_recommendation: string | null;
  recommendation_color: string | null;
  recommendation_why: string | null;
}

interface MatchRow {
  match_id: number;
  home_team: string;
  away_team: string;
  home_projection: number | null;
  away_projection: number | null;
  margin: number | null;
  confidence: string | null;
  winner: string | null;
  ai_summary: string | null;
  prediction_explanation: string | null;
  round_number: number;
  season: number;
  match_date: string | null;
  updated_at: string | null;
}

// ─── Explicit column selects (no select *) ────────────────────────────────────

const PLAYER_COLS =
  "player_id,player_name,team,position,projection_final,ceiling_estimate,floor_estimate,consistency_score,form_rating,matchup_rating,upside_rating,risk_rating,projection_confidence,ai_recommendation,ai_analysis,recommendation_color,recommendation_why,captain_score,captain_rating";

const CAPTAIN_COLS =
  "player_id,player_name,team,position,projection_final,ceiling_estimate,floor_estimate,consistency_score,form_rating,matchup_rating,projection_confidence,ai_recommendation,recommendation_color,recommendation_why,captain_score,captain_rating";

const RISK_COLS =
  "player_id,player_name,team,position,projection_final,floor_estimate,consistency_score,form_rating,matchup_rating,risk_rating,projection_confidence,ai_recommendation,recommendation_color,recommendation_why";

const RISER_COLS =
  "player_id,player_name,team,position,projection_final,ceiling_estimate,floor_estimate,consistency_score,form_rating,matchup_rating,upside_rating,risk_rating,projection_confidence,ai_recommendation,recommendation_color,recommendation_why,captain_score";

const FALLER_COLS =
  "player_id,player_name,team,position,projection_final,floor_estimate,consistency_score,form_rating,matchup_rating,risk_rating,projection_confidence,ai_recommendation,recommendation_color,recommendation_why";

const MATCH_COLS =
  "match_id,home_team,away_team,home_projection,away_projection,margin,confidence,winner,ai_summary,prediction_explanation,round_number,season,match_date,updated_at";

// ─── Retry wrapper ────────────────────────────────────────────────────────────

async function fetchWithRetry<T>(fn: () => Promise<T>): Promise<T> {
  try {
    return await fn();
  } catch (e: unknown) {
    const msg = String((e as { message?: string })?.message ?? e);
    const status = (e as { status?: number })?.status;
    if (msg.includes("500") || status === 500) {
      await new Promise((r) => setTimeout(r, 400 + Math.random() * 600));
      return await fn();
    }
    throw e;
  }
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmt(v: number | null, decimals = 1): string {
  if (v == null) return "—";
  return Number(v).toFixed(decimals);
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

function Section({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={`rounded-2xl border border-white/[0.07] bg-[#0d0d0d] p-4 md:p-6 ${className}`}>
      {children}
    </div>
  );
}

// ─── Section Error Fallback ───────────────────────────────────────────────────

function SectionError() {
  return (
    <div className="flex items-center justify-center gap-2 py-6 rounded-xl border border-white/5 bg-white/[0.02]">
      <RefreshCw size={13} className="text-white/20 shrink-0" />
      <span className="text-white/30 text-sm">Temporarily unavailable — refresh to retry</span>
    </div>
  );
}

// ─── Upgrade CTA Banner ───────────────────────────────────────────────────────

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

// ─── Elite Captain Hero Card ──────────────────────────────────────────────────

function EliteCaptainHero({
  rows,
  loading,
  error,
}: {
  rows: CaptainRow[];
  loading: boolean;
  error: boolean;
}) {
  if (loading) {
    return (
      <div className="rounded-2xl border border-[#F5C84C]/20 bg-gradient-to-r from-[#1a1408] to-[#0a0a0a] p-4 md:p-6 animate-pulse">
        <div className="h-4 w-48 rounded bg-white/10 mb-4" />
        <div className="space-y-3">
          <div className="h-20 rounded-xl bg-white/5" />
          <div className="h-20 rounded-xl bg-white/5" />
        </div>
      </div>
    );
  }

  if (error) return null;

  const eliteRows = rows.filter(
    (r) => r.captain_rating === "ELITE CAPTAIN" || r.captain_rating === "CAPTAIN LOCK"
  );

  if (eliteRows.length === 0) return null;

  return (
    <div className="rounded-2xl border border-[#F5C84C]/30 bg-gradient-to-r from-[#1a1408] to-[#0a0a0a] p-4 md:p-6">
      <div className="flex items-center gap-3 mb-5">
        <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-[#F5C84C]/15 text-[#F5C84C] shrink-0">
          <Star size={18} />
        </div>
        <div>
          <h2 className="text-base font-bold text-[#F5C84C]">Elite Captain Locks</h2>
          <p className="text-[11px] text-white/40 mt-0.5">
            Highest win probability captains this round
          </p>
        </div>
      </div>

      <div className="space-y-3">
        {eliteRows.map((row, idx) => (
          <NeekoIntelCard
            key={row.player_id ?? row.player_name + idx}
            rank={idx + 1}
            playerName={row.player_name}
            team={row.team}
            projection={row.projection_final}
            confidence={row.projection_confidence}
            label={row.captain_rating}
            color="#F5C84C"
            reason={row.recommendation_why}
            captainScore={row.captain_score}
            locked={false}
          />
        ))}
      </div>
    </div>
  );
}

// ─── Match Card ───────────────────────────────────────────────────────────────

function MatchPredictionCard({ match, locked }: { match: MatchRow; locked: boolean }) {
  const homeWin =
    match.home_projection != null &&
    match.away_projection != null &&
    match.home_projection > match.away_projection;

  return (
    <div
      className={`rounded-xl border border-white/10 bg-[#111111] p-4 transition-all ${
        locked ? "blur-sm opacity-40 select-none pointer-events-none" : ""
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
            {fmt(match.home_projection, 0)}
          </div>
        </div>

        <div className="text-center shrink-0 px-2">
          <div className="text-white/20 text-xs font-bold">VS</div>
          {match.margin != null && (
            <div className="text-[10px] text-white/30 mt-1">{Math.round(Number(match.margin))} pts</div>
          )}
        </div>

        <div className={`flex-1 text-center ${!homeWin ? "opacity-100" : "opacity-50"}`}>
          <div className="font-bold text-white text-sm leading-tight">{match.away_team}</div>
          <div className={`text-2xl font-black tabular-nums mt-1 ${!homeWin ? "text-[#F5C84C]" : "text-white/60"}`}>
            {fmt(match.away_projection, 0)}
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

// ─── Generic Player Card Renderer ────────────────────────────────────────────

type AnyPlayerRow = {
  player_id: string | null;
  player_name: string;
  team: string;
  position?: string | null;
  projection_final: number | null;
  projection_confidence?: number | null;
  ai_recommendation?: string | null;
  recommendation_color?: string | null;
  recommendation_why?: string | null;
  captain_score?: number | null;
};

function renderPlayerCards(rows: AnyPlayerRow[], loading: boolean, error: boolean) {
  if (loading) {
    return Array.from({ length: 3 }).map((_, i) => <NeekoIntelSkeletonCard key={i} />);
  }

  if (error) {
    return <SectionError />;
  }

  if (rows.length === 0) {
    return (
      <div className="text-center py-6 text-white/30 text-sm">
        Neeko Intel generating...
      </div>
    );
  }

  return rows.map((row, idx) => (
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
  ));
}

// ─── Constants ────────────────────────────────────────────────────────────────

const FREE_PREVIEW_COUNT = 1;

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function AFLNeekoIntelPage() {
  const { isPremium } = useAuth();

  const [breakouts, setBreakouts] = useState<BreakoutRow[]>([]);
  const [captains, setCaptains] = useState<CaptainRow[]>([]);
  const [risk, setRisk] = useState<RiskRow[]>([]);
  const [risers, setRisers] = useState<RiserRow[]>([]);
  const [fallers, setFallers] = useState<FallerRow[]>([]);
  const [matches, setMatches] = useState<MatchRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [lastUpdated, setLastUpdated] = useState<string | null>(null);

  const [sectionErrors, setSectionErrors] = useState({
    breakouts: false,
    captains: false,
    risk: false,
    risers: false,
    fallers: false,
    matches: false,
  });

  useEffect(() => {
    async function load() {
      setLoading(true);
      setSectionErrors({ breakouts: false, captains: false, risk: false, risers: false, fallers: false, matches: false });

      const results = await Promise.allSettled([
        fetchWithRetry(() => supabase.from("v_neeko_intel_breakouts").select(PLAYER_COLS)),
        fetchWithRetry(() => supabase.from("v_neeko_intel_captains").select(CAPTAIN_COLS)),
        fetchWithRetry(() => supabase.from("v_neeko_intel_risk").select(RISK_COLS)),
        fetchWithRetry(() => supabase.from("v_neeko_intel_risers").select(RISER_COLS)),
        fetchWithRetry(() => supabase.from("v_neeko_intel_fallers").select(FALLER_COLS)),
        fetchWithRetry(() => supabase.from("v_neeko_intel_matches").select(MATCH_COLS)),
      ]);

      const errors = { breakouts: false, captains: false, risk: false, risers: false, fallers: false, matches: false };

      const [breakoutsR, captainsR, riskR, risersR, fallersR, matchesR] = results;

      if (breakoutsR.status === "fulfilled" && !breakoutsR.value.error && breakoutsR.value.data) {
        setBreakouts(breakoutsR.value.data as BreakoutRow[]);
      } else {
        errors.breakouts = true;
      }

      if (captainsR.status === "fulfilled" && !captainsR.value.error && captainsR.value.data) {
        setCaptains(captainsR.value.data as CaptainRow[]);
      } else {
        errors.captains = true;
      }

      if (riskR.status === "fulfilled" && !riskR.value.error && riskR.value.data) {
        setRisk(riskR.value.data as RiskRow[]);
      } else {
        errors.risk = true;
      }

      if (risersR.status === "fulfilled" && !risersR.value.error && risersR.value.data) {
        setRisers(risersR.value.data as RiserRow[]);
      } else {
        errors.risers = true;
      }

      if (fallersR.status === "fulfilled" && !fallersR.value.error && fallersR.value.data) {
        setFallers(fallersR.value.data as FallerRow[]);
      } else {
        errors.fallers = true;
      }

      if (matchesR.status === "fulfilled" && !matchesR.value.error && matchesR.value.data) {
        const matchData = matchesR.value.data as MatchRow[];
        setMatches(matchData);
        const first = matchData[0];
        if (first?.updated_at) setLastUpdated(first.updated_at);
      } else {
        errors.matches = true;
      }

      setSectionErrors(errors);
      setLoading(false);
    }
    load();
  }, []);

  const visibleBreakouts = isPremium ? breakouts : breakouts.slice(0, FREE_PREVIEW_COUNT);
  const visibleCaptains = isPremium ? captains : captains.slice(0, FREE_PREVIEW_COUNT);
  const visibleRisk = isPremium ? risk : risk.slice(0, FREE_PREVIEW_COUNT);
  const visibleRisers = isPremium ? risers : risers.slice(0, FREE_PREVIEW_COUNT);
  const visibleFallers = isPremium ? fallers : fallers.slice(0, FREE_PREVIEW_COUNT);
  const visibleMatches = isPremium ? matches : matches.slice(0, FREE_PREVIEW_COUNT);

  const allSectionsFailed =
    !loading &&
    sectionErrors.breakouts &&
    sectionErrors.captains &&
    sectionErrors.matches;

  const isEmpty =
    !loading &&
    !allSectionsFailed &&
    breakouts.length === 0 &&
    captains.length === 0 &&
    matches.length === 0;

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
                AI-powered fantasy intelligence · Updated {relativeTime(lastUpdated)}
              </p>
              <p className="text-white/25 text-xs mt-1">
                Updated automatically each round using Neeko AI projections
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
                <span className="text-[#F5C84C] font-semibold">
                  {FREE_PREVIEW_COUNT} free pick
                </span>{" "}
                per section.{" "}
                <a href="/neeko-plus" className="text-[#F5C84C] font-semibold hover:underline">
                  Upgrade to Neeko+
                </a>{" "}
                for full access.
              </p>
            </div>
          )}
        </div>
      </div>

      {/* ── Page Content ── */}
      <div className="max-w-7xl mx-auto px-4 py-6 space-y-6">

        {allSectionsFailed && (
          <div className="text-center py-16">
            <RefreshCw size={32} className="text-white/20 mx-auto mb-3" />
            <p className="text-white/40 text-sm">Neeko Intel temporarily unavailable</p>
            <p className="text-white/25 text-xs mt-1">Refresh the page to retry</p>
          </div>
        )}

        {isEmpty && (
          <div className="text-center py-16">
            <RefreshCw size={32} className="text-white/20 mx-auto mb-3 animate-spin" />
            <p className="text-white/40 text-sm">Neeko Intel generating...</p>
            <p className="text-white/25 text-xs mt-1">Check back shortly</p>
          </div>
        )}

        {!allSectionsFailed && (
          <>
            {/* ── HERO: Elite Captain Locks ── */}
            <EliteCaptainHero rows={captains} loading={loading} error={sectionErrors.captains} />

            {/* ── Breakouts & Must Starts ── */}
            <Section>
              <SectionHeader
                icon={<Zap size={16} />}
                title="Breakouts & Must Starts"
                subtitle="Players with elite projections and high confidence"
                locked={!isPremium}
              />
              <div className="space-y-3">
                {renderPlayerCards(visibleBreakouts, loading, sectionErrors.breakouts)}
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
                ) : sectionErrors.captains ? (
                  <SectionError />
                ) : visibleCaptains.length === 0 ? (
                  <div className="text-center py-6 text-white/30 text-sm">
                    Neeko Intel generating...
                  </div>
                ) : (
                  visibleCaptains.map((row, idx) => (
                    <NeekoIntelCard
                      key={row.player_id ?? row.player_name + idx}
                      rank={idx + 1}
                      playerName={row.player_name}
                      team={row.team}
                      projection={row.projection_final}
                      confidence={row.projection_confidence}
                      label={row.captain_rating}
                      captainScore={row.captain_score}
                      color="#F5C84C"
                      reason={row.recommendation_why}
                      locked={false}
                    />
                  ))
                )}
              </div>
            </Section>

            {/* ── Risers / Fallers ── */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <Section>
                <SectionHeader
                  icon={<TrendingUp size={16} />}
                  title="Risers"
                  subtitle="Highest upside plays this round"
                  locked={!isPremium}
                />
                <div className="space-y-3">
                  {renderPlayerCards(visibleRisers, loading, sectionErrors.risers)}
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
                  {renderPlayerCards(visibleFallers, loading, sectionErrors.fallers)}
                </div>
              </Section>
            </div>

            {/* ── Risk & Avoid ── */}
            <Section>
              <SectionHeader
                icon={<Shield size={16} />}
                title="Risk & Avoid"
                subtitle="Players flagged as high risk or to avoid this round"
                locked={!isPremium}
              />
              <div className="space-y-3">
                {renderPlayerCards(visibleRisk, loading, sectionErrors.risk)}
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
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                  {Array.from({ length: 3 }).map((_, i) => <NeekoIntelSkeletonCard key={i} />)}
                </div>
              ) : sectionErrors.matches ? (
                <SectionError />
              ) : visibleMatches.length === 0 ? (
                <div className="text-center py-6 text-white/30 text-sm">
                  Neeko Intel generating...
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                  {visibleMatches.map((m) => (
                    <MatchPredictionCard key={m.match_id} match={m} locked={false} />
                  ))}
                </div>
              )}
            </Section>

            {/* ── Upgrade CTA (free users only) ── */}
            {!isPremium && <UpgradeCTABanner />}
          </>
        )}

        <div className="h-6" />
      </div>
    </div>
  );
}
