import { useState, useEffect, useCallback } from "react";
import { X, ArrowRight, Copy, Check, TrendingUp, TrendingDown, Minus } from "lucide-react";
import { supabase } from "@/lib/supabaseClient";
import { MWPlayerRow } from "./types";
import { fmtPrice, fmtNum, fmtPriceChange, riskColor, momentumColor, priceChangeColor } from "./helpers";
import { track } from "@/lib/analytics";

interface Props {
  onClose: () => void;
  prefillOutId?: number | null;
  prefillInId?: number | null;
  allPlayers: MWPlayerRow[];
}

export function TradeImpactModal({ onClose, prefillOutId, prefillInId, allPlayers }: Props) {
  const [outSearch, setOutSearch] = useState("");
  const [inSearch, setInSearch] = useState("");
  const [outPlayer, setOutPlayer] = useState<MWPlayerRow | null>(null);
  const [inPlayer, setInPlayer] = useState<MWPlayerRow | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    track("market_watch_compare_open");
    if (prefillOutId != null) {
      const p = allPlayers.find(r => r.player_id === prefillOutId) ?? null;
      setOutPlayer(p);
      if (p) setOutSearch(p.player_name);
    }
    if (prefillInId != null) {
      const p = allPlayers.find(r => r.player_id === prefillInId) ?? null;
      setInPlayer(p);
      if (p) setInSearch(p.player_name);
    }
  }, [prefillOutId, prefillInId, allPlayers]);

  const filteredOut = outSearch.length >= 2
    ? allPlayers.filter(p =>
        p.player_name.toLowerCase().includes(outSearch.toLowerCase()) &&
        p.player_id !== inPlayer?.player_id
      ).slice(0, 8)
    : [];

  const filteredIn = inSearch.length >= 2
    ? allPlayers.filter(p =>
        p.player_name.toLowerCase().includes(inSearch.toLowerCase()) &&
        p.player_id !== outPlayer?.player_id
      ).slice(0, 8)
    : [];

  const handleRun = useCallback(() => {
    if (!outPlayer || !inPlayer) return;
    track("market_watch_compare_run", {
      out_player: outPlayer.player_name,
      in_player: inPlayer.player_name,
    });
  }, [outPlayer, inPlayer]);

  const handleCopy = () => {
    if (!outPlayer || !inPlayer) return;
    const text = buildSummaryText(outPlayer, inPlayer);
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  const showComparison = outPlayer && inPlayer;
  if (showComparison) {
    handleRun();
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: "rgba(0,0,0,0.85)", backdropFilter: "blur(8px)" }}
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-2xl rounded-2xl overflow-hidden"
        style={{
          background: "linear-gradient(160deg, #111 0%, #0d0d0d 100%)",
          border: "1px solid rgba(255,255,255,0.08)",
          boxShadow: "0 40px 80px rgba(0,0,0,0.6)",
        }}
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-6 py-4 border-b border-white/5">
          <div>
            <h2 className="text-base font-bold text-white">Trade Impact Calculator</h2>
            <p className="text-[11px] text-white/35 mt-0.5">Compare any OUT and IN player side-by-side</p>
          </div>
          <button onClick={onClose} className="text-white/30 hover:text-white/70 transition-colors p-1">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="p-6">
          <div className="grid grid-cols-2 gap-4 mb-6">
            <PlayerSelector
              label="OUT (Selling)"
              search={outSearch}
              onSearchChange={(v) => { setOutSearch(v); if (!v) setOutPlayer(null); }}
              suggestions={filteredOut}
              selected={outPlayer}
              onSelect={(p) => { setOutPlayer(p); setOutSearch(p.player_name); }}
              accentClass="border-red-400/25 focus:border-red-400/50"
              labelClass="text-red-400"
            />
            <PlayerSelector
              label="IN (Buying)"
              search={inSearch}
              onSearchChange={(v) => { setInSearch(v); if (!v) setInPlayer(null); }}
              suggestions={filteredIn}
              selected={inPlayer}
              onSelect={(p) => { setInPlayer(p); setInSearch(p.player_name); }}
              accentClass="border-green-400/25 focus:border-green-400/50"
              labelClass="text-green-400"
            />
          </div>

          {showComparison ? (
            <ComparisonPanel out={outPlayer!} inn={inPlayer!} />
          ) : (
            <div className="rounded-xl border border-white/5 bg-white/[0.02] p-8 text-center text-white/25 text-sm">
              Search and select both players to see the trade impact
            </div>
          )}

          {showComparison && (
            <button
              onClick={handleCopy}
              className="mt-4 w-full flex items-center justify-center gap-2 py-2.5 rounded-xl border border-white/10 text-sm text-white/50 hover:text-white/80 hover:border-white/20 transition-all"
            >
              {copied ? <Check className="h-4 w-4 text-green-400" /> : <Copy className="h-4 w-4" />}
              {copied ? "Copied!" : "Copy trade summary"}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

function PlayerSelector({
  label, search, onSearchChange, suggestions, selected, onSelect, accentClass, labelClass,
}: {
  label: string;
  search: string;
  onSearchChange: (v: string) => void;
  suggestions: MWPlayerRow[];
  selected: MWPlayerRow | null;
  onSelect: (p: MWPlayerRow) => void;
  accentClass: string;
  labelClass: string;
}) {
  return (
    <div className="relative">
      <p className={`text-[10px] font-bold uppercase tracking-widest mb-1.5 ${labelClass}`}>{label}</p>
      <input
        value={search}
        onChange={e => onSearchChange(e.target.value)}
        placeholder="Search player..."
        className={`w-full rounded-lg border bg-white/[0.03] px-3 py-2 text-sm text-white placeholder-white/20 outline-none transition-colors ${accentClass}`}
      />
      {suggestions.length > 0 && !selected && (
        <div className="absolute top-full left-0 right-0 mt-1 rounded-lg border border-white/10 bg-[#111] z-10 shadow-xl overflow-hidden">
          {suggestions.map(p => (
            <button
              key={p.player_id}
              onClick={() => onSelect(p)}
              className="w-full flex items-center justify-between px-3 py-2 text-left hover:bg-white/5 transition-colors border-b border-white/5 last:border-0"
            >
              <div>
                <p className="text-sm text-white font-medium">{p.player_name}</p>
                <p className="text-[10px] text-white/35">{p.team} · {p.position}</p>
              </div>
              <div className="text-right">
                <p className="text-xs text-white/50">{fmtPrice(p.price)}</p>
                <p className="text-[10px] text-white/30">{fmtNum(p.projection, 1)} proj</p>
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function ComparisonPanel({ out, inn }: { out: MWPlayerRow; inn: MWPlayerRow }) {
  const rows: { label: string; outVal: string; inVal: string; delta: number | null; higherIsBetter: boolean }[] = [
    {
      label: "Projection",
      outVal: fmtNum(out.projection, 1),
      inVal: fmtNum(inn.projection, 1),
      delta: inn.projection - out.projection,
      higherIsBetter: true,
    },
    {
      label: "Breakeven",
      outVal: fmtNum(out.breakeven, 1),
      inVal: fmtNum(inn.breakeven, 1),
      delta: inn.breakeven - out.breakeven,
      higherIsBetter: false,
    },
    {
      label: "Price Edge",
      outVal: `${fmtNum(out.price_edge_pts, 1)} pts`,
      inVal: `${fmtNum(inn.price_edge_pts, 1)} pts`,
      delta: inn.price_edge_pts - out.price_edge_pts,
      higherIsBetter: true,
    },
    {
      label: "Exp. Price Change",
      outVal: fmtPriceChange(out.expected_price_change),
      inVal: fmtPriceChange(inn.expected_price_change),
      delta: inn.expected_price_change - out.expected_price_change,
      higherIsBetter: true,
    },
    {
      label: "Proj. Price After Round",
      outVal: fmtPrice(out.projected_price ?? out.price),
      inVal: fmtPrice(inn.projected_price ?? inn.price),
      delta: (inn.projected_price ?? inn.price) - (out.projected_price ?? out.price),
      higherIsBetter: true,
    },
    {
      label: "Risk %",
      outVal: `${fmtNum(out.risk_pct, 0)}%`,
      inVal: `${fmtNum(inn.risk_pct, 0)}%`,
      delta: inn.risk_pct - out.risk_pct,
      higherIsBetter: false,
    },
    {
      label: "Ceiling",
      outVal: fmtNum(out.ceiling, 0),
      inVal: fmtNum(inn.ceiling, 0),
      delta: inn.ceiling - out.ceiling,
      higherIsBetter: true,
    },
    {
      label: "Trade Score",
      outVal: fmtNum(out.trade_score, 1),
      inVal: fmtNum(inn.trade_score, 1),
      delta: inn.trade_score - out.trade_score,
      higherIsBetter: true,
    },
    {
      label: "Price",
      outVal: fmtPrice(out.price),
      inVal: fmtPrice(inn.price),
      delta: inn.price - out.price,
      higherIsBetter: false,
    },
  ];

  const outReasons = Array.isArray(out.reasons) ? out.reasons.filter(Boolean) : [];
  const inReasons  = Array.isArray(inn.reasons) ? inn.reasons.filter(Boolean) : [];

  return (
    <div className="rounded-xl border border-white/8 bg-white/[0.02] overflow-hidden">
      <div className="grid grid-cols-3 border-b border-white/5 text-[10px] font-bold uppercase tracking-wider text-white/30">
        <div className="px-3 py-2 text-red-400">OUT — {out.player_name}</div>
        <div className="px-3 py-2 text-center">Metric</div>
        <div className="px-3 py-2 text-right text-green-400">IN — {inn.player_name}</div>
      </div>
      {rows.map(row => {
        const isPositive = row.delta != null && (row.higherIsBetter ? row.delta > 0 : row.delta < 0);
        const isNegative = row.delta != null && (row.higherIsBetter ? row.delta < 0 : row.delta > 0);
        const deltaIcon = isPositive
          ? <TrendingUp className="h-3 w-3 text-green-400" />
          : isNegative
            ? <TrendingDown className="h-3 w-3 text-red-400" />
            : <Minus className="h-3 w-3 text-white/20" />;

        return (
          <div key={row.label} className="grid grid-cols-3 border-b border-white/5 last:border-0 items-center">
            <div className="px-3 py-2 text-sm font-medium text-white/60 tabular-nums">{row.outVal}</div>
            <div className="px-3 py-2 flex items-center justify-center gap-1">
              <span className="text-[10px] text-white/30">{row.label}</span>
              {deltaIcon}
            </div>
            <div className={`px-3 py-2 text-sm font-semibold text-right tabular-nums ${
              isPositive ? "text-green-400" : isNegative ? "text-red-400" : "text-white/60"
            }`}>{row.inVal}</div>
          </div>
        );
      })}

      {(outReasons.length > 0 || inReasons.length > 0) && (
        <div className="grid grid-cols-2 gap-0 border-t border-white/5">
          <div className="px-3 py-3 border-r border-white/5">
            <p className="text-[9px] text-red-400/60 uppercase tracking-wider mb-1.5">Why sell</p>
            {outReasons.slice(0, 2).map((r, i) => (
              <p key={i} className="text-[10px] text-white/30 leading-snug mb-0.5">· {r}</p>
            ))}
          </div>
          <div className="px-3 py-3">
            <p className="text-[9px] text-green-400/60 uppercase tracking-wider mb-1.5">Why buy</p>
            {inReasons.slice(0, 2).map((r, i) => (
              <p key={i} className="text-[10px] text-white/30 leading-snug mb-0.5">· {r}</p>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function buildSummaryText(out: MWPlayerRow, inn: MWPlayerRow): string {
  const ptsDelta = inn.projection - out.projection;
  const priceDelta = inn.expected_price_change - out.expected_price_change;
  return [
    `Trade Analysis: OUT ${out.player_name} → IN ${inn.player_name}`,
    `Points Gain: ${ptsDelta >= 0 ? "+" : ""}${ptsDelta.toFixed(1)}`,
    `Price Change Delta: ${priceDelta >= 0 ? "+" : ""}$${Math.round(Math.abs(priceDelta) / 1000)}k`,
    `Risk Change: ${(inn.risk_pct - out.risk_pct) >= 0 ? "+" : ""}${(inn.risk_pct - out.risk_pct).toFixed(0)}%`,
    `Trade Score: ${out.trade_score.toFixed(1)} → ${inn.trade_score.toFixed(1)}`,
    `Generated by Neeko Sports`,
  ].join("\n");
}
