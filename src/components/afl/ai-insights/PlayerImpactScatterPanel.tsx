import React, { useEffect, useMemo, useRef, useState } from "react";
import { Lock, Search, SlidersHorizontal } from "lucide-react";

import type { PremiumMode } from "@/components/afl/ai-insights/types";
import type { PredictRow } from "@/components/afl/ai-insights/types";
import { confLabel, volLabel, clamp } from "@/components/afl/ai-insights/utils";

type Point = {
  id: string;
  name: string;
  team: string;
  impact01: number; // higher = higher expected output
  safety01: number; // higher = safer role
  ceiling01: number; // higher = bigger upside
  rangeLow: number;
  rangeHigh: number;
  confidence01: number;
  volatility01: number;
  ai?: string;
};

function safeNum(n: any, fallback = 0) {
  const v = Number(n);
  return Number.isFinite(v) ? v : fallback;
}

function norm01(v: number, min: number, max: number) {
  if (!Number.isFinite(v) || !Number.isFinite(min) || !Number.isFinite(max)) return 0;
  if (max - min <= 1e-9) return 0.5;
  return clamp((v - min) / (max - min), 0, 1);
}

function useResizeObserver<T extends HTMLElement>(ref: React.RefObject<T>) {
  const [rect, setRect] = useState<{ width: number; height: number }>({ width: 0, height: 0 });

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const ro = new ResizeObserver((entries) => {
      const r = entries[0]?.contentRect;
      if (!r) return;
      setRect({ width: Math.max(0, r.width), height: Math.max(0, r.height) });
    });

    ro.observe(el);
    return () => ro.disconnect();
  }, [ref]);

  return rect;
}

function derivePoints(rows: PredictRow[]): Point[] {
  // We derive a "player impact map" from the predictability ranges so we don't need new data sources.
  // impact01 = normalized midpoint (expected output in this lens)
  // safety01 = confidence01 (role repeatability)
  // ceiling01 = normalized range width (upside / volatility potential)
  const mids = rows.map((r) => (safeNum((r as any).rangeLow) + safeNum((r as any).rangeHigh)) / 2);
  const widths = rows.map((r) => safeNum((r as any).rangeHigh) - safeNum((r as any).rangeLow));

  const midMin = Math.min(...mids, 0);
  const midMax = Math.max(...mids, 1);
  const wMin = Math.min(...widths, 0);
  const wMax = Math.max(...widths, 1);

  return rows.map((r) => {
    const low = safeNum((r as any).rangeLow);
    const high = safeNum((r as any).rangeHigh);
    const mid = (low + high) / 2;
    const width = Math.max(0, high - low);

    return {
      id: String((r as any).id ?? `${(r as any).name ?? "player"}__${(r as any).team ?? ""}`),
      name: String((r as any).name ?? "Player"),
      team: String((r as any).team ?? ""),
      impact01: norm01(mid, midMin, midMax),
      safety01: clamp(safeNum((r as any).confidence01), 0, 1),
      ceiling01: norm01(width, wMin, wMax),
      rangeLow: low,
      rangeHigh: high,
      confidence01: clamp(safeNum((r as any).confidence01), 0, 1),
      volatility01: clamp(safeNum((r as any).volatility01), 0, 1),
      ai: (r as any).ai ? String((r as any).ai) : undefined,
    };
  });
}

function toneFor(p: Point) {
  // subtle: safer roles more "gold", volatile more "rose"
  if (p.safety01 >= 0.72 && p.ceiling01 <= 0.45) return "safe";
  if (p.ceiling01 >= 0.7 && p.safety01 <= 0.55) return "swing";
  return "mid";
}

function Badge({
  children,
  tone = "neutral",
}: {
  children: React.ReactNode;
  tone?: "neutral" | "gold" | "muted";
}) {
  const cls =
    tone === "gold"
      ? "border-amber-400/25 bg-amber-400/10 text-amber-200/90"
      : tone === "muted"
      ? "border-white/10 bg-white/5 text-white/70"
      : "border-white/10 bg-black/30 text-white/70";

  return (
    <span className={`inline-flex items-center gap-2 rounded-full border px-2.5 py-1 text-[11px] ${cls}`}>
      {children}
    </span>
  );
}

function PremiumOverlay({
  locked,
  ctaHref = "/neeko-plus",
  ctaText = "Unlock interactive map (Neeko+)",
}: {
  locked: boolean;
  ctaHref?: string;
  ctaText?: string;
}) {
  if (!locked) return null;
  return (
    <div className="absolute inset-0 flex items-center justify-center">
      <div className="pointer-events-none absolute inset-0 rounded-2xl bg-gradient-to-b from-black/10 via-black/35 to-black/60" />
      <a
        href={ctaHref}
        className="pointer-events-auto inline-flex items-center gap-2 rounded-full border border-amber-400/40 bg-black/75 px-3 py-1.5 text-xs text-amber-200 shadow-[0_0_0_1px_rgba(251,191,36,0.14)] hover:bg-black/80 transition-colors"
      >
        <Lock className="h-4 w-4" />
        <span className="font-medium">{ctaText}</span>
      </a>
    </div>
  );
}

export default function PlayerImpactScatterPanel({
  mode,
  rows,
  statLabel,
  matchContext,
}: {
  mode: PremiumMode;
  rows: PredictRow[];
  statLabel: string;
  matchContext?: string;
}) {
  const locked = mode !== "premium";

  const points = useMemo(() => derivePoints(rows || []), [rows]);
  const [q, setQ] = useState("");
  const [teamFilter, setTeamFilter] = useState<"both" | "home" | "away">("both");
  const [selectedId, setSelectedId] = useState<string>("");

  // If matchContext is "Home vs Away", we can infer team names for filtering.
  const teams = useMemo(() => {
    const raw = String(matchContext ?? "");
    const parts = raw.split(" vs ").map((s) => s.trim()).filter(Boolean);
    return { home: parts[0] ?? "", away: parts[1] ?? "" };
  }, [matchContext]);

  const filtered = useMemo(() => {
    const qq = q.trim().toLowerCase();
    return points.filter((p) => {
      if (teamFilter === "home" && teams.home && p.team !== teams.home) return false;
      if (teamFilter === "away" && teams.away && p.team !== teams.away) return false;
      if (!qq) return true;
      return (
        p.name.toLowerCase().includes(qq) ||
        p.team.toLowerCase().includes(qq)
      );
    });
  }, [points, q, teamFilter, teams.home, teams.away]);

  const selected = useMemo(() => {
    const id = selectedId || (filtered[0]?.id ?? "");
    return filtered.find((p) => p.id === id) ?? null;
  }, [filtered, selectedId]);

  // Canvas render
  const wrapRef = useRef<HTMLDivElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const tipRef = useRef<HTMLDivElement | null>(null);
  const { width } = useResizeObserver(wrapRef);

  const height = useMemo(() => {
    // mobile-friendly height
    if (!width) return 360;
    return width < 420 ? 360 : width < 720 ? 420 : 480;
  }, [width]);

  const [hoverId, setHoverId] = useState<string>("");

  const layout = useMemo(() => {
    // plot area padding
    const padL = 44;
    const padR = 18;
    const padT = 18;
    const padB = 40;
    return { padL, padR, padT, padB };
  }, []);

  const toXY = (p: Point, W: number, H: number) => {
    const { padL, padR, padT, padB } = layout;
    const iw = Math.max(1, W - padL - padR);
    const ih = Math.max(1, H - padT - padB);

    // x = safety (right safer)
    // y = impact (higher better) => invert for canvas
    const x = padL + p.safety01 * iw;
    const y = padT + (1 - p.impact01) * ih;

    // radius = ceiling
    const r = 4 + p.ceiling01 * 7;
    return { x, y, r };
  };

  const draw = (W: number, H: number) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    // DPR scale for crispness
    const dpr = Math.max(1, Math.min(2, window.devicePixelRatio || 1));
    canvas.width = Math.floor(W * dpr);
    canvas.height = Math.floor(H * dpr);
    canvas.style.width = `${W}px`;
    canvas.style.height = `${H}px`;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    const { padL, padR, padT, padB } = layout;
    const iw = Math.max(1, W - padL - padR);
    const ih = Math.max(1, H - padT - padB);

    // background
    ctx.clearRect(0, 0, W, H);

    // soft grid
    ctx.globalAlpha = 1;
    ctx.lineWidth = 1;

    const grid = 4;
    for (let i = 0; i <= grid; i++) {
      const gx = padL + (iw * i) / grid;
      const gy = padT + (ih * i) / grid;

      ctx.strokeStyle = "rgba(255,255,255,0.07)";
      ctx.beginPath();
      ctx.moveTo(gx, padT);
      ctx.lineTo(gx, padT + ih);
      ctx.stroke();

      ctx.beginPath();
      ctx.moveTo(padL, gy);
      ctx.lineTo(padL + iw, gy);
      ctx.stroke();
    }

    // quadrant crosshair (safety=0.5, impact=0.5)
    const qx = padL + iw * 0.5;
    const qy = padT + ih * 0.5;
    ctx.strokeStyle = "rgba(251,191,36,0.18)";
    ctx.beginPath();
    ctx.moveTo(qx, padT);
    ctx.lineTo(qx, padT + ih);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(padL, qy);
    ctx.lineTo(padL + iw, qy);
    ctx.stroke();

    // axes labels
    ctx.fillStyle = "rgba(255,255,255,0.55)";
    ctx.font = "12px system-ui, -apple-system, Segoe UI, Roboto, sans-serif";
    ctx.textAlign = "left";
    ctx.fillText("Impact ↑", 10, padT + 10);
    ctx.save();
    ctx.translate(W - 8, H - 10);
    ctx.textAlign = "right";
    ctx.fillText("Safety →", 0, 0);
    ctx.restore();

    // points
    const drawn = filtered;

    // Sort so hovered / selected draw last
    const order = [...drawn].sort((a, b) => {
      const aHot = a.id === hoverId || a.id === selected?.id ? 1 : 0;
      const bHot = b.id === hoverId || b.id === selected?.id ? 1 : 0;
      return aHot - bHot;
    });

    for (const p of order) {
      const { x, y, r } = toXY(p, W, H);
      const hot = p.id === hoverId || p.id === selected?.id;

      const t = toneFor(p);
      const fill =
        t === "safe"
          ? "rgba(251,191,36,0.28)"
          : t === "swing"
          ? "rgba(244,63,94,0.22)"
          : "rgba(255,255,255,0.16)";

      const stroke =
        hot ? "rgba(251,191,36,0.85)" : "rgba(255,255,255,0.18)";

      // halo
      if (hot) {
        ctx.fillStyle = "rgba(251,191,36,0.12)";
        ctx.beginPath();
        ctx.arc(x, y, r + 8, 0, Math.PI * 2);
        ctx.fill();
      }

      // dot
      ctx.fillStyle = fill;
      ctx.strokeStyle = stroke;
      ctx.lineWidth = hot ? 2 : 1;

      ctx.beginPath();
      ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
    }

    // corner captions (subtle)
    ctx.fillStyle = "rgba(255,255,255,0.38)";
    ctx.font = "11px system-ui, -apple-system, Segoe UI, Roboto, sans-serif";
    ctx.textAlign = "left";
    ctx.fillText("High impact · Less safe", padL + 8, padT + 14);
    ctx.textAlign = "right";
    ctx.fillText("High impact · Safer", padL + iw - 8, padT + 14);
    ctx.textAlign = "left";
    ctx.fillText("Lower impact · Less safe", padL + 8, padT + ih - 8);
    ctx.textAlign = "right";
    ctx.fillText("Lower impact · Safer", padL + iw - 8, padT + ih - 8);
  };

  useEffect(() => {
    if (!width) return;
    draw(Math.floor(width), Math.floor(height));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [width, height, q, teamFilter, hoverId, selectedId, mode]);

  const pickPoint = (clientX: number, clientY: number) => {
    const canvas = canvasRef.current;
    const wrap = wrapRef.current;
    if (!canvas || !wrap) return null;

    const rect = canvas.getBoundingClientRect();
    const x = clientX - rect.left;
    const y = clientY - rect.top;

    // nearest within threshold
    let best: { id: string; d2: number; px: number; py: number } | null = null;
    for (const p of filtered) {
      const pt = toXY(p, rect.width, rect.height);
      const dx = x - pt.x;
      const dy = y - pt.y;
      const d2 = dx * dx + dy * dy;
      const thresh = (pt.r + 7) * (pt.r + 7);
      if (d2 <= thresh && (!best || d2 < best.d2)) {
        best = { id: p.id, d2, px: pt.x, py: pt.y };
      }
    }
    return best;
  };

  const showTip = (p: Point | null, x: number, y: number) => {
    const tip = tipRef.current;
    const wrap = wrapRef.current;
    if (!tip || !wrap) return;

    if (!p) {
      tip.style.opacity = "0";
      tip.style.transform = "translate3d(0,0,0)";
      return;
    }

    const W = wrap.clientWidth;
    const left = Math.max(10, Math.min(W - 260, x + 14));

    tip.style.opacity = "1";
    tip.style.transform = `translate3d(${left}px, ${Math.max(10, y - 6)}px, 0)`;

    const conf = confLabel(p.confidence01);
    const vol = volLabel(p.volatility01);

    tip.innerHTML = `
      <div style="display:flex; justify-content:space-between; gap:12px; align-items:flex-start;">
        <div style="min-width:0;">
          <div style="font-weight:600; font-size:12px; color:rgba(255,255,255,0.92); overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">${p.name}</div>
          <div style="margin-top:2px; font-size:11px; color:rgba(255,255,255,0.55);">${p.team}</div>
        </div>
        <div style="font-size:11px; color:rgba(251,191,36,0.85); white-space:nowrap;">${p.rangeLow}–${p.rangeHigh}</div>
      </div>
      <div style="margin-top:8px; display:grid; grid-template-columns:1fr 1fr; gap:6px 12px; font-size:11px;">
        <div style="color:rgba(255,255,255,0.55);">Safety</div><div style="color:rgba(255,255,255,0.82); text-align:right;">${Math.round(p.safety01*100)}%</div>
        <div style="color:rgba(255,255,255,0.55);">Impact</div><div style="color:rgba(255,255,255,0.82); text-align:right;">${Math.round(p.impact01*100)}%</div>
        <div style="color:rgba(255,255,255,0.55);">Ceiling</div><div style="color:rgba(255,255,255,0.82); text-align:right;">${Math.round(p.ceiling01*100)}%</div>
        <div style="color:rgba(255,255,255,0.55);">Role</div><div style="color:rgba(255,255,255,0.82); text-align:right;">${conf} · ${vol}</div>
      </div>
    `;
  };

  const onMove = (e: React.MouseEvent) => {
    if (locked) return;
    const hit = pickPoint(e.clientX, e.clientY);
    if (!hit) {
      setHoverId("");
      showTip(null, 0, 0);
      return;
    }
    setHoverId(hit.id);
    const p = filtered.find((x) => x.id === hit.id) ?? null;
    showTip(p, hit.px, hit.py);
  };

  const onLeave = () => {
    setHoverId("");
    showTip(null, 0, 0);
  };

  const onClick = (e: React.MouseEvent) => {
    if (locked) return;
    const hit = pickPoint(e.clientX, e.clientY);
    if (!hit) return;
    setSelectedId(hit.id);
  };

  const topList = useMemo(() => {
    // quick "Top 5" helpers for the right panel
    const byImpact = [...filtered].sort((a, b) => b.impact01 - a.impact01).slice(0, 5);
    const bySafety = [...filtered].sort((a, b) => b.safety01 - a.safety01).slice(0, 5);
    const byCeiling = [...filtered].sort((a, b) => b.ceiling01 - a.ceiling01).slice(0, 5);
    return { byImpact, bySafety, byCeiling };
  }, [filtered]);

  return (
    <section className="rounded-2xl border border-white/10 bg-black/40 overflow-hidden shadow-[inset_0_0_0_1px_rgba(255,255,255,0.03)]">
      <header className="px-4 sm:px-6 pt-4 sm:pt-5 pb-3 sm:pb-4 border-b border-white/10">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="text-base sm:text-lg font-semibold">4. Player Impact Map</h2>
            <p className="mt-1 text-xs sm:text-sm text-white/60">
              Visualise {statLabel} outlook for the selected match — impact, safety, and ceiling in one view.
            </p>
          </div>
          <div className="hidden sm:inline-flex items-center rounded-full border border-amber-400/25 bg-amber-400/10 px-2.5 py-1 text-[11px] text-amber-200/90">
            Neeko+
          </div>
        </div>
      </header>

      <div className="px-4 sm:px-6 py-4 sm:py-5 space-y-3">
        {/* Controls */}
        <div className="flex flex-col sm:flex-row gap-2 sm:items-center sm:justify-between">
          <div className="flex items-center gap-2">
            <div className="relative flex-1 sm:flex-none">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 opacity-55" />
              <input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Search player…"
                className="w-full sm:w-[280px] rounded-full border border-white/10 bg-black/40 py-2 pl-9 pr-3 text-sm text-white placeholder:text-white/35 outline-none focus:border-amber-400/30"
              />
            </div>

            <div className="hidden sm:flex items-center gap-2">
              <Badge tone="muted">
                <SlidersHorizontal className="h-4 w-4 opacity-80" />
                Safety ↔ Impact
              </Badge>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setTeamFilter("both")}
              className={[
                "rounded-full border px-3 py-1.5 text-xs transition-colors",
                teamFilter === "both"
                  ? "border-amber-400/35 bg-amber-400/10 text-amber-200"
                  : "border-white/10 bg-white/5 text-white/70 hover:bg-white/[0.07]",
              ].join(" ")}
            >
              Both
            </button>
            <button
              type="button"
              onClick={() => setTeamFilter("home")}
              className={[
                "rounded-full border px-3 py-1.5 text-xs transition-colors",
                teamFilter === "home"
                  ? "border-amber-400/35 bg-amber-400/10 text-amber-200"
                  : "border-white/10 bg-white/5 text-white/70 hover:bg-white/[0.07]",
              ].join(" ")}
            >
              {teams.home || "Team 1"}
            </button>
            <button
              type="button"
              onClick={() => setTeamFilter("away")}
              className={[
                "rounded-full border px-3 py-1.5 text-xs transition-colors",
                teamFilter === "away"
                  ? "border-amber-400/35 bg-amber-400/10 text-amber-200"
                  : "border-white/10 bg-white/5 text-white/70 hover:bg-white/[0.07]",
              ].join(" ")}
            >
              {teams.away || "Team 2"}
            </button>
          </div>
        </div>

        {/* Plot + side panel */}
        <div className="grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-3 sm:gap-4">
          <div className="relative rounded-2xl border border-white/10 bg-black/30 overflow-hidden shadow-[inset_0_0_0_1px_rgba(255,255,255,0.03)]">
            <div ref={wrapRef} className="relative w-full" style={{ height }}>
              <canvas
                ref={canvasRef}
                className={locked ? "opacity-60 select-none" : "cursor-crosshair"}
                onMouseMove={onMove}
                onMouseLeave={onLeave}
                onClick={onClick}
                aria-label="Player impact scatter plot"
              />
              <div
                ref={tipRef}
                style={{
                  position: "absolute",
                  top: 0,
                  left: 0,
                  width: 250,
                  opacity: 0,
                  transform: "translate3d(0,0,0)",
                  transition: "opacity 120ms ease",
                  pointerEvents: "none",
                  background: "rgba(0,0,0,0.72)",
                  border: "1px solid rgba(255,255,255,0.10)",
                  borderRadius: 14,
                  padding: 12,
                  boxShadow: "0 10px 30px rgba(0,0,0,0.45)",
                  backdropFilter: "blur(8px)",
                }}
              />
              <PremiumOverlay locked={locked} />
            </div>

            <div className="px-4 py-3 border-t border-white/10 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
              <div className="text-[11px] text-white/45">
                Left = less safe role · Right = safer role · Higher = higher expected output · Bigger dot = more ceiling.
              </div>
              <div className="text-[11px] text-white/45">
                Tip: click a dot to pin the player card.
              </div>
            </div>
          </div>

          <div className="rounded-2xl border border-white/10 bg-black/30 p-4 shadow-[inset_0_0_0_1px_rgba(255,255,255,0.03)]">
            <div className="flex items-start justify-between gap-2">
              <div>
                <div className="text-[11px] tracking-[0.22em] text-white/55 uppercase">Pinned player</div>
                <div className="mt-2 text-sm text-white/80">
                  {selected ? (
                    <>
                      <span className="font-semibold text-white">{selected.name}</span>{" "}
                      <span className="text-white/55">· {selected.team}</span>
                    </>
                  ) : (
                    <span className="text-white/55">Select a player</span>
                  )}
                </div>
              </div>
              <Badge tone="gold">{statLabel}</Badge>
            </div>

            {selected && (
              <>
                <div className="mt-3 rounded-xl border border-white/10 bg-white/5 p-3">
                  <div className="flex items-center justify-between">
                    <div className="text-xs text-white/55">Projection range</div>
                    <div className="text-xs text-amber-200/90">{selected.rangeLow}–{selected.rangeHigh}</div>
                  </div>
                  <div className="mt-2 grid grid-cols-3 gap-2 text-[11px]">
                    <div className="rounded-lg border border-white/10 bg-black/30 p-2">
                      <div className="text-white/45">Safety</div>
                      <div className="mt-1 text-white/80">{Math.round(selected.safety01 * 100)}%</div>
                    </div>
                    <div className="rounded-lg border border-white/10 bg-black/30 p-2">
                      <div className="text-white/45">Impact</div>
                      <div className="mt-1 text-white/80">{Math.round(selected.impact01 * 100)}%</div>
                    </div>
                    <div className="rounded-lg border border-white/10 bg-black/30 p-2">
                      <div className="text-white/45">Ceiling</div>
                      <div className="mt-1 text-white/80">{Math.round(selected.ceiling01 * 100)}%</div>
                    </div>
                  </div>

                  <div className="mt-2 text-[11px] text-white/55">
                    {confLabel(selected.confidence01)} role stability · {volLabel(selected.volatility01)} volatility.
                  </div>
                </div>

                {selected.ai && (
                  <div className="mt-3 text-sm text-white/65 rounded-xl border border-white/10 bg-black/25 p-3">
                    {selected.ai}
                  </div>
                )}
              </>
            )}

            <div className="mt-4">
              <div className="text-[11px] tracking-[0.22em] text-white/55 uppercase">Quick lenses</div>

              <div className="mt-2 space-y-2">
                <div className="rounded-xl border border-white/10 bg-white/5 p-3">
                  <div className="text-xs text-white/70">Top impact</div>
                  <div className="mt-2 space-y-1 text-sm">
                    {topList.byImpact.map((p) => (
                      <button
                        key={p.id}
                        onClick={() => setSelectedId(p.id)}
                        className="w-full text-left flex items-center justify-between gap-3 rounded-lg border border-white/10 bg-black/30 px-2.5 py-2 hover:bg-black/35 transition-colors"
                        disabled={locked}
                      >
                        <span className="truncate text-white/85">{p.name}</span>
                        <span className="text-[11px] text-white/45">{p.team}</span>
                      </button>
                    ))}
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-1 gap-2">
                  <div className="rounded-xl border border-white/10 bg-white/5 p-3">
                    <div className="text-xs text-white/70">Safest roles</div>
                    <div className="mt-2 space-y-1 text-sm">
                      {topList.bySafety.slice(0, 3).map((p) => (
                        <button
                          key={p.id}
                          onClick={() => setSelectedId(p.id)}
                          className="w-full text-left flex items-center justify-between gap-3 rounded-lg border border-white/10 bg-black/30 px-2.5 py-2 hover:bg-black/35 transition-colors"
                          disabled={locked}
                        >
                          <span className="truncate text-white/85">{p.name}</span>
                          <span className="text-[11px] text-white/45">{p.team}</span>
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="rounded-xl border border-white/10 bg-white/5 p-3">
                    <div className="text-xs text-white/70">Highest ceiling</div>
                    <div className="mt-2 space-y-1 text-sm">
                      {topList.byCeiling.slice(0, 3).map((p) => (
                        <button
                          key={p.id}
                          onClick={() => setSelectedId(p.id)}
                          className="w-full text-left flex items-center justify-between gap-3 rounded-lg border border-white/10 bg-black/30 px-2.5 py-2 hover:bg-black/35 transition-colors"
                          disabled={locked}
                        >
                          <span className="truncate text-white/85">{p.name}</span>
                          <span className="text-[11px] text-white/45">{p.team}</span>
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                <div className="text-[11px] text-white/40">
                  Note: this map is derived from each player’s recent range, confidence, and volatility in the current {statLabel} lens.
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Mobile pinned selector */}
        <div className="lg:hidden rounded-2xl border border-white/10 bg-white/5 p-3">
          <div className="text-[11px] tracking-[0.22em] text-white/55 uppercase">Jump to player</div>
          <select
            value={selectedId}
            onChange={(e) => setSelectedId(e.target.value)}
            className="mt-2 w-full appearance-none rounded-xl border border-white/10 bg-black/40 px-3 py-2 text-sm"
            disabled={locked}
          >
            <option value="">—</option>
            {filtered.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name} · {p.team}
              </option>
            ))}
          </select>
        </div>
      </div>
    </section>
  );
}
