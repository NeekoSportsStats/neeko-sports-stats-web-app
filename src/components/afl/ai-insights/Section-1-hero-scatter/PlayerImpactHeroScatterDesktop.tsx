import React, { useMemo, useState } from "react";
import { Info, Lock, Sparkles } from "lucide-react";
import type { FixtureMatch } from "@/components/afl/match-center/types";
import type { PremiumMode } from "@/components/afl/ai-insights/data/types";

import PlayerTrendModal from "./PlayerTrendModal";
import { usePlayerScatterData, type LabelMode, type LensKey, type PlayerPoint } from "./usePlayerScatterData";

const W = 760;
const H = 420;
// Slightly tighter padding = bigger usable plot area (less "dead" edge space)
const PAD = 28;

const x = (v: number) => PAD + (v / 100) * (W - PAD * 2);
const y = (v: number) => PAD + (1 - v / 100) * (H - PAD * 2);

function cls(...s: Array<string | false | null | undefined>) {
  return s.filter(Boolean).join(" ");
}

function dotFill(side: "home" | "away") {
  return side === "home" ? "#60a5fa" : "#34d399"; // blue / green
}

function isLabelSmart(p: PlayerPoint) {
  // “smart” labels: only high combined + any ceiling spike
  return p.momentum + p.ceiling >= 150 || p.ceiling >= 86;
}

export default function PlayerImpactHeroScatterDesktop(props: {
  match?: FixtureMatch;
  mode: PremiumMode;
  initialLens?: LensKey;
}) {
  const { match, mode, initialLens } = props;
  const isPremium = mode === "premium";

  const d = usePlayerScatterData({ match, initialLens });
  const {
    homeTeam,
    awayTeam,
    lens,
    setLens,
    teamFilter,
    setTeamFilter,
    labelMode,
    setLabelMode,
    playersVisible,
    ranked,
    buckets,
    openId,
    setOpenId,
    selected,
    dominantQuadrant,
    lean,
    volatility,
    whyLean,
  } = d;

  const [modalOpen, setModalOpen] = useState(false);
  const [whyOpen, setWhyOpen] = useState(false);

  const dominantLabel = useMemo(() => {
    if (dominantQuadrant === "finale") return "Finale";
    if (dominantQuadrant === "volatile") return "Volatile";
    if (dominantQuadrant === "safe") return "Safe";
    return "Low";
  }, [dominantQuadrant]);

  const premiumNarrative = useMemo(() => {
    // tiny “sugar” line; stays tasteful
    if (dominantQuadrant === "finale") return "Finale targets often align with role stability and late-game scoring control.";
    if (dominantQuadrant === "volatile") return "Volatile ceiling profiles can win slates — but swing hard week-to-week.";
    if (dominantQuadrant === "safe") return "Safe floors reduce downside, but limit explosive upside.";
    return "Low-impact profiles require role change or matchup spike to matter.";
  }, [dominantQuadrant]);

  const handleDotClick = (id: string) => {
    if (openId !== id) {
      setOpenId(id);          // A1: select + update sidebar + selected card
      setModalOpen(false);
      return;
    }
    setModalOpen(true);       // A2: second click opens modal
  };

  const handleRowClick = (id: string) => {
    if (openId !== id) {
      setOpenId(id);
      setModalOpen(false);
      return;
    }
    setModalOpen(true);
  };

  const controls = (
    

      {/* Buckets below the scatter: multi-column to reduce overall scroll */}
      <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        <SidebarCard
          title="Top targets"
          subtitle="Best combined momentum + ceiling"
          items={ranked.slice(0, 4)}
          onRowClick={handleRowClick}
        />

        <SidebarCard
          title="Finale targets"
          subtitle="High momentum, high ceiling"
          badge="Hot"
          items={buckets.finale.slice(0, 4)}
          onRowClick={handleRowClick}
        />

        <SidebarCard
          title="Volatile upside"
          subtitle="Ceiling spikes with risk"
          items={buckets.volatileUpside.slice(0, 4)}
          onRowClick={handleRowClick}
          empty="No players in this filter."
        />

        <SidebarCard
          title="Safe floors"
          subtitle="Stable momentum, capped ceiling"
          items={buckets.safeFloors.slice(0, 4)}
          onRowClick={handleRowClick}
          empty="No players in this filter."
        />

        <SidebarCard
          title="Avoid / capped"
          subtitle="Low leverage unless role changes"
          items={buckets.avoid.slice(0, 4)}
          onRowClick={handleRowClick}
          empty="No players in this filter."
        />
      </div>

      {/* Modal */}
      <PlayerTrendModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        player={selected}
        allPlayers={d.playersAll}
        lens={lens}
        locked={!isPremium}
      />
    </div>
  );
}

function SidebarCard(props: {
  title: string;
  subtitle: string;
  items: PlayerPoint[];
  badge?: string;
  empty?: string;
  onRowClick: (id: string) => void;
}) {
  const { title, subtitle, items, badge, empty, onRowClick } = props;

  return (
    <div className="rounded-2xl border border-white/10 bg-black/20 p-3">
      <div className="flex items-start justify-between gap-2">
        <div>
          <div className="text-sm font-semibold text-white">{title}</div>
          <div className="mt-0.5 text-xs text-white/50">{subtitle}</div>
        </div>
        {badge && (
          <span className="rounded-full border border-amber-400/25 bg-amber-400/10 px-2 py-0.5 text-[11px] text-amber-200">
            {badge}
          </span>
        )}
      </div>

      <div className="mt-3 space-y-2">
        {items.length ? (
          items.map((p) => (
            <button
              key={p.id}
              onClick={() => onRowClick(p.id)}
              className="w-full rounded-xl border border-white/10 bg-black/20 px-3 py-2 text-left hover:bg-white/5"
            >
              <div className="flex items-center justify-between gap-2">
                <div>
                  <div className="text-sm font-medium text-white/90">{p.name}</div>
                  <div className="text-xs text-white/45">{p.teamName}</div>
                </div>
                <div className="text-xs text-white/60">
                  M {p.momentum} · C {p.ceiling}
                </div>
              </div>
            </button>
          ))
        ) : (
          <div className="text-xs text-white/40">{empty ?? "No players in this filter."}</div>
        )}
      </div>
    </div>
  );
}

function SelectedCard(props: {
  homeTeam: string;
  awayTeam: string;
  selected: PlayerPoint | null;
  isPremium: boolean;
  onOpenTrend: () => void;
}) {
  const { selected, isPremium, onOpenTrend } = props;

  return (
    <div className={cls(
      "rounded-2xl border bg-black/20 p-4",
      selected ? "border-amber-400/20" : "border-white/10"
    )}>
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className={cls(
            "text-[11px] uppercase tracking-[0.18em]",
            selected ? "text-amber-300/80" : "text-white/35"
          )}>
            Selected
          </div>
          {selected ? (
            <>
              <div className="mt-0.5 text-lg font-semibold text-white">{selected.name}</div>
              <div className="text-sm text-white/60">{selected.teamName}</div>
              <div className="mt-2 text-sm text-white/70">
                Momentum: <span className="text-white">{selected.momentum}</span>{" "}
                <span className="text-white/40">·</span>{" "}
                Ceiling: <span className="text-white">{selected.ceiling}</span>
              </div>
            </>
          ) : (
            <div className="mt-2 text-sm text-white/55 leading-relaxed">
              Select a player to view details.
            </div>
          )}
        </div>

        <button
          onClick={onOpenTrend}
          disabled={!selected}
          className={cls(
            "rounded-full border px-3 py-1.5 text-xs transition",
            selected
              ? "border-white/10 bg-black/20 text-white/75 hover:bg-white/5"
              : "border-white/10 bg-black/10 text-white/35 cursor-not-allowed"
          )}
        >
          Open trend
        </button>
      </div>

      {!isPremium && selected && (
        <div className="mt-3 text-xs text-white/45">
          <span className="inline-flex items-center gap-1 text-white/55">
            <Lock className="h-3.5 w-3.5" />
            Neeko+ Projection (locked)
          </span>
        </div>
      )}
    </div>
  );
}
