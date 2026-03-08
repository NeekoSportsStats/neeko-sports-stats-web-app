import { useState, useEffect, useCallback, useRef } from "react";
import { ArrowRight, RotateCcw, Zap, Share2, Check } from "lucide-react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { supabase } from "@/lib/supabaseClient";
import { useAuth } from "@/lib/auth";
import { track } from "@/lib/analytics";
import { StartSitSelector } from "./StartSitSelector";
import { StartSitResult } from "./StartSitResult";
import { StartSitSocialProof } from "./StartSitSocialProof";
import type { QuickFillPlayer } from "./StartSitSocialProof";
import { getAflRoundLabel } from "@/features/afl/shared/data/getAflRoundLabel";

const CURRENT_SEASON = 2026;
const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string;
const ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY as string;

interface PlayerOption {
  player_id: string;
  player_name: string;
  team: string | null;
  position: string | null;
  projection_final: number | null;
  ceiling_estimate: number | null;
  floor_estimate: number | null;
  projection_confidence: number | null;
  risk_rating: number | null;
  neeko_rating: number | null;
}

interface CompareResult {
  winner_player_id: string;
  winner_name: string;
  confidence: number;
  ai_summary: string | null;
  model_edge: string | null;
  is_cached: boolean;
  playerA: PlayerOption;
  playerB: PlayerOption;
}


function getConfidenceLabel(confidence: number): { label: string; color: string } {
  if (confidence >= 90) return { label: "Elite Confidence", color: "text-emerald-400" };
  if (confidence >= 75) return { label: "Strong Pick", color: "text-emerald-400" };
  if (confidence >= 60) return { label: "Lean Pick", color: "text-[#F5C84C]" };
  return { label: "Risky Decision", color: "text-red-400" };
}

export default function StartSitPage() {
  const { isPremium, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  const [playerA, setPlayerA] = useState<PlayerOption | null>(null);
  const [playerB, setPlayerB] = useState<PlayerOption | null>(null);
  const [round, setRound] = useState<number>(1);
  const [roundLoading, setRoundLoading] = useState(true);
  const [topPlayers, setTopPlayers] = useState<PlayerOption[]>([]);

  const [comparing, setComparing] = useState(false);
  const [result, setResult] = useState<CompareResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const compareButtonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => { track("start_sit_view"); }, []);

  // Load the current round on mount
  useEffect(() => {
    supabase
      .rpc("get_latest_completed_round")
      .then(({ data }) => {
        const activeRound = typeof data === "number" && data >= 0 ? data : 0;
        setRound(activeRound);
      })
      .catch(() => setRound(0))
      .finally(() => setRoundLoading(false));
  }, []);

  // Pre-fetch top players so social proof quick-fill cards have real IDs
  useEffect(() => {
    supabase
      .from("v_rankings_master")
      .select("player_id, player_name, team, position, projection_final, ceiling_estimate, floor_estimate, projection_confidence, risk_rating, neeko_rating")
      .not("player_id", "is", null)
      .order("neeko_rating", { ascending: false })
      .limit(600)
      .then(({ data }) => {
        if (data) setTopPlayers(data as PlayerOption[]);
      });
  }, []);

  // Pre-fill from URL params (share link support)
  useEffect(() => {
    const pA = searchParams.get("playerA");
    const pB = searchParams.get("playerB");
    if (!pA && !pB) return;

    async function prefillFromUrl() {
      const ids = [pA, pB].filter(Boolean) as string[];
      if (ids.length === 0) return;

      const { data } = await supabase
        .from("v_rankings_master")
        .select("player_id, player_name, team, position, projection_final, ceiling_estimate, floor_estimate, projection_confidence, risk_rating, neeko_rating")
        .in("player_name", ids.map((n) => n.replace(/-/g, " ")));

      if (!data) return;
      const [found1, found2] = data as PlayerOption[];
      if (found1) setPlayerA(found1);
      if (found2) setPlayerB(found2);
    }

    prefillFromUrl();
  }, [searchParams]);

  const handlePlayerAChange = useCallback((p: PlayerOption | null) => {
    setPlayerA(p);
    setResult(null);
    setError(null);
  }, []);

  const handlePlayerBChange = useCallback((p: PlayerOption | null) => {
    setPlayerB(p);
    setResult(null);
    setError(null);
  }, []);

  const handleFillBoth = useCallback((a: QuickFillPlayer, b: QuickFillPlayer) => {
    setPlayerA(a as PlayerOption);
    setPlayerB(b as PlayerOption);
    setResult(null);
    setError(null);
  }, []);

  const handleScrollToCompare = useCallback(() => {
    setTimeout(() => {
      compareButtonRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
    }, 80);
  }, []);

  async function handleCompare() {
    if (!playerA || !playerB) return;

    track("start_sit_generate", {
      player_a: playerA.player_name,
      player_b: playerB.player_name,
    });

    setComparing(true);
    setResult(null);
    setError(null);

    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      const authHeader = session?.access_token
        ? `Bearer ${session.access_token}`
        : `Bearer ${ANON_KEY}`;

      const res = await fetch(`${SUPABASE_URL}/functions/v1/generate-start-sit`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: authHeader,
        },
        body: JSON.stringify({
          season: CURRENT_SEASON,
          round_number: round ?? 0,
          playerAId: playerA.player_id,
          playerBId: playerB.player_id,
        }),
      });

      const json = await res.json();

      if (!res.ok || json.error) {
        setError(json.error ?? "Unable to generate comparison. Please try again.");
        return;
      }

      const resultPlayerA: PlayerOption = json.playerA ?? playerA;
      const resultPlayerB: PlayerOption = json.playerB ?? playerB;

      setResult({
        winner_player_id: String(json.winner_player_id),
        winner_name: json.winner_name,
        confidence: typeof json.confidence === "number" ? json.confidence : 60,
        ai_summary: json.ai_summary ?? null,
        model_edge: json.model_edge ?? null,
        is_cached: json.is_cached ?? false,
        playerA: resultPlayerA,
        playerB: resultPlayerB,
      });

      supabase.from("start_sit_decisions").insert({
        player_a_id:      playerA.player_id,
        player_a_name:    playerA.player_name,
        player_b_id:      playerB.player_id,
        player_b_name:    playerB.player_name,
        winner_player_id: String(json.winner_player_id),
        session_id:       typeof crypto !== "undefined" ? crypto.randomUUID?.() ?? null : null,
      }).then(() => {});
    } catch {
      setError("Unable to generate comparison. Please try again.");
    } finally {
      setComparing(false);
    }
  }

  function reset() {
    setPlayerA(null);
    setPlayerB(null);
    setResult(null);
    setError(null);
  }

  function handleShare() {
    if (!playerA || !playerB) return;
    const url = new URL(window.location.href);
    url.searchParams.set("playerA", playerA.player_name.replace(/\s+/g, "-"));
    url.searchParams.set("playerB", playerB.player_name.replace(/\s+/g, "-"));
    navigator.clipboard.writeText(url.toString()).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  const canCompare = !!playerA && !!playerB && !comparing;
  const showSocialProof = !result && !comparing;
  const confidenceLabel = result ? getConfidenceLabel(result.confidence) : null;

  return (
    <div className="min-h-screen bg-[#070707] text-white">
      <div className="max-w-2xl mx-auto px-4 py-8 pb-28">

        {/* Header */}
        <div className="mb-6">
          <div className="flex items-center gap-2 mb-1">
            <Zap size={16} className="text-[#F5C84C]" />
            <span className="text-[11px] font-semibold uppercase tracking-widest text-[#F5C84C]/60">
              AFL Fantasy
            </span>
          </div>
          <h1 className="text-2xl font-extrabold text-white">Start / Sit</h1>
          <p className="text-sm text-white/40 mt-1">
            Compare two players and get a verdict on who to start this round.
          </p>
        </div>

        {/* Round pill */}
        <div className="flex items-center gap-2 mb-5">
          <span className="text-[11px] text-white/30 uppercase tracking-wider">Round</span>
          {roundLoading ? (
            <span className="h-6 w-16 rounded-md bg-white/[0.06] animate-pulse" />
          ) : (
            <span className="rounded-md border border-white/10 bg-white/[0.04] px-2.5 py-1 text-sm font-bold text-white/70">
              {getAflRoundLabel(round)}
            </span>
          )}
          <span className="text-[11px] text-white/20">{CURRENT_SEASON}</span>
        </div>

        {/* Player selectors */}
        <div className="grid gap-3 sm:grid-cols-2 mb-4">
          <StartSitSelector
            label="Player A"
            value={playerA}
            excludeId={playerB?.player_id}
            onChange={handlePlayerAChange}
          />
          <StartSitSelector
            label="Player B"
            value={playerB}
            excludeId={playerA?.player_id}
            onChange={handlePlayerBChange}
          />
        </div>

        {/* Action row */}
        <div className="flex items-center gap-3">
          <button
            ref={compareButtonRef}
            onClick={handleCompare}
            disabled={!canCompare}
            className={`flex-1 flex items-center justify-center gap-2 rounded-xl py-3.5 font-bold text-sm transition-all
              ${canCompare
                ? "bg-[#F5C84C] text-black hover:brightness-110 active:scale-[0.98]"
                : "bg-white/[0.06] text-white/25 cursor-not-allowed"
              }`}
          >
            {comparing ? (
              <>
                <span className="h-4 w-4 rounded-full border-2 border-black/30 border-t-black animate-spin" />
                Analysing...
              </>
            ) : (
              <>
                <ArrowRight size={14} />
                Compare Players
              </>
            )}
          </button>

          {result && playerA && playerB && (
            <button
              onClick={handleShare}
              className="flex items-center gap-1.5 px-4 py-3.5 rounded-xl border border-white/10 text-white/40 hover:text-white/70 hover:border-white/20 transition-all text-sm"
              title="Copy share link"
            >
              {copied ? <Check size={13} className="text-emerald-400" /> : <Share2 size={13} />}
              {copied ? "Copied" : "Share"}
            </button>
          )}

          {(result || playerA || playerB) && (
            <button
              onClick={reset}
              className="flex items-center gap-1.5 px-4 py-3.5 rounded-xl border border-white/10 text-white/40 hover:text-white/70 hover:border-white/20 transition-all text-sm"
            >
              <RotateCcw size={13} />
              Reset
            </button>
          )}
        </div>

        {/* Confidence tier label — shown only after a result */}
        {result && confidenceLabel && (
          <div className="mt-2 flex items-center gap-1.5 px-1">
            <span className={`text-xs font-semibold ${confidenceLabel.color}`}>
              {result.confidence}% confidence
            </span>
            <span className="text-white/20 text-xs">·</span>
            <span className={`text-xs ${confidenceLabel.color} opacity-70`}>
              {confidenceLabel.label}
            </span>
          </div>
        )}

        {/* Error banner */}
        {error && (
          <div className="mt-4 bg-red-500/10 border border-red-500/20 rounded-xl px-4 py-3 flex items-start justify-between gap-3">
            <p className="text-sm text-red-400 leading-snug">{error}</p>
            <button
              onClick={handleCompare}
              disabled={!canCompare}
              className="shrink-0 text-xs text-red-400/70 hover:text-red-400 underline underline-offset-2 transition-colors disabled:opacity-40"
            >
              Retry
            </button>
          </div>
        )}

        {/* Loading skeleton while fetching */}
        {comparing && (
          <div className="mt-6 space-y-3 animate-pulse">
            <div className="h-36 rounded-2xl bg-white/[0.04]" />
            <div className="h-28 rounded-xl bg-white/[0.04]" />
            <div className="h-24 rounded-xl bg-white/[0.04]" />
            <div className="h-48 rounded-xl bg-white/[0.04]" />
            <div className="h-28 rounded-xl bg-white/[0.04]" />
            <div className="h-14 rounded-xl bg-white/[0.04]" />
          </div>
        )}

        {/* Result — wait for auth to resolve before rendering so premium state is certain */}
        {!comparing && result && !authLoading && (
          <StartSitResult
            playerA={result.playerA}
            playerB={result.playerB}
            winnerPlayerId={result.winner_player_id}
            confidence={result.confidence}
            aiSummary={result.ai_summary}
            modelEdge={result.model_edge}
            isPremium={isPremium}
            onUpgrade={() => navigate("/neeko-plus")}
          />
        )}
        {!comparing && result && authLoading && (
          <div className="mt-6 space-y-3 animate-pulse">
            <div className="h-36 rounded-2xl bg-white/[0.04]" />
            <div className="h-28 rounded-xl bg-white/[0.04]" />
            <div className="h-24 rounded-xl bg-white/[0.04]" />
          </div>
        )}

        {/* Social proof — only shown when no result is displayed */}
        {showSocialProof && (
          <div className="mt-8">
            <StartSitSocialProof
              players={topPlayers}
              onFillBoth={handleFillBoth}
              onScrollToCompare={handleScrollToCompare}
            />
          </div>
        )}
      </div>
    </div>
  );
}
