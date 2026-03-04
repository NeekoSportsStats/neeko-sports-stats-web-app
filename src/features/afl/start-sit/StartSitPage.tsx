import { useState, useEffect, useCallback } from "react";
import { ArrowRight, RotateCcw, Zap } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/lib/supabaseClient";
import { useAuth } from "@/lib/auth";
import { StartSitSelector } from "./StartSitSelector";
import { StartSitResult } from "./StartSitResult";

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
  is_cached: boolean;
  playerA: PlayerOption;
  playerB: PlayerOption;
}

function getRoundLabel(round: number): string {
  if (round <= 0) return "Opening Round";
  return `Round ${round}`;
}

export default function StartSitPage() {
  const { isPremium } = useAuth();
  const navigate = useNavigate();

  const [playerA, setPlayerA] = useState<PlayerOption | null>(null);
  const [playerB, setPlayerB] = useState<PlayerOption | null>(null);
  const [round, setRound] = useState<number>(1);
  const [roundLoading, setRoundLoading] = useState(true);

  const [comparing, setComparing] = useState(false);
  const [result, setResult] = useState<CompareResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Load the current round on mount
  useEffect(() => {
    supabase
      .rpc("get_latest_completed_round")
      .then(({ data }) => {
        const latest = typeof data === "number" ? data : 0;
        // If no completed rounds (pre-season), default to round 1 (Opening Round)
        setRound(latest > 0 ? latest + 1 : 1);
      })
      .catch(() => setRound(1))
      .finally(() => setRoundLoading(false));
  }, []);

  // Clear stale result immediately whenever either player or round changes
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

  async function handleCompare() {
    if (!playerA || !playerB) return;

    setComparing(true);
    setResult(null);
    setError(null);

    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      // Always send an Authorization header:
      // - Logged-in users send their JWT so premium is detected server-side
      // - Anon users send the anon key so the function accepts the request (no 401)
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
          round_number: round,
          playerAId: playerA.player_id,
          playerBId: playerB.player_id,
        }),
      });

      const json = await res.json();

      if (!res.ok || json.error) {
        setError(
          json.error ??
            "Start/Sit data isn't available for this round yet. Try again shortly."
        );
        return;
      }

      // Use player data returned by the edge function (has latest stats)
      // Fall back to what we already have if missing from response
      const resultPlayerA: PlayerOption = json.playerA ?? playerA;
      const resultPlayerB: PlayerOption = json.playerB ?? playerB;

      setResult({
        winner_player_id: json.winner_player_id,
        winner_name: json.winner_name,
        confidence: typeof json.confidence === "number" ? json.confidence : 60,
        ai_summary: json.ai_summary ?? null,
        is_cached: json.is_cached ?? false,
        playerA: resultPlayerA,
        playerB: resultPlayerB,
      });
    } catch {
      setError(
        "Start/Sit data isn't available for this round yet. Try again shortly."
      );
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

  const canCompare = !!playerA && !!playerB && !comparing;
  const showEmptyHint = !result && !comparing && !error;

  return (
    <div className="min-h-screen bg-[#070707] text-white">
      <div className="max-w-2xl mx-auto px-4 py-8 pb-28">

        {/* Header */}
        <div className="mb-8">
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
        <div className="flex items-center gap-2 mb-6">
          <span className="text-[11px] text-white/30 uppercase tracking-wider">Round</span>
          {roundLoading ? (
            <span className="h-6 w-16 rounded-md bg-white/[0.06] animate-pulse" />
          ) : (
            <span className="rounded-md border border-white/10 bg-white/[0.04] px-2.5 py-1 text-sm font-bold text-white/70">
              {getRoundLabel(round)}
            </span>
          )}
          <span className="text-[11px] text-white/20">{CURRENT_SEASON}</span>
        </div>

        {/* Player selectors */}
        <div className="grid gap-3 sm:grid-cols-2 mb-5">
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
            <div className="h-24 rounded-xl bg-white/[0.04]" />
            <div className="h-48 rounded-xl bg-white/[0.04]" />
            <div className="h-28 rounded-xl bg-white/[0.04]" />
            <div className="h-14 rounded-xl bg-white/[0.04]" />
          </div>
        )}

        {/* Result */}
        {!comparing && result && (
          <StartSitResult
            playerA={result.playerA}
            playerB={result.playerB}
            winnerPlayerId={result.winner_player_id}
            confidence={result.confidence}
            aiSummary={result.ai_summary}
            isPremium={isPremium}
            onUpgrade={() => navigate("/neeko-plus")}
          />
        )}

        {/* Empty state */}
        {showEmptyHint && (
          <div className="mt-10 text-center">
            <p className="text-sm text-white/20">Select two players above to get started.</p>
            {!isPremium && (
              <p className="text-[11px] text-white/15 mt-1">
                AI explanation requires Neeko+
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
