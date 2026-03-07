import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/lib/supabaseClient";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import {
  Zap,
  TrendingUp,
  Bot,
  Activity,
  History,
  Database,
  RefreshCw,
} from "lucide-react";
import { AdminPipelineProgress, type PipelineRun } from "@/components/admin/AdminPipelineProgress";

const PIPELINE_STAGES: Record<string, string[]> = {
  weekly_pipeline: [
    "Ingesting AFL match data",
    "Ingesting player stats",
    "Ingesting team stats",
    "Detecting latest round",
    "Transforming player stats",
    "Transforming match data",
    "Rebuilding team defence profile",
    "Refreshing Neeko intelligence",
    "Refreshing player volatility",
    "Refreshing Market Watch snapshot",
    "Generating Market Watch AI summary",
    "Generating AI rankings",
    "Cleaning Start/Sit cache",
  ],
  ranking_ai: [
    "Loading player data",
    "Generating AI analysis",
    "Generating captain recommendations",
    "Saving results",
  ],
  volatility: [
    "Loading player history",
    "Computing volatility scores",
    "Saving results",
  ],
};

export default function AdminOperations() {
  const { toast } = useToast();
  const navigate = useNavigate();
  const [running, setRunning] = useState<string | null>(null);
  const [activeRun, setActiveRun] = useState<PipelineRun | null>(null);

  const createPipelineRun = async (
    pipelineKey: string,
    label: string
  ): Promise<string | null> => {
    const stages = PIPELINE_STAGES[pipelineKey] ?? [];
    const { data, error } = await supabase
      .from("pipeline_runs")
      .insert({
        pipeline_key: pipelineKey,
        label,
        total_tasks: stages.length || 1,
        completed_tasks: 0,
        current_step_label: stages[0] ?? "Starting…",
        status: "running",
      })
      .select("id")
      .single();
    if (error || !data) return null;
    return data.id as string;
  };

  const fetchActiveRun = async (runId: string) => {
    const { data } = await supabase
      .from("v_pipeline_progress")
      .select("*")
      .eq("id", runId)
      .maybeSingle();
    if (data) setActiveRun(data as PipelineRun);
  };

  const finishPipelineRun = async (runId: string, success: boolean) => {
    await supabase
      .from("pipeline_runs")
      .update({
        status: success ? "completed" : "failed",
        completed_tasks: success
          ? (activeRun?.total_tasks ?? 1)
          : (activeRun?.completed_tasks ?? 0),
        current_step_label: success ? "Done" : "Failed",
        finished_at: new Date().toISOString(),
      })
      .eq("id", runId);
    await fetchActiveRun(runId);
  };

  const handleRunPipeline = async () => {
    setRunning("pipeline");
    toast({ title: "Triggering weekly pipeline…" });
    const runId = await createPipelineRun("weekly_pipeline", "Weekly Pipeline");
    if (runId) await fetchActiveRun(runId);
    setRunning(null);
    supabase.functions
      .invoke("weekly-afl-pipeline", {
        body: runId ? { run_id: runId } : {},
      })
      .then(async ({ data, error }) => {
        const success = !error && data?.ok === true;
        if (runId) {
          const { data: finalRun } = await supabase
            .from("v_pipeline_progress")
            .select("*")
            .eq("id", runId)
            .maybeSingle();
          if (
            finalRun?.status !== "completed" &&
            finalRun?.status !== "failed"
          ) {
            await finishPipelineRun(runId, success);
          } else {
            await fetchActiveRun(runId);
          }
        }
        toast({
          title: success ? "Pipeline complete" : "Pipeline failed",
          variant: success ? "default" : "destructive",
        });
      });
  };

  const handleRefreshVolatility = async () => {
    setRunning("volatility");
    const runId = await createPipelineRun(
      "volatility",
      "Refresh Volatility Model"
    );
    if (runId) await fetchActiveRun(runId);
    try {
      const { error } = await supabase
        .schema("afl" as never)
        .rpc("fn_refresh_player_volatility");
      if (runId) await finishPipelineRun(runId, !error);
      if (error) throw error;
      toast({ title: "Volatility model refreshed" });
    } catch (err) {
      if (runId) await finishPipelineRun(runId, false);
      toast({
        title: "Volatility refresh failed",
        description: err instanceof Error ? err.message : "Unknown",
        variant: "destructive",
      });
    } finally {
      setRunning(null);
    }
  };

  const handleRefreshRankingAI = async () => {
    setRunning("ranking_ai");
    const runId = await createPipelineRun("ranking_ai", "Generate Ranking AI");
    if (runId) await fetchActiveRun(runId);
    try {
      const { error } = await supabase.functions.invoke("generate-ranking-ai", {
        body: {},
      });
      if (runId) await finishPipelineRun(runId, !error);
      if (error) throw error;
      toast({ title: "Ranking AI generation triggered" });
    } catch (err) {
      if (runId) await finishPipelineRun(runId, false);
      toast({
        title: "Ranking AI failed",
        description: err instanceof Error ? err.message : "Unknown",
        variant: "destructive",
      });
    } finally {
      setRunning(null);
    }
  };

  const isRunning = running !== null;

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-base font-semibold">Operations</h2>
        <p className="text-xs text-muted-foreground mt-0.5">
          Manual pipeline triggers and admin tools.
        </p>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <Zap className="h-4 w-4 text-muted-foreground" />
            Manual Actions
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            <Button
              onClick={handleRunPipeline}
              disabled={isRunning}
              variant="default"
              className="w-full"
            >
              {running === "pipeline" ? (
                <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Zap className="h-4 w-4 mr-2" />
              )}
              Run Weekly Pipeline
            </Button>

            <Button
              onClick={handleRefreshVolatility}
              disabled={isRunning}
              variant="outline"
              className="w-full"
            >
              {running === "volatility" ? (
                <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <TrendingUp className="h-4 w-4 mr-2" />
              )}
              Refresh Volatility
            </Button>

            <Button
              onClick={handleRefreshRankingAI}
              disabled={isRunning}
              variant="outline"
              className="w-full"
            >
              {running === "ranking_ai" ? (
                <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Bot className="h-4 w-4 mr-2" />
              )}
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

            <Button
              onClick={() => navigate("/admin/pipeline-history")}
              variant="outline"
              className="w-full"
            >
              <History className="h-4 w-4 mr-2" />
              Pipeline History
            </Button>

            <Button
              onClick={() => navigate("/admin/pipeline-status")}
              variant="outline"
              className="w-full"
            >
              <Database className="h-4 w-4 mr-2" />
              Data Pipeline Status
            </Button>
          </div>

          {activeRun && (
            <AdminPipelineProgress
              run={activeRun}
              onPollTick={() => fetchActiveRun(activeRun.id)}
            />
          )}
        </CardContent>
      </Card>
    </div>
  );
}
