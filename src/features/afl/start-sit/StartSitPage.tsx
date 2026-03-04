import { useState, useEffect } from "react";
import { ArrowRight, Crown, RotateCcw, Zap } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/lib/supabaseClient";
import { useAuth } from "@/lib/auth";
import { StartSitSelector } from "./StartSitSelector";
import { StartSitResult } from "./StartSitResult";

const CURRENT_SEASON = 2026;

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

interface AIResult {
  verdict: string;
  confidence: number | null;
  analysis: string | null;
}

async function fetchFullPlayer(id: string): Promise<PlayerOption | null> {
  const { data } = await supabase
    .from("v_rankings_master")
    .select(`
      player_id, player_name, team, position,
      projection_final, ceiling_estimate, floor_estimate,
      projection_confidence, risk_rating, neeko_rating
    `)
    .eq("player_id", id)
    .maybeSingle();
  return data as PlayerOption | null;
}

export default function StartSitPage() {
  const { isPremium } = useAuth();
  const navigate = useNavigate();

  const [playerA, setPlayerA] = useState<PlayerOption | null>(null);
  const [playerB, setPlayerB] = useState<PlayerOption | null>(null);
  const [round, setRound] = useState<number>(1);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<AIResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    supabase
      .rpc("get_latest_completed_round")
      .then(({ data }) => {
        const latest = typeof data === "number" ? data : 0;
        setRound(latest > 0 ? latest + 1 : 1);
      })
      .catch(() => setRound(1));
  }, []);

  async function handleCompare() {
    if (!playerA || !playerB) return;
    setLoading(true);
    setError(null);
    setResult(null);

    try {
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string;
      const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string;

      const res = await fetch(`${supabaseUrl}/functions/v1/generate-start-sit`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${anonKey}`,
        },
        body: JSON.stringify({
          playerA_id: playerA.player_id,
          playerB_id: playerB.player_id,
          season: CURRENT_SEASON,
          round,
        }),
      });

      const json = await res.json();
      if (!res.ok || json.error) {
        setError(json.error ?? "Something went wrong.");
        return;
      }

      const r = json.result;
      const verdictFlipped =
        r.player_a_id !== playerA.player_id && r.verdict !== "TOSS_UP"
          ? r.verdict === "START_PLAYER_A" ? "START_PLAYER_B" : "START_PLAYER_A"
          : r.verdict;

      const [fullA, fullB] = await Promise.all([
        fetchFullPlayer(playerA.player_id),
        fetchFullPlayer(playerB.player_id),
      ]);
      if (fullA) setPlayerA(fullA);
      if (fullB) setPlayerB(fullB);

      setResult({
        verdict: verdictFlipped,
        confidence: r.confidence ?? null,
        analysis: r.analysis ?? null,
      });
    } catch (e) {
      setError(String(e));
    } finally {
      setLoading(false);
    }
  }

  function reset() {
    setPlayerA(null);
    setPlayerB(null);
    setResult(null);
    setError(null);
  }

  const canCompare = !!playerA && !!playerB && !loading;

  return (
    <div className="min-h-screen bg-[#070707] text-white">
      <div className="max-w-2xl mx-auto px-4 py-8 pb-24">

        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center gap-2 mb-1">
            <Zap size={16} className="text-[#F5C84C]" />
            <span className="text-[11px] font-semibold uppercase tracking-widest text-[#F5C84C]/60">AFL Fantasy</span>
          </div>
          <h1 className="text-2xl font-extrabold text-white">Start / Sit</h1>
          <p className="text-sm text-white/40 mt-1">
            Compare two players and get an AI-powered verdict on who to start.
          </p>
        </div>

        {/* Round badge */}
        <div className="flex items-center gap-2 mb-6">
          <span className="text-[11px] text-white/30 uppercase tracking-wider">Round</span>
          <span className="rounded-md border border-white/10 bg-white/[0.04] px-2.5 py-1 text-sm font-bold text-white/70">
            {round}
          </span>
          <span className="text-[11px] text-white/20">{CURRENT_SEASON} season</span>
        </div>

        {/* Selectors */}
        <div className="grid gap-3 sm:grid-cols-2 mb-5">
          <StartSitSelector
            label="Player A"
            value={playerA}
            excludeId={playerB?.player_id}
            onChange={setPlayerA}
          />
          <StartSitSelector
            label="Player B"
            value={playerB}
            excludeId={playerA?.player_id}
            onChange={setPlayerB}
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
            {loading ? (
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

          {result && (
            <button
              onClick={reset}
              className="flex items-center gap-1.5 px-4 py-3.5 rounded-xl border border-white/10 text-white/40 hover:text-white/70 hover:border-white/20 transition-all text-sm"
            >
              <RotateCcw size={13} />
              Reset
            </button>
          )}
        </div>

        {error && (
          <p className="mt-4 text-sm text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg px-4 py-3">
            {error}
          </p>
        )}

        {/* Result */}
        {result && playerA && playerB && (
          <StartSitResult
            playerA={playerA}
            playerB={playerB}
            verdict={result.verdict}
            confidence={result.confidence}
            analysis={result.analysis}
            isPremium={isPremium}
            onUpgrade={() => navigate("/neeko-plus")}
          />
        )}

        {/* Empty state hint */}
        {!result && !loading && (
          <div className="mt-10 text-center">
            <p className="text-sm text-white/20">Select two players above to get started.</p>
            {!isPremium && (
              <p className="text-[11px] text-white/15 mt-1">
                AI verdict &amp; explanation require Neeko+
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
