import { useState, useCallback, useEffect, useRef, useMemo } from "react";
import { supabase } from "@/lib/supabaseClient";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { RefreshCw, TrendingUp, TrendingDown, TriangleAlert as AlertTriangle, Gem, Swords, Flame, Shield, Crown, ChevronDown, ChevronUp, ChartBar as BarChart3 } from "lucide-react";

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
  recommendation_strength: string;
  recommendation_color: string;
  recommendation_short: string;
  market_watch_category: string;
  best_value_score: number;
}

type TabKey =
  | "hot" | "cold" | "overrated" | "undervalued" | "h2h"
  | "breakout" | "high_risk" | "consistency" | "captain"
  | "price_drop" | "price_rise" | "anomalies";

interface TabDef {
  key: TabKey;
  label: string;
  icon: React.ElementType;
  description: string;
}

const TABS: TabDef[] = [
  { key: "hot",         label: "Hot",          icon: Flame,        description: "High projection + strong form + rising value" },
  { key: "cold",        label: "Cold",          icon: TrendingDown, description: "Declining projection + poor form" },
  { key: "overrated",   label: "Overrated",     icon: AlertTriangle,description: "High price but projection below breakeven" },
  { key: "undervalued", label: "Undervalued",   icon: Gem,          description: "Strong value score + projection beats price expectation" },
  { key: "h2h",         label: "Head-to-Head",  icon: Swords,       description: "Closest projection differences — useful for Start/Sit" },
  { key: "breakout",    label: "Breakout Watch",icon: TrendingUp,   description: "High upside + strong ceiling relative to price" },
  { key: "high_risk",   label: "High Risk",     icon: Shield,       description: "High volatility / low confidence players" },
  { key: "consistency", label: "Consistency",   icon: BarChart3,    description: "Most consistent performers by consistency score" },
  { key: "captain",     label: "Captain Options",icon: Crown,       description: "Top captain score players" },
  { key: "price_drop",  label: "Price Drops",   icon: ChevronDown,  description: "Biggest expected price decreases" },
  { key: "price_rise",  label: "Price Rises",   icon: ChevronUp,    description: "Biggest expected price increases" },
  { key: "anomalies",   label: "Anomalies",     icon: AlertTriangle,description: "Unusual projections or model outliers" },
];

function fmtPrice(p: number) {
  if (p >= 1_000_000) return `$${(p / 1_000_000).toFixed(2)}M`;
  if (p >= 1_000) return `$${(p / 1_000).toFixed(0)}k`;
  return `$${p}`;
}

function fmtNum(n: number | null | undefined, dec = 1) {
  if (n === null || n === undefined) return "—";
  return n.toFixed(dec);
}

function PosBadge({ pos }: { pos: string }) {
  const cls = pos === "FWD" ? "bg-red-500/15 text-red-400 border-red-500/25"
    : pos === "MID" ? "bg-sky-500/15 text-sky-400 border-sky-500/25"
    : pos === "DEF" ? "bg-emerald-500/15 text-emerald-400 border-emerald-500/25"
    : "bg-amber-500/15 text-amber-400 border-amber-500/25";
  return (
    <span className={`inline-flex items-center rounded px-1.5 py-0.5 text-[10px] font-semibold border ${cls}`}>{pos}</span>
  );
}

function RatingBadge({ label }: { label: string | null | undefined }) {
  if (!label) return <span className="text-muted-foreground text-xs">—</span>;
  const up = label.toUpperCase();
  const cls = up.includes("ELITE") || up.includes("STRONG") || up.includes("BUY") ? "text-emerald-400"
    : up.includes("HIGH") || up.includes("RISKY") || up.includes("SELL") ? "text-red-400"
    : up.includes("MED") || up.includes("HOLD") || up.includes("MODERATE") ? "text-amber-400"
    : "text-muted-foreground";
  return <span className={`text-xs font-medium ${cls}`}>{label}</span>;
}

interface ColDef {
  key: string;
  label: string;
  render: (p: PlayerRow) => React.ReactNode;
  align?: "right";
}

function PlayerTable({ players, cols, emptyMsg }: { players: PlayerRow[]; cols: ColDef[]; emptyMsg?: string }) {
  if (players.length === 0) {
    return <p className="text-sm text-muted-foreground py-6 text-center">{emptyMsg ?? "No players found."}</p>;
  }
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-border/40">
            <th className="text-left py-2 pr-3 text-xs font-medium text-muted-foreground uppercase tracking-wide">#</th>
            <th className="text-left py-2 pr-3 text-xs font-medium text-muted-foreground uppercase tracking-wide">Player</th>
            <th className="text-left py-2 pr-3 text-xs font-medium text-muted-foreground uppercase tracking-wide">Team</th>
            <th className="text-left py-2 pr-3 text-xs font-medium text-muted-foreground uppercase tracking-wide">Pos</th>
            {cols.map(c => (
              <th key={c.key} className={`py-2 pr-3 text-xs font-medium text-muted-foreground uppercase tracking-wide ${c.align === "right" ? "text-right" : "text-left"}`}>
                {c.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {players.map((p, i) => (
            <tr key={p.player_id ?? i} className="border-b border-border/20 last:border-0 hover:bg-muted/20 transition-colors">
              <td className="py-2 pr-3 text-muted-foreground tabular-nums text-xs">{i + 1}</td>
              <td className="py-2 pr-3 font-medium whitespace-nowrap">{p.player_name}</td>
              <td className="py-2 pr-3 text-muted-foreground text-xs whitespace-nowrap">{p.team}</td>
              <td className="py-2 pr-3"><PosBadge pos={p.position} /></td>
              {cols.map(c => (
                <td key={c.key} className={`py-2 pr-3 tabular-nums ${c.align === "right" ? "text-right" : ""}`}>
                  {c.render(p)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

const TAB_COLS: Record<TabKey, ColDef[]> = {
  hot: [
    { key: "proj",    label: "Projection",  render: p => <span className="font-semibold text-emerald-400">{fmtNum(p.projection_final)}</span>, align: "right" },
    { key: "neeko",   label: "Neeko",       render: p => fmtNum(p.neeko_rating, 0), align: "right" },
    { key: "form",    label: "Form",        render: p => <RatingBadge label={p.form_score?.toFixed(1)} /> },
    { key: "val",     label: "Value",       render: p => <RatingBadge label={p.value_tag} /> },
    { key: "price",   label: "Price",       render: p => <span className="text-muted-foreground">{fmtPrice(p.price)}</span>, align: "right" },
  ],
  cold: [
    { key: "proj",    label: "Projection",  render: p => <span className="font-semibold text-red-400">{fmtNum(p.projection_final)}</span>, align: "right" },
    { key: "form",    label: "Form",        render: p => fmtNum(p.form_score, 1) },
    { key: "neeko",   label: "Neeko",       render: p => fmtNum(p.neeko_rating, 0), align: "right" },
    { key: "price",   label: "Price",       render: p => <span className="text-muted-foreground">{fmtPrice(p.price)}</span>, align: "right" },
  ],
  overrated: [
    { key: "price",   label: "Price",       render: p => <span className="font-semibold text-red-400">{fmtPrice(p.price)}</span>, align: "right" },
    { key: "proj",    label: "Projection",  render: p => fmtNum(p.projection_final), align: "right" },
    { key: "breakeven",label:"Breakeven",   render: p => fmtNum(p.price / 7200, 1), align: "right" },
    { key: "edge",    label: "Edge (pts)",  render: p => {
      const be = p.price / 7200;
      const edge = p.projection_final - be;
      return <span className={`font-semibold ${edge < 0 ? "text-red-400" : "text-emerald-400"}`}>{edge.toFixed(1)}</span>;
    }, align: "right" },
    { key: "val",     label: "Value Tag",   render: p => <RatingBadge label={p.value_tag} /> },
  ],
  undervalued: [
    { key: "proj",    label: "Projection",  render: p => <span className="font-semibold text-emerald-400">{fmtNum(p.projection_final)}</span>, align: "right" },
    { key: "price",   label: "Price",       render: p => fmtPrice(p.price), align: "right" },
    { key: "valScore",label: "Value Score", render: p => <span className="font-semibold text-emerald-400">{fmtNum(p.best_value_score, 1)}</span>, align: "right" },
    { key: "val",     label: "Value Tag",   render: p => <RatingBadge label={p.value_tag} /> },
    { key: "neeko",   label: "Neeko",       render: p => fmtNum(p.neeko_rating, 0), align: "right" },
  ],
  h2h: [
    { key: "proj",    label: "Projection",  render: p => <span className="font-semibold">{fmtNum(p.projection_final)}</span>, align: "right" },
    { key: "ceil",    label: "Ceiling",     render: p => fmtNum(p.ceiling), align: "right" },
    { key: "floor",   label: "Floor",       render: p => fmtNum(p.floor), align: "right" },
    { key: "captain", label: "Captain",     render: p => <RatingBadge label={p.captain_rating} /> },
    { key: "price",   label: "Price",       render: p => fmtPrice(p.price), align: "right" },
  ],
  breakout: [
    { key: "proj",    label: "Projection",  render: p => fmtNum(p.projection_final), align: "right" },
    { key: "ceil",    label: "Ceiling",     render: p => <span className="font-semibold text-emerald-400">{fmtNum(p.ceiling)}</span>, align: "right" },
    { key: "upside",  label: "Upside",      render: p => <RatingBadge label={p.upside_rating} /> },
    { key: "upsidePct",label:"Upside %",    render: p => <span className="font-semibold text-emerald-400">{fmtNum(p.upside_pct, 0)}%</span>, align: "right" },
    { key: "price",   label: "Price",       render: p => fmtPrice(p.price), align: "right" },
  ],
  high_risk: [
    { key: "proj",    label: "Projection",  render: p => fmtNum(p.projection_final), align: "right" },
    { key: "risk",    label: "Risk",        render: p => <RatingBadge label={p.risk_rating} /> },
    { key: "ceil",    label: "Ceiling",     render: p => fmtNum(p.ceiling), align: "right" },
    { key: "floor",   label: "Floor",       render: p => fmtNum(p.floor), align: "right" },
    { key: "range",   label: "Range",       render: p => <span className="text-red-400 font-semibold">{fmtNum((p.ceiling ?? 0) - (p.floor ?? 0), 0)}</span>, align: "right" },
  ],
  consistency: [
    { key: "cons",    label: "Consistency", render: p => <span className="font-semibold text-emerald-400">{fmtNum(p.consistency, 1)}</span>, align: "right" },
    { key: "proj",    label: "Projection",  render: p => fmtNum(p.projection_final), align: "right" },
    { key: "floor",   label: "Floor",       render: p => fmtNum(p.floor), align: "right" },
    { key: "neeko",   label: "Neeko",       render: p => fmtNum(p.neeko_rating, 0), align: "right" },
    { key: "price",   label: "Price",       render: p => fmtPrice(p.price), align: "right" },
  ],
  captain: [
    { key: "captain", label: "Capt. Score", render: p => <span className="font-semibold text-amber-400">{fmtNum(p.captain_score, 0)}</span>, align: "right" },
    { key: "captRating",label:"Rating",     render: p => <RatingBadge label={p.captain_rating} /> },
    { key: "proj",    label: "Projection",  render: p => fmtNum(p.projection_final), align: "right" },
    { key: "ceil",    label: "Ceiling",     render: p => fmtNum(p.ceiling), align: "right" },
    { key: "price",   label: "Price",       render: p => fmtPrice(p.price), align: "right" },
  ],
  price_drop: [
    { key: "expChange",label:"Exp. Change", render: p => {
      const be = p.price / 7200;
      const chg = Math.round((p.projection_final - be) * 7200);
      return <span className="font-semibold text-red-400">${chg.toLocaleString()}</span>;
    }, align: "right" },
    { key: "proj",    label: "Projection",  render: p => fmtNum(p.projection_final), align: "right" },
    { key: "breakeven",label:"Breakeven",   render: p => fmtNum(p.price / 7200, 1), align: "right" },
    { key: "price",   label: "Price",       render: p => fmtPrice(p.price), align: "right" },
  ],
  price_rise: [
    { key: "expChange",label:"Exp. Change", render: p => {
      const be = p.price / 7200;
      const chg = Math.round((p.projection_final - be) * 7200);
      return <span className="font-semibold text-emerald-400">+${chg.toLocaleString()}</span>;
    }, align: "right" },
    { key: "proj",    label: "Projection",  render: p => fmtNum(p.projection_final), align: "right" },
    { key: "breakeven",label:"Breakeven",   render: p => fmtNum(p.price / 7200, 1), align: "right" },
    { key: "price",   label: "Price",       render: p => fmtPrice(p.price), align: "right" },
  ],
  anomalies: [
    { key: "proj",    label: "Projection",  render: p => <span className="font-semibold text-amber-400">{fmtNum(p.projection_final)}</span>, align: "right" },
    { key: "neeko",   label: "Neeko",       render: p => fmtNum(p.neeko_rating, 0), align: "right" },
    { key: "matchup", label: "Matchup",     render: p => <RatingBadge label={p.matchup_rating} /> },
    { key: "reco",    label: "AI Reco",     render: p => <RatingBadge label={p.ai_recommendation} /> },
    { key: "price",   label: "Price",       render: p => fmtPrice(p.price), align: "right" },
  ],
};

const TAB_LIMITS: Record<TabKey, number> = {
  hot: 10, cold: 10, overrated: 25, undervalued: 25,
  h2h: 10, breakout: 20, high_risk: 20, consistency: 20,
  captain: 10, price_drop: 20, price_rise: 20, anomalies: 15,
};

export default function AdminPlayersIntelligence() {
  const [activeTab, setActiveTab] = useState<TabKey>("hot");
  const [players, setPlayers] = useState<PlayerRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [lastRefreshed, setLastRefreshed] = useState<Date | null>(null);
  const hasLoaded = useRef(false);

  const fetchPlayers = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await supabase
        .from("v_rankings_master")
        .select("player_id,player_name,team,position,projection_final,projection,ceiling,floor,price,neeko_rating,value_score,value_tag,consistency,form_score,captain_score,captain_rating,upside_rating,upside_pct,risk_rating,matchup_rating,matchup_multiplier,ai_recommendation,recommendation_strength,recommendation_color,recommendation_short,market_watch_category,best_value_score")
        .limit(700);
      if (data) setPlayers(data as PlayerRow[]);
    } finally {
      setLoading(false);
      setLastRefreshed(new Date());
    }
  }, []);

  useEffect(() => {
    if (!hasLoaded.current) {
      hasLoaded.current = true;
      fetchPlayers();
    }
  }, [fetchPlayers]);

  const tabData = useMemo((): PlayerRow[] => {
    const limit = TAB_LIMITS[activeTab];
    const sorted = [...players];
    switch (activeTab) {
      case "hot":
        return sorted
          .sort((a, b) => (b.neeko_rating ?? 0) - (a.neeko_rating ?? 0))
          .slice(0, limit);
      case "cold":
        return sorted
          .filter(p => (p.form_score ?? 0) < 50)
          .sort((a, b) => (a.neeko_rating ?? 0) - (b.neeko_rating ?? 0))
          .slice(0, limit);
      case "overrated":
        return sorted
          .filter(p => p.price > 700_000)
          .sort((a, b) => {
            const edgeA = (a.projection_final ?? 0) - (a.price / 7200);
            const edgeB = (b.projection_final ?? 0) - (b.price / 7200);
            return edgeA - edgeB;
          })
          .slice(0, limit);
      case "undervalued":
        return sorted
          .filter(p => (p.best_value_score ?? 0) > 0)
          .sort((a, b) => (b.best_value_score ?? 0) - (a.best_value_score ?? 0))
          .slice(0, limit);
      case "h2h":
        return sorted
          .filter(p => (p.projection_final ?? 0) > 0)
          .sort((a, b) => (b.captain_score ?? 0) - (a.captain_score ?? 0))
          .slice(0, limit);
      case "breakout":
        return sorted
          .sort((a, b) => (b.upside_pct ?? 0) - (a.upside_pct ?? 0))
          .slice(0, limit);
      case "high_risk": {
        return sorted
          .filter(p => {
            const range = (p.ceiling ?? 0) - (p.floor ?? 0);
            return range > 60;
          })
          .sort((a, b) => {
            const rangeA = (a.ceiling ?? 0) - (a.floor ?? 0);
            const rangeB = (b.ceiling ?? 0) - (b.floor ?? 0);
            return rangeB - rangeA;
          })
          .slice(0, limit);
      }
      case "consistency":
        return sorted
          .filter(p => (p.consistency ?? 0) > 0)
          .sort((a, b) => (b.consistency ?? 0) - (a.consistency ?? 0))
          .slice(0, limit);
      case "captain":
        return sorted
          .sort((a, b) => (b.captain_score ?? 0) - (a.captain_score ?? 0))
          .slice(0, limit);
      case "price_drop":
        return sorted
          .sort((a, b) => {
            const edgeA = (a.projection_final ?? 0) - (a.price / 7200);
            const edgeB = (b.projection_final ?? 0) - (b.price / 7200);
            return edgeA - edgeB;
          })
          .slice(0, limit);
      case "price_rise":
        return sorted
          .sort((a, b) => {
            const edgeA = (a.projection_final ?? 0) - (a.price / 7200);
            const edgeB = (b.projection_final ?? 0) - (b.price / 7200);
            return edgeB - edgeA;
          })
          .filter(p => {
            const be = p.price / 7200;
            return (p.projection_final ?? 0) > be;
          })
          .slice(0, limit);
      case "anomalies":
        return sorted
          .filter(p => {
            const be = p.price / 7200;
            const edge = (p.projection_final ?? 0) - be;
            const highProj = (p.projection_final ?? 0) > 110;
            const badReco = (p.ai_recommendation ?? "").toLowerCase().includes("sell") || (p.ai_recommendation ?? "").toLowerCase().includes("avoid");
            const mismatch = highProj && badReco;
            const extremeEdge = Math.abs(edge) > 50;
            return mismatch || extremeEdge;
          })
          .sort((a, b) => {
            const rangeA = Math.abs((a.projection_final ?? 0) - (a.price / 7200));
            const rangeB = Math.abs((b.projection_final ?? 0) - (b.price / 7200));
            return rangeB - rangeA;
          })
          .slice(0, limit);
      default:
        return [];
    }
  }, [players, activeTab]);

  const activeTabDef = TABS.find(t => t.key === activeTab)!;

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-base font-semibold">Player Intelligence</h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            {lastRefreshed
              ? `${players.length.toLocaleString()} players loaded · ${lastRefreshed.toLocaleTimeString("en-AU", { hour: "2-digit", minute: "2-digit" })}`
              : "Real data from v_rankings_master — all 700+ AFL players"}
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={fetchPlayers} disabled={loading}>
          <RefreshCw className={`h-4 w-4 mr-2 ${loading ? "animate-spin" : ""}`} />
          Refresh
        </Button>
      </div>

      {/* Tab strip */}
      <div className="overflow-x-auto border-b border-border pb-0" style={{ scrollbarWidth: "none" }}>
        <div className="flex gap-0 min-w-max">
          {TABS.map(({ key, label, icon: Icon }) => (
            <button
              key={key}
              onClick={() => setActiveTab(key)}
              className={`flex items-center gap-1.5 px-3.5 py-2.5 text-xs font-medium whitespace-nowrap border-b-2 transition-colors ${
                activeTab === key
                  ? "border-foreground text-foreground"
                  : "border-transparent text-muted-foreground hover:text-foreground"
              }`}
            >
              <Icon className="h-3.5 w-3.5" />
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* Tab content */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-sm font-semibold">
            <activeTabDef.icon className="h-4 w-4 text-muted-foreground" />
            {activeTabDef.label}
            <span className="text-xs font-normal text-muted-foreground ml-1">— {activeTabDef.description}</span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="space-y-2">
              {[1, 2, 3, 4, 5, 6, 7, 8].map(i => (
                <div key={i} className="h-8 rounded bg-muted animate-pulse" />
              ))}
            </div>
          ) : (
            <PlayerTable
              players={tabData}
              cols={TAB_COLS[activeTab]}
              emptyMsg={`No players match the criteria for "${activeTabDef.label}"`}
            />
          )}
          {!loading && tabData.length > 0 && (
            <p className="text-xs text-muted-foreground mt-3">
              Showing {tabData.length} of {players.length.toLocaleString()} players · Source: v_rankings_master
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
