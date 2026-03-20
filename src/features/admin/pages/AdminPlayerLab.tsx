import { useState, useEffect, useCallback, useMemo } from "react";
import { supabase } from "@/lib/supabaseClient";
import { RefreshCw, Users, TrendingUp, DollarSign, Target, ChevronUp, ChevronDown, ChevronsUpDown, Search, Flame, Gem, Crown, Shield, TriangleAlert as AlertTriangle, ChevronRight, X, Zap, Activity, ChartBar as BarChart2, CircleAlert as AlertCircle, CircleCheck as CheckCircle, TrendingDown, Tag, CreditCard as Edit2, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { AdminSectionIntro, AdminInfoTooltip } from "@/features/admin/shared/AdminExplain";
import { FantasyPricesTab } from "@/features/admin/price-ingest/FantasyPricesTab";
import { NameResolverTab } from "@/features/admin/price-ingest/NameResolverTab";
import { PriceChangeDebugTab } from "@/features/admin/price-ingest/PriceChangeDebugTab";
import { FantasyPlayerMatchingTab } from "@/features/admin/price-ingest/FantasyPlayerMatchingTab";
import {
  BarChart, Bar, ScatterChart, Scatter,
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
  recommendation_why: string;
  market_watch_category: string;
  best_value_score: number;
  confidence_label: string;
  edge_score: number;
  edge_tier: string;
  start_sit_decision: string;
  recommendation_strength: string;
  games_played: number;
  consistency_tier: string;
  ai_summary: string;
}

interface PlayerSignals {
  player_id: number;
  signal_tags: string[];
  signal_count: number;
  signal_strength_score: number;
}

interface PlayerEdge {
  player_id: number;
  value_edge: number;
  matchup_edge: number;
  role_edge: number;
  form_edge: number;
  risk_penalty: number;
  edge_total: number;
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

interface PlayerAccuracyRow {
  player_id: number;
  player_name: string;
  team: string;
  game_id: number;
  round_label: string;
  projection: number;
  actual_score: number;
  error: number;
  absolute_error: number;
  accuracy_band: string;
  projection_bias: string;
}

interface TeamAccuracyRow {
  team: string;
  prediction_count: number;
  avg_error: number;
  median_error: number;
  prediction_bias: number;
  over_projected_pct: number;
  under_projected_pct: number;
  within_10_pct: number;
  within_20_pct: number;
}

interface PriceRow {
  player_id: number;
  player_name: string;
  team: string;
  position: string;
  current_price: number;
  last_price: number | null;
  price_change: number;
  price_change_pct: number;
  value_score: number;
  best_value_score: number;
  projection_final: number;
  projection: number;
  neeko_rating: number;
  form_score: number;
  consistency: number;
  matchup_label: string;
  recommendation_short: string;
  recommendation_color: string;
  confidence_label: string;
  market_watch_category: string;
}

interface LabPlayerRow {
  player_id: number;
  player_name: string;
  team: string;
  position: string;
  projection: number;
  ceiling: number;
  price: number;
  value_score: number;
  neeko_rating: number;
  form_score: number;
  consistency: number;
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
}

interface SignalMasterRow {
  player_id: number;
  player_name: string;
  team: string;
  position: string;
  price: number;
  projection: number;
  neeko_rating: number;
  signal_tags: string[];
  signal_count: number;
  signal_strength_score: number;
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

function pctDirect(n: number | null | undefined) {
  if (n == null) return "—";
  return n.toFixed(1) + "%";
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

// ─── Confidence label badge ───────────────────────────────────────────────────

function ConfidenceBadge({ label }: { label: string }) {
  const cls =
    label === "LOCK"     ? "bg-emerald-500/20 text-emerald-300 border-emerald-500/30" :
    label === "STRONG"   ? "bg-sky-500/20 text-sky-300 border-sky-500/30" :
    label === "SOLID"    ? "bg-blue-500/20 text-blue-300 border-blue-500/30" :
    label === "RISKY"    ? "bg-amber-500/20 text-amber-300 border-amber-500/30" :
    label === "VOLATILE" ? "bg-red-500/20 text-red-300 border-red-500/30" :
                           "bg-muted/30 text-muted-foreground border-border/30";
  return (
    <span className={`inline-flex text-[10px] font-bold px-1.5 py-0.5 rounded border ${cls}`}>
      {label || "—"}
    </span>
  );
}

// ─── Player Deep Panel ────────────────────────────────────────────────────────

function PlayerDeepPanel({
  player,
  signals,
  edge,
  onClose,
}: {
  player: PlayerRow;
  signals: PlayerSignals | null;
  edge: PlayerEdge | null;
  onClose: () => void;
}) {
  const edgeBar = (label: string, value: number | null | undefined, color: string, positive = true) => {
    const v = value ?? 0;
    const width = Math.min(100, Math.abs(v));
    return (
      <div className="flex items-center gap-2 text-xs">
        <span className="w-28 text-muted-foreground shrink-0">{label}</span>
        <div className="flex-1 h-1.5 bg-muted/30 rounded-full overflow-hidden">
          <div
            className={`h-full rounded-full transition-all ${positive ? color : "bg-red-500/60"}`}
            style={{ width: `${width}%` }}
          />
        </div>
        <span className={`w-10 text-right tabular-nums font-mono text-[11px] ${positive ? (v > 50 ? "text-emerald-400" : "text-muted-foreground") : "text-red-400"}`}>
          {v > 0 && !positive ? "-" : ""}{fmtNum(v, 0)}
        </span>
      </div>
    );
  };

  const SIGNAL_CATEGORY_MAP: Record<string, string> = {
    underpriced_elite: "Value", underpriced_mid: "Value", overpriced_trap: "Value",
    value_spike: "Value", value_drop: "Value",
    form_hot: "Form", form_cold: "Form", ceiling_spike: "Form", floor_drop: "Form", volatility_high: "Form",
    ultra_consistent: "Consistency", inconsistent: "Consistency", trend_up: "Consistency", trend_down: "Consistency",
    role_improved: "Role", role_declined: "Role", midfield_boost: "Role", role_uncertain: "Role",
    easy_matchup: "Matchup", hard_matchup: "Matchup", tag_risk: "Matchup", venue_boost: "Matchup",
    captain_viable: "Meta", pod_play: "Meta", high_ownership_risk: "Meta",
    breakout_candidate: "Meta", regression_candidate: "Meta",
  };

  const tagsByCategory: Record<string, string[]> = {};
  (signals?.signal_tags ?? []).forEach(tag => {
    const cat = SIGNAL_CATEGORY_MAP[tag] ?? "Other";
    if (!tagsByCategory[cat]) tagsByCategory[cat] = [];
    tagsByCategory[cat].push(tag);
  });

  return (
    <div className="border border-border/60 bg-card/60 rounded-lg p-4 space-y-4 text-xs">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <div className="flex items-center gap-2">
            <span className="font-bold text-sm">{player.player_name}</span>
            <span className="text-muted-foreground">{player.team}</span>
            <span className="text-[10px] bg-muted/40 px-1.5 py-0.5 rounded font-mono">{player.position}</span>
            <ConfidenceBadge label={player.confidence_label} />
            <RecoBadge color={player.recommendation_color} short={player.recommendation_short} />
          </div>
          <div className="text-muted-foreground mt-1">{fmtPrice(player.price)} · Rating {fmtNum(player.neeko_rating, 0)} · {player.games_played ?? "—"} games</div>
        </div>
        <button onClick={onClose} className="text-muted-foreground hover:text-foreground p-1 rounded">
          <X className="h-4 w-4" />
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Projection */}
        <div className="space-y-2">
          <div className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">Projection</div>
          <div className="grid grid-cols-3 gap-2">
            {[
              { label: "Final", value: fmtNum(player.projection_final, 0), color: "text-foreground text-base font-bold" },
              { label: "Ceiling", value: fmtNum(player.ceiling, 0), color: "text-emerald-400 font-semibold" },
              { label: "Floor", value: fmtNum(player.floor, 0), color: "text-red-400 font-semibold" },
            ].map(({ label, value, color }) => (
              <div key={label} className="bg-muted/20 rounded p-2 text-center">
                <div className="text-muted-foreground text-[10px]">{label}</div>
                <div className={`tabular-nums ${color}`}>{value}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Model inputs */}
        <div className="space-y-2">
          <div className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">Model Inputs</div>
          <div className="space-y-1.5">
            {edgeBar("Consistency", player.consistency * 100, "bg-sky-500/70")}
            {edgeBar("Form Score", player.form_score, "bg-emerald-500/70")}
            {edgeBar("Matchup", (player.matchup_multiplier - 0.8) * 500, "bg-blue-500/70")}
            {edgeBar("Risk", player.risk_rating, "bg-red-500/70", false)}
          </div>
        </div>

        {/* Edge breakdown */}
        <div className="space-y-2">
          <div className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">Edge Breakdown</div>
          {edge ? (
            <div className="space-y-1.5">
              {edgeBar("Value Edge", edge.value_edge, "bg-amber-500/70")}
              {edgeBar("Matchup Edge", edge.matchup_edge, "bg-blue-500/70")}
              {edgeBar("Role Edge", edge.role_edge, "bg-sky-500/70")}
              {edgeBar("Form Edge", edge.form_edge, "bg-emerald-500/70")}
              {edgeBar("Risk Penalty", Math.abs(edge.risk_penalty), "bg-red-500/70", false)}
              <div className="border-t border-border/40 pt-1.5 flex items-center justify-between">
                <span className="text-muted-foreground">Edge Total</span>
                <span className="font-bold tabular-nums text-sm">{fmtNum(edge.edge_total, 0)}</span>
              </div>
            </div>
          ) : (
            <div className="text-muted-foreground">Loading edge data…</div>
          )}
        </div>
      </div>

      {/* Signals */}
      {signals && signals.signal_tags.length > 0 && (
        <div className="space-y-2">
          <div className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-2">
            Signals
            <span className="bg-muted/40 px-1.5 py-0.5 rounded text-[10px] font-mono">{signals.signal_count} total · strength {fmtNum(signals.signal_strength_score, 0)}</span>
          </div>
          <div className="flex flex-wrap gap-2">
            {Object.entries(tagsByCategory).map(([cat, tags]) => (
              <div key={cat} className="space-y-1">
                <div className="text-[10px] text-muted-foreground font-medium">{cat}</div>
                <div className="flex flex-wrap gap-1">
                  {tags.map(tag => (
                    <span key={tag} className="text-[10px] bg-muted/50 text-foreground/80 border border-border/40 rounded px-1.5 py-0.5 font-mono">
                      {tag}
                    </span>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* AI Summary */}
      {player.ai_summary && (
        <div className="space-y-1.5">
          <div className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">AI Summary</div>
          <p className="text-muted-foreground leading-relaxed">{player.ai_summary}</p>
        </div>
      )}
      {player.recommendation_why && (
        <div className="space-y-1.5">
          <div className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">Recommendation Rationale</div>
          <p className="text-muted-foreground leading-relaxed">{player.recommendation_why}</p>
        </div>
      )}
    </div>
  );
}

// ─── Player Explorer Tab ──────────────────────────────────────────────────────

function PlayerExplorerTab() {
  const [rows, setRows] = useState<PlayerRow[]>([]);
  const [signalsMap, setSignalsMap] = useState<Map<number, PlayerSignals>>(new Map());
  const [edgeMap, setEdgeMap] = useState<Map<number, PlayerEdge>>(new Map());
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [posFilter, setPosFilter] = useState("ALL");
  const [teamFilter, setTeamFilter] = useState("ALL");
  const [recoFilter, setRecoFilter] = useState("ALL");
  const [quickFilter, setQuickFilter] = useState<"all" | "high_edge" | "high_confidence" | "high_risk" | "signals_3plus">("all");
  const [sortCol, setSortCol] = useState<string>("neeko_rating");
  const [sortDir, setSortDir] = useState<SortDir>("desc");
  const [expandedId, setExpandedId] = useState<number | null>(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [explorerRes, signalsRes, edgeRes] = await Promise.allSettled([
        supabase.from("v_player_lab_explorer").select("*").order("neeko_rating", { ascending: false }).limit(1000),
        supabase.from("v_player_signals_master").select("player_id,signal_tags,signal_count,signal_strength_score").limit(1000),
        supabase.from("v_player_edge_scores").select("player_id,value_edge,matchup_edge,role_edge,form_edge,risk_penalty,edge_total").limit(1000),
      ]);

      if (explorerRes.status === "fulfilled") {
        console.log("Player Lab explorer:", explorerRes.value.data?.length, "rows | error:", explorerRes.value.error);
        setRows((explorerRes.value.data as PlayerRow[]) ?? []);
      }
      if (signalsRes.status === "fulfilled") {
        const sMap = new Map<number, PlayerSignals>();
        ((signalsRes.value.data ?? []) as PlayerSignals[]).forEach(s => sMap.set(s.player_id, s));
        setSignalsMap(sMap);
      }
      if (edgeRes.status === "fulfilled") {
        const eMap = new Map<number, PlayerEdge>();
        ((edgeRes.value.data ?? []) as PlayerEdge[]).forEach(e => eMap.set(e.player_id, e));
        setEdgeMap(eMap);
      }
    } catch (err) {
      console.error("Player Lab explorer fetch failed:", err);
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
    if (quickFilter === "high_edge")       res = res.filter(r => r.edge_score > 60);
    if (quickFilter === "high_confidence") res = res.filter(r => ["LOCK", "STRONG"].includes(r.confidence_label));
    if (quickFilter === "high_risk")       res = res.filter(r => r.risk_rating > 60);
    if (quickFilter === "signals_3plus")   res = res.filter(r => (signalsMap.get(r.player_id)?.signal_count ?? 0) >= 3);
    return [...res].sort((a, b) => {
      if (sortCol === "signal_count") {
        const av = signalsMap.get(a.player_id)?.signal_count ?? 0;
        const bv = signalsMap.get(b.player_id)?.signal_count ?? 0;
        return sortDir === "asc" ? av - bv : bv - av;
      }
      const av = (a as Record<string, unknown>)[sortCol] as number ?? 0;
      const bv = (b as Record<string, unknown>)[sortCol] as number ?? 0;
      return sortDir === "asc" ? av - bv : bv - av;
    });
  }, [rows, search, posFilter, teamFilter, recoFilter, quickFilter, sortCol, sortDir, signalsMap]);

  function handleSort(col: string) {
    if (col === sortCol) setSortDir(d => d === "asc" ? "desc" : "asc");
    else { setSortCol(col); setSortDir("desc"); }
  }

  function toggleExpand(id: number) {
    setExpandedId(prev => prev === id ? null : id);
  }

  const cols: { key: string; label: string; explain?: string }[] = [
    { key: "player_name",        label: "Player" },
    { key: "position",           label: "Pos" },
    { key: "team",               label: "Team" },
    { key: "projection_final",   label: "Proj",       explain: "Final blended projection including matchup and role multipliers" },
    { key: "ceiling",            label: "Ceil",       explain: "85th percentile outcome from recent 10 games" },
    { key: "floor",              label: "Floor",      explain: "15th percentile outcome from recent 10 games" },
    { key: "neeko_rating",       label: "Rating",     explain: "Neeko composite rating (0–100)" },
    { key: "confidence_label",   label: "Conf",       explain: "Confidence tier: LOCK/STRONG/SOLID/RISKY/VOLATILE" },
    { key: "value_score",        label: "Value",      explain: "Value score: projected points per $100k" },
    { key: "consistency",        label: "Cons%",      explain: "Fraction of recent games above own average" },
    { key: "captain_score",      label: "Cap",        explain: "Captain score: upside-weighted captaincy rating" },
    { key: "upside_pct",         label: "Upside%",    explain: "Probability of exceeding projection by >10%" },
    { key: "matchup_multiplier", label: "Matchup",    explain: "Opponent difficulty multiplier (>1 = easier)" },
    { key: "edge_score",         label: "Edge",       explain: "Edge score — composite of value, matchup, and upside signals" },
    { key: "signal_count",       label: "Signals",    explain: "Number of active signals from the signal engine" },
    { key: "price",              label: "Price" },
    { key: "recommendation_short", label: "Reco" },
  ];

  const QUICK_FILTERS = [
    { id: "all" as const,             label: "All Players" },
    { id: "high_edge" as const,       label: "High Edge (60+)" },
    { id: "high_confidence" as const, label: "High Confidence" },
    { id: "high_risk" as const,       label: "High Risk" },
    { id: "signals_3plus" as const,   label: "≥3 Signals" },
  ];

  return (
    <div className="space-y-4">
      <AdminSectionIntro
        description="Deep inspection table for every player in the model. Click any row to expand a full analytics panel including edge breakdown, signals, and AI summary."
        detail="Data from v_player_lab_explorer · v_player_signals_master · v_player_edge_scores. All views backed by afl.player_rankings_cache."
      />

      {/* Quick filters */}
      <div className="flex flex-wrap gap-1.5">
        {QUICK_FILTERS.map(f => (
          <button
            key={f.id}
            onClick={() => setQuickFilter(f.id)}
            className={`px-2.5 py-1 text-[11px] rounded-full border font-medium transition-colors ${
              quickFilter === f.id
                ? "border-foreground bg-foreground text-background"
                : "border-border/50 text-muted-foreground hover:text-foreground hover:border-foreground/40"
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      {/* Search + filters */}
      <div className="flex flex-wrap gap-2 items-center">
        <div className="relative flex-1 min-w-[180px]">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search name or team…"
            className="w-full pl-8 pr-3 py-1.5 text-xs bg-background border border-border rounded-md focus:outline-none focus:ring-1 focus:ring-ring"
          />
        </div>
        <select value={posFilter} onChange={e => setPosFilter(e.target.value)} className="text-xs bg-background border border-border rounded-md px-2 py-1.5 focus:outline-none">
          {positions.map(p => <option key={p}>{p}</option>)}
        </select>
        <select value={teamFilter} onChange={e => setTeamFilter(e.target.value)} className="text-xs bg-background border border-border rounded-md px-2 py-1.5 focus:outline-none">
          {teams.map(t => <option key={t}>{t}</option>)}
        </select>
        <select value={recoFilter} onChange={e => setRecoFilter(e.target.value)} className="text-xs bg-background border border-border rounded-md px-2 py-1.5 focus:outline-none">
          {recos.map(r => <option key={r}>{r}</option>)}
        </select>
        <Button size="sm" variant="outline" onClick={fetchData} className="ml-auto">
          <RefreshCw className={`h-3.5 w-3.5 mr-1.5 ${loading ? "animate-spin" : ""}`} /> Refresh
        </Button>
        <span className="text-[11px] text-muted-foreground">{filtered.length} players</span>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20"><RefreshCw className="h-5 w-5 animate-spin text-muted-foreground" /></div>
      ) : (
        <div className="space-y-1">
          <div className="overflow-x-auto rounded-lg border border-border">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-border bg-muted/30">
                  <th className="w-6 px-2 py-2" />
                  {cols.map(c => (
                    <th key={c.key} className="px-2 py-2 text-left font-medium text-muted-foreground whitespace-nowrap">
                      <button onClick={() => handleSort(c.key)} className="flex items-center gap-1 hover:text-foreground transition-colors">
                        <span>{c.label}</span>
                        {c.explain && <AdminInfoTooltip text={c.explain} />}
                        <SortIcon col={c.key} activeCol={sortCol} dir={sortDir} />
                      </button>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.length === 0 ? (
                  <tr><td colSpan={cols.length + 1} className="text-center py-10 text-muted-foreground">No players match current filters</td></tr>
                ) : filtered.map(r => {
                  const isExpanded = expandedId === r.player_id;
                  const sigs = signalsMap.get(r.player_id);
                  return [
                    <tr
                      key={`row-${r.player_id}`}
                      onClick={() => toggleExpand(r.player_id)}
                      className={`border-b border-border/40 cursor-pointer transition-colors ${isExpanded ? "bg-muted/30" : "hover:bg-muted/20"}`}
                    >
                      <td className="px-2 py-2 text-muted-foreground">
                        <ChevronRight className={`h-3 w-3 transition-transform ${isExpanded ? "rotate-90" : ""}`} />
                      </td>
                      <td className="px-2 py-2 font-medium whitespace-nowrap">{r.player_name}</td>
                      <td className="px-2 py-2 text-muted-foreground font-mono">{r.position}</td>
                      <td className="px-2 py-2 text-muted-foreground">{r.team}</td>
                      <td className="px-2 py-2 tabular-nums font-semibold">{fmtNum(r.projection_final, 0)}</td>
                      <td className="px-2 py-2 tabular-nums text-emerald-400">{fmtNum(r.ceiling, 0)}</td>
                      <td className="px-2 py-2 tabular-nums text-red-400">{fmtNum(r.floor, 0)}</td>
                      <td className="px-2 py-2 tabular-nums font-semibold">{fmtNum(r.neeko_rating, 0)}</td>
                      <td className="px-2 py-2"><ConfidenceBadge label={r.confidence_label} /></td>
                      <td className="px-2 py-2 tabular-nums text-amber-400">{fmtNum(r.value_score, 2)}</td>
                      <td className="px-2 py-2 tabular-nums">{pct(r.consistency)}</td>
                      <td className="px-2 py-2 tabular-nums">{fmtNum(r.captain_score, 0)}</td>
                      <td className="px-2 py-2 tabular-nums">{pct(r.upside_pct)}</td>
                      <td className="px-2 py-2 tabular-nums">{fmtNum(r.matchup_multiplier, 2)}</td>
                      <td className="px-2 py-2 tabular-nums text-sky-400">{fmtNum(r.edge_score, 0)}</td>
                      <td className="px-2 py-2 tabular-nums">
                        {sigs && sigs.signal_count > 0 ? (
                          <span className="bg-muted/40 text-foreground/80 px-1.5 py-0.5 rounded font-mono">{sigs.signal_count}</span>
                        ) : "—"}
                      </td>
                      <td className="px-2 py-2 tabular-nums text-muted-foreground">{fmtPrice(r.price)}</td>
                      <td className="px-2 py-2"><RecoBadge color={r.recommendation_color} short={r.recommendation_short} /></td>
                    </tr>,
                    isExpanded && (
                      <tr key={`expand-${r.player_id}`} className="bg-muted/10">
                        <td colSpan={cols.length + 1} className="px-3 py-3">
                          <PlayerDeepPanel
                            player={r}
                            signals={sigs ?? null}
                            edge={edgeMap.get(r.player_id) ?? null}
                            onClose={() => setExpandedId(null)}
                          />
                        </td>
                      </tr>
                    ),
                  ];
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Accuracy Tab ─────────────────────────────────────────────────────────────

type AccuracySubTab = "overview" | "by_player" | "by_team";

function AccuracyTab() {
  const [sub, setSub] = useState<AccuracySubTab>("overview");
  const [kpi, setKpi] = useState<AccuracyKpi | null>(null);
  const [rounds, setRounds] = useState<RoundRow[]>([]);
  const [positions, setPositions] = useState<PositionRow[]>([]);
  const [playerRows, setPlayerRows] = useState<PlayerAccuracyRow[]>([]);
  const [teamRows, setTeamRows] = useState<TeamAccuracyRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [playerSearch, setPlayerSearch] = useState("");

  const fetchData = useCallback(async () => {
    setLoading(true);
    const [kpiRes, roundRes, posRes, playerRes, teamRes] = await Promise.allSettled([
      supabase.from("v_projection_accuracy_homepage").select("*").maybeSingle(),
      supabase.from("v_projection_accuracy_by_round").select("round_number,round_label,mean_error,median_error,within_10_pct,within_20_pct,predictions_count").order("round_number", { ascending: false }).limit(24),
      supabase.from("v_projection_accuracy_by_position").select("*").order("mean_absolute_error", { ascending: true }),
      supabase.from("v_player_accuracy_detail").select("*").order("absolute_error", { ascending: false }).limit(200),
      supabase.from("v_team_accuracy_summary").select("*").order("avg_error", { ascending: true }),
    ]);
    if (kpiRes.status === "fulfilled")    setKpi(kpiRes.value.data as AccuracyKpi | null);
    if (roundRes.status === "fulfilled")  setRounds((roundRes.value.data ?? []) as RoundRow[]);
    if (posRes.status === "fulfilled")    setPositions((posRes.value.data ?? []) as PositionRow[]);
    if (playerRes.status === "fulfilled") setPlayerRows((playerRes.value.data ?? []) as PlayerAccuracyRow[]);
    if (teamRes.status === "fulfilled")   setTeamRows((teamRes.value.data ?? []) as TeamAccuracyRow[]);
    setLoading(false);
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  const chartData = useMemo(() =>
    [...rounds].reverse().map(r => ({ name: r.round_label ?? `R${r.round_number}`, mae: +(r.mean_error ?? 0).toFixed(1), w10: +(r.within_10_pct * 100).toFixed(1) })),
    [rounds]
  );

  const scatterData = useMemo(() =>
    playerRows.slice(0, 100).map(r => ({ x: +(r.projection ?? 0), y: +(r.actual_score ?? 0), name: r.player_name })),
    [playerRows]
  );

  const MAE_GOOD = 18, MAE_OK = 25;
  const maeColor = (mae: number | null) => mae == null ? "" : mae < MAE_GOOD ? "text-emerald-400" : mae < MAE_OK ? "text-amber-400" : "text-red-400";
  const bandColor = (band: string) => band === "within_10" ? "text-emerald-400" : band === "within_20" ? "text-sky-400" : band === "within_30" ? "text-amber-400" : "text-red-400";
  const biasColor = (bias: string) => bias === "over_projected" ? "text-red-400" : bias === "under_projected" ? "text-emerald-400" : "text-muted-foreground";

  const filteredPlayers = useMemo(() =>
    playerSearch
      ? playerRows.filter(r => r.player_name?.toLowerCase().includes(playerSearch.toLowerCase()) || r.team?.toLowerCase().includes(playerSearch.toLowerCase()))
      : playerRows,
    [playerRows, playerSearch]
  );

  const ACCURACY_SUBTABS: { id: AccuracySubTab; label: string }[] = [
    { id: "overview",   label: "Overview + Charts" },
    { id: "by_player",  label: "Player Accuracy" },
    { id: "by_team",    label: "Team Accuracy" },
  ];

  return (
    <div className="space-y-4">
      <AdminSectionIntro
        description="Full projection accuracy analysis — MAE by round, position, team, and individual player. Scatterplot shows projection vs actual across all measured games."
        detail="Sources: v_projection_accuracy_homepage · v_projection_accuracy_by_round · v_projection_accuracy_by_position · v_player_accuracy_detail · v_team_accuracy_summary"
      />

      <div className="flex gap-2 border-b border-border">
        {ACCURACY_SUBTABS.map(({ id, label }) => (
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
        <Button size="sm" variant="outline" onClick={fetchData} className="ml-auto mb-1">
          <RefreshCw className={`h-3.5 w-3.5 mr-1.5 ${loading ? "animate-spin" : ""}`} /> Refresh
        </Button>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20"><RefreshCw className="h-5 w-5 animate-spin text-muted-foreground" /></div>
      ) : (
        <>
          {/* OVERVIEW */}
          {sub === "overview" && (
            <div className="space-y-6">
              {kpi ? (
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
                  {[
                    { label: "Avg MAE",         value: fmtNum(kpi.avg_error),    color: maeColor(kpi.avg_error ?? null),    explain: "Mean absolute error" },
                    { label: "Median Error",     value: fmtNum(kpi.median_error), color: maeColor(kpi.median_error ?? null), explain: "Median absolute error" },
                    { label: "Within 10pts",     value: pct(kpi.within_10 != null ? kpi.within_10 / 100 : null),  color: "text-emerald-400", explain: "% predictions within 10pts" },
                    { label: "Within 15pts",     value: pct(kpi.within_15 != null ? kpi.within_15 / 100 : null),  color: "text-emerald-400", explain: "% predictions within 15pts" },
                    { label: "Within 20pts",     value: pct(kpi.within_20 != null ? kpi.within_20 / 100 : null),  color: "text-emerald-400", explain: "% predictions within 20pts" },
                    { label: "Players Analysed", value: kpi.players_analysed ?? "—", color: "",                    explain: "Unique players measured" },
                  ].map(({ label, value, color, explain }) => (
                    <div key={label} className="rounded-lg border border-border bg-card p-3">
                      <div className="flex items-center gap-1 text-[11px] text-muted-foreground mb-1">{label}<AdminInfoTooltip text={explain} /></div>
                      <div className={`text-xl font-bold tabular-nums ${color}`}>{value}</div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-sm text-muted-foreground p-4 border border-border rounded-lg">No accuracy KPI data yet.</div>
              )}

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                {/* MAE by Round */}
                {chartData.length > 0 && (
                  <div>
                    <div className="flex items-center gap-2 mb-3">
                      <h3 className="text-sm font-medium">MAE by Round</h3>
                      <AdminInfoTooltip text="Lower = better. Green &lt;18, Amber &lt;25, Red &gt;25." />
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

                {/* Projection vs Actual Scatter */}
                {scatterData.length > 0 && (
                  <div>
                    <div className="flex items-center gap-2 mb-3">
                      <h3 className="text-sm font-medium">Projection vs Actual</h3>
                      <AdminInfoTooltip text="Perfect model = diagonal line. Points above = over-projected, below = under-projected." />
                    </div>
                    <div className="h-48 rounded-lg border border-border bg-card p-3">
                      <ResponsiveContainer width="100%" height="100%">
                        <ScatterChart margin={{ top: 4, right: 8, left: -20, bottom: 0 }}>
                          <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
                          <XAxis dataKey="x" name="Projected" tick={{ fontSize: 10 }} label={{ value: "Proj", position: "insideBottom", offset: -4, fontSize: 10 }} />
                          <YAxis dataKey="y" name="Actual" tick={{ fontSize: 10 }} />
                          <RechartsTooltip cursor={{ strokeDasharray: "3 3" }} contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 6, fontSize: 11 }} formatter={(v, n) => [v, n]} />
                          <Scatter data={scatterData} fill="#38bdf8" opacity={0.6} />
                        </ScatterChart>
                      </ResponsiveContainer>
                    </div>
                  </div>
                )}
              </div>

              {/* By Position */}
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

              {/* By Round */}
              {rounds.length > 0 && (
                <div>
                  <h3 className="text-sm font-medium mb-3">By Round</h3>
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
            </div>
          )}

          {/* BY PLAYER */}
          {sub === "by_player" && (
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <div className="relative flex-1 max-w-xs">
                  <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                  <input
                    value={playerSearch}
                    onChange={e => setPlayerSearch(e.target.value)}
                    placeholder="Search player or team…"
                    className="w-full pl-8 pr-3 py-1.5 text-xs bg-background border border-border rounded-md focus:outline-none"
                  />
                </div>
                <span className="text-xs text-muted-foreground">{filteredPlayers.length} rows</span>
              </div>
              {filteredPlayers.length === 0 ? (
                <p className="text-sm text-muted-foreground py-8 text-center">No player accuracy data available yet.</p>
              ) : (
                <div className="overflow-x-auto rounded-lg border border-border">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="border-b border-border bg-muted/30">
                        {["Player", "Team", "Round", "Projected", "Actual", "Error", "Abs Error", "Band", "Bias"].map(h => (
                          <th key={h} className="px-3 py-2 text-left font-medium text-muted-foreground">{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {filteredPlayers.map((r, i) => (
                        <tr key={`${r.player_id}-${r.game_id}-${i}`} className="border-b border-border/40 hover:bg-muted/20">
                          <td className="px-3 py-2 font-medium whitespace-nowrap">{r.player_name}</td>
                          <td className="px-3 py-2 text-muted-foreground">{r.team}</td>
                          <td className="px-3 py-2 text-muted-foreground">{r.round_label}</td>
                          <td className="px-3 py-2 tabular-nums">{fmtNum(r.projection, 0)}</td>
                          <td className="px-3 py-2 tabular-nums font-semibold">{fmtNum(r.actual_score, 0)}</td>
                          <td className={`px-3 py-2 tabular-nums ${(r.error ?? 0) > 0 ? "text-red-400" : "text-emerald-400"}`}>{r.error > 0 ? "+" : ""}{fmtNum(r.error, 0)}</td>
                          <td className={`px-3 py-2 tabular-nums font-semibold ${maeColor(r.absolute_error)}`}>{fmtNum(r.absolute_error, 0)}</td>
                          <td className={`px-3 py-2 ${bandColor(r.accuracy_band)}`}>{r.accuracy_band?.replace("_", " ") ?? "—"}</td>
                          <td className={`px-3 py-2 ${biasColor(r.projection_bias)}`}>{r.projection_bias?.replace("_", " ") ?? "—"}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {/* BY TEAM */}
          {sub === "by_team" && (
            <div className="space-y-3">
              {teamRows.length === 0 ? (
                <p className="text-sm text-muted-foreground py-8 text-center">No team accuracy data available yet.</p>
              ) : (
                <div className="overflow-x-auto rounded-lg border border-border">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="border-b border-border bg-muted/30">
                        {["Team", "Predictions", "Avg MAE", "Median MAE", "Bias", "Over%", "Under%", "Within 10pts", "Within 20pts"].map(h => (
                          <th key={h} className="px-3 py-2 text-left font-medium text-muted-foreground">{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {teamRows.map(t => (
                        <tr key={t.team} className="border-b border-border/40 hover:bg-muted/20">
                          <td className="px-3 py-2 font-medium">{t.team}</td>
                          <td className="px-3 py-2 tabular-nums">{t.prediction_count}</td>
                          <td className={`px-3 py-2 tabular-nums font-semibold ${maeColor(t.avg_error)}`}>{fmtNum(t.avg_error)}</td>
                          <td className="px-3 py-2 tabular-nums">{fmtNum(t.median_error)}</td>
                          <td className={`px-3 py-2 tabular-nums ${(t.prediction_bias ?? 0) > 2 ? "text-red-400" : (t.prediction_bias ?? 0) < -2 ? "text-emerald-400" : "text-muted-foreground"}`}>{t.prediction_bias > 0 ? "+" : ""}{fmtNum(t.prediction_bias)}</td>
                          <td className="px-3 py-2 tabular-nums text-red-400">{pctDirect(t.over_projected_pct)}</td>
                          <td className="px-3 py-2 tabular-nums text-emerald-400">{pctDirect(t.under_projected_pct)}</td>
                          <td className="px-3 py-2 tabular-nums text-emerald-400">{pctDirect(t.within_10_pct)}</td>
                          <td className="px-3 py-2 tabular-nums text-emerald-400">{pctDirect(t.within_20_pct)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}

// ─── Price Full Table Tab ──────────────────────────────────────────────────────

function PriceFullTable() {
  const [rows, setRows] = useState<PriceRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [priceFilter, setPriceFilter] = useState<"all" | "risers" | "fallers" | "value_high" | "projection_high">("all");
  const [sortCol, setSortCol] = useState<string>("price_change");
  const [sortDir, setSortDir] = useState<SortDir>("desc");
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editValue, setEditValue] = useState<string>("");
  const [saving, setSaving] = useState(false);

  const fetchData = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase.from("v_player_price_full").select("*").limit(600);
    console.log("Price full table:", data?.length, "rows | error:", error);
    setRows((data as PriceRow[]) ?? []);
    setLoading(false);
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  const filtered = useMemo(() => {
    let res = rows;
    if (search) res = res.filter(r => r.player_name?.toLowerCase().includes(search.toLowerCase()) || r.team?.toLowerCase().includes(search.toLowerCase()));
    if (priceFilter === "risers")          res = res.filter(r => (r.price_change ?? 0) > 0);
    if (priceFilter === "fallers")         res = res.filter(r => (r.price_change ?? 0) < 0);
    if (priceFilter === "value_high")      res = res.filter(r => (r.value_score ?? 0) > 2.5);
    if (priceFilter === "projection_high") res = res.filter(r => (r.projection_final ?? 0) > 90);
    return [...res].sort((a, b) => {
      const av = (a as Record<string, unknown>)[sortCol] as number ?? 0;
      const bv = (b as Record<string, unknown>)[sortCol] as number ?? 0;
      return sortDir === "asc" ? av - bv : bv - av;
    });
  }, [rows, search, priceFilter, sortCol, sortDir]);

  function handleSort(col: string) {
    if (col === sortCol) setSortDir(d => d === "asc" ? "desc" : "asc");
    else { setSortCol(col); setSortDir("desc"); }
  }

  function startEdit(r: PriceRow) {
    setEditingId(r.player_id);
    setEditValue(String(r.current_price ?? ""));
  }

  async function saveEdit(playerId: number) {
    const newPrice = parseInt(editValue.replace(/[^0-9]/g, ""), 10);
    if (isNaN(newPrice) || newPrice <= 0) { setEditingId(null); return; }
    setSaving(true);
    const { error } = await supabase
      .schema("afl" as never)
      .from("player_prices")
      .update({ price: newPrice, updated_at: new Date().toISOString() })
      .eq("player_id", playerId);
    if (error) {
      console.error("Price update failed:", error);
    } else {
      setRows(prev => prev.map(r => r.player_id === playerId ? { ...r, current_price: newPrice } : r));
    }
    setSaving(false);
    setEditingId(null);
  }

  const PRICE_FILTERS = [
    { id: "all" as const,             label: "All" },
    { id: "risers" as const,          label: "Price Risers" },
    { id: "fallers" as const,         label: "Price Fallers" },
    { id: "value_high" as const,      label: "High Value (>2.5)" },
    { id: "projection_high" as const, label: "Proj >90" },
  ];

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2 items-center">
        <div className="flex gap-1.5 flex-wrap">
          {PRICE_FILTERS.map(f => (
            <button
              key={f.id}
              onClick={() => setPriceFilter(f.id)}
              className={`px-2.5 py-1 text-[11px] rounded-full border font-medium transition-colors ${
                priceFilter === f.id
                  ? "border-foreground bg-foreground text-background"
                  : "border-border/50 text-muted-foreground hover:text-foreground hover:border-foreground/40"
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>
        <div className="relative ml-auto">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search…"
            className="pl-8 pr-3 py-1.5 text-xs bg-background border border-border rounded-md focus:outline-none w-40"
          />
        </div>
        <Button size="sm" variant="outline" onClick={fetchData}>
          <RefreshCw className={`h-3.5 w-3.5 mr-1.5 ${loading ? "animate-spin" : ""}`} /> Refresh
        </Button>
        <span className="text-[11px] text-muted-foreground">{filtered.length} players</span>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20"><RefreshCw className="h-5 w-5 animate-spin text-muted-foreground" /></div>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-border">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-border bg-muted/30">
                {[
                  { key: "player_name", label: "Player" },
                  { key: "team",        label: "Team" },
                  { key: "position",    label: "Pos" },
                  { key: "current_price", label: "Price" },
                  { key: "last_price",  label: "Last Price" },
                  { key: "price_change", label: "Δ Price" },
                  { key: "price_change_pct", label: "Δ %" },
                  { key: "value_score", label: "Value" },
                  { key: "projection",  label: "Proj" },
                  { key: "neeko_rating", label: "Rating" },
                  { key: "recommendation_short", label: "Reco" },
                  { key: "edit",        label: "Edit" },
                ].map(c => (
                  <th key={c.key} className="px-2 py-2 text-left font-medium text-muted-foreground whitespace-nowrap">
                    {c.key !== "edit" ? (
                      <button onClick={() => handleSort(c.key)} className="flex items-center gap-1 hover:text-foreground transition-colors">
                        {c.label} <SortIcon col={c.key} activeCol={sortCol} dir={sortDir} />
                      </button>
                    ) : c.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr><td colSpan={12} className="text-center py-10 text-muted-foreground">No price data</td></tr>
              ) : filtered.map(r => {
                const delta = r.price_change ?? 0;
                const isEditing = editingId === r.player_id;
                return (
                  <tr key={r.player_id} className="border-b border-border/40 hover:bg-muted/20">
                    <td className="px-2 py-2 font-medium whitespace-nowrap">{r.player_name}</td>
                    <td className="px-2 py-2 text-muted-foreground">{r.team}</td>
                    <td className="px-2 py-2 text-muted-foreground font-mono">{r.position}</td>
                    <td className="px-2 py-2 tabular-nums font-semibold">
                      {isEditing ? (
                        <input
                          autoFocus
                          value={editValue}
                          onChange={e => setEditValue(e.target.value)}
                          onKeyDown={e => { if (e.key === "Enter") saveEdit(r.player_id); if (e.key === "Escape") setEditingId(null); }}
                          className="w-24 px-1.5 py-0.5 text-xs bg-background border border-ring rounded focus:outline-none font-mono"
                        />
                      ) : fmtPrice(r.current_price)}
                    </td>
                    <td className="px-2 py-2 tabular-nums text-muted-foreground">{fmtPrice(r.last_price)}</td>
                    <td className={`px-2 py-2 tabular-nums font-semibold ${delta > 0 ? "text-emerald-400" : delta < 0 ? "text-red-400" : "text-muted-foreground"}`}>
                      {delta > 0 ? "+" : ""}{fmtPrice(delta)}
                    </td>
                    <td className={`px-2 py-2 tabular-nums ${delta > 0 ? "text-emerald-400" : delta < 0 ? "text-red-400" : "text-muted-foreground"}`}>
                      {delta > 0 ? "+" : ""}{fmtNum(r.price_change_pct, 1)}%
                    </td>
                    <td className="px-2 py-2 tabular-nums text-amber-400">{fmtNum(r.value_score, 2)}</td>
                    <td className="px-2 py-2 tabular-nums">{fmtNum(r.projection_final, 0)}</td>
                    <td className="px-2 py-2 tabular-nums">{fmtNum(r.neeko_rating, 0)}</td>
                    <td className="px-2 py-2"><RecoBadge color={r.recommendation_color} short={r.recommendation_short} /></td>
                    <td className="px-2 py-2">
                      {isEditing ? (
                        <div className="flex gap-1">
                          <button onClick={() => saveEdit(r.player_id)} disabled={saving} className="p-1 text-emerald-400 hover:text-emerald-300">
                            <Check className="h-3.5 w-3.5" />
                          </button>
                          <button onClick={() => setEditingId(null)} className="p-1 text-muted-foreground hover:text-foreground">
                            <X className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      ) : (
                        <button onClick={() => startEdit(r)} className="p-1 text-muted-foreground hover:text-foreground">
                          <Edit2 className="h-3.5 w-3.5" />
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// ─── Pricing Tab ──────────────────────────────────────────────────────────────

type PricingSubTab = "full_table" | "ingest" | "resolver" | "changes" | "matching";

const PRICING_TABS: { id: PricingSubTab; label: string }[] = [
  { id: "full_table", label: "Full Price Table" },
  { id: "ingest",     label: "Price Ingest" },
  { id: "resolver",   label: "Name Resolver" },
  { id: "changes",    label: "Price Changes" },
  { id: "matching",   label: "Player Matching" },
];

function PricingTab() {
  const [sub, setSub] = useState<PricingSubTab>("full_table");
  return (
    <div>
      <AdminSectionIntro
        description="Full price intelligence table with inline editing, delta tracking, and filters. Plus ingestion tools for new price data."
        detail="Full Price Table = v_player_price_full (current + historical delta). Price Ingest = paste AFL Fantasy CSV. Name Resolver = fix unmatched names. Player Matching = fantasy_player_market table."
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

      {sub === "full_table" && <PriceFullTable />}
      {sub === "ingest"     && <FantasyPricesTab />}
      {sub === "resolver"   && <NameResolverTab />}
      {sub === "changes"    && <PriceChangeDebugTab />}
      {sub === "matching"   && <FantasyPlayerMatchingTab />}
    </div>
  );
}

// ─── Signals Tab ──────────────────────────────────────────────────────────────

type SignalCategory = "master" | "best_buys" | "breakout" | "high_upside" | "risky_traps" | "safe_picks";

const SIGNAL_CATS: { id: SignalCategory; label: string; icon: React.ElementType; desc: string }[] = [
  { id: "master",      label: "All Signals",   icon: TrendingUp,    desc: "Master signal table — 25+ signal types grouped by category" },
  { id: "best_buys",   label: "Best Buys",     icon: Gem,           desc: "Top value picks — high buy score and projected upside vs price" },
  { id: "breakout",    label: "Breakout",      icon: Flame,         desc: "Players with high breakout probability and recent upward trend" },
  { id: "high_upside", label: "High Upside",   icon: Crown,         desc: "High captain_score and high upside — double or captain options" },
  { id: "risky_traps", label: "Risky Traps",   icon: AlertTriangle, desc: "Players priced high but signal engine flags as overvalued traps" },
  { id: "safe_picks",  label: "Safe Picks",    icon: Shield,        desc: "Consistent, low-risk players with high floor scores" },
];

const SIGNAL_GROUPS = [
  { id: "Value",       color: "text-amber-400",   bg: "bg-amber-500/10 border-amber-500/20" },
  { id: "Form",        color: "text-emerald-400", bg: "bg-emerald-500/10 border-emerald-500/20" },
  { id: "Consistency", color: "text-sky-400",     bg: "bg-sky-500/10 border-sky-500/20" },
  { id: "Role",        color: "text-blue-400",    bg: "bg-blue-500/10 border-blue-500/20" },
  { id: "Matchup",     color: "text-violet-400",  bg: "bg-violet-500/10 border-violet-500/20" },
  { id: "Meta",        color: "text-rose-400",    bg: "bg-rose-500/10 border-rose-500/20" },
];

const SIGNAL_CATEGORY_MAP: Record<string, string> = {
  underpriced_elite: "Value", underpriced_mid: "Value", overpriced_trap: "Value",
  value_spike: "Value", value_drop: "Value",
  form_hot: "Form", form_cold: "Form", ceiling_spike: "Form", floor_drop: "Form", volatility_high: "Form",
  ultra_consistent: "Consistency", inconsistent: "Consistency", trend_up: "Consistency", trend_down: "Consistency",
  role_improved: "Role", role_declined: "Role", midfield_boost: "Role", role_uncertain: "Role",
  easy_matchup: "Matchup", hard_matchup: "Matchup", tag_risk: "Matchup", venue_boost: "Matchup",
  captain_viable: "Meta", pod_play: "Meta", high_ownership_risk: "Meta",
  breakout_candidate: "Meta", regression_candidate: "Meta",
};

function SignalsTab() {
  const [masterRows, setMasterRows] = useState<SignalMasterRow[]>([]);
  const [labRows, setLabRows] = useState<LabPlayerRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [category, setCategory] = useState<SignalCategory>("master");
  const [signalFilter, setSignalFilter] = useState<string>("ALL");

  const fetchData = useCallback(async (cat: SignalCategory) => {
    setLoading(true);
    if (cat === "master") {
      const { data, error } = await supabase
        .from("v_player_signals_master")
        .select("*")
        .gt("signal_count", 0)
        .order("signal_count", { ascending: false })
        .limit(200);
      console.log("Signals master:", data?.length, "rows | error:", error);
      setMasterRows((data as SignalMasterRow[]) ?? []);
    } else {
      const viewMap: Record<Exclude<SignalCategory, "master">, string> = {
        best_buys:   "v_player_lab_best_buys",
        breakout:    "v_player_lab_breakout",
        high_upside: "v_player_lab_high_upside",
        risky_traps: "v_player_lab_risky_traps",
        safe_picks:  "v_player_lab_safe_picks",
      };
      const viewName = viewMap[cat as Exclude<SignalCategory, "master">];
      const { data, error } = await supabase
        .from(viewName)
        .select("*")
        .order("total_score", { ascending: false })
        .limit(50);
      console.log(`Signals [${cat}]:`, data?.length, "rows | error:", error);
      setLabRows((data as LabPlayerRow[]) ?? []);
    }
    setLoading(false);
  }, []);

  useEffect(() => { fetchData(category); }, [category, fetchData]);

  // Compute signal type frequency for distribution chart
  const signalDistribution = useMemo(() => {
    const counts: Record<string, number> = {};
    masterRows.forEach(r => {
      (r.signal_tags ?? []).forEach(tag => {
        counts[tag] = (counts[tag] ?? 0) + 1;
      });
    });
    return Object.entries(counts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 15)
      .map(([name, count]) => ({ name, count, group: SIGNAL_CATEGORY_MAP[name] ?? "Other" }));
  }, [masterRows]);

  // Unique signal types in master data
  const allSignalTypes = useMemo(() => {
    const types = new Set<string>();
    masterRows.forEach(r => (r.signal_tags ?? []).forEach(t => types.add(t)));
    return ["ALL", ...Array.from(types).sort()];
  }, [masterRows]);

  const filteredMaster = useMemo(() => {
    if (signalFilter === "ALL") return masterRows;
    return masterRows.filter(r => (r.signal_tags ?? []).includes(signalFilter));
  }, [masterRows, signalFilter]);

  const activeCat = SIGNAL_CATS.find(c => c.id === category)!;

  const groupColors: Record<string, string> = Object.fromEntries(SIGNAL_GROUPS.map(g => [g.id, g.color]));

  return (
    <div className="space-y-4">
      <AdminSectionIntro
        description="Signal engine overview — 25+ signal types across Value, Form, Consistency, Role, Matchup, and Meta categories. Use the master view to see all signals per player."
        detail="Master signals from v_player_signals_master (computed from afl.player_rankings_cache). Category views from v_player_lab_* tables."
      />

      {/* Category selector */}
      <div className="flex flex-wrap gap-2">
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
        <Button size="sm" variant="outline" onClick={() => fetchData(category)} className="ml-auto">
          <RefreshCw className={`h-3.5 w-3.5 mr-1.5 ${loading ? "animate-spin" : ""}`} /> Refresh
        </Button>
      </div>

      {activeCat && (
        <p className="text-xs text-muted-foreground flex items-center gap-1.5">
          <activeCat.icon className="h-3.5 w-3.5" />
          {activeCat.desc} — {loading ? "loading…" : category === "master" ? `${masterRows.length} players · ${signalDistribution.length} signal types active` : `${labRows.length} players`}
        </p>
      )}

      {loading ? (
        <div className="flex items-center justify-center py-20"><RefreshCw className="h-5 w-5 animate-spin text-muted-foreground" /></div>
      ) : (
        <>
          {/* MASTER VIEW */}
          {category === "master" && (
            <div className="space-y-4">
              {/* Signal distribution chart */}
              {signalDistribution.length > 0 && (
                <div>
                  <h3 className="text-sm font-medium mb-3">Signal Distribution (top 15 types)</h3>
                  <div className="h-48 rounded-lg border border-border bg-card p-3">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={signalDistribution} margin={{ top: 4, right: 8, left: -20, bottom: 32 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
                        <XAxis dataKey="name" tick={{ fontSize: 8 }} angle={-35} textAnchor="end" interval={0} />
                        <YAxis tick={{ fontSize: 10 }} />
                        <RechartsTooltip contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 6, fontSize: 11 }} />
                        <Bar dataKey="count" name="Players" radius={[3, 3, 0, 0]}>
                          {signalDistribution.map((d, i) => {
                            const grp = SIGNAL_GROUPS.find(g => g.id === d.group);
                            const fill = grp ? grp.color.replace("text-", "#").replace("amber-400", "f59e0b").replace("emerald-400", "10b981").replace("sky-400", "38bdf8").replace("blue-400", "60a5fa").replace("violet-400", "a78bfa").replace("rose-400", "fb7185") : "#6b7280";
                            const colorMap: Record<string, string> = { "text-amber-400": "#f59e0b", "text-emerald-400": "#10b981", "text-sky-400": "#38bdf8", "text-blue-400": "#60a5fa", "text-violet-400": "#a78bfa", "text-rose-400": "#fb7185" };
                            return <Cell key={i} fill={grp ? colorMap[grp.color] ?? "#6b7280" : "#6b7280"} />;
                          })}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              )}

              {/* Signal group legend */}
              <div className="flex flex-wrap gap-2">
                {SIGNAL_GROUPS.map(g => (
                  <div key={g.id} className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] border ${g.bg}`}>
                    <span className={`font-semibold ${g.color}`}>{g.id}</span>
                  </div>
                ))}
              </div>

              {/* Signal filter */}
              <div className="flex items-center gap-2">
                <span className="text-xs text-muted-foreground">Filter by signal:</span>
                <select
                  value={signalFilter}
                  onChange={e => setSignalFilter(e.target.value)}
                  className="text-xs bg-background border border-border rounded-md px-2 py-1.5 focus:outline-none"
                >
                  {allSignalTypes.map(t => <option key={t}>{t}</option>)}
                </select>
                <span className="text-xs text-muted-foreground">{filteredMaster.length} players</span>
              </div>

              {/* Master table */}
              <div className="overflow-x-auto rounded-lg border border-border">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="border-b border-border bg-muted/30">
                      <th className="px-3 py-2 text-left font-medium text-muted-foreground">#</th>
                      <th className="px-3 py-2 text-left font-medium text-muted-foreground">Player</th>
                      <th className="px-3 py-2 text-left font-medium text-muted-foreground">Pos</th>
                      <th className="px-3 py-2 text-left font-medium text-muted-foreground">Team</th>
                      <th className="px-3 py-2 text-left font-medium text-muted-foreground">Rating</th>
                      <th className="px-3 py-2 text-left font-medium text-muted-foreground">Proj</th>
                      <th className="px-3 py-2 text-left font-medium text-muted-foreground">Price</th>
                      <th className="px-3 py-2 text-left font-medium text-muted-foreground">
                        <span className="flex items-center gap-1">Signals <AdminInfoTooltip text="Total active signal count" /></span>
                      </th>
                      <th className="px-3 py-2 text-left font-medium text-muted-foreground">Strength</th>
                      <th className="px-3 py-2 text-left font-medium text-muted-foreground">Signal Tags</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredMaster.length === 0 ? (
                      <tr><td colSpan={10} className="text-center py-10 text-muted-foreground">No signal data</td></tr>
                    ) : filteredMaster.map((r, i) => (
                      <tr key={`${r.player_id}-${i}`} className="border-b border-border/40 hover:bg-muted/20">
                        <td className="px-3 py-2 text-muted-foreground">{i + 1}</td>
                        <td className="px-3 py-2 font-medium whitespace-nowrap">{r.player_name}</td>
                        <td className="px-3 py-2 text-muted-foreground font-mono">{r.position}</td>
                        <td className="px-3 py-2 text-muted-foreground">{r.team}</td>
                        <td className="px-3 py-2 tabular-nums font-semibold">{fmtNum(r.neeko_rating, 0)}</td>
                        <td className="px-3 py-2 tabular-nums">{fmtNum(r.projection, 0)}</td>
                        <td className="px-3 py-2 tabular-nums text-muted-foreground">{fmtPrice(r.price)}</td>
                        <td className="px-3 py-2 tabular-nums">
                          <span className="font-mono font-bold text-foreground">{r.signal_count}</span>
                        </td>
                        <td className="px-3 py-2 tabular-nums">
                          <div className="flex items-center gap-1.5">
                            <div className="w-16 h-1.5 bg-muted/30 rounded-full overflow-hidden">
                              <div
                                className="h-full bg-sky-500/70 rounded-full"
                                style={{ width: `${Math.min(100, +(r.signal_strength_score ?? 0))}%` }}
                              />
                            </div>
                            <span className="text-[10px] tabular-nums text-muted-foreground">{fmtNum(r.signal_strength_score, 0)}</span>
                          </div>
                        </td>
                        <td className="px-3 py-2 max-w-[240px]">
                          <div className="flex flex-wrap gap-0.5">
                            {(r.signal_tags ?? []).map((tag, ti) => {
                              const grp = SIGNAL_CATEGORY_MAP[tag] ?? "Other";
                              const cls = groupColors[grp] ?? "text-muted-foreground";
                              return (
                                <span key={ti} className={`text-[9px] bg-muted/40 border border-border/30 rounded px-1 py-0.5 whitespace-nowrap font-mono ${cls}`}>
                                  {tag}
                                </span>
                              );
                            })}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* CATEGORY VIEWS */}
          {category !== "master" && (
            <div className="overflow-x-auto rounded-lg border border-border">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-border bg-muted/30">
                    <th className="px-3 py-2 text-left font-medium text-muted-foreground">#</th>
                    <th className="px-3 py-2 text-left font-medium text-muted-foreground">Player</th>
                    <th className="px-3 py-2 text-left font-medium text-muted-foreground">Pos</th>
                    <th className="px-3 py-2 text-left font-medium text-muted-foreground">Team</th>
                    <th className="px-3 py-2 text-left font-medium text-muted-foreground">Rating</th>
                    <th className="px-3 py-2 text-left font-medium text-muted-foreground">Proj</th>
                    <th className="px-3 py-2 text-left font-medium text-muted-foreground">Value</th>
                    <th className="px-3 py-2 text-left font-medium text-muted-foreground">Price</th>
                    <th className="px-3 py-2 text-left font-medium text-muted-foreground">Buy</th>
                    <th className="px-3 py-2 text-left font-medium text-muted-foreground">Opp</th>
                    <th className="px-3 py-2 text-left font-medium text-muted-foreground">Risk</th>
                    <th className="px-3 py-2 text-left font-medium text-muted-foreground">Total</th>
                    <th className="px-3 py-2 text-left font-medium text-muted-foreground">Tags</th>
                    <th className="px-3 py-2 text-left font-medium text-muted-foreground">Reco</th>
                  </tr>
                </thead>
                <tbody>
                  {labRows.length === 0 ? (
                    <tr><td colSpan={14} className="text-center py-10 text-muted-foreground">No signal data for this category</td></tr>
                  ) : labRows.map((r, i) => (
                    <tr key={`${r.player_id ?? r.player_name}-${i}`} className="border-b border-border/40 hover:bg-muted/20">
                      <td className="px-3 py-2 text-muted-foreground">{i + 1}</td>
                      <td className="px-3 py-2 font-medium whitespace-nowrap">{r.player_name}</td>
                      <td className="px-3 py-2 text-muted-foreground font-mono">{r.position}</td>
                      <td className="px-3 py-2 text-muted-foreground">{r.team}</td>
                      <td className="px-3 py-2 tabular-nums font-semibold">{fmtNum(r.neeko_rating)}</td>
                      <td className="px-3 py-2 tabular-nums">{fmtNum(r.projection)}</td>
                      <td className="px-3 py-2 tabular-nums text-amber-400">{fmtNum(r.value_score, 2)}</td>
                      <td className="px-3 py-2 tabular-nums text-muted-foreground">{fmtPrice(r.price)}</td>
                      <td className="px-3 py-2 tabular-nums text-emerald-400">{fmtNum(r.buy_score, 0)}</td>
                      <td className="px-3 py-2 tabular-nums text-sky-400">{fmtNum(r.opportunity_score, 0)}</td>
                      <td className="px-3 py-2 tabular-nums text-amber-400">{fmtNum(r.risk_score, 0)}</td>
                      <td className="px-3 py-2 tabular-nums font-semibold">{fmtNum(r.total_score, 0)}</td>
                      <td className="px-3 py-2 max-w-[140px]">
                        {Array.isArray(r.signal_tags) && r.signal_tags.length > 0 ? (
                          <div className="flex flex-wrap gap-0.5">
                            {r.signal_tags.slice(0, 3).map((tag, ti) => (
                              <span key={ti} className="text-[9px] bg-muted/60 text-muted-foreground rounded px-1 py-0.5 whitespace-nowrap font-mono">{tag}</span>
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
          )}
        </>
      )}
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function AdminPlayerLab() {
  const [tab, setTab] = useState<Tab>("explorer");

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Player Lab</h1>
        <p className="text-muted-foreground text-sm mt-1">Intelligence terminal — projection debugging, signal analysis, accuracy diagnostics, and price inspection.</p>
      </div>

      <div className="flex gap-1 border-b border-border">
        {TABS.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            onClick={() => setTab(id)}
            className={`flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium transition-colors border-b-2 -mb-px ${
              tab === id
                ? "border-foreground text-foreground"
                : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
          >
            <Icon className="h-4 w-4" />
            {label}
          </button>
        ))}
      </div>

      <div>
        {tab === "explorer" && <PlayerExplorerTab />}
        {tab === "accuracy" && <AccuracyTab />}
        {tab === "pricing"  && <PricingTab />}
        {tab === "signals"  && <SignalsTab />}
      </div>
    </div>
  );
}
