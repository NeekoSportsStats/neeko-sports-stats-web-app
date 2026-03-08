import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/lib/supabaseClient";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { Zap, TrendingUp, Bot, Activity, History, Database, RefreshCw, DollarSign, Upload, CircleCheck as CheckCircle, CircleAlert as AlertCircle } from "lucide-react";
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

  // ─── Price Upload ───────────────────────────────────────────────────────────
  const [priceText, setPriceText] = useState("");
  const [priceRound, setPriceRound] = useState<string>("");
  const [uploadingPrices, setUploadingPrices] = useState(false);
  const [uploadResult, setUploadResult] = useState<{ ok: number; errors: string[] } | null>(null);

  const handlePriceUpload = async () => {
    const round = parseInt(priceRound, 10);
    if (!priceText.trim()) {
      toast({ title: "No data pasted", variant: "destructive" });
      return;
    }
    if (isNaN(round) || round < 0 || round > 30) {
      toast({ title: "Enter a valid round number (0–30)", variant: "destructive" });
      return;
    }

    setUploadingPrices(true);
    setUploadResult(null);

    const lines = priceText.trim().split("\n").map((l) => l.trim()).filter(Boolean);
    const rows: { player_name: string; price: number }[] = [];
    const errors: string[] = [];

    for (const line of lines) {
      const parts = line.split(",");
      if (parts.length < 2) { errors.push(`Skipped (no comma): ${line}`); continue; }
      const rawName = parts.slice(0, -1).join(",").trim();
      const rawPrice = parts[parts.length - 1].replace(/[^0-9]/g, "");
      const price = parseInt(rawPrice, 10);
      if (!rawName) { errors.push(`Empty name: ${line}`); continue; }
      if (isNaN(price) || price < 100000) { errors.push(`Invalid price for ${rawName}: ${rawPrice}`); continue; }
      rows.push({ player_name: rawName, price });
    }

    if (rows.length === 0) {
      toast({ title: "No valid rows parsed", variant: "destructive" });
      setUploadResult({ ok: 0, errors });
      setUploadingPrices(false);
      return;
    }

    let ok = 0;
    for (const row of rows) {
      const { data: players } = await supabase
        .from("afl_player_prices")
        .select("id, player_id")
        .eq("season", 2026)
        .ilike("player_name", row.player_name)
        .limit(1);

      if (players && players.length > 0) {
        const { error } = await supabase
          .from("afl_player_prices")
          .update({ price: row.price, round_number: round })
          .eq("id", (players[0] as { id: string }).id);
        if (error) errors.push(`Update failed for ${row.player_name}: ${error.message}`);
        else ok++;
      } else {
        errors.push(`Player not found: ${row.player_name}`);
      }
    }

    setUploadResult({ ok, errors });
    if (ok > 0) {
      toast({ title: `${ok} price${ok > 1 ? "s" : ""} updated for Round ${round}` });
    } else {
      toast({ title: "No prices updated", variant: "destructive" });
    }
    setUploadingPrices(false);
  };

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

      {/* ── Fantasy Price Upload ───────────────────────────────────────────── */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <DollarSign className="h-4 w-4 text-muted-foreground" />
            Fantasy Price Upload
          </CardTitle>
          <p className="text-xs text-muted-foreground mt-0.5">
            Paste player prices in CSV format. Matches by player name and upserts into Round prices.
          </p>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center gap-3">
            <div className="flex-1">
              <label className="text-xs text-muted-foreground mb-1 block">Round Number</label>
              <input
                type="number"
                min={0}
                max={30}
                placeholder="e.g. 1"
                value={priceRound}
                onChange={(e) => setPriceRound(e.target.value)}
                className="w-full rounded-md border border-input bg-background px-3 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
              />
            </div>
          </div>

          <div>
            <label className="text-xs text-muted-foreground mb-1 block">
              Paste CSV — one player per line: <code className="text-xs bg-muted px-1 rounded">Player Name,Price</code>
            </label>
            <textarea
              value={priceText}
              onChange={(e) => setPriceText(e.target.value)}
              placeholder={"Marcus Bontempelli,1054000\nNick Daicos,987000\nMax Gawn,921000"}
              rows={8}
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm font-mono focus:outline-none focus:ring-1 focus:ring-ring resize-y"
            />
          </div>

          <Button
            onClick={handlePriceUpload}
            disabled={uploadingPrices || !priceText.trim() || !priceRound}
            className="w-full sm:w-auto"
          >
            {uploadingPrices ? (
              <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <Upload className="h-4 w-4 mr-2" />
            )}
            Upload Prices
          </Button>

          {uploadResult && (
            <div className="space-y-2">
              {uploadResult.ok > 0 && (
                <div className="flex items-center gap-2 text-sm text-emerald-600">
                  <CheckCircle className="h-4 w-4 shrink-0" />
                  {uploadResult.ok} player{uploadResult.ok > 1 ? "s" : ""} updated successfully
                </div>
              )}
              {uploadResult.errors.length > 0 && (
                <div className="rounded-md border border-destructive/30 bg-destructive/5 p-3 space-y-1">
                  <div className="flex items-center gap-2 text-xs font-semibold text-destructive">
                    <AlertCircle className="h-3.5 w-3.5 shrink-0" />
                    {uploadResult.errors.length} issue{uploadResult.errors.length > 1 ? "s" : ""}
                  </div>
                  <ul className="text-xs text-muted-foreground space-y-0.5 max-h-32 overflow-y-auto">
                    {uploadResult.errors.map((e, i) => <li key={i}>{e}</li>)}
                  </ul>
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
