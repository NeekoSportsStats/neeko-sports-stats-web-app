import React, { useMemo } from "react";
import { X } from "lucide-react";
import type { FixtureMatch } from "./types";

import MatchDetailHeader from "./MatchDetailHeader";
import VenueIntelChips from "./VenueIntelChips";
import WinProbabilityBar from "./WinProbabilityBar";
import MatchDetailCTA from "./MatchDetailCTA";
import HeadToHeadPanel from "./HeadToHeadPanel";
import UpcomingAIPreview from "./UpcomingAIPreview";

type Props = {
  match: FixtureMatch;
  onClose: () => void;
};

const cx = (...c: Array<string | false | undefined>) => c.filter(Boolean).join(" ");

/** Deterministic “hash” → stable mock outputs per matchup */
function hashSeed(str: string) {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return Math.abs(h);
}

function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n));
}

/** 45–55 with slight matchup variance, stable */
function computeWinProbability(homeTeam: string, awayTeam: string) {
  const seed = hashSeed(`${homeTeam}__${awayTeam}`);
  const wobble = (seed % 17) - 8; // -8..+8
  const base = 50 + wobble * 0.6; // ~45..55
  return clamp(Math.round(base), 38, 62);
}

const PLAYERS_POOL = [
  "Anderson",
  "Daicos",
  "Walsh",
  "Neale",
  "Petracca",
  "Butters",
  "Cripps",
  "Merrett",
  "Serong",
  "Bontempelli",
  "Greene",
  "Dawson",
  "Gulden",
  "Cameron",
  "Stewart",
  "Moore",
  "Weitering",
  "May",
  "Bolton",
  "De Goey",
  "Brayshaw",
  "Guthrie",
];

function buildProjectedLineup(team: string, count = 22) {
  const seed = hashSeed(team);
  const out: string[] = [];
  for (let i = 0; i < count; i++) {
    const idx = (seed + i * 7) % PLAYERS_POOL.length;
    out.push(`${PLAYERS_POOL[idx]} (${team.slice(0, 1)})`);
  }
  return out;
}

type LastFiveItem = { label: string; result: "W" | "L"; margin: number };

function buildLastFive(team: string): LastFiveItem[] {
  const seed = hashSeed(team);
  return Array.from({ length: 5 }).map((_, i) => {
    const n = (seed + i * 13) % 100;
    const win = n >= 48;
    const margin = 6 + ((seed + i * 11) % 39); // 6..44
    const oppIdx = (seed + i * 5) % 18;
    const opp = [
      "Sydney",
      "Geelong",
      "Brisbane",
      "Carlton",
      "Fremantle",
      "Collingwood",
      "Port Adelaide",
      "Melbourne",
      "Essendon",
      "Adelaide",
      "Richmond",
      "Hawthorn",
      "GWS",
      "St Kilda",
      "Gold Coast",
      "North Melbourne",
      "West Coast",
      "Bulldogs",
    ][oppIdx];

    return {
      label: `vs ${opp}`,
      result: win ? "W" : "L",
      margin: margin,
    };
  });
}

function buildInsights(homeTeam: string, awayTeam: string) {
  const seed = hashSeed(`${homeTeam}-${awayTeam}`);
  const options = [
    "Midfield pressure profile suggests cleaner entries for the home side.",
    "Scoring efficiency gap looks narrow — expect a tight finish.",
    "Contested game profile favours the side with higher stoppage wins.",
    "Transition defence will be key — watch intercept chains off half-back.",
    "Venue bias + travel load slightly shifts expected margin.",
    "If early clearance dominance holds, win probability rises quickly.",
  ];
  const a = options[seed % options.length];
  const b = options[(seed + 2) % options.length];
  const c = options[(seed + 4) % options.length];
  return [a, b, c].slice(0, 3);
}

export default function MatchDetailOverlay({ match, onClose }: Props) {
  const homePct = useMemo(
    () => computeWinProbability(match.homeTeam, match.awayTeam),
    [match.homeTeam, match.awayTeam]
  );

  const upcomingLineups = useMemo(() => {
    return {
      home: buildProjectedLineup(match.homeTeam),
      away: buildProjectedLineup(match.awayTeam),
    };
  }, [match.homeTeam, match.awayTeam]);

  const last5 = useMemo(() => {
    return {
      home: buildLastFive(match.homeTeam),
      away: buildLastFive(match.awayTeam),
    };
  }, [match.homeTeam, match.awayTeam]);

  const insights = useMemo(() => buildInsights(match.homeTeam, match.awayTeam), [
    match.homeTeam,
    match.awayTeam,
  ]);

  return (
    <div className="fixed inset-0 z-50">
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} />

      <div className="absolute inset-y-0 right-0 w-full max-w-md bg-black border-l border-white/10 overflow-y-auto">
        <div className="sticky top-0 z-10 flex items-center justify-between p-4 border-b border-white/10 bg-black/80 backdrop-blur">
          <div className="text-sm font-semibold">Match Details</div>
          <button onClick={onClose} className="text-white/80 hover:text-white">
            <X size={18} />
          </button>
        </div>

        <div className="p-4 space-y-6">
          <MatchDetailHeader match={match} />

          {/* ✅ Win Probability: now for UPCOMING too */}
          <WinProbabilityBar homePct={homePct} />

          {/* FINAL (2025 historical) */}
          {match.status === "final" && (
            <HeadToHeadPanel homeTeam={match.homeTeam} awayTeam={match.awayTeam} />
          )}

          {/* UPCOMING (2026 default + future rounds) */}
          {match.status === "upcoming" && (
            <>
              {/* Keep your existing short AI preview */}
              <UpcomingAIPreview />

              {/* Added: Lineups */}
              <Panel title="Lineups (Projected)" subtitle="Full squad shown until official teams drop.">
                <div className="grid grid-cols-2 gap-3">
                  <LineupCol team={match.homeTeam} players={upcomingLineups.home.slice(0, 11)} />
                  <LineupCol team={match.awayTeam} players={upcomingLineups.away.slice(0, 11)} />
                  <LineupCol team={`${match.homeTeam} (Bench)`} players={upcomingLineups.home.slice(11, 22)} />
                  <LineupCol team={`${match.awayTeam} (Bench)`} players={upcomingLineups.away.slice(11, 22)} />
                </div>
              </Panel>

              {/* Added: Last 5 */}
              <Panel title="Last 5" subtitle="Recent form snapshot for both teams.">
                <div className="grid grid-cols-2 gap-3">
                  <Last5Col team={match.homeTeam} items={last5.home} />
                  <Last5Col team={match.awayTeam} items={last5.away} />
                </div>
              </Panel>

              {/* Added: 2–3 insights */}
              <Panel title="Key Insights" subtitle="Short preview notes (mocked for now).">
                <ul className="space-y-2 text-xs text-white/70">
                  {insights.map((t) => (
                    <li key={t} className="flex gap-2">
                      <span className="mt-[6px] h-1 w-1 rounded-full bg-amber-400/80 shrink-0" />
                      <span>{t}</span>
                    </li>
                  ))}
                </ul>
              </Panel>
            </>
          )}

          <VenueIntelChips match={match} />
          <MatchDetailCTA />
        </div>
      </div>
    </div>
  );
}

/* --------------------------------- UI Bits -------------------------------- */

function Panel({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-xl border border-white/10 bg-white/[0.03] p-4">
      <div className="flex items-start justify-between gap-3 mb-3">
        <div>
          <div className="text-sm font-semibold text-white">{title}</div>
          {subtitle && <div className="text-[11px] text-white/45 mt-0.5">{subtitle}</div>}
        </div>
      </div>
      {children}
    </div>
  );
}

function LineupCol({ team, players }: { team: string; players: string[] }) {
  return (
    <div className="rounded-lg border border-white/10 bg-black/20 p-3">
      <div className="text-[11px] font-semibold text-white/75 mb-2 truncate">{team}</div>
      <div className="space-y-1">
        {players.map((p, idx) => (
          <div key={`${team}-${idx}`} className="text-[11px] text-white/60 truncate">
            {p}
          </div>
        ))}
      </div>
    </div>
  );
}

function Last5Col({ team, items }: { team: string; items: { label: string; result: "W" | "L"; margin: number }[] }) {
  return (
    <div className="rounded-lg border border-white/10 bg-black/20 p-3">
      <div className="text-[11px] font-semibold text-white/75 mb-2 truncate">{team}</div>
      <div className="space-y-1.5">
        {items.map((it, idx) => (
          <div key={`${team}-l5-${idx}`} className="flex items-center justify-between gap-2 text-[11px]">
            <div className="text-white/55 truncate">{it.label}</div>
            <div className="flex items-center gap-2 shrink-0">
              <span
                className={cx(
                  "inline-flex items-center justify-center w-5 h-5 rounded-md text-[10px] font-bold border",
                  it.result === "W"
                    ? "border-emerald-400/30 bg-emerald-400/10 text-emerald-200"
                    : "border-rose-400/30 bg-rose-400/10 text-rose-200"
                )}
              >
                {it.result}
              </span>
              <span className="text-white/60">{it.margin}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
