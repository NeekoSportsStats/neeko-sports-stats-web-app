import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import {
  Crown, ArrowRight, Trophy, Zap, AlertTriangle,
  Star, TrendingUp, BarChart2, GitCompare, Check,
  Database, Cpu, Radio,
} from "lucide-react";
import { supabase } from "@/lib/supabaseClient";
import { useAuth } from "@/lib/auth";

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
    desc: "Each player is assessed against matchup conditions, recent form and historical ceiling. The output is a scored, ranked verdict — not an opinion.",
  },
  {
    icon: Radio,
    title: "Weekly Edge Signals",
    desc: "Captain picks, breakout watches and trap flags are generated weekly from a multi-factor model built around price, form and opponent context.",
  },
  {
    icon: BarChart2,
    title: "Advanced Rankings",
    desc: "Neeko Rating combines projection, matchup grade, volatility band and AI verdict into a single number designed for head-to-head trading decisions.",
  },
];

const HOW_IT_WORKS = [
  {
    step: "01",
    icon: Database,
    title: "Data Modelling",
    desc: "Match results, player statistics and historical trends are ingested and normalised into structured fantasy-relevant features.",
  },
  {
    step: "02",
    icon: Cpu,
    title: "AI Projection Engine",
    desc: "A multi-model pipeline scores each player for projection, ceiling, floor, volatility and matchup grade against the upcoming round.",
  },
  {
    step: "03",
    icon: Radio,
    title: "Weekly Edge Signals",
    desc: "Captain signals, breakout candidates and trap warnings are derived from mispricing, form velocity and opponent softness.",
  },
];

const PROOF_STATIC = [
  { stat: "250+",   label: "Players analysed" },
  { stat: "2,400+", label: "Games processed" },
  { stat: "3",      label: "AI models running" },
];

const FOOTER_LINKS = [
  { label: "Policies", to: "/policies" },
  { label: "Contact",  to: "/contact" },
  { label: "About",    to: "/about" },
  { label: "FAQ",      to: "/faq" },
];

const NEEKO_FEATURES = [
  "Full Rankings table — all players",
  "Full AI player breakdowns",
  "Captain Edge board",
  "Breakout alerts & trap warnings",
  "Player vs Player comparison",
  "Advanced projections and value metrics",
];

// ─── Helpers ──────────────────────────────────────────────────────────────────

function teamAbbr(team: string) {
  const map: Record<string, string> = {
    "Adelaide":            "ADE", "Brisbane Lions":    "BRL", "Carlton":           "CAR",
    "Collingwood":         "COL", "Essendon":           "ESS", "Fremantle":         "FRE",
    "Geelong":             "GEE", "Gold Coast":         "GCS", "Greater Western Sydney": "GWS",
    "Hawthorn":            "HAW", "Melbourne":          "MEL", "North Melbourne":   "NME",
    "Port Adelaide":       "PAD", "Richmond":           "RIC", "St Kilda":          "STK",
    "Sydney":              "SYD", "West Coast":         "WCE", "Western Bulldogs":  "WBD",
  };
  return map[team] ?? team.slice(0, 3).toUpperCase();
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function SectionLabel({ children }: { children: string }) {
  return (
    <p className="text-center text-[11px] text-white/25 uppercase tracking-[0.18em] font-semibold mb-4">
      {children}
    </p>
  );
}

function SectionHeading({ children }: { children: React.ReactNode }) {
  return (
    <h2 className="text-3xl md:text-4xl font-extrabold text-white text-center leading-tight mb-3">
      {children}
    </h2>
  );
}

function GoldDivider() {
  return (
    <div className="flex justify-center my-5">
      <div className="w-10 h-0.5 rounded-full bg-[#F5C84C]/30" />
    </div>
  );
}

// ─── Rankings preview ─────────────────────────────────────────────────────────

function RankingsPreview() {
  const [rows, setRows] = useState<RankingRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const { data } = await supabase.rpc("get_rankings_free", {
        p_tab:      "best",
        p_position: "ALL",
        p_sort_key: "neeko_rating",
        p_sort_dir: "desc",
        p_limit:    10,
        p_offset:   0,
      });
      setRows((data ?? []).slice(0, 10));
      setLoading(false);
    })();
  }, []);

  return (
    <section className="py-20 bg-[#070707] border-t border-white/[0.05]">
      <div className="max-w-4xl mx-auto px-4">
        <SectionLabel>Rankings Preview</SectionLabel>
        <SectionHeading>Top 10 Players This Round</SectionHeading>
        <GoldDivider />
        <p className="text-center text-white/40 text-sm mb-10 max-w-md mx-auto">
          Ranked by Neeko Rating — projection, matchup and AI verdict combined.
        </p>

        <div className="rounded-2xl border border-white/[0.07] overflow-hidden">
          <div className="grid grid-cols-[2rem_1fr_4rem_5rem] gap-x-4 px-5 py-3 text-[11px] font-semibold text-white/25 uppercase tracking-widest border-b border-white/[0.06] bg-[#0a0a0a]">
            <span>#</span>
            <span>Player</span>
            <span className="text-center">Team</span>
            <span className="text-right">Projection</span>
          </div>

          {loading
            ? Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="grid grid-cols-[2rem_1fr_4rem_5rem] gap-x-4 px-5 py-3.5 border-b border-white/[0.04] bg-[#0c0c0c] animate-pulse">
                  <div className="h-4 w-4 bg-white/10 rounded" />
                  <div className="h-4 w-32 bg-white/10 rounded" />
                  <div className="h-4 w-10 bg-white/10 rounded mx-auto" />
                  <div className="h-4 w-12 bg-white/10 rounded ml-auto" />
                </div>
              ))
            : rows.map((row, idx) => (
                <div
                  key={idx}
                  className="grid grid-cols-[2rem_1fr_4rem_5rem] gap-x-4 px-5 py-3.5 border-b border-white/[0.04] bg-[#0c0c0c] hover:bg-[#111] transition-colors"
                >
                  <span className="text-sm text-white/25 font-mono">{idx + 1}</span>
                  <span className="text-sm font-semibold text-white truncate">{row.player_name}</span>
                  <span className="text-xs text-white/40 text-center self-center">{teamAbbr(row.team)}</span>
                  <span className="text-sm font-bold text-[#F5C84C] text-right">
                    {row.projection_final != null ? Math.round(row.projection_final) : "—"}
                  </span>
                </div>
              ))}
        </div>

        <div className="flex justify-center mt-7">
          <Link
            to="/sports/afl/rankings"
            className="inline-flex items-center gap-2 border border-white/15 text-white/70 hover:text-white hover:border-white/30 font-semibold text-sm px-7 py-3 rounded-xl transition-all"
          >
            View Full Rankings
            <ArrowRight size={14} />
          </Link>
        </div>
      </div>
    </section>
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
      const { data } = await supabase.rpc("get_edge_board_data");
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
    <section className="py-20 bg-[#0a0a0a] border-t border-white/[0.05]">
      <div className="max-w-4xl mx-auto px-4">
        <SectionLabel>Edge Board Preview</SectionLabel>
        <SectionHeading>This Round's Edge Signals</SectionHeading>
        <GoldDivider />
        <p className="text-center text-white/40 text-sm mb-10 max-w-md mx-auto">
          One signal from each category. Unlock Neeko+ to see the full board.
        </p>

        <div className="grid sm:grid-cols-3 gap-4">
          {cards.map(({ section, icon: Icon, color, label, row, stat }) => (
            <div
              key={section}
              className="rounded-2xl border border-white/[0.07] bg-[#0e0e0e] p-5 hover:border-white/[0.12] transition-all"
            >
              <div className="flex items-center gap-2 mb-4">
                <div
                  className="w-8 h-8 rounded-lg flex items-center justify-center"
                  style={{ background: `${color}15`, border: `1px solid ${color}30` }}
                >
                  <Icon size={15} style={{ color }} />
                </div>
                <span className="text-xs font-bold uppercase tracking-widest" style={{ color }}>
                  {label}
                </span>
              </div>

              {loading ? (
                <div className="space-y-2 animate-pulse">
                  <div className="h-5 w-28 bg-white/10 rounded" />
                  <div className="h-3 w-16 bg-white/10 rounded" />
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
                <p className="text-sm text-white/20">No signal this round</p>
              )}
            </div>
          ))}
        </div>

        <div className="flex justify-center mt-7">
          <Link
            to="/neeko-plus"
            className="inline-flex items-center gap-2 bg-[#F5C84C] text-black font-bold text-sm px-7 py-3 rounded-xl hover:brightness-110 transition-all"
          >
            <Crown size={14} />
            Unlock Full Edge Board
          </Link>
        </div>
      </div>
    </section>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function Index() {
  const { isPremium } = useAuth();
  const [playerCount, setPlayerCount] = useState<number | null>(null);

  useEffect(() => {
    (async () => {
      const { count } = await supabase
        .from("afl_player_ledger")
        .select("*", { count: "exact", head: true });
      setPlayerCount(count ?? null);
    })();
  }, []);

  return (
    <div className="min-h-screen bg-[#070707] text-white">

      {/* ── HERO ──────────────────────────────────────────────────────────────── */}
      <section className="relative overflow-hidden min-h-[80vh] flex items-center">
        <div
          className="absolute inset-0"
          style={{
            backgroundImage: "url(/hero.jpg)",
            backgroundSize: "cover",
            backgroundPosition: "center",
          }}
        />
        <div className="absolute inset-0 bg-gradient-to-b from-black/70 via-black/60 to-[#070707]" />

        <div className="relative z-10 w-full max-w-4xl mx-auto px-4 py-32 text-center">
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full border border-[#F5C84C]/35 bg-[#F5C84C]/10 text-[#F5C84C] text-[11px] font-bold uppercase tracking-widest mb-8">
            AFL 2026 Season Live
          </div>

          <h1 className="text-5xl md:text-[5.5rem] font-extrabold leading-[1.05] tracking-tight mb-5">
            AFL Fantasy Intelligence<br className="hidden md:block" />
            <span className="text-[#F5C84C]">Built to Find the Weekly Edge</span>
          </h1>

          <p className="text-lg md:text-xl text-white/55 font-medium mb-10 max-w-xl mx-auto leading-relaxed">
            AI-powered projections, captain signals, breakout alerts and trap warnings — built to help serious AFL Fantasy coaches make smarter decisions.
          </p>

          <div className="flex flex-col sm:flex-row gap-3 justify-center items-center">
            {!isPremium && (
              <Link
                to="/neeko-plus"
                className="inline-flex items-center gap-2 bg-[#F5C84C] text-black font-bold text-sm px-8 py-3.5 rounded-xl hover:brightness-110 transition-all shadow-[0_4px_30px_rgba(245,200,76,0.25)]"
              >
                <Crown size={15} />
                Unlock Neeko+
              </Link>
            )}
            <Link
              to="/sports/afl/rankings"
              className={`inline-flex items-center gap-2 font-semibold text-sm px-8 py-3.5 rounded-xl transition-all ${
                isPremium
                  ? "bg-[#F5C84C] text-black hover:brightness-110"
                  : "border border-white/15 text-white/70 hover:text-white hover:border-white/30 bg-transparent"
              }`}
            >
              View Rankings
              <ArrowRight size={14} />
            </Link>
          </div>
        </div>
      </section>

      {/* ── LIVE DATA BANNER ──────────────────────────────────────────────────── */}
      <section className="border-t border-white/[0.06] bg-[#0a0a0a] py-10">
        <div className="max-w-3xl mx-auto px-4">
          <p className="text-center text-xs text-white/25 uppercase tracking-widest font-semibold mb-7">
            Opening Round Insights
          </p>
          <div className="grid grid-cols-3 gap-6 text-center">
            <div>
              <p className="text-2xl md:text-3xl font-extrabold text-white mb-1">
                {playerCount != null ? `${playerCount}+` : "250+"}
              </p>
              <p className="text-xs text-white/30 font-medium">Total players analysed this round</p>
            </div>
            <div>
              <p className="text-2xl md:text-3xl font-extrabold text-white mb-1">2,400+</p>
              <p className="text-xs text-white/30 font-medium">Games processed</p>
            </div>
            <div>
              <p className="text-2xl md:text-3xl font-extrabold text-white mb-1">Weekly</p>
              <p className="text-xs text-white/30 font-medium">Updated picks</p>
            </div>
          </div>
        </div>
      </section>

      {/* ── RANKINGS PREVIEW ──────────────────────────────────────────────────── */}
      <RankingsPreview />

      {/* ── EDGE BOARD PREVIEW ────────────────────────────────────────────────── */}
      <EdgeBoardPreview />

      {/* ── WHAT NEEKO DOES ───────────────────────────────────────────────────── */}
      <section className="py-20 bg-[#070707] border-t border-white/[0.05]">
        <div className="max-w-4xl mx-auto px-4">
          <SectionLabel>What Neeko Does</SectionLabel>
          <SectionHeading>Built for AFL Fantasy Decision-Making</SectionHeading>
          <GoldDivider />
          <p className="text-center text-white/40 text-sm mb-12 max-w-md mx-auto">
            Not news. Not chat. Just structured intelligence that plugs directly into how you build your team.
          </p>

          <div className="grid sm:grid-cols-3 gap-5">
            {FEATURES.map(({ icon: Icon, title, desc }) => (
              <div
                key={title}
                className="rounded-2xl border border-white/[0.07] bg-[#0e0e0e] p-6 hover:border-[#F5C84C]/20 transition-all"
              >
                <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-[#F5C84C]/10 border border-[#F5C84C]/20 mb-5">
                  <Icon size={18} className="text-[#F5C84C]" />
                </div>
                <h3 className="text-base font-bold text-white mb-2">{title}</h3>
                <p className="text-sm text-white/40 leading-relaxed">{desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── HOW IT WORKS ──────────────────────────────────────────────────────── */}
      <section className="py-20 bg-[#0a0a0a] border-t border-white/[0.05]">
        <div className="max-w-4xl mx-auto px-4">
          <SectionLabel>How It Works</SectionLabel>
          <SectionHeading>From Raw Data to Weekly Edge Signals</SectionHeading>
          <GoldDivider />

          <div className="grid sm:grid-cols-3 gap-5 mt-10">
            {HOW_IT_WORKS.map(({ step, icon: Icon, title, desc }) => (
              <div key={step} className="relative rounded-2xl border border-white/[0.07] bg-[#0e0e0e] p-6">
                <div className="flex items-start gap-4 mb-4">
                  <span className="text-[11px] font-black text-[#F5C84C]/40 tracking-widest font-mono mt-0.5">
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

      {/* ── SOCIAL PROOF ──────────────────────────────────────────────────────── */}
      <section className="py-20 bg-[#070707] border-t border-white/[0.05]">
        <div className="max-w-3xl mx-auto px-4">
          <SectionLabel>By the Numbers</SectionLabel>
          <SectionHeading>The Engine Behind Neeko+</SectionHeading>
          <GoldDivider />

          <div className="grid grid-cols-3 gap-8 mt-10 text-center">
            {PROOF_STATIC.map(({ stat, label }) => (
              <div key={label}>
                <p className="text-3xl md:text-4xl font-extrabold text-[#F5C84C] mb-2">{stat}</p>
                <p className="text-sm text-white/35 font-medium">{label}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── PRICING ───────────────────────────────────────────────────────────── */}
      {!isPremium && (
        <section className="py-20 bg-[#0a0a0a] border-t border-white/[0.05]">
          <div className="max-w-3xl mx-auto px-4">
            <SectionLabel>Pricing</SectionLabel>
            <SectionHeading>Simple. No Hidden Fees.</SectionHeading>
            <GoldDivider />
            <p className="text-center text-white/40 text-sm mb-12 max-w-sm mx-auto">
              One subscription. Full access. Cancel anytime.
            </p>

            <div className="grid sm:grid-cols-2 gap-5 mb-10">
              {/* Monthly */}
              <div className="rounded-2xl border border-white/[0.09] bg-[#0e0e0e] p-6">
                <p className="text-xs font-bold uppercase tracking-widest text-white/30 mb-3">Monthly</p>
                <div className="flex items-end gap-1.5 mb-1">
                  <span className="text-4xl font-extrabold text-white">$12.99</span>
                  <span className="text-sm text-white/35 mb-1">AUD / month</span>
                </div>
                <p className="text-xs text-white/25 mb-6">Billed monthly. Cancel anytime.</p>
                <Link
                  to="/neeko-plus"
                  className="block text-center border border-[#F5C84C]/40 text-[#F5C84C] font-semibold text-sm py-2.5 rounded-xl hover:bg-[#F5C84C]/10 transition-all"
                >
                  Start Monthly
                </Link>
              </div>

              {/* Yearly */}
              <div
                className="relative rounded-2xl p-6"
                style={{
                  border: "1px solid rgba(245,200,76,0.35)",
                  background: "linear-gradient(160deg, #111 0%, #0d0d0d 100%)",
                  boxShadow: "0 0 40px rgba(245,200,76,0.1)",
                }}
              >
                <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                  <span className="bg-[#F5C84C] text-black text-[11px] font-black px-3 py-0.5 rounded-full uppercase tracking-wide">
                    Best Value — Save 24%
                  </span>
                </div>
                <p className="text-xs font-bold uppercase tracking-widest text-[#F5C84C]/60 mb-3">Yearly</p>
                <div className="flex items-end gap-1.5 mb-1">
                  <span className="text-4xl font-extrabold text-white">$119</span>
                  <span className="text-sm text-white/35 mb-1">AUD / year</span>
                </div>
                <p className="text-xs text-[#F5C84C]/50 mb-6">Equivalent to $9.92/month</p>
                <Link
                  to="/neeko-plus"
                  className="block text-center bg-[#F5C84C] text-black font-bold text-sm py-2.5 rounded-xl hover:brightness-110 transition-all"
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
          </div>
        </section>
      )}

      {/* ── FOOTER CTA ────────────────────────────────────────────────────────── */}
      {!isPremium && (
        <section className="py-20 bg-[#070707] border-t border-white/[0.05]">
          <div className="max-w-xl mx-auto px-4 text-center">
            <div
              className="w-14 h-14 rounded-full flex items-center justify-center mx-auto mb-6"
              style={{ background: "rgba(245,200,76,0.10)", border: "1px solid rgba(245,200,76,0.25)" }}
            >
              <Crown size={24} className="text-[#F5C84C]" />
            </div>
            <h2 className="text-3xl md:text-4xl font-extrabold mb-3">
              Ready to gain the edge this season?
            </h2>
            <p className="text-white/40 text-base mb-8 max-w-sm mx-auto">
              Full AI analysis, captain signals and advanced rankings — updated every round.
            </p>
            <Link
              to="/neeko-plus"
              className="inline-flex items-center gap-2 bg-[#F5C84C] text-black font-bold text-sm px-10 py-3.5 rounded-xl hover:brightness-110 transition-all shadow-[0_4px_30px_rgba(245,200,76,0.2)]"
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
