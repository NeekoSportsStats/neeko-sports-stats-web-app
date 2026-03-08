import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/lib/supabaseClient";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { Zap, TrendingUp, Bot, Activity, History, Database, RefreshCw, DollarSign, Upload, CircleCheck as CheckCircle, CircleAlert as AlertCircle, ChartBar as BarChart2, Grid2x2 as Grid } from "lucide-react";
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

  const handleRefreshMarketWatch = async () => {
    setRunning("market_watch");
    try {
      const { error } = await supabase.rpc("fn_refresh_market_watch");
      if (error) throw error;
      toast({ title: "Market Watch refreshed successfully" });
    } catch (err) {
      toast({
        title: "Market Watch refresh failed",
        description: err instanceof Error ? err.message : "Unknown error",
        variant: "destructive",
      });
    } finally {
      setRunning(null);
    }
  };

  const handleRefreshEdgeBoard = async () => {
    setRunning("edge_board");
    try {
      const { error } = await supabase.rpc("fn_refresh_edge_board");
      if (error) throw error;
      toast({ title: "Edge Board refreshed successfully" });
    } catch (err) {
      toast({
        title: "Edge Board refresh failed",
        description: err instanceof Error ? err.message : "Unknown error",
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

  interface PriceUploadResult {
    rows_updated: number;
    rows_not_found: number;
    unmatched: string[];
    rows_skipped: number;
  }
  const [uploadResult, setUploadResult] = useState<PriceUploadResult | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);

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
    setUploadError(null);

    const lines = priceText.trim().split("\n").map((l) => l.trim()).filter(Boolean);
    const priceRows: { player_name: string; price: number }[] = [];

    for (const line of lines) {
      const parts = line.split(",");
      if (parts.length < 2) continue;
      const rawName = parts.slice(0, -1).join(",").trim();
      const rawPrice = parts[parts.length - 1].replace(/[^0-9]/g, "");
      const price = parseInt(rawPrice, 10);
      if (!rawName || isNaN(price) || price < 100000) continue;
      priceRows.push({ player_name: rawName, price });
    }

    if (priceRows.length === 0) {
      toast({ title: "No valid rows found. Check format: Player Name,Price", variant: "destructive" });
      setUploadingPrices(false);
      return;
    }

    try {
      const { data, error } = await supabase.rpc("admin_update_fantasy_prices", {
        price_rows: priceRows,
        p_round: round,
      });

      if (error) throw error;

      const result = data as { success: boolean; error?: string } & PriceUploadResult;

      if (!result.success) {
        setUploadError(result.error ?? "Unknown error");
        toast({ title: "Price update failed", variant: "destructive" });
      } else {
        setUploadResult({
          rows_updated:   result.rows_updated   ?? 0,
          rows_not_found: result.rows_not_found ?? 0,
          unmatched:      result.unmatched      ?? [],
          rows_skipped:   result.rows_skipped   ?? 0,
        });
        const updated = result.rows_updated ?? 0;
        if (updated > 0) {
          toast({ title: `${updated} price${updated !== 1 ? "s" : ""} updated for Round ${round} — Market Watch and Edge Board refreshed` });
        } else {
          toast({ title: "No prices matched. Check player names.", variant: "destructive" });
        }
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Unknown error";
      setUploadError(msg);
      toast({ title: "Price update failed", description: msg, variant: "destructive" });
    } finally {
      setUploadingPrices(false);
    }
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
              onClick={handleRefreshMarketWatch}
              disabled={isRunning}
              variant="outline"
              className="w-full"
            >
              {running === "market_watch" ? (
                <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <BarChart2 className="h-4 w-4 mr-2" />
              )}
              Refresh Market Watch
            </Button>

            <Button
              onClick={handleRefreshEdgeBoard}
              disabled={isRunning}
              variant="outline"
              className="w-full"
            >
              {running === "edge_board" ? (
                <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Grid className="h-4 w-4 mr-2" />
              )}
              Refresh Edge Board
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
          <p className="text-xs text-muted-foreground mt-1">
            Paste player prices below. The system will update{" "}
            <code className="text-[11px] bg-muted px-1 rounded">afl_player_prices</code>, then automatically
            refresh Market Watch and Edge Board.
          </p>
        </CardHeader>
        <CardContent className="space-y-4">

          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1.5 block">Round Number</label>
              <input
                type="number"
                min={0}
                max={30}
                placeholder="e.g. 1"
                value={priceRound}
                onChange={(e) => { setPriceRound(e.target.value); setUploadResult(null); setUploadError(null); }}
                className="w-full rounded-md border border-input bg-background px-3 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
              />
            </div>
            <div className="sm:col-span-2 sm:hidden" />
          </div>

          <div>
            <label className="text-xs font-medium text-muted-foreground mb-1.5 block">
              Player Prices — one per line: <code className="text-[11px] bg-muted px-1 rounded">Player Name,Price</code>
            </label>
            <textarea
              value={priceText}
              onChange={(e) => { setPriceText(e.target.value); setUploadResult(null); setUploadError(null); }}
              placeholder={"Marcus Bontempelli,1054000\nNick Daicos,987000\nMax Gawn,921000"}
              rows={10}
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm font-mono focus:outline-none focus:ring-1 focus:ring-ring resize-y"
            />
            {priceText.trim() && (
              <p className="text-[11px] text-muted-foreground mt-1">
                {priceText.trim().split("\n").filter((l) => l.trim() && l.includes(",")).length} rows detected
              </p>
            )}
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
            Update Prices
          </Button>

          {uploadError && (
            <div className="flex items-start gap-2 rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2.5">
              <AlertCircle className="h-4 w-4 shrink-0 text-destructive mt-0.5" />
              <p className="text-xs text-destructive">{uploadError}</p>
            </div>
          )}

          {uploadResult && !uploadError && (
            <div className="space-y-2.5">
              {uploadResult.rows_updated > 0 && (
                <div className="flex items-center gap-2 rounded-md border border-emerald-500/30 bg-emerald-500/5 px-3 py-2.5">
                  <CheckCircle className="h-4 w-4 shrink-0 text-emerald-500" />
                  <div>
                    <p className="text-sm font-medium text-emerald-600">
                      {uploadResult.rows_updated} price{uploadResult.rows_updated !== 1 ? "s" : ""} updated
                    </p>
                    <p className="text-[11px] text-muted-foreground mt-0.5">
                      Market Watch and Edge Board have been refreshed automatically.
                    </p>
                  </div>
                </div>
              )}
              {uploadResult.rows_not_found > 0 && uploadResult.unmatched.length > 0 && (
                <div className="rounded-md border border-amber-500/30 bg-amber-500/5 p-3 space-y-1.5">
                  <div className="flex items-center gap-2 text-xs font-semibold text-amber-600">
                    <AlertCircle className="h-3.5 w-3.5 shrink-0" />
                    {uploadResult.rows_not_found} player{uploadResult.rows_not_found !== 1 ? "s" : ""} not found
                  </div>
                  <ul className="text-xs text-muted-foreground space-y-0.5 max-h-36 overflow-y-auto font-mono">
                    {uploadResult.unmatched.map((name, i) => (
                      <li key={i} className="pl-1">{name}</li>
                    ))}
                  </ul>
                  <p className="text-[11px] text-muted-foreground">
                    Check spelling — names must match exactly (case-insensitive).
                  </p>
                </div>
              )}
              {uploadResult.rows_skipped > 0 && (
                <p className="text-[11px] text-muted-foreground">
                  {uploadResult.rows_skipped} row{uploadResult.rows_skipped !== 1 ? "s" : ""} skipped (invalid format or price below 100,000).
                </p>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
