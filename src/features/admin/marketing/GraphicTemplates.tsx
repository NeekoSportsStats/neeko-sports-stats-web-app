import React from "react";

// ─── Types ─────────────────────────────────────────────────────────────────────

export interface ContentPlayer {
  player_id: number | null;
  player_name: string;
  team: string;
  position: string | null;
  projection_final: number | null;
  ceiling_estimate: number | null;
  floor_estimate: number | null;
  captain_score: number | null;
  matchup_rating: number | null;
  upside_rating: number | null;
  consistency_score: number | null;
  risk_rating: number | null;
}

export interface StatAngle {
  id: string;
  label: string;
  title: string;
  subtitle: string;
  orderBy: keyof ContentPlayer;
  orderDir: "asc" | "desc";
  limit: number;
  statLabel: string;
  statFn: (p: ContentPlayer) => string;
  accentColor: string;
  insightFn: (players: ContentPlayer[]) => string;
  layoutHint?: "stat_card" | "leaderboard" | "battle";
}

export type LayoutEngine = "stat_card" | "leaderboard" | "battle";
export type BackgroundTheme = "dark_gradient" | "stadium" | "grass" | "team_colour" | "analytics_grid";

export interface GraphicOptions {
  layout: LayoutEngine;
  background: BackgroundTheme;
  showTeamAccent: boolean;
  playerImageUrl?: string;
}

// ─── Team colours (expanded) ───────────────────────────────────────────────────

const TEAM_COLOURS: Record<string, { primary: string; secondary: string }> = {
  ADEL: { primary: "#002B5C", secondary: "#E21A3A" },
  BL:   { primary: "#7B0046", secondary: "#0066CC" },
  CARL: { primary: "#031A29", secondary: "#FFFFFF" },
  COLL: { primary: "#000000", secondary: "#FFFFFF" },
  ESS:  { primary: "#000000", secondary: "#D50032" },
  FRE:  { primary: "#2C0E53", secondary: "#CF3B1E" },
  GEEL: { primary: "#001C3F", secondary: "#FFCD00" },
  GC:   { primary: "#E40B16", secondary: "#FFCD00" },
  GWS:  { primary: "#F15A25", secondary: "#333" },
  HAW:  { primary: "#442B17", secondary: "#FFCD00" },
  MELB: { primary: "#0C2340", secondary: "#BA0C2F" },
  NM:   { primary: "#013B9F", secondary: "#FFFFFF" },
  PORT: { primary: "#008AAB", secondary: "#000000" },
  RICH: { primary: "#F1C400", secondary: "#000000" },
  STK:  { primary: "#ED0F05", secondary: "#000000" },
  SYD:  { primary: "#E00E18", secondary: "#FFFFFF" },
  WB:   { primary: "#003087", secondary: "#E00B0B" },
  WCE:  { primary: "#002B81", secondary: "#F2A900" },
};

export function getTeamColour(team: string): { primary: string; secondary: string } {
  const key = team?.trim().toUpperCase();
  return TEAM_COLOURS[key] ?? { primary: "#1e293b", secondary: "#64748b" };
}

// ─── Background helpers ────────────────────────────────────────────────────────

function bgStyle(theme: BackgroundTheme, accentColor: string, teamPrimary: string): React.CSSProperties {
  switch (theme) {
    case "stadium":
      return {
        background: `
          radial-gradient(ellipse 160% 80% at 50% 110%, ${accentColor}18 0%, transparent 70%),
          radial-gradient(ellipse 80% 40% at 50% 0%, ${accentColor}10 0%, transparent 60%),
          linear-gradient(170deg, #0b1628 0%, #060e1e 50%, #000810 100%)
        `,
      };
    case "grass":
      return {
        background: `
          repeating-linear-gradient(0deg, rgba(255,255,255,0.012) 0px, rgba(255,255,255,0.012) 1px, transparent 1px, transparent 48px),
          repeating-linear-gradient(90deg, rgba(255,255,255,0.008) 0px, rgba(255,255,255,0.008) 1px, transparent 1px, transparent 48px),
          linear-gradient(170deg, #061208 0%, #04100a 100%)
        `,
      };
    case "team_colour":
      return {
        background: `linear-gradient(155deg, ${teamPrimary}22 0%, #07111e 40%, #020917 100%)`,
      };
    case "analytics_grid":
      return {
        background: `
          linear-gradient(rgba(255,255,255,0.014) 1px, transparent 1px),
          linear-gradient(90deg, rgba(255,255,255,0.014) 1px, transparent 1px),
          linear-gradient(150deg, #0a0f1e 0%, #020511 100%)
        `,
        backgroundSize: "72px 72px, 72px 72px, 100% 100%",
      };
    default:
      return {
        background: "linear-gradient(135deg, #0f172a 0%, #020617 100%)",
      };
  }
}

// ─── Shared primitives ─────────────────────────────────────────────────────────

function AccentBar({ color }: { color: string }) {
  return (
    <div style={{
      position: "absolute", top: 0, left: 0, right: 0, height: 5,
      background: `linear-gradient(90deg, ${color} 0%, ${color}66 65%, transparent 100%)`,
    }} />
  );
}

function BrandBar({ accentColor, right }: { accentColor: string; right?: React.ReactNode }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
      <div style={{
        width: 32, height: 32, borderRadius: 8,
        background: accentColor,
        display: "flex", alignItems: "center", justifyContent: "center",
        fontSize: 17, fontWeight: 900, color: "#000", flexShrink: 0,
      }}>N</div>
      <span style={{ fontSize: 17, fontWeight: 800, color: "rgba(255,255,255,0.82)", letterSpacing: "0.09em", textTransform: "uppercase" }}>
        NEEKO SPORTS STATS
      </span>
      {right && <><div style={{ flex: 1 }} />{right}</>}
    </div>
  );
}

function Footer({ accentColor }: { accentColor: string }) {
  return (
    <div style={{
      display: "flex", alignItems: "center", justifyContent: "space-between",
      paddingTop: 22, borderTop: "1px solid rgba(255,255,255,0.07)",
    }}>
      <span style={{ fontSize: 17, fontWeight: 700, color: accentColor }}>neekostats.com.au</span>
      <span style={{ fontSize: 14, color: "rgba(255,255,255,0.28)", letterSpacing: "0.04em" }}>
        #AFLFantasy · #FantasyFooty · #AFL
      </span>
    </div>
  );
}

// ─── Player image layer ────────────────────────────────────────────────────────
// Renders a very subtle ghost image if a URL is provided.
// Falls back silently if the image fails to load.

function PlayerGhostImage({ url, w, h }: { url: string; w: number; h: number }) {
  const [ok, setOk] = React.useState(true);
  if (!ok) return null;
  return (
    <div style={{
      position: "absolute",
      right: 0,
      bottom: 0,
      width: Math.round(w * 0.55),
      height: Math.round(h * 0.75),
      pointerEvents: "none",
      overflow: "hidden",
      zIndex: 1,
    }}>
      <img
        src={url}
        alt=""
        onError={() => setOk(false)}
        style={{
          width: "100%",
          height: "100%",
          objectFit: "contain",
          objectPosition: "bottom right",
          opacity: 0.18,
          filter: "blur(1.5px) saturate(0.6)",
          userSelect: "none",
        }}
      />
    </div>
  );
}

// ─── Team colour left-border accent ───────────────────────────────────────────

function TeamAccentBorder({ teamPrimary }: { teamPrimary: string }) {
  return (
    <div style={{
      position: "absolute",
      top: 0,
      bottom: 0,
      left: 0,
      width: 6,
      background: `linear-gradient(180deg, ${teamPrimary} 0%, ${teamPrimary}44 60%, transparent 100%)`,
    }} />
  );
}

// ─── Shared wrapper ────────────────────────────────────────────────────────────

function CanvasShell({
  w, h, angle, options, teamColour, children,
}: {
  w: number; h: number;
  angle: StatAngle;
  options: GraphicOptions;
  teamColour: { primary: string; secondary: string };
  children: React.ReactNode;
}) {
  const isWide = w > h;
  const pad = isWide ? "40px 60px" : "52px 60px";
  const gridOverlay = options.background !== "analytics_grid"
    ? "linear-gradient(rgba(255,255,255,0.012) 1px,transparent 1px),linear-gradient(90deg,rgba(255,255,255,0.012) 1px,transparent 1px)"
    : undefined;

  return (
    <div style={{
      width: w, height: h,
      fontFamily: "'Inter','Helvetica Neue',Arial,sans-serif",
      position: "relative",
      overflow: "hidden",
      display: "flex",
      flexDirection: "column",
      padding: pad,
      boxSizing: "border-box",
      zIndex: 0,
      ...bgStyle(options.background, angle.accentColor, teamColour.primary),
    }}>
      {/* Grid overlay for non-grid themes */}
      {gridOverlay && (
        <div style={{
          position: "absolute", inset: 0,
          backgroundImage: gridOverlay,
          backgroundSize: "72px 72px",
          pointerEvents: "none",
        }} />
      )}
      {/* Radial glow */}
      <div style={{
        position: "absolute", top: -200, right: -160,
        width: 560, height: 560, borderRadius: "50%",
        background: `radial-gradient(circle,${angle.accentColor}14 0%,transparent 65%)`,
        pointerEvents: "none",
      }} />
      <AccentBar color={angle.accentColor} />
      {options.showTeamAccent && <TeamAccentBorder teamPrimary={teamColour.primary} />}
      {options.playerImageUrl && (
        <PlayerGhostImage url={options.playerImageUrl} w={w} h={h} />
      )}
      <div style={{ position: "relative", zIndex: 2, display: "flex", flexDirection: "column", height: "100%" }}>
        {children}
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// LAYOUT ENGINE 1: STAT CARD
// ═══════════════════════════════════════════════════════════════════════════════
// Used for: Player Spotlight, Breakout Watch, Captain Picks, Value Picks,
//           Projection Risers, Hot Streak, Form Players, Differential Picks
// ═══════════════════════════════════════════════════════════════════════════════

export function LayoutStatCard({
  angle, players, w, h, options,
}: {
  angle: StatAngle; players: ContentPlayer[]; w: number; h: number; options: GraphicOptions;
}) {
  const top = players[0];
  if (!top) return <div style={{ width: w, height: h, background: "#060a14" }} />;
  const isWide = w > h;
  const isTall = h > w;
  const teamColour = getTeamColour(top.team);

  const proj   = Math.round(Number(top.projection_final ?? 0));
  const ceil   = Math.round(Number(top.ceiling_estimate ?? 0));
  const floor  = Math.round(Number(top.floor_estimate ?? 0));
  const cons   = Number(top.consistency_score ?? 0).toFixed(0);
  const matchup = Math.round(Number(top.matchup_rating ?? 0));

  const stats = [
    { label: "Projection",    val: proj   > 0 ? `${proj} pts`        : "—" },
    { label: "Ceiling",       val: ceil   > 0 ? `${ceil} pts`        : "—" },
    { label: "Floor",         val: floor  > 0 ? `${floor} pts`       : "—" },
    { label: "Consistency",   val: Number(cons) > 0 ? `${cons}%`     : "—" },
    { label: "Matchup",       val: matchup > 0 ? `${matchup} / 100`  : "—" },
  ];

  const nameParts = top.player_name.split(" ");
  const lastName  = nameParts.slice(-1)[0];
  const firstName = nameParts.slice(0, -1).join(" ");

  return (
    <CanvasShell w={w} h={h} angle={angle} options={options} teamColour={teamColour}>
      {/* Header */}
      <div style={{ flexShrink: 0, marginBottom: isWide ? 20 : 28 }}>
        <BrandBar accentColor={angle.accentColor} right={
          <span style={{ fontSize: 12, fontWeight: 700, color: angle.accentColor, textTransform: "uppercase", letterSpacing: "0.1em" }}>
            {angle.label}
          </span>
        } />
      </div>

      {/* Body */}
      <div style={{
        flex: 1,
        display: "flex",
        flexDirection: isWide ? "row" : "column",
        alignItems: isWide ? "center" : "flex-start",
        justifyContent: isTall ? "center" : "flex-start",
        gap: isWide ? 48 : 0,
      }}>
        {/* Player info */}
        <div style={{ textAlign: isWide ? "left" : "center", width: isWide ? undefined : "100%", ...(isWide ? { flex: 1 } : {}) }}>
          <div style={{
            fontSize: 12, fontWeight: 700, color: angle.accentColor,
            textTransform: "uppercase", letterSpacing: "0.12em",
            marginBottom: isWide ? 8 : 12,
          }}>
            #{1} {angle.label}
          </div>
          <div style={{
            fontSize: isWide ? 56 : (isTall ? 88 : 72),
            fontWeight: 900, color: "#fff",
            lineHeight: 0.95, letterSpacing: "-0.03em",
            marginBottom: 4,
          }}>
            {lastName}
          </div>
          <div style={{
            fontSize: isWide ? 28 : (isTall ? 40 : 34),
            fontWeight: 700, color: "rgba(255,255,255,0.45)",
            letterSpacing: "-0.01em", marginBottom: 14,
          }}>
            {firstName}
          </div>

          {/* Big hero stat */}
          <div style={{
            fontSize: isWide ? 44 : (isTall ? 64 : 56),
            fontWeight: 900, color: angle.accentColor,
            lineHeight: 1, fontVariantNumeric: "tabular-nums",
            marginBottom: 8,
          }}>
            {angle.statFn(top)}
          </div>
          <div style={{
            fontSize: 13, fontWeight: 700, color: "rgba(255,255,255,0.3)",
            textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 16,
          }}>
            {angle.statLabel}
          </div>

          {/* Team / position pill */}
          <div style={{
            display: "inline-flex", alignItems: "center", gap: 8,
            background: `${angle.accentColor}12`, border: `1px solid ${angle.accentColor}30`,
            borderRadius: 20, padding: "5px 14px",
          }}>
            <span style={{ fontSize: 14, color: "rgba(255,255,255,0.5)" }}>{top.team}</span>
            {top.position && (
              <>
                <span style={{ width: 3, height: 3, borderRadius: "50%", background: angle.accentColor, display: "inline-block" }} />
                <span style={{ fontSize: 14, color: angle.accentColor, fontWeight: 700 }}>{top.position}</span>
              </>
            )}
          </div>
        </div>

        {/* Stats card */}
        <div style={{ ...(isWide ? { width: 320, flexShrink: 0 } : { width: "100%", marginTop: 28 }) }}>
          <div style={{
            background: `${angle.accentColor}10`,
            border: `1.5px solid ${angle.accentColor}28`,
            borderRadius: 20,
            padding: isWide ? "24px 28px" : "22px 28px",
            display: "flex", flexDirection: "column", gap: 13,
          }}>
            {stats.map(({ label, val }) => (
              <div key={label} style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <span style={{ fontSize: 15, color: "rgba(255,255,255,0.4)", fontWeight: 500 }}>{label}</span>
                <span style={{ fontSize: 20, fontWeight: 800, color: "#fff", fontVariantNumeric: "tabular-nums" }}>{val}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div style={{ flexShrink: 0, marginTop: isWide ? 20 : 24 }}>
        <Footer accentColor={angle.accentColor} />
      </div>
    </CanvasShell>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// LAYOUT ENGINE 2: LEADERBOARD
// ═══════════════════════════════════════════════════════════════════════════════
// Used for: Top Projections, Captain Rankings, Best Value, Most Consistent,
//           Trade Targets, Avoid Players, Worst Matchups, Rookie Watch
// ═══════════════════════════════════════════════════════════════════════════════

export function LayoutLeaderboard({
  angle, players, w, h, options,
}: {
  angle: StatAngle; players: ContentPlayer[]; w: number; h: number; options: GraphicOptions;
}) {
  const isWide = w > h;
  const isTall = h > w * 1.3;
  const maxRows = isTall ? 10 : isWide ? 8 : 8;
  const rows = players.slice(0, maxRows);
  const teamColour = rows[0] ? getTeamColour(rows[0].team) : { primary: "#1e293b", secondary: "#64748b" };

  const rankColor = (i: number) =>
    i === 0 ? "#F59E0B" : i === 1 ? "#94A3B8" : i === 2 ? "#CD7C37" : "rgba(255,255,255,0.2)";

  return (
    <CanvasShell w={w} h={h} angle={angle} options={options} teamColour={teamColour}>
      {/* Header */}
      <div style={{ flexShrink: 0, marginBottom: isTall ? 28 : 22 }}>
        <BrandBar accentColor={angle.accentColor} right={
          <div style={{
            background: `${angle.accentColor}1a`, border: `1px solid ${angle.accentColor}40`,
            borderRadius: 8, padding: "5px 14px",
            fontSize: 13, fontWeight: 700, color: angle.accentColor,
            textTransform: "uppercase", letterSpacing: "0.07em",
          }}>
            {angle.statLabel}
          </div>
        } />
        <div style={{ width: 44, height: 3, background: angle.accentColor, borderRadius: 2, marginTop: 18, marginBottom: 12 }} />
        <h1 style={{
          fontSize: isWide ? 36 : (isTall ? 52 : 42),
          fontWeight: 900, color: "#fff",
          lineHeight: 1.05, margin: 0, letterSpacing: "-0.025em",
        }}>
          {angle.title}
        </h1>
        <p style={{ fontSize: 17, color: "rgba(255,255,255,0.35)", marginTop: 6, fontWeight: 400 }}>
          {angle.subtitle}
        </p>
      </div>

      {/* Rows */}
      <div style={{
        flex: 1,
        display: "flex",
        flexDirection: isWide ? "row" : "column",
        gap: 5,
        flexWrap: isWide ? "wrap" : "nowrap",
        alignContent: "flex-start",
      }}>
        {rows.map((p, i) => {
          const isFirst = i === 0;
          const tc = options.showTeamAccent ? getTeamColour(p.team) : null;
          return (
            <div key={i} style={{
              display: "flex", alignItems: "center",
              padding: isFirst ? "14px 20px" : "10px 20px",
              borderRadius: 10,
              background: isFirst
                ? `linear-gradient(90deg,${angle.accentColor}1c 0%,${angle.accentColor}06 100%)`
                : i < 3 ? "rgba(255,255,255,0.04)" : "rgba(255,255,255,0.022)",
              border: isFirst
                ? `1px solid ${angle.accentColor}40`
                : "1px solid rgba(255,255,255,0.05)",
              borderLeft: tc ? `3px solid ${tc.primary}` : undefined,
              ...(isWide ? { width: "calc(50% - 3px)", flexShrink: 0 } : {}),
            }}>
              <span style={{
                fontSize: isFirst ? 22 : 17,
                fontWeight: 900, color: rankColor(i),
                width: 38, flexShrink: 0, fontVariantNumeric: "tabular-nums",
              }}>
                {i + 1}
              </span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{
                  fontSize: isFirst ? 22 : 18,
                  fontWeight: 700, color: "#fff",
                  whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis",
                }}>
                  {p.player_name}
                </div>
                <div style={{ fontSize: 12, color: "rgba(255,255,255,0.32)", marginTop: 1 }}>
                  {p.team}{p.position ? ` · ${p.position}` : ""}
                </div>
              </div>
              <div style={{
                fontSize: isFirst ? 26 : 20,
                fontWeight: 800,
                color: isFirst ? angle.accentColor : "#fff",
                fontVariantNumeric: "tabular-nums", flexShrink: 0,
              }}>
                {angle.statFn(p)}
              </div>
            </div>
          );
        })}
      </div>

      <div style={{ flexShrink: 0, marginTop: 18 }}>
        <Footer accentColor={angle.accentColor} />
      </div>
    </CanvasShell>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// LAYOUT ENGINE 3: PLAYER BATTLE
// ═══════════════════════════════════════════════════════════════════════════════
// Used for: Start/Sit, Captain Battle, Midfield Comparison, Ruck Comparison
// ═══════════════════════════════════════════════════════════════════════════════

export function LayoutBattle({
  angle, players, w, h, options,
}: {
  angle: StatAngle; players: ContentPlayer[]; w: number; h: number; options: GraphicOptions;
}) {
  const p1 = players[0];
  const p2 = players[1];
  if (!p1 || !p2) return <div style={{ width: w, height: h, background: "#060a14" }} />;
  const isWide = w > h;
  const isTall = h > w;
  const teamColour1 = getTeamColour(p1.team);
  const teamColour2 = getTeamColour(p2.team);

  const battleStats = [
    { label: "Projection",  v1: p1.projection_final,  v2: p2.projection_final,  fmt: (n: number | null) => n != null ? `${Math.round(Number(n))} pts` : "—" },
    { label: "Ceiling",     v1: p1.ceiling_estimate,  v2: p2.ceiling_estimate,  fmt: (n: number | null) => n != null ? `${Math.round(Number(n))} pts` : "—" },
    { label: "Matchup",     v1: p1.matchup_rating,    v2: p2.matchup_rating,    fmt: (n: number | null) => n != null ? `${Math.round(Number(n))} / 100` : "—" },
    { label: "Form",        v1: p1.consistency_score, v2: p2.consistency_score, fmt: (n: number | null) => n != null ? `${Number(n).toFixed(0)}%` : "—" },
  ];

  const isBetter = (v1: number | null, v2: number | null) =>
    v1 != null && v2 != null ? Number(v1) >= Number(v2) : null;

  const vsSize = isTall ? 60 : 52;

  return (
    <CanvasShell w={w} h={h} angle={angle} options={{ ...options, playerImageUrl: undefined }} teamColour={teamColour1}>
      <div style={{ flexShrink: 0, marginBottom: isTall ? 32 : 22 }}>
        <BrandBar accentColor={angle.accentColor} />
        <div style={{ width: 44, height: 3, background: angle.accentColor, borderRadius: 2, marginTop: 16, marginBottom: 12 }} />
        <h1 style={{
          fontSize: isWide ? 34 : (isTall ? 54 : 44),
          fontWeight: 900, color: "#fff", margin: 0, letterSpacing: "-0.025em",
        }}>
          {angle.title}
        </h1>
        <p style={{ fontSize: 16, color: "rgba(255,255,255,0.38)", marginTop: 5 }}>
          Who do you start this round?
        </p>
      </div>

      {/* Battle panels */}
      <div style={{
        flex: 1, display: "flex",
        flexDirection: isTall ? "column" : "row",
        alignItems: "stretch", gap: 0, position: "relative",
      }}>
        {[p1, p2].map((p, side) => {
          const tc = options.showTeamAccent
            ? (side === 0 ? teamColour1 : teamColour2)
            : null;
          return (
            <div key={side} style={{
              flex: 1, display: "flex", flexDirection: "column",
              alignItems: "center", justifyContent: "center",
              padding: isWide ? "24px 20px" : (isTall ? "24px 28px" : "32px 24px"),
              borderRadius: side === 0
                ? (isTall ? "16px 16px 0 0" : "16px 0 0 16px")
                : (isTall ? "0 0 16px 16px" : "0 16px 16px 0"),
              background: side === 0
                ? `linear-gradient(155deg,${angle.accentColor}1a 0%,${angle.accentColor}07 100%)`
                : "rgba(255,255,255,0.03)",
              border: side === 0
                ? `1.5px solid ${angle.accentColor}44`
                : "1.5px solid rgba(255,255,255,0.07)",
              borderTop: tc ? `4px solid ${tc.primary}` : undefined,
              position: "relative",
            }}>
              {side === 0 && (
                <div style={{
                  position: "absolute", top: 12, left: 12,
                  background: angle.accentColor, borderRadius: 6,
                  padding: "3px 10px", fontSize: 10, fontWeight: 800,
                  color: "#000", textTransform: "uppercase", letterSpacing: "0.06em",
                }}>
                  TOP PICK
                </div>
              )}
              <div style={{
                fontSize: 12, fontWeight: 700,
                color: side === 0 ? angle.accentColor : "rgba(255,255,255,0.28)",
                textTransform: "uppercase", letterSpacing: "0.1em",
                marginBottom: isTall ? 12 : 10,
              }}>
                #{side + 1} {angle.statLabel}
              </div>
              <div style={{
                fontSize: isWide ? 32 : (isTall ? 52 : 40),
                fontWeight: 900, color: "#fff",
                textAlign: "center", lineHeight: 1.1,
                letterSpacing: "-0.02em", marginBottom: 8,
              }}>
                {p.player_name}
              </div>
              <div style={{ fontSize: 14, color: "rgba(255,255,255,0.35)", marginBottom: isTall ? 16 : 12 }}>
                {p.team}{p.position ? ` · ${p.position}` : ""}
              </div>
              <div style={{
                fontSize: isWide ? 42 : (isTall ? 64 : 52),
                fontWeight: 900,
                color: side === 0 ? angle.accentColor : "#fff",
                lineHeight: 1, fontVariantNumeric: "tabular-nums",
                marginBottom: 6,
              }}>
                {angle.statFn(p)}
              </div>
              <div style={{
                fontSize: 12, color: "rgba(255,255,255,0.25)",
                textTransform: "uppercase", letterSpacing: "0.08em",
              }}>
                {angle.statLabel}
              </div>
            </div>
          );
        })}

        {/* VS badge */}
        <div style={{
          position: "absolute",
          top: isTall ? "50%" : "50%",
          left: isTall ? "50%" : "50%",
          transform: "translate(-50%,-50%)",
          zIndex: 10,
          width: vsSize, height: vsSize, borderRadius: "50%",
          background: "#070d1b",
          border: `2px solid ${angle.accentColor}55`,
          display: "flex", alignItems: "center", justifyContent: "center",
        }}>
          <span style={{ fontSize: 16, fontWeight: 900, color: angle.accentColor }}>VS</span>
        </div>
      </div>

      {/* Stat comparison table */}
      <div style={{ flexShrink: 0, marginTop: isTall ? 20 : 14 }}>
        <div style={{
          display: "grid",
          gridTemplateColumns: "1fr auto 1fr",
          gap: isTall ? "10px 8px" : "7px 8px",
          marginBottom: 16,
        }}>
          {battleStats.map(({ label, v1, v2, fmt }) => {
            const p1Better = isBetter(v1, v2);
            return (
              <React.Fragment key={label}>
                <div style={{
                  textAlign: "right",
                  fontSize: isWide ? 16 : 18,
                  fontWeight: 800,
                  color: p1Better === true ? angle.accentColor : "#fff",
                  fontVariantNumeric: "tabular-nums",
                }}>
                  {fmt(v1)}
                </div>
                <div style={{
                  textAlign: "center",
                  fontSize: 11, fontWeight: 600,
                  color: "rgba(255,255,255,0.28)",
                  textTransform: "uppercase", letterSpacing: "0.07em",
                  alignSelf: "center",
                }}>
                  {label}
                </div>
                <div style={{
                  textAlign: "left",
                  fontSize: isWide ? 16 : 18,
                  fontWeight: 800,
                  color: p1Better === false ? angle.accentColor : "#fff",
                  fontVariantNumeric: "tabular-nums",
                }}>
                  {fmt(v2)}
                </div>
              </React.Fragment>
            );
          })}
        </div>
        <Footer accentColor={angle.accentColor} />
      </div>
    </CanvasShell>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// CAROUSEL SLIDE WRAPPER
// Wraps a single player card for carousel exports
// ═══════════════════════════════════════════════════════════════════════════════

export function CarouselTitleSlide({
  angle, w, h, options, totalPlayers,
}: {
  angle: StatAngle; w: number; h: number; options: GraphicOptions; totalPlayers: number;
}) {
  const teamColour = { primary: "#1e293b", secondary: "#64748b" };
  const isTall = h > w;

  return (
    <CanvasShell w={w} h={h} angle={angle} options={{ ...options, playerImageUrl: undefined }} teamColour={teamColour}>
      <div style={{ flexShrink: 0, marginBottom: 24 }}>
        <BrandBar accentColor={angle.accentColor} />
      </div>

      <div style={{
        flex: 1, display: "flex", flexDirection: "column",
        alignItems: "center", justifyContent: "center", textAlign: "center",
      }}>
        {/* Decorative glow */}
        <div style={{
          position: "absolute", top: "30%", left: "50%",
          transform: "translate(-50%,-50%)",
          width: 500, height: 500, borderRadius: "50%",
          background: `radial-gradient(circle,${angle.accentColor}18 0%,transparent 65%)`,
          pointerEvents: "none",
        }} />

        <div style={{
          display: "flex", alignItems: "center", gap: 12, marginBottom: 28,
        }}>
          <div style={{ width: 56, height: 3, background: angle.accentColor, borderRadius: 2 }} />
          <span style={{
            fontSize: 13, fontWeight: 800, color: angle.accentColor,
            textTransform: "uppercase", letterSpacing: "0.14em",
          }}>
            Carousel
          </span>
          <div style={{ width: 56, height: 3, background: angle.accentColor, borderRadius: 2 }} />
        </div>

        <h1 style={{
          fontSize: isTall ? 72 : 52,
          fontWeight: 900, color: "#fff",
          lineHeight: 1.05, letterSpacing: "-0.03em",
          marginBottom: 20, maxWidth: w - 120,
          margin: "0 auto 20px",
        }}>
          {angle.title}
        </h1>
        <p style={{
          fontSize: isTall ? 32 : 24,
          color: "rgba(255,255,255,0.38)",
          fontWeight: 400, marginBottom: 32,
        }}>
          {angle.subtitle}
        </p>

        <div style={{
          background: `${angle.accentColor}14`,
          border: `1px solid ${angle.accentColor}35`,
          borderRadius: 12, padding: "10px 24px",
          fontSize: 18, fontWeight: 700,
          color: angle.accentColor,
        }}>
          Swipe for Top {totalPlayers} Players →
        </div>
      </div>

      <div style={{ flexShrink: 0, marginTop: 24 }}>
        <Footer accentColor={angle.accentColor} />
      </div>
    </CanvasShell>
  );
}

export function CarouselPlayerSlide({
  angle, player, rank, w, h, options,
}: {
  angle: StatAngle; player: ContentPlayer; rank: number; w: number; h: number; options: GraphicOptions;
}) {
  const teamColour = getTeamColour(player.team);
  const isTall = h > w;
  const isWide = w > h;
  const nameParts = player.player_name.split(" ");
  const lastName  = nameParts.slice(-1)[0];
  const firstName = nameParts.slice(0, -1).join(" ");

  const proj  = Math.round(Number(player.projection_final ?? 0));
  const ceil  = Math.round(Number(player.ceiling_estimate ?? 0));
  const cons  = Number(player.consistency_score ?? 0).toFixed(0);
  const matchup = Math.round(Number(player.matchup_rating ?? 0));

  const secondary = [
    { label: "Projection", val: proj   > 0 ? `${proj} pts`       : "—" },
    { label: "Ceiling",    val: ceil   > 0 ? `${ceil} pts`       : "—" },
    { label: "Consistency",val: Number(cons) > 0 ? `${cons}%`    : "—" },
    { label: "Matchup",    val: matchup > 0 ? `${matchup} / 100` : "—" },
  ];

  return (
    <CanvasShell w={w} h={h} angle={angle} options={options} teamColour={teamColour}>
      <div style={{ flexShrink: 0, marginBottom: isTall ? 24 : 18 }}>
        <BrandBar accentColor={angle.accentColor} right={
          <div style={{
            background: `${angle.accentColor}1a`, border: `1px solid ${angle.accentColor}40`,
            borderRadius: 8, padding: "4px 12px",
            fontSize: 13, fontWeight: 800,
            color: angle.accentColor,
            fontVariantNumeric: "tabular-nums",
          }}>
            #{rank}
          </div>
        } />
      </div>

      <div style={{
        flex: 1, display: "flex", flexDirection: "column",
        alignItems: isTall ? "center" : "flex-start",
        justifyContent: "center",
        textAlign: isTall ? "center" : "left",
      }}>
        {/* Rank badge */}
        <div style={{
          fontSize: 13, fontWeight: 700, color: angle.accentColor,
          textTransform: "uppercase", letterSpacing: "0.12em", marginBottom: 12,
        }}>
          #{rank} {angle.label}
        </div>

        {/* Name */}
        <div style={{
          fontSize: isTall ? 96 : (isWide ? 56 : 80),
          fontWeight: 900, color: "#fff",
          lineHeight: 0.9, letterSpacing: "-0.035em", marginBottom: 4,
        }}>
          {lastName}
        </div>
        <div style={{
          fontSize: isTall ? 48 : (isWide ? 28 : 40),
          fontWeight: 700, color: "rgba(255,255,255,0.42)",
          letterSpacing: "-0.01em", marginBottom: 20,
        }}>
          {firstName}
        </div>

        {/* Hero stat */}
        <div style={{
          fontSize: isTall ? 80 : (isWide ? 52 : 68),
          fontWeight: 900, color: angle.accentColor,
          lineHeight: 1, fontVariantNumeric: "tabular-nums", marginBottom: 6,
        }}>
          {angle.statFn(player)}
        </div>
        <div style={{
          fontSize: 13, color: "rgba(255,255,255,0.3)",
          textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 20,
        }}>
          {angle.statLabel}
        </div>

        {/* Team/position */}
        <div style={{
          display: "inline-flex", alignItems: "center", gap: 8,
          background: `${angle.accentColor}12`, border: `1px solid ${angle.accentColor}30`,
          borderRadius: 20, padding: "5px 14px", marginBottom: 24,
        }}>
          <span style={{ fontSize: 14, color: "rgba(255,255,255,0.5)" }}>{player.team}</span>
          {player.position && (
            <>
              <span style={{ width: 3, height: 3, borderRadius: "50%", background: angle.accentColor, display: "inline-block" }} />
              <span style={{ fontSize: 14, color: angle.accentColor, fontWeight: 700 }}>{player.position}</span>
            </>
          )}
        </div>

        {/* Secondary stat grid */}
        <div style={{
          display: "grid",
          gridTemplateColumns: "repeat(2, 1fr)",
          gap: 8,
          width: isTall ? "100%" : Math.min(w - 120, 480),
        }}>
          {secondary.map(({ label, val }) => (
            <div key={label} style={{
              background: "rgba(255,255,255,0.04)",
              border: "1px solid rgba(255,255,255,0.07)",
              borderRadius: 12, padding: "14px 16px", textAlign: "center",
            }}>
              <div style={{ fontSize: isTall ? 26 : 20, fontWeight: 800, color: "#fff", fontVariantNumeric: "tabular-nums" }}>
                {val}
              </div>
              <div style={{ fontSize: 11, color: "rgba(255,255,255,0.3)", textTransform: "uppercase", letterSpacing: "0.08em", marginTop: 3 }}>
                {label}
              </div>
            </div>
          ))}
        </div>
      </div>

      <div style={{ flexShrink: 0, marginTop: 20 }}>
        <Footer accentColor={angle.accentColor} />
      </div>
    </CanvasShell>
  );
}

// ─── Main dispatcher ───────────────────────────────────────────────────────────

export function GraphicCanvas({
  layout, angle, players, w, h, options,
}: {
  layout: LayoutEngine;
  angle: StatAngle;
  players: ContentPlayer[];
  w: number; h: number;
  options: GraphicOptions;
}) {
  switch (layout) {
    case "stat_card":  return <LayoutStatCard   angle={angle} players={players} w={w} h={h} options={options} />;
    case "battle":     return <LayoutBattle     angle={angle} players={players} w={w} h={h} options={options} />;
    default:           return <LayoutLeaderboard angle={angle} players={players} w={w} h={h} options={options} />;
  }
}
