import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/lib/supabaseClient";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { RefreshCw, Shield, Database, Zap, Activity, CircleCheck as CheckCircle, TriangleAlert as AlertTriangle, Circle as XCircle, Clock, TrendingUp, Server, Bot, ChartBar as BarChart3, Layers } from "lucide-react";

const ADMIN_USER_ID = "4421a8b2-b5b6-4c93-b865-c8819a7ae902";

interface PipelineHealth {
  last_pipeline_run: string | null;
  successful_runs: number;
  partial_runs: number;
  failed_runs: number;
  total_runs: number;
  max_duration_ms: number | null;
  avg_duration_ms: number | null;
  last_error: string | null;
  latest_status: string | null;
}

interface IngestHealth {
  last_match_ingest: string | null;
  total_matches: number;
  latest_match_season: number | null;
  latest_match_round: number | null;
  last_player_stats_ingest: string | null;
  total_player_stat_rows: number;
  last_team_stats_ingest: string | null;
  total_team_stat_rows: number;
}

interface CanonicalHealth {
  latest_round_loaded: number | null;
  total_player_round_rows: number;
  unique_players: number;
  seasons_covered: number;
  earliest_season: number | null;
  latest_season: number | null;
  rows_missing_fantasy_points: number;
  overall_avg_fantasy_points: number | null;
}

interface AIGenerationHealth {
  player_ai_rows: number;
  team_ai_rows: number;
  player_ai_with_summary: number;
  team_ai_with_summary: number;
  last_player_ai_update: string | null;
  last_team_ai_update: string | null;
  unique_players_with_ai: number;
  unique_teams_with_ai: number;
}

interface StartSitCacheHealth {
  cache_rows: number;
  last_cache_update: string | null;
  oldest_cache_entry: string | null;
  stale_rows: number;
  seasons_cached: number;
  rounds_cached: number;
}

interface DataIntegrityChecks {
  players_missing_projection: number;
  players_missing_neeko_rating: number;
  players_missing_ceiling: number;
  players_missing_floor: number;
  players_missing_ai_reco: number;
  players_missing_volatility: number;
  total_volatility_rows: number;
  last_volatility_refresh: string | null;
}

function formatDate(ts: string | null): string {
  if (!ts) return "—";
  return new Date(ts).toLocaleString("en-AU", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatMs(ms: number | null): string {
  if (ms === null || ms === undefined) return "—";
  if (ms < 1000) return `${ms}ms`;
  return `${(ms / 1000).toFixed(1)}s`;
}

function StatusDot({ ok }: { ok: boolean }) {
  return (
    <span
      className={`inline-block w-2 h-2 rounded-full mr-2 ${ok ? "bg-emerald-500" : "bg-red-500"}`}
    />
  );
}

function StatRow({
  label,
  value,
  highlight,
}: {
  label: string;
  value: React.ReactNode;
  highlight?: "good" | "warn" | "bad" | "neutral";
}) {
  const valueClass =
    highlight === "good"
      ? "text-emerald-600 dark:text-emerald-400 font-semibold"
      : highlight === "warn"
        ? "text-amber-600 dark:text-amber-400 font-semibold"
        : highlight === "bad"
          ? "text-red-600 dark:text-red-400 font-semibold"
          : "font-medium";

  return (
    <div className="flex justify-between items-center py-1.5 border-b border-border/40 last:border-0">
      <span className="text-sm text-muted-foreground">{label}</span>
      <span className={`text-sm ${valueClass}`}>{value}</span>
    </div>
  );
}

function SectionCard({
  icon: Icon,
  title,
  status,
  children,
  loading,
}: {
  icon: React.ElementType;
  title: string;
  status?: "ok" | "warn" | "error" | "loading";
  children: React.ReactNode;
  loading?: boolean;
}) {
  const statusIcon =
    status === "ok" ? (
      <CheckCircle className="h-4 w-4 text-emerald-500" />
    ) : status === "warn" ? (
      <AlertTriangle className="h-4 w-4 text-amber-500" />
    ) : status === "error" ? (
      <XCircle className="h-4 w-4 text-red-500" />
    ) : null;

  return (
    <Card className="flex flex-col">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center justify-between text-base">
          <span className="flex items-center gap-2">
            <Icon className="h-4 w-4 text-muted-foreground" />
            {title}
          </span>
          {statusIcon}
        </CardTitle>
      </CardHeader>
      <CardContent className="flex-1">
        {loading ? (
          <div className="flex items-center justify-center h-24">
            <RefreshCw className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        ) : (
          children
        )}
      </CardContent>
    </Card>
  );
}

export default function Admin() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();

  const [isRefreshing, setIsRefreshing] = useState(false);
  const [dataLoading, setDataLoading] = useState(true);

  const [pipeline, setPipeline] = useState<PipelineHealth | null>(null);
  const [ingest, setIngest] = useState<IngestHealth | null>(null);
  const [canonical, setCanonical] = useState<CanonicalHealth | null>(null);
  const [aiHealth, setAiHealth] = useState<AIGenerationHealth | null>(null);
  const [cacheHealth, setCacheHealth] = useState<StartSitCacheHealth | null>(null);
  const [integrity, setIntegrity] = useState<DataIntegrityChecks | null>(null);

  useEffect(() => {
    if (loading) return;
    if (!user) {
      navigate("/auth");
      return;
    }
    if (user.id !== ADMIN_USER_ID) {
      navigate("/");
      return;
    }
  }, [user, loading, navigate]);

  const fetchAll = useCallback(async () => {
    setDataLoading(true);
    try {
      const [
        pipelineRes,
        ingestRes,
        canonicalRes,
        aiRes,
        cacheRes,
        integrityRes,
      ] = await Promise.all([
        supabase.from("v_pipeline_health").select("*").maybeSingle(),
        supabase.from("v_ingest_health").select("*").maybeSingle(),
        supabase.from("v_canonical_health").select("*").maybeSingle(),
        supabase.from("v_ai_generation_health").select("*").maybeSingle(),
        supabase.from("v_start_sit_cache_health").select("*").maybeSingle(),
        supabase.from("v_data_integrity_checks").select("*").maybeSingle(),
      ]);

      if (pipelineRes.data) setPipeline(pipelineRes.data as PipelineHealth);
      if (ingestRes.data) setIngest(ingestRes.data as IngestHealth);
      if (canonicalRes.data) setCanonical(canonicalRes.data as CanonicalHealth);
      if (aiRes.data) setAiHealth(aiRes.data as AIGenerationHealth);
      if (cacheRes.data) setCacheHealth(cacheRes.data as StartSitCacheHealth);
      if (integrityRes.data) setIntegrity(integrityRes.data as DataIntegrityChecks);
    } catch (err) {
      console.error("Admin fetch error:", err);
      toast({
        title: "Failed to load monitoring data",
        description: err instanceof Error ? err.message : "Unknown error",
        variant: "destructive",
      });
    } finally {
      setDataLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    if (!loading && user?.id === ADMIN_USER_ID) {
      fetchAll();
    }
  }, [loading, user, fetchAll]);

  const handleRunPipeline = async () => {
    setIsRefreshing(true);
    toast({ title: "Triggering weekly pipeline…", description: "This may take 2–5 minutes." });
    try {
      const { error } = await supabase.functions.invoke("weekly-afl-pipeline", { body: {} });
      if (error) throw error;
      toast({ title: "Pipeline complete", description: "All steps finished successfully." });
      await fetchAll();
    } catch (err) {
      toast({
        title: "Pipeline failed",
        description: err instanceof Error ? err.message : "Unknown error",
        variant: "destructive",
      });
    } finally {
      setIsRefreshing(false);
    }
  };

  const handleRefreshVolatility = async () => {
    setIsRefreshing(true);
    toast({ title: "Refreshing volatility model…" });
    try {
      const { error } = await supabase.schema("afl").rpc("fn_refresh_player_volatility");
      if (error) throw error;
      toast({ title: "Volatility model refreshed" });
      await fetchAll();
    } catch (err) {
      toast({
        title: "Volatility refresh failed",
        description: err instanceof Error ? err.message : "Unknown error",
        variant: "destructive",
      });
    } finally {
      setIsRefreshing(false);
    }
  };

  const handleRefreshRankingAI = async () => {
    setIsRefreshing(true);
    toast({ title: "Triggering AI ranking generation…" });
    try {
      const { error } = await supabase.functions.invoke("generate-ranking-ai", { body: {} });
      if (error) throw error;
      toast({ title: "Ranking AI generation triggered" });
      await fetchAll();
    } catch (err) {
      toast({
        title: "Ranking AI generation failed",
        description: err instanceof Error ? err.message : "Unknown error",
        variant: "destructive",
      });
    } finally {
      setIsRefreshing(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <RefreshCw className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!user || user.id !== ADMIN_USER_ID) {
    return null;
  }

  const pipelineStatus =
    pipeline?.latest_status === "success"
      ? "ok"
      : pipeline?.latest_status === "partial"
        ? "warn"
        : pipeline?.latest_status === "failed"
          ? "error"
          : "loading";

  const integrityIssues = integrity
    ? integrity.players_missing_projection +
      integrity.players_missing_neeko_rating +
      integrity.players_missing_ceiling +
      integrity.players_missing_floor +
      integrity.players_missing_ai_reco +
      integrity.players_missing_volatility
    : 0;

  const integrityStatus = integrityIssues === 0 ? "ok" : integrityIssues < 10 ? "warn" : "error";

  return (
    <div className="container mx-auto py-8 px-4 max-w-7xl">
      <div className="flex items-center justify-between mb-8">
        <div className="flex items-center gap-3">
          <Shield className="h-7 w-7 text-foreground" />
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Admin Monitoring</h1>
            <p className="text-sm text-muted-foreground">{user.email}</p>
          </div>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={fetchAll}
          disabled={dataLoading}
        >
          <RefreshCw className={`h-4 w-4 mr-2 ${dataLoading ? "animate-spin" : ""}`} />
          Refresh
        </Button>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3 mb-8">

        {/* Pipeline Health */}
        <SectionCard
          icon={Activity}
          title="Pipeline Status"
          status={pipelineStatus}
          loading={dataLoading}
        >
          <StatRow
            label="Latest run"
            value={formatDate(pipeline?.last_pipeline_run ?? null)}
          />
          <StatRow
            label="Status"
            value={
              <span className="flex items-center">
                <StatusDot ok={pipeline?.latest_status === "success"} />
                {pipeline?.latest_status ?? "—"}
              </span>
            }
          />
          <StatRow label="Total runs" value={pipeline?.total_runs ?? "—"} />
          <StatRow
            label="Successful"
            value={pipeline?.successful_runs ?? "—"}
            highlight="good"
          />
          <StatRow
            label="Failed"
            value={pipeline?.failed_runs ?? "—"}
            highlight={(pipeline?.failed_runs ?? 0) > 0 ? "bad" : "neutral"}
          />
          <StatRow label="Avg duration" value={formatMs(pipeline?.avg_duration_ms ?? null)} />
          {pipeline?.last_error && (
            <div className="mt-2 p-2 bg-red-50 dark:bg-red-950 rounded text-xs text-red-700 dark:text-red-300 break-words">
              {pipeline.last_error}
            </div>
          )}
        </SectionCard>

        {/* Data Ingest */}
        <SectionCard
          icon={Database}
          title="Data Ingest"
          status={ingest?.total_matches ? "ok" : "warn"}
          loading={dataLoading}
        >
          <StatRow label="Total matches ingested" value={ingest?.total_matches ?? "—"} />
          <StatRow label="Latest match round" value={ingest?.latest_match_round ?? "—"} />
          <StatRow label="Latest match season" value={ingest?.latest_match_season ?? "—"} />
          <StatRow label="Last match ingest" value={formatDate(ingest?.last_match_ingest ?? null)} />
          <StatRow label="Player stat rows" value={ingest?.total_player_stat_rows ?? "—"} />
          <StatRow label="Team stat rows" value={ingest?.total_team_stat_rows ?? "—"} />
          <StatRow label="Last player ingest" value={formatDate(ingest?.last_player_stats_ingest ?? null)} />
        </SectionCard>

        {/* Canonical Stats */}
        <SectionCard
          icon={Layers}
          title="Canonical Stats"
          status={canonical?.total_player_round_rows ? "ok" : "warn"}
          loading={dataLoading}
        >
          <StatRow label="Latest round loaded" value={canonical?.latest_round_loaded ?? "—"} />
          <StatRow label="Total player-round rows" value={canonical?.total_player_round_rows?.toLocaleString() ?? "—"} />
          <StatRow label="Unique players" value={canonical?.unique_players ?? "—"} />
          <StatRow label="Seasons covered" value={canonical?.seasons_covered ?? "—"} />
          <StatRow label="Season range" value={
            canonical?.earliest_season && canonical?.latest_season
              ? `${canonical.earliest_season}–${canonical.latest_season}`
              : "—"
          } />
          <StatRow
            label="Rows missing fantasy pts"
            value={canonical?.rows_missing_fantasy_points ?? "—"}
            highlight={(canonical?.rows_missing_fantasy_points ?? 0) > 0 ? "warn" : "good"}
          />
          <StatRow label="Overall avg fantasy pts" value={canonical?.overall_avg_fantasy_points ?? "—"} />
        </SectionCard>

        {/* AI Generation */}
        <SectionCard
          icon={Bot}
          title="AI Generation"
          status={aiHealth?.player_ai_rows ? "ok" : "warn"}
          loading={dataLoading}
        >
          <StatRow label="Player AI rows" value={aiHealth?.player_ai_rows ?? "—"} />
          <StatRow label="Players with summary" value={aiHealth?.player_ai_with_summary ?? "—"} highlight="good" />
          <StatRow label="Unique players covered" value={aiHealth?.unique_players_with_ai ?? "—"} />
          <StatRow label="Last player AI update" value={formatDate(aiHealth?.last_player_ai_update ?? null)} />
          <StatRow label="Team AI rows" value={aiHealth?.team_ai_rows ?? "—"} />
          <StatRow label="Teams with summary" value={aiHealth?.team_ai_with_summary ?? "—"} highlight="good" />
          <StatRow label="Last team AI update" value={formatDate(aiHealth?.last_team_ai_update ?? null)} />
        </SectionCard>

        {/* Start/Sit Cache */}
        <SectionCard
          icon={Clock}
          title="Start/Sit Cache"
          status={
            (cacheHealth?.stale_rows ?? 0) > 0 ? "warn" : cacheHealth?.cache_rows ? "ok" : "warn"
          }
          loading={dataLoading}
        >
          <StatRow label="Cache rows" value={cacheHealth?.cache_rows ?? "—"} />
          <StatRow label="Last update" value={formatDate(cacheHealth?.last_cache_update ?? null)} />
          <StatRow label="Oldest entry" value={formatDate(cacheHealth?.oldest_cache_entry ?? null)} />
          <StatRow
            label="Stale rows (>24h)"
            value={cacheHealth?.stale_rows ?? "—"}
            highlight={(cacheHealth?.stale_rows ?? 0) > 0 ? "warn" : "good"}
          />
          <StatRow label="Seasons cached" value={cacheHealth?.seasons_cached ?? "—"} />
          <StatRow label="Rounds cached" value={cacheHealth?.rounds_cached ?? "—"} />
        </SectionCard>

        {/* Data Integrity */}
        <SectionCard
          icon={TrendingUp}
          title="Data Integrity"
          status={integrityStatus}
          loading={dataLoading}
        >
          <StatRow
            label="Missing projections"
            value={integrity?.players_missing_projection ?? "—"}
            highlight={(integrity?.players_missing_projection ?? 0) > 0 ? "bad" : "good"}
          />
          <StatRow
            label="Missing Neeko rating"
            value={integrity?.players_missing_neeko_rating ?? "—"}
            highlight={(integrity?.players_missing_neeko_rating ?? 0) > 0 ? "bad" : "good"}
          />
          <StatRow
            label="Missing ceiling"
            value={integrity?.players_missing_ceiling ?? "—"}
            highlight={(integrity?.players_missing_ceiling ?? 0) > 0 ? "warn" : "good"}
          />
          <StatRow
            label="Missing floor"
            value={integrity?.players_missing_floor ?? "—"}
            highlight={(integrity?.players_missing_floor ?? 0) > 0 ? "warn" : "good"}
          />
          <StatRow
            label="Missing AI reco"
            value={integrity?.players_missing_ai_reco ?? "—"}
            highlight={(integrity?.players_missing_ai_reco ?? 0) > 0 ? "warn" : "good"}
          />
          <StatRow label="Volatility rows" value={integrity?.total_volatility_rows ?? "—"} highlight="good" />
          <StatRow label="Last volatility refresh" value={formatDate(integrity?.last_volatility_refresh ?? null)} />
        </SectionCard>
      </div>

      {/* Actions */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <Server className="h-4 w-4 text-muted-foreground" />
            Manual Actions
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <Button
              onClick={handleRunPipeline}
              disabled={isRefreshing}
              variant="default"
              className="w-full"
            >
              {isRefreshing ? (
                <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Zap className="h-4 w-4 mr-2" />
              )}
              Run Weekly Pipeline
            </Button>

            <Button
              onClick={handleRefreshVolatility}
              disabled={isRefreshing}
              variant="outline"
              className="w-full"
            >
              <BarChart3 className="h-4 w-4 mr-2" />
              Refresh Volatility
            </Button>

            <Button
              onClick={handleRefreshRankingAI}
              disabled={isRefreshing}
              variant="outline"
              className="w-full"
            >
              <Bot className="h-4 w-4 mr-2" />
              Run Ranking AI
            </Button>

            <Button
              onClick={() => navigate("/admin/queue")}
              variant="outline"
              className="w-full"
            >
              <Activity className="h-4 w-4 mr-2" />
              AI Queue Dashboard
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
