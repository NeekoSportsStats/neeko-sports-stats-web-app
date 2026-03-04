import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Crown, ArrowRight, Star, TrendingUp, TriangleAlert as AlertTriangle, Check, Database, Cpu, Radio, Trophy, Users, ChartBar as BarChart2, Lock, Crosshair, Zap, ShieldAlert, ChartLine as LineChart } from "lucide-react";
import { supabase } from "@/lib/supabaseClient";
import { useAuth } from "@/lib/auth";
import { NEEKO_PRICING } from "@/config/neekoPricing";

// ─── Types ────────────────────────────────────────────────────────────────────

interface RankingRow {
  player_name: string;
  team: string;
  projection_final: number | null;
  neeko_rating: number | null;
}

interface EdgeRow {
  player_name: string;
  team: string;
  projection_final: number | null;
  captain_score: number | null;
  upside_rating: number | null;
  risk_rating: number | null;
  ai_summary: string | null;
  section: string;
}

// ─── Static data ──────────────────────────────────────────────────────────────

const FEATURES = [
  {
    icon: Cpu,
    title: "AI Player Analysis",
    desc: "Each player is evaluated using matchup difficulty, recent form and historical scoring to project realistic fantasy outcomes.",
  },
  {
    icon: Radio,
    title: "Weekly Edge Signals",
    desc: "Captain picks, breakout watches and trap warnings generated from projection mismatches.",
  },
  {
    icon: BarChart2,
    title: "Advanced Rankings",
    desc: "Neeko Rating combines projection, matchup grade, volatility band and AI verdict.",
  },
];

const HOW_IT_WORKS = [
  {
    step: "01",
    icon: Database,
    title: "Data Modelling",
    desc: "Historical match data, player statistics and form trends are normalised into fantasy relevant metrics.",
  },
  {
    step: "02",
    icon: Cpu,
    title: "AI Projection Engine",
    desc: "Projection models estimate scoring range, ceiling and volatility for each player.",
  },
  {
    step: "03",
    icon: Radio,
    title: "Edge Signals",
    desc: "Captain signals, breakout alerts and trap warnings generated from projection mismatches.",
  },
];

const WHO_FOR = [
  {
    icon: Trophy,
    title: "Competitive League Players",
    desc: "Looking for weekly captain edges and matchup advantages.",
  },
  {
    icon: BarChart2,
    title: "Data Driven Coaches",
    desc: "Who prefer projections and metrics over guesswork.",
  },
  {
    icon: Users,
    title: "Fantasy Optimisers",
    desc: "Trying to maximise every lineup decision.",
  },
];

const NEEKO_FEATURES = [
  "Full rankings table",
  "AI player breakdowns",
  "Captain Edge Board",
  "Breakout alerts",
  "Trap warnings",
  "Player vs Player comparison",
  "Advanced projections and value metrics",
];

const FOOTER_LINKS = [
  { label: "Policies", to: "/policies" },
  { label: "Contact",  to: "/contact" },
  { label: "About",    to: "/about" },
  { label: "FAQ",      to: "/faq" },
];

const HERO_FEATURES = [
  { icon: Crosshair,   label: "Weekly captain picks" },
  { icon: Zap,         label: "Breakout alerts" },
  { icon: ShieldAlert, label: "Trap warnings" },
  { icon: LineChart,   label: "Advanced player projections" },
];

// ─── Helpers ──────────────────────────────────────────────────────────────────

function teamAbbr(team: string) {
  const map: Record<string, string> = {
    "Adelaide": "ADE", "Brisbane Lions": "BRL", "Carlton": "CAR",
    "Collingwood": "COL", "Essendon": "ESS", "Fremantle": "FRE",
    "Geelong": "GEE", "Gold Coast": "GCS", "Greater Western Sydney": "GWS",
    "Hawthorn": "HAW", "Melbourne": "MEL", "North Melbourne": "NME",
    "Port Adelaide": "PAD", "Richmond": "RIC", "St Kilda": "STK",
    "Sydney": "SYD", "West Coast": "WCE", "Western Bulldogs": "WBD",
  };
  return map[team] ?? team.slice(0, 3).toUpperCase();
}

// ─── Shared layout ────────────────────────────────────────────────────────────

function SectionLabel({ children }: { children: string }) {
  return (
    <p className="text-center text-[11px] text-white/25 uppercase tracking-[0.18em] font-semibold mb-3">
      {children}
    </p>
  );
}

function SectionHeading({ children }: { children: React.ReactNode }) {
  return (
    <h2 className="text-2xl md:text-4xl font-extrabold text-white text-center leading-tight mb-3">
      {children}
    </h2>
  );
}

function GoldDivider() {
  return (
    <div className="flex justify-center my-4">
      <div className="w-10 h-0.5 rounded-full bg-[#F5C84C]/30" />
    </div>
  );
}

// ─── Edge board preview ───────────────────────────────────────────────────────

function EdgeBoardPreview() {
  const [captain,  setCaptain]  = useState<EdgeRow | null>(null);
  const [breakout, setBreakout] = useState<EdgeRow | null>(null);
  const [trap,     setTrap]     = useState<EdgeRow | null>(null);
  const [loading,  setLoading]  = useState(true);

  useEffect(() => {
    (async () => {
      const { data } = await supabase.rpc("get_edge_board_data", { limit_n: 5 });
      const rows: EdgeRow[] = data ?? [];
      setCaptain(rows.find((r) => r.section === "captain")  ?? null);
      setBreakout(rows.find((r) => r.section === "breakout") ?? null);
      setTrap(rows.find((r) => r.section === "trap")     ?? null);
      setLoading(false);
    })();
  }, []);

  const cards = [
    {
      section: "captain",
      icon: Star,
      color: "#F5C84C",
      label: "Captain Pick",
      row: captain,
      stat: (r: EdgeRow) => r.captain_score != null ? `Captain Score ${Math.round(r.captain_score)}` : null,
    },
    {
      section: "breakout",
      icon: TrendingUp,
      color: "#34d399",
      label: "Breakout Watch",
      row: breakout,
      stat: (r: EdgeRow) => r.upside_rating != null ? `Upside ${Math.round(r.upside_rating)}` : null,
    },
    {
      section: "trap",
      icon: AlertTriangle,
      color: "#f87171",
      label: "Trap Alert",
      row: trap,
      stat: (r: EdgeRow) => r.risk_rating != null ? `Risk ${Math.round(r.risk_rating)}` : null,
    },
  ];

  return (
    <section className="py-12 md:py-16 bg-[#0a0a0a] border-t border-white/[0.05]">
      <div className="max-w-3xl mx-auto px-4">
        <SectionLabel>Edge Signals Preview</SectionLabel>
        <SectionHeading>This Round's Edge Signals</SectionHeading>
        <GoldDivider />
        <p className="text-center text-white/40 text-sm mb-8 max-w-md mx-auto">
          One signal from each category. Unlock Neeko+ to see the full board.
        </p>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {cards.map(({ section, icon: Icon, color, label, row, stat }) => (
            <div
              key={section}
              className="rounded-2xl border border-white/[0.07] bg-[#0e0e0e] p-5 hover:border-white/[0.12] transition-all"
            >
              <div className="flex items-center gap-2 mb-4">
                <div
                  className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0"
                  style={{ background: `${color}15`, border: `1px solid ${color}30` }}
                >
                  <Icon size={16} style={{ color }} />
                </div>
                <span className="text-xs font-bold uppercase tracking-widest" style={{ color }}>
                  {label}
                </span>
              </div>

              {loading ? (
                <div className="space-y-2 animate-pulse">
                  <div className="h-5 w-32 bg-white/10 rounded" />
                  <div className="h-3 w-20 bg-white/10 rounded" />
                  <div className="h-3 w-24 bg-white/10 rounded" />
                </div>
              ) : row ? (
                <>
                  <p className="text-base font-bold text-white leading-tight mb-1">{row.player_name}</p>
                  <p className="text-xs text-white/35 mb-2">{row.team}</p>
                  {stat(row) && (
                    <p className="text-xs font-semibold" style={{ color }}>{stat(row)}</p>
                  )}
                  {row.projection_final != null && (
                    <p className="text-xs text-white/30 mt-1">
                      Proj. {Math.round(row.projection_final)} pts
                    </p>
                  )}
                </>
              ) : (
                <div className="space-y-2 animate-pulse">
                  <div className="h-5 w-32 bg-white/[0.06] rounded" />
                  <div className="h-3 w-20 bg-white/[0.06] rounded" />
                  <div className="h-3 w-24 bg-white/[0.06] rounded" />
                </div>
              )}
            </div>
          ))}
        </div>

        <p className="text-center text-white/25 text-xs mt-5">
          Full edge board includes additional signals and matchup analysis.
        </p>

        <div className="mt-4">
          <Link
            to="/neeko-plus"
            className="flex w-full sm:w-auto sm:inline-flex items-center justify-center gap-2 bg-[#F5C84C] text-black font-bold text-sm px-7 py-3.5 rounded-xl hover:brightness-110 transition-all min-h-[48px] sm:mx-auto sm:table"
          >
            <Crown size={14} />
            Unlock All Edge Signals
          </Link>
        </div>
      </div>
    </section>
  );
}

// ─── Rankings preview ─────────────────────────────────────────────────────────

function RankingsPreview() {
  const [rows, setRows] = useState<RankingRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const { data } = await supabase.rpc("get_rankings_free", {
        position_filter: "ALL",
        sort_key:        "neeko_rating",
        limit_n:         10,
      });
      setRows((data ?? []).slice(0, 5));
      setLoading(false);
    })();
  }, []);

  return (
    <section className="py-12 md:py-16 bg-[#070707] border-t border-white/[0.05]">
      <div className="max-w-3xl mx-auto px-4">
        <SectionLabel>Rankings Preview</SectionLabel>
        <SectionHeading>This Week's Top Fantasy Projections</SectionHeading>
        <GoldDivider />
        <p className="text-center text-white/40 text-sm mb-8 max-w-md mx-auto">
          Ranked by Neeko Rating — projection, matchup and AI verdict combined.
        </p>

        <div className="rounded-2xl border border-white/[0.07] overflow-hidden">
          {/* Desktop header — hides on mobile */}
          <div className="hidden sm:grid grid-cols-[2rem_1fr_4rem_5rem] gap-x-4 px-5 py-3 text-[11px] font-semibold text-white/25 uppercase tracking-widest border-b border-white/[0.06] bg-[#0a0a0a]">
            <span>#</span>
            <span>Player</span>
            <span className="text-center">Team</span>
            <span className="text-right">Projection</span>
          </div>

          {/* Mobile header — shows only on mobile, no Team column */}
          <div className="grid sm:hidden grid-cols-[2rem_1fr_4rem] gap-x-3 px-4 py-3 text-[11px] font-semibold text-white/25 uppercase tracking-widest border-b border-white/[0.06] bg-[#0a0a0a]">
            <span>#</span>
            <span>Player</span>
            <span className="text-right">Proj.</span>
          </div>

          {loading
            ? Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="animate-pulse border-b border-white/[0.04] bg-[#0c0c0c] last:border-0">
                  {/* Mobile skeleton */}
                  <div className="grid sm:hidden grid-cols-[2rem_1fr_4rem] gap-x-3 px-4 py-4">
                    <div className="h-4 w-4 bg-white/10 rounded" />
                    <div className="h-4 w-32 bg-white/10 rounded" />
                    <div className="h-4 w-10 bg-white/10 rounded ml-auto" />
                  </div>
                  {/* Desktop skeleton */}
                  <div className="hidden sm:grid grid-cols-[2rem_1fr_4rem_5rem] gap-x-4 px-5 py-4">
                    <div className="h-4 w-4 bg-white/10 rounded" />
                    <div className="h-4 w-36 bg-white/10 rounded" />
                    <div className="h-4 w-10 bg-white/10 rounded mx-auto" />
                    <div className="h-4 w-12 bg-white/10 rounded ml-auto" />
                  </div>
                </div>
              ))
            : rows.length > 0
              ? (
                <>
                  {rows.map((row, idx) => (
                    <div
                      key={idx}
                      className="border-b border-white/[0.04] bg-[#0c0c0c] hover:bg-[#111] transition-colors"
                    >
                      {/* Mobile row */}
                      <div className="grid sm:hidden grid-cols-[2rem_1fr_4rem] gap-x-3 px-4 py-4">
                        <span className="text-sm text-white/25 font-mono self-center">{idx + 1}</span>
                        <span className="text-sm font-semibold text-white truncate self-center">{row.player_name}</span>
                        <span className="text-sm font-bold text-[#F5C84C] text-right self-center">
                          {row.projection_final != null ? Math.round(row.projection_final) : "—"}
                        </span>
                      </div>
                      {/* Desktop row */}
                      <div className="hidden sm:grid grid-cols-[2rem_1fr_4rem_5rem] gap-x-4 px-5 py-4">
                        <span className="text-sm text-white/25 font-mono">{idx + 1}</span>
                        <span className="text-sm font-semibold text-white truncate">{row.player_name}</span>
                        <span className="text-xs text-white/40 text-center self-center">{teamAbbr(row.team)}</span>
                        <span className="text-sm font-bold text-[#F5C84C] text-right">
                          {row.projection_final != null ? Math.round(row.projection_final) : "—"}
                        </span>
                      </div>
                    </div>
                  ))}

                  {/* Blurred locked rows */}
                  {[6, 7].map((rank) => (
                    <div
                      key={rank}
                      className="group border-b border-white/[0.04] bg-[#0c0c0c] last:border-0 relative select-none"
                    >
                      {/* Mobile locked row */}
                      <div className="grid sm:hidden grid-cols-[2rem_1fr_4rem] gap-x-3 px-4 py-4">
                        <span className="text-sm text-white/15 font-mono self-center">{rank}</span>
                        <div className="flex items-center gap-1.5 self-center min-w-0">
                          <Lock size={10} className="text-white/20 shrink-0" />
                          <span className="text-sm font-semibold text-white/20 blur-[3px] truncate">Premium Player</span>
                          <span className="ml-1 inline-flex items-center px-1.5 py-0.5 rounded-md bg-[#F5C84C]/10 border border-[#F5C84C]/20 text-[9px] font-bold text-[#F5C84C]/60 uppercase tracking-wide shrink-0 whitespace-nowrap">
                            Neeko+
                          </span>
                        </div>
                        <span className="text-sm font-bold text-[#F5C84C]/20 text-right self-center blur-[3px]">000</span>
                      </div>
                      {/* Desktop locked row */}
                      <div className="hidden sm:grid grid-cols-[2rem_1fr_4rem_5rem] gap-x-4 px-5 py-4">
                        <span className="text-sm text-white/15 font-mono">{rank}</span>
                        <div className="flex items-center gap-2 relative">
                          <Lock size={11} className="text-white/20 shrink-0" />
                          <span className="text-sm font-semibold text-white/20 blur-[3px]">Premium Player</span>
                          <span className="ml-1 inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-[#F5C84C]/10 border border-[#F5C84C]/20 text-[10px] font-bold text-[#F5C84C]/60 uppercase tracking-wide shrink-0">
                            Neeko+ Insight
                          </span>
                          <div className="pointer-events-none absolute left-0 -top-9 w-64 bg-[#1a1a1a] border border-white/10 rounded-lg px-3 py-2 text-[11px] text-white/50 opacity-0 group-hover:opacity-100 transition-opacity z-10 shadow-xl">
                            Unlock full projections, value ratings and matchup analysis.
                          </div>
                        </div>
                        <span className="text-xs text-white/15 text-center self-center blur-[3px]">XXX</span>
                        <span className="text-sm font-bold text-[#F5C84C]/20 text-right blur-[3px]">000</span>
                      </div>
                    </div>
                  ))}
                </>
              )
              : (
                <div className="px-5 py-8 text-center text-sm text-white/25 bg-[#0c0c0c]">
                  Rankings will be available when round data is processed.
                </div>
              )
          }
        </div>

        <p className="text-center text-white/25 text-xs mt-5">
          Full rankings include value ratings, ceiling projections and matchup grades.
        </p>

        <div className="mt-4">
          <Link
            to="/sports/afl/rankings"
            className="flex w-full sm:w-auto sm:inline-flex items-center justify-center gap-2 border border-white/15 text-white/70 hover:text-white hover:border-white/30 font-semibold text-sm px-7 py-3.5 rounded-xl transition-all min-h-[48px]"
          >
            View Full Rankings
            <ArrowRight size={14} />
          </Link>
        </div>
      </div>
    </section>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function Index() {
  const { isPremium } = useAuth();

  return (
    <div className="min-h-screen bg-[#070707] text-white">

      {/* ── HERO ──────────────────────────────────────────────────────────────── */}
      <section className="relative overflow-hidden min-h-[85vh] flex items-center">
        <div
          className="absolute inset-0"
          style={{
            backgroundImage: "url(/hero.jpg)",
            backgroundSize: "cover",
            backgroundPosition: "center top",
          }}
        />
        <div className="absolute inset-0 bg-gradient-to-b from-black/75 via-black/65 to-[#070707]" />

        <div className="relative z-10 w-full max-w-4xl mx-auto px-5 py-24 md:py-32 text-center">
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full border border-[#F5C84C]/35 bg-[#F5C84C]/10 text-[#F5C84C] text-[11px] font-bold uppercase tracking-widest mb-7">
            AFL 2026 Season Live
          </div>

          <h1 className="text-4xl sm:text-5xl md:text-[5.5rem] font-extrabold leading-[1.08] tracking-tight mb-6">
            AFL Fantasy Intelligence
            <br />
            <span className="text-[#F5C84C]">Built to Find the Weekly Edge</span>
          </h1>

          <p className="text-base md:text-xl text-white/55 font-medium mb-10 max-w-xl mx-auto leading-relaxed px-1">
            AI-powered projections, captain signals, breakout alerts and trap warnings — designed to help serious AFL Fantasy coaches make smarter weekly decisions.
          </p>

          {/* CTA buttons — stacked on mobile, side-by-side on sm+ */}
          <div className="flex flex-col gap-3 sm:flex-row sm:justify-center sm:items-center px-2 sm:px-0">
            {!isPremium && (
              <Link
                to="/neeko-plus"
                className="flex items-center justify-center gap-2 bg-[#F5C84C] text-black font-bold text-sm px-8 rounded-xl hover:brightness-110 transition-all shadow-[0_4px_30px_rgba(245,200,76,0.25)] min-h-[52px] w-full sm:w-auto"
              >
                <Crown size={15} />
                Unlock Neeko+
              </Link>
            )}
            <Link
              to="/sports/afl/rankings"
              className={`flex items-center justify-center gap-2 font-semibold text-sm px-8 rounded-xl transition-all min-h-[52px] w-full sm:w-auto ${
                isPremium
                  ? "bg-[#F5C84C] text-black hover:brightness-110"
                  : "border border-white/15 text-white/70 hover:text-white hover:border-white/30 bg-transparent"
              }`}
            >
              View Rankings
              <ArrowRight size={14} />
            </Link>
          </div>

          <p className="mt-6 text-[12px] text-[#F5C84C]/45 font-medium tracking-wide">
            Used weekly by serious AFL Fantasy coaches.
          </p>

          {/* Feature bar — horizontal on desktop, 2×2 grid on mobile */}
          <div className="mt-7 hidden sm:flex flex-wrap justify-center gap-x-6 gap-y-2.5">
            {HERO_FEATURES.map(({ icon: Icon, label }) => (
              <div key={label} className="flex items-center gap-1.5">
                <Icon size={12} className="text-[#F5C84C]/50 shrink-0" />
                <span className="text-[12px] text-[#F5C84C]/50 font-medium">{label}</span>
              </div>
            ))}
          </div>

          <div className="mt-7 grid grid-cols-2 gap-x-4 gap-y-3 sm:hidden max-w-xs mx-auto">
            {HERO_FEATURES.map(({ icon: Icon, label }) => (
              <div key={label} className="flex flex-col items-center gap-1.5">
                <Icon size={16} className="text-[#F5C84C]/50" />
                <span className="text-[11px] text-[#F5C84C]/50 font-medium text-center leading-snug">{label}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── SECTION 2: EDGE SIGNALS PREVIEW ──────────────────────────────────── */}
      <EdgeBoardPreview />

      {/* ── SECTION 3: RANKINGS PREVIEW ───────────────────────────────────────── */}
      <RankingsPreview />

      {/* ── SECTION 4: WHY NEEKO WINS ─────────────────────────────────────────── */}
      <section className="py-12 md:py-16 bg-[#0a0a0a] border-t border-white/[0.05]">
        <div className="max-w-4xl mx-auto px-4">
          <SectionLabel>Why Neeko+</SectionLabel>
          <SectionHeading>Why Fantasy Coaches Use Neeko+</SectionHeading>
          <GoldDivider />
          <p className="text-center text-white/40 text-sm mb-10 max-w-md mx-auto">
            Not news. Not chat. Structured intelligence designed for AFL Fantasy decision-making.
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 md:gap-5">
            {FEATURES.map(({ icon: Icon, title, desc }) => (
              <div
                key={title}
                className="rounded-2xl border border-white/[0.07] bg-[#0e0e0e] p-6 hover:border-[#F5C84C]/20 transition-all"
              >
                <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-[#F5C84C]/10 border border-[#F5C84C]/20 mb-4">
                  <Icon size={18} className="text-[#F5C84C]" />
                </div>
                <h3 className="text-base font-bold text-white mb-2">{title}</h3>
                <p className="text-sm text-white/40 leading-relaxed">{desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── SECTION 5: HOW IT WORKS ───────────────────────────────────────────── */}
      <section className="py-12 md:py-16 bg-[#070707] border-t border-white/[0.05]">
        <div className="max-w-4xl mx-auto px-4">
          <SectionLabel>How It Works</SectionLabel>
          <SectionHeading>From Raw Data to Weekly Edge Signals</SectionHeading>
          <GoldDivider />

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 md:gap-5 mt-8">
            {HOW_IT_WORKS.map(({ step, icon: Icon, title, desc }) => (
              <div key={step} className="rounded-2xl border border-white/[0.07] bg-[#0e0e0e] p-6">
                <div className="flex items-start gap-4 mb-4">
                  <span className="text-[11px] font-black text-[#F5C84C]/40 tracking-widest font-mono mt-0.5 shrink-0">
                    {step}
                  </span>
                  <div className="w-9 h-9 rounded-xl bg-[#F5C84C]/10 border border-[#F5C84C]/20 flex items-center justify-center shrink-0">
                    <Icon size={16} className="text-[#F5C84C]" />
                  </div>
                </div>
                <h3 className="text-base font-bold text-white mb-2">{title}</h3>
                <p className="text-sm text-white/40 leading-relaxed">{desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── SECTION 6: WHO NEEKO IS FOR ───────────────────────────────────────── */}
      <section className="py-12 md:py-16 bg-[#0a0a0a] border-t border-white/[0.05]">
        <div className="max-w-4xl mx-auto px-4">
          <SectionLabel>Who It's For</SectionLabel>
          <SectionHeading>Built For Serious AFL Fantasy Coaches</SectionHeading>
          <GoldDivider />

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 md:gap-5 mt-8">
            {WHO_FOR.map(({ icon: Icon, title, desc }) => (
              <div
                key={title}
                className="rounded-2xl border border-white/[0.07] bg-[#0e0e0e] p-6 hover:border-white/[0.12] transition-all"
              >
                <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-white/[0.05] border border-white/[0.08] mb-4">
                  <Icon size={18} className="text-white/50" />
                </div>
                <h3 className="text-base font-bold text-white mb-2">{title}</h3>
                <p className="text-sm text-white/40 leading-relaxed">{desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── TRUST SIGNAL ──────────────────────────────────────────────────────── */}
      {!isPremium && (
        <section className="py-10 md:py-12 bg-[#070707] border-t border-white/[0.05]">
          <div className="max-w-xl mx-auto px-4 text-center">
            <p className="text-[11px] text-white/20 uppercase tracking-[0.18em] font-semibold mb-3">
              Who Uses Neeko+
            </p>
            <h2 className="text-xl md:text-2xl font-bold text-white mb-3">
              Trusted by Competitive AFL Fantasy Coaches
            </h2>
            <p className="text-sm text-white/35 leading-relaxed max-w-sm mx-auto">
              Designed for serious fantasy players who want structured insights — not noise.
            </p>
          </div>
        </section>
      )}

      {/* ── SECTION 7: PRICING ────────────────────────────────────────────────── */}
      {!isPremium && (
        <section className="py-12 md:py-16 bg-[#0a0a0a] border-t border-white/[0.05]">
          <div className="max-w-3xl mx-auto px-4">
            <SectionLabel>Pricing</SectionLabel>
            <SectionHeading>Simple. No Hidden Fees.</SectionHeading>
            <GoldDivider />
            <p className="text-center text-white/40 text-sm mb-10 max-w-sm mx-auto">
              One subscription. Full access. Cancel anytime.
            </p>

            {/* On mobile: yearly first, then monthly. On sm+: side by side. */}
            <div className="flex flex-col-reverse sm:grid sm:grid-cols-2 gap-5 mb-8">
              {/* Monthly */}
              <div className="rounded-2xl border border-white/[0.09] bg-[#0e0e0e] p-6">
                <p className="text-xs font-bold uppercase tracking-widest text-white/30 mb-3">Monthly</p>
                <div className="flex items-end gap-1.5 mb-1">
                  <span className="text-4xl font-extrabold text-white">$9.99</span>
                  <span className="text-sm text-white/35 mb-1">AUD / month</span>
                </div>
                <p className="text-xs text-white/25 mb-6">{NEEKO_PRICING.monthly.billingNote}</p>
                <Link
                  to="/neeko-plus"
                  className="block text-center border border-[#F5C84C]/40 text-[#F5C84C] font-semibold text-sm py-3 rounded-xl hover:bg-[#F5C84C]/10 transition-all min-h-[48px] flex items-center justify-center"
                >
                  Start Monthly
                </Link>
              </div>

              {/* Yearly — shown first on mobile via flex-col-reverse */}
              <div
                className="relative rounded-2xl p-6"
                style={{
                  border: "1px solid rgba(245,200,76,0.35)",
                  background: "linear-gradient(160deg, #111 0%, #0d0d0d 100%)",
                  boxShadow: "0 0 40px rgba(245,200,76,0.08)",
                }}
              >
                <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                  <span className="bg-[#F5C84C] text-black text-[11px] font-black px-3 py-0.5 rounded-full uppercase tracking-wide">
                    Best Value
                  </span>
                </div>
                <p className="text-xs font-bold uppercase tracking-widest text-[#F5C84C]/60 mb-3">Yearly</p>
                <div className="flex items-end gap-1.5 mb-1">
                  <span className="text-4xl font-extrabold text-white">$89</span>
                  <span className="text-sm text-white/35 mb-1">AUD / year</span>
                </div>
                <p className="text-xs text-[#F5C84C]/50 mb-6">Equivalent to $7.42/month</p>
                <Link
                  to="/neeko-plus"
                  className="block text-center bg-[#F5C84C] text-black font-bold text-sm py-3 rounded-xl hover:brightness-110 transition-all min-h-[48px] flex items-center justify-center"
                >
                  Start Yearly
                </Link>
              </div>
            </div>

            <div className="grid sm:grid-cols-2 gap-y-2.5 gap-x-8 max-w-md mx-auto">
              {NEEKO_FEATURES.map((f) => (
                <div key={f} className="flex items-center gap-2.5">
                  <div className="w-4 h-4 rounded-full bg-[#F5C84C]/15 border border-[#F5C84C]/30 flex items-center justify-center shrink-0">
                    <Check size={9} className="text-[#F5C84C]" />
                  </div>
                  <span className="text-sm text-white/50">{f}</span>
                </div>
              ))}
            </div>

            <p className="text-center text-xs text-white/20 mt-8">
              No ads. No noise. Just structured fantasy insights.
            </p>
          </div>
        </section>
      )}

      {/* ── SECTION 8: FINAL CTA ──────────────────────────────────────────────── */}
      {!isPremium && (
        <section className="py-14 md:py-16 bg-[#070707] border-t border-white/[0.05]">
          <div className="max-w-xl mx-auto px-5 text-center">
            <div
              className="w-14 h-14 rounded-full flex items-center justify-center mx-auto mb-6"
              style={{ background: "rgba(245,200,76,0.10)", border: "1px solid rgba(245,200,76,0.25)" }}
            >
              <Crown size={24} className="text-[#F5C84C]" />
            </div>
            <h2 className="text-2xl md:text-4xl font-extrabold mb-4 leading-tight">
              Ready to gain the edge this season?
            </h2>
            <p className="text-white/40 text-base mb-8 max-w-sm mx-auto leading-relaxed">
              Updated every round before lockout — so you can make smarter captain and trade decisions.
            </p>
            <Link
              to="/neeko-plus"
              className="flex w-full sm:w-auto sm:inline-flex items-center justify-center gap-2 bg-[#F5C84C] text-black font-bold text-sm px-10 rounded-xl hover:brightness-110 transition-all shadow-[0_4px_30px_rgba(245,200,76,0.2)] min-h-[52px]"
            >
              <Crown size={15} />
              Unlock Neeko+
            </Link>
          </div>
        </section>
      )}

      {/* ── FOOTER ────────────────────────────────────────────────────────────── */}
      <footer className="border-t border-white/[0.05] bg-[#070707] py-8">
        <div className="max-w-4xl mx-auto px-4">
          <div className="flex flex-col sm:flex-row justify-between items-center gap-4">
            <p className="text-xs text-white/25">
              © {new Date().getFullYear()} Neeko Sports Stats. All rights reserved.
            </p>
            <div className="flex gap-5 text-xs">
              {FOOTER_LINKS.map((l) => (
                <Link key={l.to} to={l.to} className="text-white/25 hover:text-white/60 transition-colors">
                  {l.label}
                </Link>
              ))}
            </div>
          </div>
        </div>
      </footer>

    </div>
  );
}
