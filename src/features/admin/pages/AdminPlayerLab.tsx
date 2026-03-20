import { useState, useEffect, useCallback, useMemo } from "react";
import { supabase } from "@/lib/supabaseClient";
import { RefreshCw, Users, TrendingUp, DollarSign, Target, ChevronUp, ChevronDown, ChevronsUpDown, Search, Flame, Gem, Crown, Shield, TriangleAlert as AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { AdminSectionIntro, AdminInfoTooltip } from "@/features/admin/shared/AdminExplain";
import { FantasyPricesTab } from "@/features/admin/price-ingest/FantasyPricesTab";
import { NameResolverTab } from "@/features/admin/price-ingest/NameResolverTab";
import { PriceChangeDebugTab } from "@/features/admin/price-ingest/PriceChangeDebugTab";
import { FantasyPlayerMatchingTab } from "@/features/admin/price-ingest/FantasyPlayerMatchingTab";
import {
  BarChart, Bar,
  XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip,
  ResponsiveContainer, Cell,
} from "recharts";

// ─── Types ───────────────────────────────────────────────────────────────────

type Tab = "explorer" | "accuracy" | "pricing" | "signals";
type SortDir = "asc" | "desc";

interface PlayerRow {
  player_id: number;
  player_name: string;
  team: string;
  position: string;
  projection_final: number;
  projection: number;
  ceiling: number;
  floor: number;
  price: number;
  neeko_rating: number;
  neeko_rating_scaled: number;
  value_score: number;
  value_tag: string;
  consistency: number;
  form_score: number;
  captain_score: number;
  captain_rating: string;
  upside_rating: number;
  upside_pct: number;
  risk_rating: number;
  matchup_rating: string;
  matchup_multiplier: number;
  matchup_label: string;
  ai_recommendation: string;
  recommendation_color: string;
  recommendation_short: string;
  market_watch_category: string;
  best_value_score: number;
  confidence_label: string;
  edge_score: number;
  edge_tier: string;
  start_sit_decision: string;
  recommendation_strength: string;
  games_played: number;
  consistency_tier: string;
}

interface AccuracyKpi {
  players_analysed: number | null;
  avg_error: number | null;
  median_error: number | null;
  within_10: number | null;
  within_15: number | null;
  within_20: number | null;
  latest_round: number | null;
  source: string | null;
}

interface RoundRow {
  round_number: number;
  round_label: string;
  mean_error: number;
  median_error: number;
  within_10_pct: number;
  within_20_pct: number;
  predictions_count: number;
}

interface PositionRow {
  position_group: string;
  mean_absolute_error: number;
  median_absolute_error: number;
  rmse: number;
  within_10_pct: number;
  within_20_pct: number;
  predictions_count: number;
  players_count: number;
}

// ─── Signal view types ────────────────────────────────────────────────────────

interface LabPlayerRow {
  player_id: number;
  player_name: string;
  team: string;
  position: string;
  projection: number;
  ceiling: number;
  floor: number;
  price: number;
  value_score: number;
  neeko_rating: number;
  form_score: number;
  consistency: number;
  upside_pct: number;
  captain_score: number;
  captain_rating: string;
  matchup_label: string;
  recommendation_short: string;
  recommendation_color: string;
  confidence_label: string;
  buy_score: number;
  opportunity_score: number;
  risk_score: number;
  total_score: number;
  signal_count: number;
  signal_tags: string[];
  composite_label: string;
  breakout_probability?: number;
  breakout_index?: number;
  ceiling_hit_rate?: number;
  recent_trend?: string;
  sell_score?: number;
}

// ─── Sub-tab config ───────────────────────────────────────────────────────────

const TABS: { id: Tab; label: string; icon: React.ElementType }[] = [
  { id: "explorer",  label: "Player Explorer", icon: Users },
  { id: "accuracy",  label: "Accuracy",        icon: Target },
  { id: "pricing",   label: "Pricing",         icon: DollarSign },
  { id: "signals",   label: "Signals",         icon: TrendingUp },
];

// ─── Shared helpers ───────────────────────────────────────────────────────────

function fmtNum(n: number | null | undefined, dec = 1) {
  if (n == null) return "—";
  return n.toFixed(dec);
}

function fmtPrice(n: number | null | undefined) {
  if (n == null) return "—";
  return "$" + (n / 1000).toFixed(0) + "k";
}

function pct(n: number | null | undefined) {
  if (n == null) return "—";
  return (n * 100).toFixed(0) + "%";
}

// ─── Recommendation badge ─────────────────────────────────────────────────────

function RecoBadge({ color, short }: { color: string; short: string }) {
  const cls =
    color === "green"  ? "bg-emerald-500/15 text-emerald-400 border-emerald-500/25" :
    color === "red"    ? "bg-red-500/15 text-red-400 border-red-500/25" :
    color === "yellow" ? "bg-amber-500/15 text-amber-400 border-amber-500/25" :
                         "bg-muted/40 text-muted-foreground border-border/40";
  return (
    <span className={`inline-flex text-[10px] font-semibold px-1.5 py-0.5 rounded border whitespace-nowrap ${cls}`}>
      {short || "—"}
    </span>
  );
}

// ─── Sort icon ────────────────────────────────────────────────────────────────

function SortIcon({ col, activeCol, dir }: { col: string; activeCol: string; dir: SortDir }) {
  if (col !== activeCol) return <ChevronsUpDown className="h-3 w-3 text-muted-foreground/50" />;
  return dir === "asc" ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />;
}

// ─── Player Explorer Tab ──────────────────────────────────────────────────────

function PlayerExplorerTab() {
  const [rows, setRows] = useState<PlayerRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [posFilter, setPosFilter] = useState("ALL");
  const [teamFilter, setTeamFilter] = useState("ALL");
  const [recoFilter, setRecoFilter] = useState("ALL");
  const [sortCol, setSortCol] = useState<string>("neeko_rating");
  const [sortDir, setSortDir] = useState<SortDir>("desc");

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("v_player_lab_explorer")
        .select("*")
        .order("neeko_rating", { ascending: false })
        .limit(1000);
      console.log("Player Lab explorer:", data?.length, "rows | error:", error);
      setRows((data as PlayerRow[]) ?? []);
    } catch (err) {
      console.error("Player Lab explorer fetch failed:", err);
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  useEffect(() => {
    const handler = () => fetchData();
    window.addEventListener("neeko:prices-applied", handler);
    return () => window.removeEventListener("neeko:prices-applied", handler);
  }, [fetchData]);

  const positions = useMemo(() => ["ALL", ...Array.from(new Set(rows.map(r => r.position).filter(Boolean))).sort()], [rows]);
  const teams = useMemo(() => ["ALL", ...Array.from(new Set(rows.map(r => r.team).filter(Boolean))).sort()], [rows]);
  const recos = useMemo(() => ["ALL", ...Array.from(new Set(rows.map(r => r.ai_recommendation).filter(Boolean))).sort()], [rows]);

  const filtered = useMemo(() => {
    let res = rows;
    if (search) res = res.filter(r => r.player_name?.toLowerCase().includes(search.toLowerCase()) || r.team?.toLowerCase().includes(search.toLowerCase()));
    if (posFilter !== "ALL") res = res.filter(r => r.position === posFilter);
    if (teamFilter !== "ALL") res = res.filter(r => r.team === teamFilter);
    if (recoFilter !== "ALL") res = res.filter(r => r.ai_recommendation === recoFilter);
    return [...res].sort((a, b) => {
      const av = (a as Record<string, unknown>)[sortCol] as number ?? 0;
      const bv = (b as Record<string, unknown>)[sortCol] as number ?? 0;
      return sortDir === "asc" ? av - bv : bv - av;
    });
  }, [rows, search, posFilter, teamFilter, recoFilter, sortCol, sortDir]);

  function handleSort(col: string) {
    if (col === sortCol) setSortDir(d => d === "asc" ? "desc" : "asc");
    else { setSortCol(col); setSortDir("desc"); }
  }

  const cols: { key: string; label: string; explain?: string }[] = [
    { key: "player_name",        label: "Player" },
    { key: "position",           label: "Pos" },
    { key: "team",               label: "Team" },
    { key: "projection_final",   label: "Proj",     explain: "Final blended projection including matchup and role multipliers" },
    { key: "ceiling",            label: "Ceil",     explain: "85th percentile outcome from recent 10 games" },
    { key: "floor",              label: "Floor",    explain: "15th percentile outcome from recent 10 games" },
    { key: "neeko_rating",       label: "Rating",   explain: "Neeko composite rating (0-100) blending projection, form, value, consistency" },
    { key: "value_score",        label: "Value",    explain: "Value score: projected points per $100k of price. Higher = better value" },
    { key: "consistency",        label: "Cons%",    explain: "Consistency: fraction of recent games above their own average" },
    { key: "captain_score",      label: "Cap",      explain: "Captain score: upside-weighted rating for captaincy decisions" },
    { key: "upside_pct",         label: "Upside%",  explain: "Probability of exceeding projection by >10%" },
    { key: "matchup_multiplier", label: "Matchup",  explain: "Opponent difficulty multiplier (1.0 = neutral, >1 = easier)" },
    { key: "edge_score",         label: "Edge",     explain: "Edge score — composite of value, matchup, and upside signals" },
    { key: "best_value_score",   label: "Val Score", explain: "Best value score blending projected return per price tier" },
    { key: "price",              label: "Price" },
    { key: "recommendation_short", label: "Reco" },
  ];

  return (
    <div>
      <AdminSectionIntro
        description="Full player data from afl.player_rankings_cache — the production table driving all rankings and recommendations."
        detail="Filters update in-browser on the 1000-row local dataset. Sort any column by clicking its header. Includes opportunity, risk, and signal scores from the signal engine."
      />

      <div className="flex flex-wrap gap-2 mb-4">
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground pointer-events-none" />
          <input
            className="pl-8 pr-3 py-1.5 rounded-md border border-border bg-background text-xs w-48 focus:outline-none focus:ring-1 focus:ring-ring"
            placeholder="Search player / team…"
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>
        {[
          { label: "Position", opts: positions, val: posFilter, set: setPosFilter },
          { label: "Team",     opts: teams,     val: teamFilter, set: setTeamFilter },
          { label: "Reco",     opts: recos,     val: recoFilter, set: setRecoFilter },
        ].map(({ label, opts, val, set }) => (
          <select
            key={label}
            className="text-xs border border-border rounded-md px-2 py-1.5 bg-background text-foreground"
            value={val}
            onChange={e => set(e.target.value)}
          >
            {opts.map(o => <option key={o} value={o}>{o === "ALL" ? `All ${label}s` : o}</option>)}
          </select>
        ))}
        <Button size="sm" variant="outline" onClick={fetchData} className="ml-auto">
          <RefreshCw className={`h-3.5 w-3.5 mr-1.5 ${loading ? "animate-spin" : ""}`} />
          {loading ? "Loading…" : `Refresh (${filtered.length})`}
        </Button>
      </div>

      <div className="overflow-x-auto rounded-lg border border-border">
        <table className="w-full text-xs">
          <thead>
            <tr className="border-b border-border bg-muted/30">
              {cols.map(c => (
                <th key={c.key} className="px-2 py-2 text-left font-medium text-muted-foreground whitespace-nowrap">
                  <button
                    className="flex items-center gap-1 hover:text-foreground transition-colors"
                    onClick={() => handleSort(c.key)}
                  >
                    {c.label}
                    {c.explain && <AdminInfoTooltip text={c.explain} />}
                    <SortIcon col={c.key} activeCol={sortCol} dir={sortDir} />
                  </button>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={cols.length} className="text-center py-10 text-muted-foreground">Loading…</td></tr>
            ) : filtered.length === 0 ? (
              <tr><td colSpan={cols.length} className="text-center py-10 text-muted-foreground">No players match filters</td></tr>
            ) : filtered.map(r => (
              <tr key={r.player_id} className="border-b border-border/40 hover:bg-muted/20 transition-colors">
                <td className="px-2 py-2 font-medium">{r.player_name}</td>
                <td className="px-2 py-2 text-muted-foreground">{r.position}</td>
                <td className="px-2 py-2 text-muted-foreground">{r.team}</td>
                <td className="px-2 py-2 tabular-nums">{fmtNum(r.projection_final)}</td>
                <td className="px-2 py-2 tabular-nums text-emerald-400">{fmtNum(r.ceiling)}</td>
                <td className="px-2 py-2 tabular-nums text-red-400">{fmtNum(r.floor)}</td>
                <td className="px-2 py-2 tabular-nums font-semibold">{fmtNum(r.neeko_rating)}</td>
                <td className="px-2 py-2 tabular-nums">{fmtNum(r.value_score, 2)}</td>
                <td className="px-2 py-2 tabular-nums">{pct(r.consistency)}</td>
                <td className="px-2 py-2 tabular-nums">{fmtNum(r.captain_score)}</td>
                <td className="px-2 py-2 tabular-nums">{fmtNum(r.upside_pct, 0)}%</td>
                <td className="px-2 py-2 tabular-nums">{fmtNum(r.matchup_multiplier, 2)}x</td>
                <td className="px-2 py-2 tabular-nums text-sky-400">{fmtNum(r.edge_score, 0)}</td>
                <td className="px-2 py-2 tabular-nums text-amber-400">{fmtNum(r.best_value_score, 1)}</td>
                <td className="px-2 py-2 tabular-nums">{fmtPrice(r.price)}</td>
                <td className="px-2 py-2">
                  <RecoBadge color={r.recommendation_color} short={r.recommendation_short} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ─── Accuracy Tab ─────────────────────────────────────────────────────────────

function AccuracyTab() {
  const [kpi, setKpi] = useState<AccuracyKpi | null>(null);
  const [rounds, setRounds] = useState<RoundRow[]>([]);
  const [positions, setPositions] = useState<PositionRow[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(async () => {
    setLoading(true);
    const [kpiRes, roundRes, posRes] = await Promise.allSettled([
      supabase.from("v_projection_accuracy_homepage").select("*").maybeSingle(),
      supabase.from("v_projection_accuracy_by_round").select("round_number,round_label,mean_error,median_error,within_10_pct,within_20_pct,predictions_count").order("round_number", { ascending: false }).limit(12),
      supabase.from("v_projection_accuracy_by_position").select("position_group,mean_absolute_error,median_absolute_error,rmse,within_10_pct,within_20_pct,predictions_count,players_count").order("mean_absolute_error", { ascending: true }),
    ]);
    if (kpiRes.status === "fulfilled") {
      console.log("Accuracy KPI:", kpiRes.value.data, "error:", kpiRes.value.error);
      setKpi(kpiRes.value.data as AccuracyKpi | null);
    }
    if (roundRes.status === "fulfilled") {
      console.log("Accuracy rounds:", roundRes.value.data?.length, "rows | error:", roundRes.value.error);
      setRounds((roundRes.value.data ?? []) as RoundRow[]);
    }
    if (posRes.status === "fulfilled") {
      console.log("Accuracy positions:", posRes.value.data?.length, "rows | error:", posRes.value.error);
      setPositions((posRes.value.data ?? []) as PositionRow[]);
    }
    setLoading(false);
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  const chartData = useMemo(() =>
    [...rounds].reverse().map(r => ({ name: r.round_label ?? `R${r.round_number}`, mae: r.mean_error, w10: +(r.within_10_pct * 100).toFixed(1) })),
    [rounds]
  );

  const MAE_GOOD = 18, MAE_OK = 25;
  const maeColor = (mae: number | null) => mae == null ? "" : mae < MAE_GOOD ? "text-emerald-400" : mae < MAE_OK ? "text-amber-400" : "text-red-400";

  return (
    <div className="space-y-6">
      <AdminSectionIntro
        description="How accurate are the Neeko projection models? MAE = Mean Absolute Error (lower is better). Within 10%/20% = fraction of predictions within that band."
        detail="Data from v_projection_accuracy_homepage, v_projection_accuracy_by_round, and v_projection_accuracy_by_position views. These are refreshed daily by the pipeline."
      />

      {loading ? (
        <div className="flex items-center justify-center py-20"><RefreshCw className="h-5 w-5 animate-spin text-muted-foreground" /></div>
      ) : (
        <>
          {kpi ? (
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
              {[
                { label: "Avg Error (MAE)",    value: fmtNum(kpi.avg_error),          color: maeColor(kpi.avg_error ?? null),    explain: "Mean absolute error across all predictions" },
                { label: "Median Error",       value: fmtNum(kpi.median_error),        color: maeColor(kpi.median_error ?? null), explain: "Median absolute error — less sensitive to outliers" },
                { label: "Within 10pts",       value: pct(kpi.within_10 != null ? kpi.within_10 / 100 : null),   color: "text-emerald-400", explain: "Fraction of predictions within 10 points of actual" },
                { label: "Within 15pts",       value: pct(kpi.within_15 != null ? kpi.within_15 / 100 : null),   color: "text-emerald-400", explain: "Fraction of predictions within 15 points of actual" },
                { label: "Within 20pts",       value: pct(kpi.within_20 != null ? kpi.within_20 / 100 : null),   color: "text-emerald-400", explain: "Fraction of predictions within 20 points of actual" },
                { label: "Players Analysed",   value: kpi.players_analysed ?? "—",    color: "",                                 explain: "Number of unique players with at least one accuracy measurement" },
              ].map(({ label, value, color, explain }) => (
                <div key={label} className="rounded-lg border border-border bg-card p-3">
                  <div className="flex items-center gap-1 text-[11px] text-muted-foreground mb-1">
                    {label}
                    <AdminInfoTooltip text={explain} />
                  </div>
                  <div className={`text-xl font-bold tabular-nums ${color}`}>{value}</div>
                </div>
              ))}
            </div>
          ) : (
            <div className="rounded-lg border border-border bg-card p-4 text-sm text-muted-foreground">
              No accuracy summary data found. Run the accuracy pipeline to generate projections.
              <Button size="sm" variant="outline" onClick={fetchData} className="ml-3">
                <RefreshCw className="h-3.5 w-3.5 mr-1.5" /> Retry
              </Button>
            </div>
          )}

          {chartData.length > 0 && (
            <div>
              <div className="flex items-center gap-2 mb-3">
                <h3 className="text-sm font-medium">MAE by Round</h3>
                <AdminInfoTooltip text="Lower MAE is better. Green bars are under 18 (good), amber under 25 (ok), red above 25 (needs work)." />
              </div>
              <div className="h-48 rounded-lg border border-border bg-card p-3">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={chartData} margin={{ top: 4, right: 8, left: -20, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
                    <XAxis dataKey="name" tick={{ fontSize: 10 }} />
                    <YAxis tick={{ fontSize: 10 }} />
                    <RechartsTooltip contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 6, fontSize: 12 }} />
                    <Bar dataKey="mae" name="MAE" radius={[3, 3, 0, 0]}>
                      {chartData.map((d, i) => (
                        <Cell key={i} fill={d.mae < MAE_GOOD ? "#10b981" : d.mae < MAE_OK ? "#f59e0b" : "#ef4444"} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          )}

          {positions.length > 0 && (
            <div>
              <h3 className="text-sm font-medium mb-3">By Position</h3>
              <div className="overflow-x-auto rounded-lg border border-border">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="border-b border-border bg-muted/30">
                      {["Position", "Players", "Predictions", "MAE", "RMSE", "Within 10pts", "Within 20pts"].map(h => (
                        <th key={h} className="px-3 py-2 text-left font-medium text-muted-foreground">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {positions.map(p => (
                      <tr key={p.position_group} className="border-b border-border/40 hover:bg-muted/20">
                        <td className="px-3 py-2 font-medium">{p.position_group}</td>
                        <td className="px-3 py-2 tabular-nums">{p.players_count}</td>
                        <td className="px-3 py-2 tabular-nums">{p.predictions_count}</td>
                        <td className={`px-3 py-2 tabular-nums font-semibold ${maeColor(p.mean_absolute_error)}`}>{fmtNum(p.mean_absolute_error)}</td>
                        <td className="px-3 py-2 tabular-nums">{fmtNum(p.rmse)}</td>
                        <td className="px-3 py-2 tabular-nums text-emerald-400">{pct(p.within_10_pct)}</td>
                        <td className="px-3 py-2 tabular-nums text-emerald-400">{pct(p.within_20_pct)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {rounds.length > 0 && (
            <div>
              <h3 className="text-sm font-medium mb-3">Recent Rounds</h3>
              <div className="overflow-x-auto rounded-lg border border-border">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="border-b border-border bg-muted/30">
                      {["Round", "Predictions", "Mean Error", "Median Error", "Within 10pts", "Within 20pts"].map(h => (
                        <th key={h} className="px-3 py-2 text-left font-medium text-muted-foreground">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {rounds.map(r => (
                      <tr key={r.round_number} className="border-b border-border/40 hover:bg-muted/20">
                        <td className="px-3 py-2 font-medium">{r.round_label ?? `Round ${r.round_number}`}</td>
                        <td className="px-3 py-2 tabular-nums">{r.predictions_count}</td>
                        <td className={`px-3 py-2 tabular-nums font-semibold ${maeColor(r.mean_error)}`}>{fmtNum(r.mean_error)}</td>
                        <td className="px-3 py-2 tabular-nums">{fmtNum(r.median_error)}</td>
                        <td className="px-3 py-2 tabular-nums text-emerald-400">{pct(r.within_10_pct)}</td>
                        <td className="px-3 py-2 tabular-nums text-emerald-400">{pct(r.within_20_pct)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {!kpi && rounds.length === 0 && positions.length === 0 && (
            <p className="text-sm text-muted-foreground text-center py-8">No accuracy data available yet.</p>
          )}

          <div className="flex justify-end">
            <Button size="sm" variant="outline" onClick={fetchData}>
              <RefreshCw className="h-3.5 w-3.5 mr-1.5" /> Refresh
            </Button>
          </div>
        </>
      )}
    </div>
  );
}

// ─── Pricing Tab ──────────────────────────────────────────────────────────────

type PricingSubTab = "ingest" | "resolver" | "changes" | "matching";

const PRICING_TABS: { id: PricingSubTab; label: string }[] = [
  { id: "ingest",    label: "Price Ingest" },
  { id: "resolver",  label: "Name Resolver" },
  { id: "changes",   label: "Price Changes" },
  { id: "matching",  label: "Player Matching" },
];

function PricingTab() {
  const [sub, setSub] = useState<PricingSubTab>("ingest");
  return (
    <div>
      <AdminSectionIntro
        description="Fantasy price ingestion, name resolution, and player matching tools."
        detail="Use 'Price Ingest' to paste CSV/raw AFL Fantasy price data and map it to Neeko player IDs. 'Name Resolver' handles unmatched name mappings. 'Price Changes' shows historical price movements. 'Player Matching' manages the fantasy_player_market table."
      />

      <div className="flex gap-2 mb-5 border-b border-border">
        {PRICING_TABS.map(({ id, label }) => (
          <button
            key={id}
            onClick={() => setSub(id)}
            className={`px-3 py-2 text-xs font-medium transition-colors border-b-2 -mb-px ${
              sub === id ? "border-foreground text-foreground" : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {sub === "ingest"    && <FantasyPricesTab />}
      {sub === "resolver"  && <NameResolverTab />}
      {sub === "changes"   && <PriceChangeDebugTab />}
      {sub === "matching"  && <FantasyPlayerMatchingTab />}
    </div>
  );
}

// ─── Signals Tab — rewired to v_player_lab_* backend views ───────────────────

type SignalCategory = "best_buys" | "breakout" | "high_upside" | "risky_traps" | "safe_picks" | "all";

const SIGNAL_CATS: { id: SignalCategory; label: string; icon: React.ElementType; desc: string; view: string }[] = [
  { id: "best_buys",   label: "Best Buys",    icon: Gem,           desc: "Top value picks — high buy score and projected upside vs price", view: "v_player_lab_best_buys" },
  { id: "breakout",    label: "Breakout",     icon: Flame,         desc: "Players with high breakout probability and recent upward trend",   view: "v_player_lab_breakout" },
  { id: "high_upside", label: "High Upside",  icon: Crown,         desc: "High captain_score and high upside — double or captain options",  view: "v_player_lab_high_upside" },
  { id: "risky_traps", label: "Risky Traps",  icon: AlertTriangle, desc: "Players priced high but signal engine flags as overvalued traps", view: "v_player_lab_risky_traps" },
  { id: "safe_picks",  label: "Safe Picks",   icon: Shield,        desc: "Consistent, low-risk players with high floor scores",             view: "v_player_lab_safe_picks" },
  { id: "all",         label: "All Signals",  icon: TrendingUp,    desc: "All player signals sorted by total_score from the signal engine", view: "" },
];

function SignalsTab() {
  const [rows, setRows] = useState<LabPlayerRow[]>([]);
  const [allRows, setAllRows] = useState<LabPlayerRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [category, setCategory] = useState<SignalCategory>("best_buys");

  const fetchCategory = useCallback(async (cat: SignalCategory) => {
    setLoading(true);
    const viewMap: Record<SignalCategory, string> = {
      best_buys:   "v_player_lab_best_buys",
      breakout:    "v_player_lab_breakout",
      high_upside: "v_player_lab_high_upside",
      risky_traps: "v_player_lab_risky_traps",
      safe_picks:  "v_player_lab_safe_picks",
      all:         "v_player_lab_best_buys",
    };

    if (cat === "all") {
      if (allRows.length === 0) {
        const { data, error } = await supabase
          .from("v_player_lab_best_buys")
          .select("*")
          .order("total_score", { ascending: false })
          .limit(100);
        console.log("Signals all (fallback best_buys):", data?.length, "rows | error:", error);
        setRows((data as LabPlayerRow[]) ?? []);
        setAllRows((data as LabPlayerRow[]) ?? []);
      } else {
        setRows(allRows);
      }
    } else {
      const viewName = viewMap[cat];
      const { data, error } = await supabase
        .from(viewName)
        .select("*")
        .order("total_score", { ascending: false })
        .limit(50);
      console.log(`Signals [${cat}] from ${viewName}:`, data?.length, "rows | error:", error);
      setRows((data as LabPlayerRow[]) ?? []);
    }
    setLoading(false);
  }, [allRows]);

  useEffect(() => { fetchCategory(category); }, [category, fetchCategory]);

  function handleCategory(cat: SignalCategory) {
    setCategory(cat);
  }

  const activeCat = SIGNAL_CATS.find(c => c.id === category)!;

  return (
    <div>
      <AdminSectionIntro
        description="Curated signal lists powered by the Neeko signal engine — each category is a dedicated backend view with pre-computed scores."
        detail="Best Buys = v_player_lab_best_buys | Breakout = v_player_lab_breakout | High Upside = v_player_lab_high_upside | Risky Traps = v_player_lab_risky_traps | Safe Picks = v_player_lab_safe_picks"
      />

      <div className="flex flex-wrap gap-2 mb-4">
        {SIGNAL_CATS.map(({ id, label, icon: Icon, desc }) => (
          <button
            key={id}
            onClick={() => handleCategory(id)}
            title={desc}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium border transition-colors ${
              category === id
                ? "border-foreground bg-foreground text-background"
                : "border-border text-muted-foreground hover:text-foreground hover:border-foreground/40"
            }`}
          >
            <Icon className="h-3.5 w-3.5" />
            {label}
          </button>
        ))}
        <Button size="sm" variant="outline" onClick={() => fetchCategory(category)} className="ml-auto">
          <RefreshCw className={`h-3.5 w-3.5 mr-1.5 ${loading ? "animate-spin" : ""}`} />
          Refresh
        </Button>
      </div>

      {activeCat && (
        <p className="text-xs text-muted-foreground mb-3 flex items-center gap-1.5">
          <activeCat.icon className="h-3.5 w-3.5" />
          {activeCat.desc} — {loading ? "loading…" : `${rows.length} players`}
        </p>
      )}

      <div className="overflow-x-auto rounded-lg border border-border">
        <table className="w-full text-xs">
          <thead>
            <tr className="border-b border-border bg-muted/30">
              <th className="px-3 py-2 text-left font-medium text-muted-foreground">#</th>
              <th className="px-3 py-2 text-left font-medium text-muted-foreground">Player</th>
              <th className="px-3 py-2 text-left font-medium text-muted-foreground">Pos</th>
              <th className="px-3 py-2 text-left font-medium text-muted-foreground">Team</th>
              <th className="px-3 py-2 text-left font-medium text-muted-foreground">
                <span className="flex items-center gap-1">Rating <AdminInfoTooltip text="Neeko composite rating" /></span>
              </th>
              <th className="px-3 py-2 text-left font-medium text-muted-foreground">Proj</th>
              <th className="px-3 py-2 text-left font-medium text-muted-foreground">
                <span className="flex items-center gap-1">Value <AdminInfoTooltip text="Points per $100k" /></span>
              </th>
              <th className="px-3 py-2 text-left font-medium text-muted-foreground">Price</th>
              <th className="px-3 py-2 text-left font-medium text-muted-foreground">
                <span className="flex items-center gap-1">Buy <AdminInfoTooltip text="Buy score from signal engine" /></span>
              </th>
              <th className="px-3 py-2 text-left font-medium text-muted-foreground">
                <span className="flex items-center gap-1">Opp <AdminInfoTooltip text="Opportunity score — breakout + matchup + value" /></span>
              </th>
              <th className="px-3 py-2 text-left font-medium text-muted-foreground">
                <span className="flex items-center gap-1">Risk <AdminInfoTooltip text="Risk score from signal engine" /></span>
              </th>
              <th className="px-3 py-2 text-left font-medium text-muted-foreground">
                <span className="flex items-center gap-1">Total <AdminInfoTooltip text="Composite total score — higher = stronger signal" /></span>
              </th>
              <th className="px-3 py-2 text-left font-medium text-muted-foreground">Tags</th>
              <th className="px-3 py-2 text-left font-medium text-muted-foreground">Reco</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={14} className="text-center py-10 text-muted-foreground">Loading…</td></tr>
            ) : rows.length === 0 ? (
              <tr><td colSpan={14} className="text-center py-10 text-muted-foreground">No signal data found for this category</td></tr>
            ) : rows.map((r, i) => (
              <tr key={`${r.player_id ?? r.player_name}-${i}`} className="border-b border-border/40 hover:bg-muted/20">
                <td className="px-3 py-2 text-muted-foreground">{i + 1}</td>
                <td className="px-3 py-2 font-medium">{r.player_name}</td>
                <td className="px-3 py-2 text-muted-foreground">{r.position}</td>
                <td className="px-3 py-2 text-muted-foreground">{r.team}</td>
                <td className="px-3 py-2 tabular-nums font-semibold">{fmtNum(r.neeko_rating)}</td>
                <td className="px-3 py-2 tabular-nums">{fmtNum(r.projection)}</td>
                <td className="px-3 py-2 tabular-nums">{fmtNum(r.value_score, 2)}</td>
                <td className="px-3 py-2 tabular-nums">{fmtPrice(r.price)}</td>
                <td className="px-3 py-2 tabular-nums text-emerald-400">{fmtNum(r.buy_score, 0)}</td>
                <td className="px-3 py-2 tabular-nums text-sky-400">{fmtNum(r.opportunity_score, 0)}</td>
                <td className="px-3 py-2 tabular-nums text-amber-400">{fmtNum(r.risk_score, 0)}</td>
                <td className="px-3 py-2 tabular-nums font-semibold">{fmtNum(r.total_score, 0)}</td>
                <td className="px-3 py-2 max-w-[140px]">
                  {Array.isArray(r.signal_tags) && r.signal_tags.length > 0 ? (
                    <div className="flex flex-wrap gap-0.5">
                      {r.signal_tags.slice(0, 3).map((tag, ti) => (
                        <span key={ti} className="text-[9px] bg-muted/60 text-muted-foreground rounded px-1 py-0.5 whitespace-nowrap">{tag}</span>
                      ))}
                    </div>
                  ) : <span className="text-muted-foreground">—</span>}
                </td>
                <td className="px-3 py-2">
                  <RecoBadge color={r.recommendation_color} short={r.recommendation_short} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function AdminPlayerLab() {
  const [tab, setTab] = useState<Tab>("explorer");

  return (
    <div>
      <div className="mb-5">
        <h1 className="text-lg font-semibold">Player Lab</h1>
        <p className="text-xs text-muted-foreground mt-0.5">
          Explore, analyse, and diagnose every player in the system — projections, pricing, accuracy, and signals.
        </p>
      </div>

      <div className="flex gap-1 border-b border-border mb-6 overflow-x-auto" style={{ scrollbarWidth: "none" }}>
        {TABS.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            onClick={() => setTab(id)}
            className={`flex items-center gap-1.5 px-4 py-2.5 text-xs font-medium whitespace-nowrap border-b-2 -mb-px transition-colors ${
              tab === id
                ? "border-foreground text-foreground"
                : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
          >
            <Icon className="h-3.5 w-3.5" />
            {label}
          </button>
        ))}
      </div>

      {tab === "explorer" && <PlayerExplorerTab />}
      {tab === "accuracy"  && <AccuracyTab />}
      {tab === "pricing"   && <PricingTab />}
      {tab === "signals"   && <SignalsTab />}
    </div>
  );
}
