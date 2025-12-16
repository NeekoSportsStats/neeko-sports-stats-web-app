import React from "react";
import { Calendar, MapPin, Activity } from "lucide-react";

const cx = (...c: Array<string | false | undefined>) =>
  c.filter(Boolean).join(" ");

export default function MatchCenterHeader() {
  return (
    <section className="relative mb-10">
      {/* Soft gold atmospheric glow */}
      <div className="pointer-events-none absolute inset-0 rounded-3xl bg-[radial-gradient(60%_60%_at_20%_0%,rgba(255,200,60,0.12),transparent_70%)]" />

      {/* Header surface */}
      <div className="relative rounded-3xl border border-white/10 bg-black/60 backdrop-blur-xl px-6 py-7 md:px-8 md:py-9">
        {/* Eyebrow */}
        <div className="mb-3 flex items-center gap-2 text-xs font-medium tracking-widest text-amber-300/80">
          <Activity size={14} />
          MATCH CENTER
        </div>

        {/* Title */}
        <h1 className="text-3xl md:text-4xl font-bold text-white">
          AFL Match Center
        </h1>

        {/* Subtitle */}
        <p className="mt-2 max-w-3xl text-sm md:text-base text-white/70">
          Live fixtures, venue context and ladder positioning — with deeper
          predictive insight available via AI match analysis.
        </p>

        {/* Section rail */}
        <div className="mt-6 flex flex-wrap gap-2">
          <SectionPill active icon={<Calendar size={14} />}>
            Fixtures
          </SectionPill>
          <SectionPill icon={<MapPin size={14} />}>
            Venues
          </SectionPill>
          <SectionPill>
            Ladder Context
          </SectionPill>
          <SectionPill premium>
            AI Match Insights
          </SectionPill>
        </div>
      </div>
    </section>
  );
}

/* -------------------------------------------------------------------------- */
/* Section Pill                                                               */
/* -------------------------------------------------------------------------- */

function SectionPill({
  children,
  active,
  premium,
  icon,
}: {
  children: React.ReactNode;
  active?: boolean;
  premium?: boolean;
  icon?: React.ReactNode;
}) {
  return (
    <div
      className={cx(
        "inline-flex items-center gap-2 rounded-full px-4 py-2 text-xs font-medium transition-all",
        "border",
        active
          ? "border-amber-300/40 bg-amber-400/20 text-amber-300"
          : premium
          ? "border-amber-400/30 bg-amber-400/10 text-amber-300"
          : "border-white/10 bg-white/5 text-white/70 hover:bg-white/10"
      )}
    >
      {icon}
      {children}
    </div>
  );
}
