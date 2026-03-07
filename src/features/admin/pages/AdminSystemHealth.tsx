import { useState, useCallback, useEffect } from "react";
import { supabase } from "@/lib/supabaseClient";
import { Button } from "@/components/ui/button";
import { Activity, Database, Brain, ShieldCheck, Zap, RefreshCw, ChartBar as BarChart2 } from "lucide-react";
import {
  formatDate,
  formatMs,
  StatusDot,
  StatRow,
  SectionCard,
  type PipelineHealth,
  type CanonicalHealth,
  type DataIntegrityChecks,
  type AIQueueHealthRow,
  type AIWorkerHealth,
  type AIOutputHealth,
} from "../shared/adminUtils";

interface PipelineStatusData {
  last_run: string | null;
  duration_ms: number | null;
  steps_completed: number | null;
  steps_total: number | null;
  status: string | null;
  last_error: string | null;
}

interface DataFreshnessData {
  latest_round: number | null;
  total_player_rows: number | null;
  unique_players: number | null;
  season_range: string | null;
  is_preseason: boolean;
}

interface AIEngineData {
  queue_size: number;
  pending: number;
  processed_today: number;
}

interface AICoverageData {
  players_analysed: number;
  recommendations: number;
  coverage_pct: number | null;
}

export default function AdminSystemHealth() {
  const [loading, setLoading] = useState(false);
  const [lastRefreshed, setLastRefreshed] = useState<Date | null>(null);

  const [pipelineStatus, setPipelineStatus] = useState<PipelineStatusData | null>(null);
  const [dataFreshness, setDataFreshness] = useState<DataFreshnessData | null>(null);
  const [aiEngine, setAIEngine] = useState<AIEngineData | null>(null);
  const [aiCoverage, setAICoverage] = useState<AICoverageData | null>(null);
  const [integrity, setIntegrity] = useState<DataIntegrityChecks | null>(null);
  const [workerHealth, setWorkerHealth] = useState<AIWorkerHealth | null>(null);

  const fetchAll = useCallback(async () => {
    setLoading(true);
    try {
      const [
        pipelineRes,
        canonicalRes,
        integrityRes,
        queueRes,
        workerRes,
        outputRes,
        queueTodayRes,
      ] = await Promise.all([
        supabase.from("v_pipeline_health").select("*").maybeSingle(),
        supabase.from("v_canonical_health").select("*").maybeSingle(),
        supabase.from("v_data_integrity_checks").select("*").maybeSingle(),
        supabase
          .from("ai_generation_queue")
          .select("status", { count: "exact" })
          .eq("status", "pending"),
        supabase.from("v_ai_worker_health").select("*").maybeSingle(),
        supabase.from("v_ai_output_health").select("*").maybeSingle(),
        supabase
          .from("ai_generation_logs")
          .select("id", { count: "exact" })
          .gte(
            "created_at",
            new Date(new Date().setHours(0, 0, 0, 0)).toISOString()
          )
          .eq("success", true),
      ]);

      const ph = pipelineRes.data as PipelineHealth | null;
      if (ph) {
        setPipelineStatus({
          last_run: ph.last_pipeline_run,
          duration_ms: ph.avg_duration_ms,
          steps_completed: null,
          steps_total: 13,
          status: ph.latest_status,
          last_error: ph.last_error,
        });
      }

      const ch = canonicalRes.data as CanonicalHealth | null;
      if (ch) {
        setDataFreshness({
          latest_round: ch.latest_round_loaded,
          total_player_rows: ch.total_player_round_rows,
          unique_players: ch.unique_players,
          season_range:
            ch.earliest_season && ch.latest_season
              ? `${ch.earliest_season}–${ch.latest_season}`
              : null,
          is_preseason:
            !ch.total_player_round_rows || ch.total_player_round_rows === 0,
        });
      }

      const pendingCount = queueRes.count ?? 0;
      const totalQueueRes = await supabase
        .from("ai_generation_queue")
        .select("status", { count: "exact" });
      const totalQueue = totalQueueRes.count ?? 0;
      const processedToday = queueTodayRes.count ?? 0;
      setAIEngine({
        queue_size: totalQueue,
        pending: pendingCount,
        processed_today: processedToday,
      });

      const out = outputRes.data as AIOutputHealth | null;
      if (out) {
        const total = out.ranking_recos_rows ?? 0;
        const analysed = out.player_analysis_rows ?? 0;
        const canonical = ch?.unique_players ?? 0;
        setAICoverage({
          players_analysed: analysed,
          recommendations: total,
          coverage_pct:
            canonical > 0 ? Math.round((total / canonical) * 100) : null,
        });
      }

      if (integrityRes.data)
        setIntegrity(integrityRes.data as DataIntegrityChecks);
      if (workerRes.data) setWorkerHealth(workerRes.data as AIWorkerHealth);

      setLastRefreshed(new Date());
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchAll();
  }, [fetchAll]);

  const pipelineOk =
    pipelineStatus?.status === "success" ||
    pipelineStatus?.status === "partial";
  const pipelineStatusLevel: "ok" | "warn" | "error" | "loading" =
    pipelineStatus?.status === "success"
      ? "ok"
      : pipelineStatus?.status === "partial"
        ? "warn"
        : pipelineStatus?.status === "failed"
          ? "error"
          : "loading";

  const integrityIssues = integrity
    ? (integrity.players_missing_projection ?? 0) +
      (integrity.players_missing_neeko_rating ?? 0) +
      (integrity.players_missing_ai_reco ?? 0)
    : 0;
  const integrityLevel: "ok" | "warn" | "error" =
    integrityIssues === 0 ? "ok" : integrityIssues < 10 ? "warn" : "error";

  const workerLastRunMins = workerHealth?.last_worker_run
    ? Math.round(
        (Date.now() - new Date(workerHealth.last_worker_run).getTime()) / 60000
      )
    : null;
  const workerOk = workerLastRunMins !== null && workerLastRunMins <= 60;
  const workerLevel: "ok" | "warn" | "error" =
    workerLastRunMins === null
      ? "warn"
      : workerLastRunMins <= 60
        ? "ok"
        : "error";

  const workerStatusLabel =
    workerLastRunMins === null
      ? "Unknown"
      : workerLastRunMins <= 15
        ? "Active"
        : workerLastRunMins <= 60
          ? "Idle"
          : "Stalled";

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-base font-semibold">System Health</h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            {lastRefreshed
              ? `Last refreshed ${lastRefreshed.toLocaleTimeString("en-AU", { hour: "2-digit", minute: "2-digit" })}`
              : "Backend pipeline status and AI engine health."}
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={fetchAll}
          disabled={loading}
        >
          <RefreshCw
            className={`h-4 w-4 mr-2 ${loading ? "animate-spin" : ""}`}
          />
          Refresh All
        </Button>
      </div>

      <div className="grid gap-6 sm:grid-cols-2 xl:grid-cols-3">
        {/* 1 — Pipeline Status */}
        <SectionCard
          icon={Activity}
          title="Pipeline Status"
          status={pipelineStatusLevel}
          loading={loading}
        >
          <StatRow
            label="Last run"
            value={formatDate(pipelineStatus?.last_run ?? null)}
          />
          <StatRow
            label="Avg duration"
            value={formatMs(pipelineStatus?.duration_ms ?? null)}
          />
          <StatRow label="Steps total" value={pipelineStatus?.steps_total ?? 13} />
          <StatRow
            label="Status"
            value={
              <span className="flex items-center">
                <StatusDot ok={pipelineOk} />
                {pipelineStatus?.status ?? "—"}
              </span>
            }
          />
          {pipelineStatus?.last_error && (
            <div className="mt-2 p-2 bg-red-50 dark:bg-red-950 rounded text-xs text-red-700 dark:text-red-300 break-words">
              {pipelineStatus.last_error}
            </div>
          )}
        </SectionCard>

        {/* 2 — Data Freshness */}
        <SectionCard
          icon={Database}
          title="Data Freshness"
          status={
            dataFreshness?.is_preseason
              ? "warn"
              : dataFreshness?.total_player_rows
                ? "ok"
                : "warn"
          }
          loading={loading}
        >
          <StatRow
            label="Latest round"
            value={dataFreshness?.latest_round ?? "—"}
          />
          <StatRow
            label="Players tracked"
            value={
              dataFreshness?.unique_players?.toLocaleString() ?? "—"
            }
          />
          <StatRow
            label="Stat rows"
            value={
              dataFreshness?.total_player_rows?.toLocaleString() ?? "—"
            }
          />
          <StatRow
            label="Season range"
            value={dataFreshness?.season_range ?? "—"}
          />
          <StatRow
            label="Status"
            value={
              dataFreshness?.is_preseason ? (
                <span className="text-amber-500 font-semibold">
                  Preseason
                </span>
              ) : dataFreshness?.total_player_rows ? (
                <span className="text-emerald-500 font-semibold">Live</span>
              ) : (
                "—"
              )
            }
          />
        </SectionCard>

        {/* 3 — AI Engine */}
        <SectionCard
          icon={Brain}
          title="AI Engine"
          status={
            aiEngine
              ? aiEngine.pending === 0
                ? "ok"
                : "warn"
              : "loading"
          }
          loading={loading}
        >
          <StatRow
            label="Queue size"
            value={aiEngine?.queue_size?.toLocaleString() ?? "—"}
          />
          <StatRow
            label="Pending"
            value={
              <span
                className={
                  (aiEngine?.pending ?? 0) > 0
                    ? "text-amber-500 font-semibold"
                    : "font-medium"
                }
              >
                {aiEngine?.pending?.toLocaleString() ?? "—"}
              </span>
            }
          />
          <StatRow
            label="Processed today"
            value={
              <span
                className={
                  (aiEngine?.processed_today ?? 0) > 0
                    ? "text-emerald-500 font-semibold"
                    : "font-medium"
                }
              >
                {aiEngine?.processed_today?.toLocaleString() ?? "—"}
              </span>
            }
          />
        </SectionCard>

        {/* 4 — AI Coverage */}
        <SectionCard
          icon={BarChart2}
          title="AI Coverage"
          status={
            aiCoverage
              ? (aiCoverage.coverage_pct ?? 0) >= 90
                ? "ok"
                : "warn"
              : "loading"
          }
          loading={loading}
        >
          <StatRow
            label="Players analysed"
            value={aiCoverage?.players_analysed?.toLocaleString() ?? "—"}
          />
          <StatRow
            label="Recommendations"
            value={aiCoverage?.recommendations?.toLocaleString() ?? "—"}
          />
          <StatRow
            label="Coverage"
            value={
              aiCoverage?.coverage_pct != null ? (
                <span
                  className={
                    aiCoverage.coverage_pct >= 90
                      ? "text-emerald-500 font-semibold"
                      : "text-amber-500 font-semibold"
                  }
                >
                  {aiCoverage.coverage_pct}%
                </span>
              ) : (
                "—"
              )
            }
          />
        </SectionCard>

        {/* 5 — Database Integrity */}
        <SectionCard
          icon={ShieldCheck}
          title="Database Integrity"
          status={integrityLevel}
          loading={loading}
        >
          <StatRow
            label="Missing projections"
            value={integrity?.players_missing_projection ?? "—"}
            highlight={
              (integrity?.players_missing_projection ?? 0) > 0 ? "bad" : "good"
            }
          />
          <StatRow
            label="Missing Neeko rating"
            value={integrity?.players_missing_neeko_rating ?? "—"}
            highlight={
              (integrity?.players_missing_neeko_rating ?? 0) > 0
                ? "bad"
                : "good"
            }
          />
          <StatRow
            label="Missing AI reco"
            value={integrity?.players_missing_ai_reco ?? "—"}
            highlight={
              (integrity?.players_missing_ai_reco ?? 0) > 0 ? "warn" : "good"
            }
          />
          <StatRow
            label="Missing ceiling"
            value={integrity?.players_missing_ceiling ?? "—"}
            highlight={
              (integrity?.players_missing_ceiling ?? 0) > 0 ? "warn" : "good"
            }
          />
          <StatRow
            label="Missing floor"
            value={integrity?.players_missing_floor ?? "—"}
            highlight={
              (integrity?.players_missing_floor ?? 0) > 0 ? "warn" : "good"
            }
          />
        </SectionCard>

        {/* 6 — Worker Health */}
        <SectionCard
          icon={Zap}
          title="Worker Health"
          status={workerLevel}
          loading={loading}
        >
          <StatRow
            label="Last run"
            value={formatDate(workerHealth?.last_worker_run ?? null)}
          />
          <StatRow
            label="Jobs last hour"
            value={
              <span
                className={
                  (workerHealth?.jobs_last_10m ?? 0) > 0
                    ? "text-emerald-500 font-semibold"
                    : "font-medium"
                }
              >
                {workerHealth?.jobs_last_10m?.toLocaleString() ?? "—"}
              </span>
            }
          />
          <StatRow
            label="Errors last hour"
            value={workerHealth?.errors_last_hour ?? "—"}
            highlight={
              (workerHealth?.errors_last_hour ?? 0) === 0
                ? "good"
                : (workerHealth?.errors_last_hour ?? 0) <= 5
                  ? "warn"
                  : "bad"
            }
          />
          <StatRow
            label="Status"
            value={
              <span
                className={
                  workerLevel === "ok"
                    ? "text-emerald-500 font-semibold"
                    : workerLevel === "warn"
                      ? "text-amber-500 font-semibold"
                      : "text-red-500 font-semibold"
                }
              >
                {workerStatusLabel}
              </span>
            }
          />
        </SectionCard>
      </div>
    </div>
  );
}
