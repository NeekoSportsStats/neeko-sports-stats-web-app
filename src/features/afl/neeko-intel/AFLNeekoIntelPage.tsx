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
  projection_confidence: number | null;
  form_rating: number | null;
  matchup_rating: number | null;
  risk_rating: number | null;
  ai_recommendation: string | null;
  recommendation_color: string | null;
  recommendation_short: string | null;
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
  recommendation_short: string | null;
}

interface RiskRow {
  player_id: string | null;
  player_name: string;
  team: string;
  position: string | null;
  projection_final: number | null;
  projection_confidence: number | null;
  risk_rating: number | null;
  consistency_score: number | null;
  ai_recommendation: string | null;
  recommendation_color: string | null;
  recommendation_short: string | null;
}

interface RiserRow {
  player_id: string | null;
  player_name: string;
  team: string;
  position: string | null;
  projection_final: number | null;
  projection_confidence: number | null;
  upside_rating: number | null;
  form_rating: number | null;
  ai_recommendation: string | null;
  recommendation_color: string | null;
  recommendation_short: string | null;
}

interface FallerRow {
  player_id: string | null;
  player_name: string;
  team: string;
  position: string | null;
  projection_final: number | null;
  projection_confidence: number | null;
  risk_rating: number | null;
  form_rating: number | null;
  ai_recommendation: string | null;
  recommendation_color: string | null;
  recommendation_short: string | null;
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

function EliteCaptainHero({ rows, loading }: { rows: CaptainRow[]; loading: boolean }) {
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
            confidence={row.captain_confidence}
            label={row.captain_rating}
            color="#F5C84C"
            reason={row.recommendation_short}
            captainScore={row.captain_score}
            locked={false}
          />
        ))}
      </div>
    </div>
  );
}

// ─── Match Card ───────────────────────────────────────────────────────────────

function MatchPredictionCard({
  match,
  locked,
}: {
  match: MatchRow;
  locked: boolean;
}) {
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
          <div
            className={`text-2xl font-black tabular-nums mt-1 ${
              homeWin ? "text-[#F5C84C]" : "text-white/60"
            }`}
          >
            {fmt(match.home_projection, 0)}
          </div>
        </div>

        <div className="text-center shrink-0 px-2">
          <div className="text-white/20 text-xs font-bold">VS</div>
          {match.margin != null && (
            <div className="text-[10px] text-white/30 mt-1">
              {Math.round(Number(match.margin))} pts
            </div>
          )}
        </div>

        <div className={`flex-1 text-center ${!homeWin ? "opacity-100" : "opacity-50"}`}>
          <div className="font-bold text-white text-sm leading-tight">{match.away_team}</div>
          <div
            className={`text-2xl font-black tabular-nums mt-1 ${
              !homeWin ? "text-[#F5C84C]" : "text-white/60"
            }`}
          >
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
  recommendation_short?: string | null;
  captain_score?: number | null;
  upside_rating?: number | null;
  risk_rating?: number | null;
};

function renderPlayerCards(
  rows: AnyPlayerRow[],
  keyField: string,
  loading: boolean
) {
  if (loading) {
    return Array.from({ length: 3 }).map((_, i) => <NeekoIntelSkeletonCard key={i} />);
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
      reason={row.recommendation_short}
      captainScore={row.captain_score}
      locked={false}
    />
  ));
}

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

  useEffect(() => {
    async function load() {
      setLoading(true);
      try {
        const [
          breakoutsRes,
          captainsRes,
          riskRes,
          risersRes,
          fallersRes,
          matchesRes,
        ] = await Promise.all([
          supabase.from("v_neeko_intel_breakouts").select("*"),
          supabase.from("v_neeko_intel_captains").select("*"),
          supabase.from("v_neeko_intel_risk").select("*"),
          supabase.from("v_neeko_intel_risers").select("*"),
          supabase.from("v_neeko_intel_fallers").select("*"),
          supabase.from("v_neeko_intel_matches").select("*"),
        ]);

        if (breakoutsRes.data) setBreakouts(breakoutsRes.data as BreakoutRow[]);
        if (captainsRes.data) setCaptains(captainsRes.data as CaptainRow[]);
        if (riskRes.data) setRisk(riskRes.data as RiskRow[]);
        if (risersRes.data) setRisers(risersRes.data as RiserRow[]);
        if (fallersRes.data) setFallers(fallersRes.data as FallerRow[]);
        if (matchesRes.data) {
          setMatches(matchesRes.data as MatchRow[]);
          const first = (matchesRes.data as MatchRow[])[0];
          if (first?.updated_at) setLastUpdated(first.updated_at);
        }
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  const FREE_LIMIT = 1;

  const visibleBreakouts = isPremium ? breakouts : breakouts.slice(0, FREE_LIMIT);
  const visibleCaptains = isPremium ? captains : captains.slice(0, FREE_LIMIT);
  const visibleRisk = isPremium ? risk : risk.slice(0, FREE_LIMIT);
  const visibleRisers = isPremium ? risers : risers.slice(0, FREE_LIMIT);
  const visibleFallers = isPremium ? fallers : fallers.slice(0, FREE_LIMIT);
  const visibleMatches = isPremium ? matches : matches.slice(0, FREE_LIMIT);

  const isEmpty =
    !loading &&
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

        {isEmpty && (
          <div className="text-center py-16">
            <RefreshCw size={32} className="text-white/20 mx-auto mb-3 animate-spin" />
            <p className="text-white/40 text-sm">Neeko Intel generating...</p>
            <p className="text-white/25 text-xs mt-1">Check back shortly</p>
          </div>
        )}

        {!isEmpty && (
          <>
            {/* ── HERO: Elite Captain Locks ── */}
            <EliteCaptainHero rows={captains} loading={loading} />

            {/* ── Breakouts & Must Starts ── */}
            <Section>
              <SectionHeader
                icon={<Zap size={16} />}
                title="Breakouts & Must Starts"
                subtitle="Players with elite projections and high confidence"
                locked={!isPremium}
              />
              <div className="space-y-3">
                {renderPlayerCards(visibleBreakouts, "breakout", loading)}
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
                      confidence={row.captain_confidence}
                      label={row.captain_rating}
                      captainScore={row.captain_score}
                      color="#F5C84C"
                      reason={row.recommendation_short}
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
                  {renderPlayerCards(visibleRisers, "risers", loading)}
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
                  {renderPlayerCards(visibleFallers, "fallers", loading)}
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
                {renderPlayerCards(visibleRisk, "risk", loading)}
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
                  {Array.from({ length: 3 }).map((_, i) => (
                    <NeekoIntelSkeletonCard key={i} />
                  ))}
                </div>
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
