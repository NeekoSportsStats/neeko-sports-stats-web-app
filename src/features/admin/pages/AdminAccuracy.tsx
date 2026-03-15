import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabaseClient";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { RefreshCw, Target, TrendingUp, Award, TriangleAlert as AlertTriangle, ChartBar as BarChart3 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  ScatterChart,
  Scatter,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
  ReferenceLine,
} from "recharts";

// ─── Types ─────────────────────────────────────────────────────────────────────

interface AccuracySummary {
  mean_absolute_error: number | null;
  median_absolute_error: number | null;
  within_10_pct: number | null;
  within_20_pct: number | null;
  total_predictions: number | null;
  players_analysed: number | null;
}

interface RoundAccuracy {
  round_number: number;
  round_label: string;
  mean_error: number | null;
  median_error: number | null;
  within_10_pct: number | null;
  within_20_pct: number | null;
  games_count: number | null;
  predictions_count: number | null;
}

interface PredictionResult {
  player_id: number | null;
  player_name: string;
  team: string;
  game_id: number | null;
  round_label: string;
  projection: number | null;
  actual_score: number | null;
  error: number | null;
  absolute_error: number | null;
}

interface ErrorBand {
  band: string;
  sort_order: number;
  pct: number | null;
}

interface PositionAccuracy {
  position_group: string;
  mean_absolute_error: number | null;
  median_absolute_error: number | null;
  rmse: number | null;
  within_10_pct: number | null;
  within_20_pct: number | null;
  predictions_count: number | null;
  players_count: number | null;
}

// ─── Helpers ────────────────────────────────────────────────────────────────────

function fmt(n: number | null | undefined, suffix = "", dp = 1) {
  if (n == null) return "—";
  return `${Number(n).toFixed(dp)}${suffix}`;
}

function errorColor(abs: number | null) {
  if (abs == null) return "#6b7280";
  if (abs <= 10) return "#10b981";
  if (abs <= 20) return "#f59e0b";
  return "#ef4444";
}

// ─── Sub-components ──────────────────────────────────────────────────────────

function StatCard({
  label,
  value,
  sub,
  icon: Icon,
  color,
}: {
  label: string;
  value: string;
  sub?: string;
  icon: React.ElementType;
  color: string;
}) {
  return (
    <Card className="bg-card border-border">
      <CardContent className="p-4">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-xs text-muted-foreground font-medium">{label}</p>
            <p className="text-2xl font-bold mt-1" style={{ color }}>{value}</p>
            {sub && <p className="text-xs text-muted-foreground mt-0.5">{sub}</p>}
          </div>
          <div className="p-2 rounded-lg bg-muted/30">
            <Icon className="h-4 w-4 text-muted-foreground" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function PredictionTable({
  title,
  rows,
  emptyLabel,
}: {
  title: string;
  rows: PredictionResult[];
  emptyLabel: string;
}) {
  return (
    <Card className="bg-card border-border">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-semibold text-foreground">{title}</CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        {rows.length === 0 ? (
          <p className="text-xs text-muted-foreground px-4 pb-4">{emptyLabel}</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-border">
                  <th className="text-left px-4 py-2 text-muted-foreground font-medium">Player</th>
                  <th className="text-right px-4 py-2 text-muted-foreground font-medium">Proj</th>
                  <th className="text-right px-4 py-2 text-muted-foreground font-medium">Actual</th>
                  <th className="text-right px-4 py-2 text-muted-foreground font-medium">Error</th>
                  <th className="text-left px-4 py-2 text-muted-foreground font-medium">Round</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r, i) => (
                  <tr key={i} className="border-b border-border/50 hover:bg-muted/20 transition-colors">
                    <td className="px-4 py-2">
                      <span className="font-medium text-foreground">{r.player_name}</span>
                      <span className="ml-1.5 text-muted-foreground">{r.team}</span>
                    </td>
                    <td className="px-4 py-2 text-right text-muted-foreground">{fmt(r.projection, "", 0)}</td>
                    <td className="px-4 py-2 text-right font-medium text-foreground">{fmt(r.actual_score, "", 0)}</td>
                    <td className="px-4 py-2 text-right">
                      <span
                        className="font-semibold tabular-nums"
                        style={{ color: errorColor(r.absolute_error) }}
                      >
                        {r.absolute_error != null ? `±${Math.round(r.absolute_error)}` : "—"}
                      </span>
                    </td>
                    <td className="px-4 py-2 text-muted-foreground">{r.round_label}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ─── Main Component ─────────────────────────────────────────────────────────────

export default function AdminAccuracy() {
  const [summary, setSummary] = useState<AccuracySummary | null>(null);
  const [rounds, setRounds] = useState<RoundAccuracy[]>([]);
  const [best, setBest] = useState<PredictionResult[]>([]);
  const [worst, setWorst] = useState<PredictionResult[]>([]);
  const [recent, setRecent] = useState<PredictionResult[]>([]);
  const [errorBands, setErrorBands] = useState<ErrorBand[]>([]);
  const [positionAccuracy, setPositionAccuracy] = useState<PositionAccuracy[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = async () => {
    setRefreshing(true);
    try {
      const [sumRes, roundRes, bestRes, worstRes, recentRes, bandsRes, posRes] = await Promise.all([
        supabase.from("v_projection_accuracy_summary").select("*").maybeSingle(),
        supabase.from("v_projection_accuracy_by_round").select("*").order("round_number"),
        supabase.from("v_projection_accuracy_best").select("*").limit(10),
        supabase.from("v_projection_accuracy_worst").select("*").limit(10),
        supabase.from("v_projection_results").select("*").limit(20),
        supabase.schema("afl" as never).from("v_projection_error_distribution").select("*").order("sort_order"),
        supabase.from("v_projection_accuracy_by_position").select("*"),
      ]);

      if (sumRes.data)  setSummary(sumRes.data as AccuracySummary);
      if (roundRes.data)  setRounds(roundRes.data as RoundAccuracy[]);
      if (bestRes.data)   setBest(bestRes.data as PredictionResult[]);
      if (worstRes.data)  setWorst(worstRes.data as PredictionResult[]);
      if (recentRes.data) setRecent(recentRes.data as PredictionResult[]);
      if (bandsRes.data)  setErrorBands(bandsRes.data as ErrorBand[]);
      if (posRes.data)    setPositionAccuracy(posRes.data as PositionAccuracy[]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => { load(); }, []);

  const noData = !loading && !summary && rounds.length === 0;

  return (
    <div className="space-y-6 p-4 md:p-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-bold text-foreground">Projection Accuracy</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Model credibility — predicted vs actual scores
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={load}
          disabled={refreshing}
          className="gap-1.5"
        >
          <RefreshCw className={`h-3.5 w-3.5 ${refreshing ? "animate-spin" : ""}`} />
          Refresh
        </Button>
      </div>

      {noData && (
        <Card className="bg-card border-border">
          <CardContent className="p-8 text-center">
            <BarChart3 className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
            <p className="text-sm text-muted-foreground">No accuracy data yet.</p>
            <p className="text-xs text-muted-foreground mt-1">
              Data populates once completed games with stored projections are available.
            </p>
          </CardContent>
        </Card>
      )}

      {/* Summary Cards */}
      {summary && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <StatCard
            label="Season MAE"
            value={fmt(summary.mean_absolute_error, " pts")}
            sub="Mean absolute error"
            icon={Target}
            color="#f59e0b"
          />
          <StatCard
            label="Median Error"
            value={fmt(summary.median_absolute_error, " pts")}
            sub="Median absolute error"
            icon={BarChart3}
            color="#60a5fa"
          />
          <StatCard
            label="Within 10 pts"
            value={fmt(summary.within_10_pct, "%", 1)}
            sub={`of ${summary.total_predictions ?? 0} predictions`}
            icon={Award}
            color="#10b981"
          />
          <StatCard
            label="Within 20 pts"
            value={fmt(summary.within_20_pct, "%", 1)}
            sub={`${summary.players_analysed ?? 0} players analysed`}
            icon={TrendingUp}
            color="#8b5cf6"
          />
        </div>
      )}

      {/* Charts Row */}
      {(rounds.length > 0 || errorBands.length > 0) && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {/* Round Accuracy Trend */}
          {rounds.length > 0 && (
            <Card className="bg-card border-border">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-semibold text-foreground">
                  Round Accuracy Trend
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={200}>
                  <LineChart data={rounds} margin={{ top: 4, right: 8, bottom: 0, left: -16 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.4} />
                    <XAxis
                      dataKey="round_label"
                      tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }}
                      tickLine={false}
                    />
                    <YAxis
                      tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }}
                      tickLine={false}
                      axisLine={false}
                    />
                    <Tooltip
                      contentStyle={{
                        background: "hsl(var(--card))",
                        border: "1px solid hsl(var(--border))",
                        borderRadius: 6,
                        fontSize: 11,
                      }}
                      labelStyle={{ color: "hsl(var(--foreground))" }}
                    />
                    <ReferenceLine y={10} stroke="#10b981" strokeDasharray="3 3" opacity={0.5} />
                    <Line
                      type="monotone"
                      dataKey="mean_error"
                      name="MAE"
                      stroke="#f59e0b"
                      strokeWidth={2}
                      dot={{ r: 3, fill: "#f59e0b" }}
                    />
                    <Line
                      type="monotone"
                      dataKey="median_error"
                      name="Median"
                      stroke="#60a5fa"
                      strokeWidth={2}
                      dot={{ r: 3, fill: "#60a5fa" }}
                    />
                  </LineChart>
                </ResponsiveContainer>
                <p className="text-[10px] text-muted-foreground mt-1 text-center">
                  Green dashed = 10pt target
                </p>
              </CardContent>
            </Card>
          )}

          {/* Error Distribution */}
          {errorBands.length > 0 && (
            <Card className="bg-card border-border">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-semibold text-foreground">
                  Error Distribution
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={200}>
                  <BarChart data={errorBands} margin={{ top: 4, right: 8, bottom: 0, left: -16 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.4} />
                    <XAxis
                      dataKey="band"
                      tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }}
                      tickLine={false}
                    />
                    <YAxis
                      tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }}
                      tickLine={false}
                      axisLine={false}
                      tickFormatter={(v) => `${v}%`}
                    />
                    <Tooltip
                      contentStyle={{
                        background: "hsl(var(--card))",
                        border: "1px solid hsl(var(--border))",
                        borderRadius: 6,
                        fontSize: 11,
                      }}
                      formatter={(v: number) => [`${v}%`, "Share"]}
                    />
                    <Bar dataKey="pct" name="%" radius={[4, 4, 0, 0]}>
                      {errorBands.map((band, i) => (
                        <Cell
                          key={i}
                          fill={
                            i === 0 ? "#10b981" :
                            i === 1 ? "#f59e0b" :
                            i === 2 ? "#f97316" : "#ef4444"
                          }
                        />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          )}
        </div>
      )}

      {/* Round Accuracy Table */}
      {rounds.length > 0 && (
        <Card className="bg-card border-border">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold text-foreground">Round Breakdown</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-border">
                    <th className="text-left px-4 py-2 text-muted-foreground font-medium">Round</th>
                    <th className="text-right px-4 py-2 text-muted-foreground font-medium">MAE</th>
                    <th className="text-right px-4 py-2 text-muted-foreground font-medium">Median</th>
                    <th className="text-right px-4 py-2 text-muted-foreground font-medium">Within 10%</th>
                    <th className="text-right px-4 py-2 text-muted-foreground font-medium">Within 20%</th>
                    <th className="text-right px-4 py-2 text-muted-foreground font-medium">Games</th>
                    <th className="text-right px-4 py-2 text-muted-foreground font-medium">Preds</th>
                  </tr>
                </thead>
                <tbody>
                  {rounds.map((r, i) => (
                    <tr key={i} className="border-b border-border/50 hover:bg-muted/20 transition-colors">
                      <td className="px-4 py-2 font-medium text-foreground">{r.round_label}</td>
                      <td className="px-4 py-2 text-right">
                        <span style={{ color: (r.mean_error ?? 99) <= 10 ? "#10b981" : (r.mean_error ?? 99) <= 15 ? "#f59e0b" : "#ef4444" }}>
                          {fmt(r.mean_error, " pts")}
                        </span>
                      </td>
                      <td className="px-4 py-2 text-right text-muted-foreground">{fmt(r.median_error, " pts")}</td>
                      <td className="px-4 py-2 text-right">
                        <Badge
                          variant="outline"
                          className="text-[10px]"
                          style={{
                            borderColor: (r.within_10_pct ?? 0) >= 60 ? "#10b981" : "#f59e0b",
                            color: (r.within_10_pct ?? 0) >= 60 ? "#10b981" : "#f59e0b",
                          }}
                        >
                          {fmt(r.within_10_pct, "%", 0)}
                        </Badge>
                      </td>
                      <td className="px-4 py-2 text-right text-muted-foreground">{fmt(r.within_20_pct, "%", 0)}</td>
                      <td className="px-4 py-2 text-right text-muted-foreground">{r.games_count ?? "—"}</td>
                      <td className="px-4 py-2 text-right text-muted-foreground">{r.predictions_count ?? "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Recent Results + Best/Worst tables */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <PredictionTable
          title="Top 10 Best Predictions"
          rows={best}
          emptyLabel="No data yet."
        />
        <PredictionTable
          title="Top 10 Worst Predictions"
          rows={worst}
          emptyLabel="No data yet."
        />
      </div>

      {recent.length > 0 && (
        <PredictionTable
          title="Recent Prediction Results"
          rows={recent}
          emptyLabel="No recent data."
        />
      )}

      {/* Position Accuracy Breakdown */}
      {positionAccuracy.length > 0 && (
        <Card className="bg-card border-border">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold text-foreground">Accuracy by Position</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-border">
                    <th className="text-left px-4 py-2 text-muted-foreground font-medium">Position</th>
                    <th className="text-right px-4 py-2 text-muted-foreground font-medium">MAE</th>
                    <th className="text-right px-4 py-2 text-muted-foreground font-medium">Median</th>
                    <th className="text-right px-4 py-2 text-muted-foreground font-medium">RMSE</th>
                    <th className="text-right px-4 py-2 text-muted-foreground font-medium">Within 10</th>
                    <th className="text-right px-4 py-2 text-muted-foreground font-medium">Within 20</th>
                    <th className="text-right px-4 py-2 text-muted-foreground font-medium">Players</th>
                    <th className="text-right px-4 py-2 text-muted-foreground font-medium">Preds</th>
                  </tr>
                </thead>
                <tbody>
                  {positionAccuracy.map((p, i) => (
                    <tr key={i} className="border-b border-border/50 hover:bg-muted/20 transition-colors">
                      <td className="px-4 py-2">
                        <span className="inline-flex items-center rounded-md border px-2 py-0.5 text-[10px] font-semibold"
                          style={{
                            color: p.position_group === "MID" ? "#60a5fa" :
                                   p.position_group === "FWD" ? "#f59e0b" :
                                   p.position_group === "DEF" ? "#10b981" :
                                   p.position_group === "RUC" ? "#a78bfa" : "#9ca3af",
                            borderColor: p.position_group === "MID" ? "#60a5fa40" :
                                         p.position_group === "FWD" ? "#f59e0b40" :
                                         p.position_group === "DEF" ? "#10b98140" :
                                         p.position_group === "RUC" ? "#a78bfa40" : "#9ca3af40",
                            background: p.position_group === "MID" ? "#60a5fa12" :
                                        p.position_group === "FWD" ? "#f59e0b12" :
                                        p.position_group === "DEF" ? "#10b98112" :
                                        p.position_group === "RUC" ? "#a78bfa12" : "#9ca3af12",
                          }}
                        >
                          {p.position_group}
                        </span>
                      </td>
                      <td className="px-4 py-2 text-right">
                        <span style={{ color: errorColor(p.mean_absolute_error) }}>
                          {fmt(p.mean_absolute_error, " pts")}
                        </span>
                      </td>
                      <td className="px-4 py-2 text-right text-muted-foreground">
                        {fmt(p.median_absolute_error, " pts")}
                      </td>
                      <td className="px-4 py-2 text-right text-muted-foreground">
                        {fmt(p.rmse, " pts")}
                      </td>
                      <td className="px-4 py-2 text-right">
                        <Badge
                          variant="outline"
                          className="text-[10px]"
                          style={{
                            borderColor: (p.within_10_pct ?? 0) >= 60 ? "#10b981" : "#f59e0b",
                            color: (p.within_10_pct ?? 0) >= 60 ? "#10b981" : "#f59e0b",
                          }}
                        >
                          {fmt(p.within_10_pct, "%", 0)}
                        </Badge>
                      </td>
                      <td className="px-4 py-2 text-right text-muted-foreground">
                        {fmt(p.within_20_pct, "%", 0)}
                      </td>
                      <td className="px-4 py-2 text-right text-muted-foreground">{p.players_count ?? "—"}</td>
                      <td className="px-4 py-2 text-right text-muted-foreground">{p.predictions_count ?? "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Scatter: Projection vs Actual */}
      {recent.filter(r => r.projection != null && r.actual_score != null).length > 4 && (
        <Card className="bg-card border-border">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold text-foreground">
              Projection vs Actual (Recent Games)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={240}>
              <ScatterChart margin={{ top: 4, right: 16, bottom: 8, left: -8 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.4} />
                <XAxis
                  type="number"
                  dataKey="projection"
                  name="Projected"
                  tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }}
                  tickLine={false}
                  label={{ value: "Projected", offset: -4, position: "insideBottom", fontSize: 10, fill: "hsl(var(--muted-foreground))" }}
                />
                <YAxis
                  type="number"
                  dataKey="actual_score"
                  name="Actual"
                  tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }}
                  tickLine={false}
                  axisLine={false}
                  label={{ value: "Actual", angle: -90, position: "insideLeft", fontSize: 10, fill: "hsl(var(--muted-foreground))" }}
                />
                <Tooltip
                  cursor={{ strokeDasharray: "3 3" }}
                  contentStyle={{
                    background: "hsl(var(--card))",
                    border: "1px solid hsl(var(--border))",
                    borderRadius: 6,
                    fontSize: 11,
                  }}
                  formatter={(v, name) => [Math.round(Number(v)), name]}
                />
                <ReferenceLine
                  segment={[{ x: 40, y: 40 }, { x: 180, y: 180 }]}
                  stroke="#10b981"
                  strokeDasharray="3 3"
                  opacity={0.5}
                />
                <Scatter
                  data={recent.filter(r => r.projection != null && r.actual_score != null)}
                  fill="#f59e0b"
                  opacity={0.7}
                />
              </ScatterChart>
            </ResponsiveContainer>
            <p className="text-[10px] text-muted-foreground mt-1 text-center">
              Green dashed = perfect prediction line
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
