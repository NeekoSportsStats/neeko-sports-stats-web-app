import { useState, useEffect, useCallback, useMemo } from "react";
import { supabase } from "@/lib/supabaseClient";
import { RefreshCw, Users, TrendingUp, DollarSign, Target, ChevronUp, ChevronDown, ChevronsUpDown, Search, Flame, Gem, Crown, Shield, TriangleAlert as AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { AdminSectionIntro, AdminInfoTooltip } from "@/features/admin/shared/AdminExplain";
import { FantasyPricesTab } from "@/features/admin/price-ingest/FantasyPricesTab";
import { NameResolverTab } from "@/features/admin/price-ingest/NameResolverTab";
import { PriceChangeDebugTab } from "@/features/admin/price-ingest/PriceChangeDebugTab";
import { FantasyPlayerMatchingTab } from "@/features/admin/price-ingest/FantasyPlayerMatchingTab";
import {
  LineChart, Line, BarChart, Bar,
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
  ceiling: number;
  floor: number;
  price: number;
  neeko_rating: number;
  value_score: number;
  value_tag: string;
  consistency: number;
  form_score: number;
  captain_score: number;
  captain_rating: string;
  upside_rating: string;
  upside_pct: number;
  risk_rating: string;
  matchup_rating: string;
  matchup_multiplier: number;
  ai_recommendation: string;
  recommendation_color: string;
  recommendation_short: string;
  market_watch_category: string;
  best_value_score: number;
}

interface AccuracyKpi {
  total_predictions: number | null;
  players_evaluated: number | null;
  latest_round: number | null;
  latest_round_mae: number | null;
  season_mae: number | null;
  season_rmse: number | null;
  within_10_pct: number | null;
  within_20_pct: number | null;
  avg_signed_error: number | null;
  over_projection_pct: number | null;
  best_position: string | null;
  worst_position: string | null;
  best_position_mae: number | null;
  worst_position_mae: number | null;
}

interface RoundRow {
  round_number: number;
  round_label: string;
  mae: number;
  rmse: number;
  within_10_pct: number;
  within_20_pct: number;
  predictions_count: number;
}

interface PositionRow {
  position: string;
  predictions_count: number;
  mae: number;
  rmse: number;
  within_10_pct: number;
  within_20_pct: number;
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
    const { data } = await supabase
      .from("player_rankings_cache")
      .select("player_id,player_name,team,position,projection_final,ceiling,floor,price,neeko_rating,value_score,value_tag,consistency,form_score,captain_score,captain_rating,upside_rating,upside_pct,risk_rating,matchup_rating,matchup_multiplier,ai_recommendation,recommendation_color,recommendation_short,market_watch_category,best_value_score")
      .order("neeko_rating", { ascending: false })
      .limit(700);
    setRows((data as PlayerRow[]) ?? []);
    setLoading(false);
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

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
    { key: "player_name", label: "Player" },
    { key: "position",    label: "Pos" },
    { key: "team",        label: "Team" },
    { key: "projection_final", label: "Proj", explain: "Final blended projection including matchup and role multipliers" },
    { key: "ceiling",     label: "Ceil", explain: "85th percentile outcome from recent 10 games" },
    { key: "floor",       label: "Floor", explain: "15th percentile outcome from recent 10 games" },
    { key: "neeko_rating", label: "Rating", explain: "Neeko composite rating (0-100) blending projection, form, value, consistency" },
    { key: "value_score", label: "Value", explain: "Value score: projected points per $100k of price. Higher = better value" },
    { key: "consistency", label: "Cons%", explain: "Consistency: fraction of recent games above their own average" },
    { key: "captain_score", label: "Cap", explain: "Captain score: upside-weighted rating for captaincy decisions" },
    { key: "upside_pct",  label: "Upside%", explain: "Probability of exceeding projection by >10%" },
    { key: "matchup_multiplier", label: "Matchup", explain: "Opponent difficulty multiplier (1.0 = neutral, >1 = easier)" },
    { key: "price",       label: "Price" },
    { key: "recommendation_short", label: "Reco" },
  ];

  return (
    <div>
      <AdminSectionIntro
        description="Full player data from player_rankings_cache — the production table that drives all rankings and recommendations."
        detail="Filters update in-browser on the 700-row local dataset. Sort any column by clicking its header. The Reco column shows the AI short recommendation from the latest generation cycle."
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
      supabase.from("v_projection_accuracy_round").select("round_number,round_label,mae,rmse,within_10_pct,within_20_pct,predictions_count").order("round_number", { ascending: false }).limit(12),
      supabase.from("v_projection_accuracy_by_position").select("position,predictions_count,mae,rmse,within_10_pct,within_20_pct").order("mae", { ascending: true }),
    ]);
    if (kpiRes.status === "fulfilled") setKpi(kpiRes.value.data as AccuracyKpi | null);
    if (roundRes.status === "fulfilled") setRounds((roundRes.value.data ?? []) as RoundRow[]);
    if (posRes.status === "fulfilled") setPositions((posRes.value.data ?? []) as PositionRow[]);
    setLoading(false);
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  const chartData = useMemo(() =>
    [...rounds].reverse().map(r => ({ name: r.round_label ?? `R${r.round_number}`, mae: r.mae, rmse: r.rmse, w10: +(r.within_10_pct * 100).toFixed(1) })),
    [rounds]
  );

  const MAE_GOOD = 18, MAE_OK = 25;
  const maeColor = (mae: number | null) => mae == null ? "" : mae < MAE_GOOD ? "text-emerald-400" : mae < MAE_OK ? "text-amber-400" : "text-red-400";

  return (
    <div className="space-y-6">
      <AdminSectionIntro
        description="How accurate are the Neeko projection models? MAE = Mean Absolute Error (lower is better). Within 10%/20% = fraction of predictions within that band."
        detail="Data from v_projection_accuracy_homepage, v_projection_accuracy_round, and v_projection_accuracy_by_position views. These are refreshed weekly after each round by the pipeline."
      />

      {loading ? (
        <div className="flex items-center justify-center py-20"><RefreshCw className="h-5 w-5 animate-spin text-muted-foreground" /></div>
      ) : (
        <>
          {/* KPI Row */}
          <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-3">
            {[
              { label: "Season MAE", value: fmtNum(kpi?.season_mae), color: maeColor(kpi?.season_mae ?? null), explain: "Average absolute error across all predictions this season" },
              { label: "Latest Round MAE", value: fmtNum(kpi?.latest_round_mae), color: maeColor(kpi?.latest_round_mae ?? null), explain: "MAE for the most recently completed round" },
              { label: "Season RMSE", value: fmtNum(kpi?.season_rmse), color: "", explain: "Root mean squared error — penalises larger errors more heavily" },
              { label: "Within 10%", value: pct(kpi?.within_10_pct ?? null), color: "text-emerald-400", explain: "Fraction of predictions within 10% of actual score" },
              { label: "Within 20%", value: pct(kpi?.within_20_pct ?? null), color: "text-emerald-400", explain: "Fraction of predictions within 20% of actual score" },
              { label: "Avg Bias", value: fmtNum(kpi?.avg_signed_error), color: "", explain: "Signed error: positive = over-projecting, negative = under-projecting" },
              { label: "Players Evaluated", value: kpi?.players_evaluated ?? "—", color: "", explain: "Number of unique players with at least one accuracy measurement" },
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

          {/* Best / Worst position */}
          {(kpi?.best_position || kpi?.worst_position) && (
            <div className="flex flex-wrap gap-3">
              {kpi?.best_position && (
                <div className="flex items-center gap-2 text-xs rounded-md border border-emerald-500/25 bg-emerald-500/10 px-3 py-2">
                  <span className="text-emerald-400 font-medium">Best: {kpi.best_position}</span>
                  <span className="text-muted-foreground">MAE {fmtNum(kpi.best_position_mae)}</span>
                </div>
              )}
              {kpi?.worst_position && (
                <div className="flex items-center gap-2 text-xs rounded-md border border-red-500/25 bg-red-500/10 px-3 py-2">
                  <span className="text-red-400 font-medium">Needs work: {kpi.worst_position}</span>
                  <span className="text-muted-foreground">MAE {fmtNum(kpi.worst_position_mae)}</span>
                </div>
              )}
            </div>
          )}

          {/* Round MAE chart */}
          {chartData.length > 0 && (
            <div>
              <div className="flex items-center gap-2 mb-3">
                <h3 className="text-sm font-medium">MAE by Round</h3>
                <AdminInfoTooltip text="Lower MAE is better. The green reference line at 18 marks a good target." />
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

          {/* Position breakdown */}
          {positions.length > 0 && (
            <div>
              <h3 className="text-sm font-medium mb-3">By Position</h3>
              <div className="overflow-x-auto rounded-lg border border-border">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="border-b border-border bg-muted/30">
                      {["Position", "Predictions", "MAE", "RMSE", "Within 10%", "Within 20%"].map(h => (
                        <th key={h} className="px-3 py-2 text-left font-medium text-muted-foreground">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {positions.map(p => (
                      <tr key={p.position} className="border-b border-border/40 hover:bg-muted/20">
                        <td className="px-3 py-2 font-medium">{p.position}</td>
                        <td className="px-3 py-2 tabular-nums">{p.predictions_count}</td>
                        <td className={`px-3 py-2 tabular-nums font-semibold ${maeColor(p.mae)}`}>{fmtNum(p.mae)}</td>
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

          {/* Round table */}
          {rounds.length > 0 && (
            <div>
              <h3 className="text-sm font-medium mb-3">Recent Rounds</h3>
              <div className="overflow-x-auto rounded-lg border border-border">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="border-b border-border bg-muted/30">
                      {["Round", "Predictions", "MAE", "RMSE", "Within 10%", "Within 20%"].map(h => (
                        <th key={h} className="px-3 py-2 text-left font-medium text-muted-foreground">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {rounds.map(r => (
                      <tr key={r.round_number} className="border-b border-border/40 hover:bg-muted/20">
                        <td className="px-3 py-2 font-medium">{r.round_label ?? `Round ${r.round_number}`}</td>
                        <td className="px-3 py-2 tabular-nums">{r.predictions_count}</td>
                        <td className={`px-3 py-2 tabular-nums font-semibold ${maeColor(r.mae)}`}>{fmtNum(r.mae)}</td>
                        <td className="px-3 py-2 tabular-nums">{fmtNum(r.rmse)}</td>
                        <td className="px-3 py-2 tabular-nums text-emerald-400">{pct(r.within_10_pct)}</td>
                        <td className="px-3 py-2 tabular-nums text-emerald-400">{pct(r.within_20_pct)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
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

// ─── Signals Tab ─────────────────────────────────────────────────────────────

interface SignalRow {
  player_name: string;
  team: string;
  position: string;
  neeko_rating: number;
  projection_final: number;
  value_score: number;
  price: number;
  market_watch_category: string;
  recommendation_short: string;
  recommendation_color: string;
  captain_score: number;
  upside_pct: number;
  consistency: number;
}

type SignalCategory = "hot" | "value" | "captain" | "risky" | "all";

const SIGNAL_CATS: { id: SignalCategory; label: string; icon: React.ElementType; desc: string }[] = [
  { id: "hot",     label: "Hot Picks",      icon: Flame,          desc: "Players with high form_score and above-average Neeko rating" },
  { id: "value",   label: "Best Value",     icon: Gem,            desc: "Highest value_score — points per dollar of price" },
  { id: "captain", label: "Captain Picks",  icon: Crown,          desc: "Highest captain_score for doubling options" },
  { id: "risky",   label: "Risk Watch",     icon: AlertTriangle,  desc: "High upside but inconsistent — trade with caution" },
  { id: "all",     label: "All Signals",    icon: Shield,         desc: "All players sorted by Neeko rating" },
];

function SignalsTab() {
  const [rows, setRows] = useState<SignalRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [category, setCategory] = useState<SignalCategory>("hot");

  const fetchData = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase
      .from("player_rankings_cache")
      .select("player_name,team,position,neeko_rating,projection_final,value_score,price,market_watch_category,recommendation_short,recommendation_color,captain_score,upside_pct,consistency,form_score,risk_rating")
      .order("neeko_rating", { ascending: false })
      .limit(600);
    setRows((data as SignalRow[]) ?? []);
    setLoading(false);
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  const filtered = useMemo(() => {
    if (category === "hot")
      return [...rows].sort((a, b) => (b as unknown as Record<string, number>).form_score - (a as unknown as Record<string, number>).form_score).slice(0, 25);
    if (category === "value")
      return [...rows].filter(r => r.price > 0).sort((a, b) => b.value_score - a.value_score).slice(0, 25);
    if (category === "captain")
      return [...rows].sort((a, b) => b.captain_score - a.captain_score).slice(0, 25);
    if (category === "risky")
      return [...rows].filter(r => r.upside_pct > 30 && r.consistency < 0.55).sort((a, b) => b.upside_pct - a.upside_pct).slice(0, 25);
    return rows.slice(0, 50);
  }, [rows, category]);

  const activeCat = SIGNAL_CATS.find(c => c.id === category)!;

  return (
    <div>
      <AdminSectionIntro
        description="Curated signal lists to quickly identify targets, value plays, captain options, and risk players."
        detail="All data from player_rankings_cache. Hot = sorted by form_score. Value = sorted by value_score (pts/$). Captain = sorted by captain_score. Risky = high upside_pct but low consistency."
      />

      <div className="flex flex-wrap gap-2 mb-4">
        {SIGNAL_CATS.map(({ id, label, icon: Icon, desc }) => (
          <button
            key={id}
            onClick={() => setCategory(id)}
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
        <Button size="sm" variant="outline" onClick={fetchData} className="ml-auto">
          <RefreshCw className={`h-3.5 w-3.5 mr-1.5 ${loading ? "animate-spin" : ""}`} />
          Refresh
        </Button>
      </div>

      {activeCat && (
        <p className="text-xs text-muted-foreground mb-3 flex items-center gap-1.5">
          <activeCat.icon className="h-3.5 w-3.5" />
          {activeCat.desc} — showing top {filtered.length} players
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
              <th className="px-3 py-2 text-left font-medium text-muted-foreground">Cons%</th>
              <th className="px-3 py-2 text-left font-medium text-muted-foreground">Cap</th>
              <th className="px-3 py-2 text-left font-medium text-muted-foreground">Upside%</th>
              <th className="px-3 py-2 text-left font-medium text-muted-foreground">Reco</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={12} className="text-center py-10 text-muted-foreground">Loading…</td></tr>
            ) : filtered.map((r, i) => (
              <tr key={`${r.player_name}-${i}`} className="border-b border-border/40 hover:bg-muted/20">
                <td className="px-3 py-2 text-muted-foreground">{i + 1}</td>
                <td className="px-3 py-2 font-medium">{r.player_name}</td>
                <td className="px-3 py-2 text-muted-foreground">{r.position}</td>
                <td className="px-3 py-2 text-muted-foreground">{r.team}</td>
                <td className="px-3 py-2 tabular-nums font-semibold">{fmtNum(r.neeko_rating)}</td>
                <td className="px-3 py-2 tabular-nums">{fmtNum(r.projection_final)}</td>
                <td className="px-3 py-2 tabular-nums">{fmtNum(r.value_score, 2)}</td>
                <td className="px-3 py-2 tabular-nums">{fmtPrice(r.price)}</td>
                <td className="px-3 py-2 tabular-nums">{pct(r.consistency)}</td>
                <td className="px-3 py-2 tabular-nums">{fmtNum(r.captain_score)}</td>
                <td className="px-3 py-2 tabular-nums">{fmtNum(r.upside_pct, 0)}%</td>
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
