import { Link } from "react-router-dom";
import { Crown, ArrowRight, Trophy, ChartBar as BarChart2, GitCompare } from "lucide-react";
import { useAuth } from "@/lib/auth";

const FEATURES = [
  {
    icon: Trophy,
    title: "Rankings",
    desc: "Every player ranked by projected fantasy score. Spot the must-starts and the traps before lock.",
    href: "/sports/afl/rankings",
    cta: "View Rankings",
  },
  {
    icon: BarChart2,
    title: "Edge Board",
    desc: "Breakout alerts, value picks, and ceiling plays — surfaced and ranked before each round.",
    href: "/sports/afl/edge-board",
    cta: "View Edge Board",
  },
  {
    icon: GitCompare,
    title: "Player Compare",
    desc: "Head-to-head comparison. Projection, risk, value. Pick the right start in seconds.",
    href: "/sports/afl/compare",
    cta: "Compare Players",
  },
];

const PROOF = [
  { stat: "200+", label: "Players ranked" },
  { stat: "Round 1", label: "2026 season live" },
  { stat: "Weekly", label: "Updated picks" },
];

export default function Index() {
  const { isPremium } = useAuth();

  return (
    <div className="min-h-screen bg-[#070707] text-white">

      {/* ── HERO ─────────────────────────────────────────────── */}
      <section className="relative overflow-hidden min-h-[70vh] flex items-center">
        <div
          className="absolute inset-0"
          style={{
            backgroundImage: "url(/hero.jpg)",
            backgroundSize: "cover",
            backgroundPosition: "center",
          }}
        />
        <div className="absolute inset-0 bg-gradient-to-b from-black/65 via-black/55 to-[#070707]" />

        <div className="relative z-10 w-full max-w-4xl mx-auto px-4 py-28 text-center">
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full border border-[#F5C84C]/35 bg-[#F5C84C]/10 text-[#F5C84C] text-[11px] font-bold uppercase tracking-widest mb-8">
            AFL 2026 Season Live
          </div>

          <h1 className="text-5xl md:text-[5.5rem] font-extrabold leading-[1.05] tracking-tight mb-5">
            Elite AFL Fantasy<br className="hidden md:block" /> Intelligence
          </h1>

          <p className="text-lg md:text-xl text-white/55 font-medium mb-10 max-w-md mx-auto leading-relaxed">
            Captain picks. Breakout alerts. Trap warnings.
          </p>

          <div className="flex flex-col sm:flex-row gap-3 justify-center items-center">
            {!isPremium && (
              <Link
                to="/neeko-plus"
                className="inline-flex items-center gap-2 bg-[#F5C84C] text-black font-bold text-sm px-7 py-3.5 rounded-xl hover:brightness-110 transition-all"
              >
                <Crown size={15} />
                Upgrade to Neeko+
              </Link>
            )}
            <Link
              to="/sports/afl/rankings"
              className={`inline-flex items-center gap-2 font-semibold text-sm px-7 py-3.5 rounded-xl transition-all ${
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

      {/* ── SOCIAL PROOF ─────────────────────────────────────── */}
      <section className="border-t border-white/[0.06] bg-[#0a0a0a] py-10">
        <div className="max-w-3xl mx-auto px-4">
          <p className="text-center text-xs text-white/25 uppercase tracking-widest font-semibold mb-7">
            Built for serious AFL fantasy players
          </p>
          <div className="grid grid-cols-3 gap-6 text-center">
            {PROOF.map(({ stat, label }) => (
              <div key={label}>
                <p className="text-2xl md:text-3xl font-extrabold text-white mb-1">{stat}</p>
                <p className="text-xs text-white/30 font-medium">{label}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── FEATURE BLOCKS ───────────────────────────────────── */}
      <section className="py-20 bg-[#070707] border-t border-white/[0.05]">
        <div className="max-w-4xl mx-auto px-4">
          <div className="grid sm:grid-cols-3 gap-4">
            {FEATURES.map(({ icon: Icon, title, desc, href, cta }) => (
              <Link
                key={title}
                to={href}
                className="group rounded-2xl border border-white/[0.07] bg-[#0e0e0e] p-6 hover:border-[#F5C84C]/25 hover:bg-[#F5C84C]/[0.03] transition-all duration-200"
              >
                <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-[#F5C84C]/10 border border-[#F5C84C]/20 mb-5">
                  <Icon size={18} className="text-[#F5C84C]" />
                </div>
                <h3 className="text-base font-bold text-white mb-2">{title}</h3>
                <p className="text-sm text-white/40 leading-relaxed mb-5">{desc}</p>
                <div className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#F5C84C]/60 group-hover:text-[#F5C84C] transition-colors">
                  {cta}
                  <ArrowRight size={12} className="group-hover:translate-x-0.5 transition-transform" />
                </div>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* ── NEEKO+ UPGRADE CTA ───────────────────────────────── */}
      {!isPremium && (
        <section className="py-20 bg-[#0a0a0a] border-t border-white/[0.05]">
          <div className="max-w-xl mx-auto px-4 text-center">
            <div className="flex items-center justify-center w-14 h-14 rounded-full bg-[#F5C84C]/12 border border-[#F5C84C]/25 mx-auto mb-6">
              <Crown size={24} className="text-[#F5C84C]" />
            </div>
            <h2 className="text-3xl md:text-4xl font-extrabold mb-3">Neeko+</h2>
            <p className="text-white/45 text-base mb-2 max-w-sm mx-auto leading-relaxed">
              Full rankings. Captain intel. Ceiling and floor data. Head-to-head comparison tools.
            </p>
            <p className="text-[#F5C84C] font-bold text-lg mb-8">$5.99 / week — cancel anytime</p>

            <div className="grid grid-cols-2 gap-3 mb-8 text-left">
              {[
                "All 200+ players ranked",
                "Ceiling & floor projections",
                "Captain recommendations",
                "Value score & risk rating",
                "Full player comparisons",
                "Weekly updated picks",
              ].map((f) => (
                <div key={f} className="flex items-center gap-2.5">
                  <div className="w-1.5 h-1.5 rounded-full bg-[#F5C84C] shrink-0" />
                  <span className="text-sm text-white/55">{f}</span>
                </div>
              ))}
            </div>

            <Link
              to="/neeko-plus"
              className="inline-flex items-center gap-2 bg-[#F5C84C] text-black font-bold text-sm px-10 py-3.5 rounded-xl hover:brightness-110 transition-all"
            >
              <Crown size={15} />
              Upgrade to Neeko+
            </Link>
          </div>
        </section>
      )}

      {/* ── FOOTER ───────────────────────────────────────────── */}
      <footer className="border-t border-white/[0.05] bg-[#070707] py-8">
        <div className="max-w-4xl mx-auto px-4">
          <div className="flex flex-col sm:flex-row justify-between items-center gap-4">
            <p className="text-xs text-white/25">
              © {new Date().getFullYear()} Neeko Sports Stats. All rights reserved.
            </p>
            <div className="flex gap-5 text-xs">
              {[
                { label: "Policies", to: "/policies" },
                { label: "Contact",  to: "/contact" },
                { label: "About",    to: "/about" },
                { label: "FAQ",      to: "/faq" },
              ].map((l) => (
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
