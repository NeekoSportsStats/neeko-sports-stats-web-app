import React, { useEffect, useRef, useState } from "react";
import { X, Lock } from "lucide-react";
import { usePlayerScatterData, type LensKey, type PlayerPoint } from "./usePlayerScatterData";

interface PlayerTrendBottomSheetProps {
  open: boolean;
  onClose: () => void;
  player: PlayerPoint | null;
  allPlayers: PlayerPoint[];
  lens: LensKey;
  locked: boolean;
}

const DRAG_THRESHOLD = 12;
const DISMISS_DISTANCE_RATIO = 0.3;
const DISMISS_VELOCITY = 0.5;

export default function PlayerTrendBottomSheet(props: PlayerTrendBottomSheetProps) {
  const { open, onClose, player, allPlayers, lens, locked } = props;
  const [isDragging, setIsDragging] = useState(false);
  const [dragStarted, setDragStarted] = useState(false);
  const [isSheetDragging, setIsSheetDragging] = useState(false);
  const [dragY, setDragY] = useState(0);
  const [startY, setStartY] = useState(0);
  const [startTime, setStartTime] = useState(0);
  const [lastY, setLastY] = useState(0);
  const [velocity, setVelocity] = useState(0);
  const [dragEnabled, setDragEnabled] = useState(true);
  const sheetRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const handleRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (open) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
      setDragY(0);
      setDragStarted(false);
      setIsDragging(false);
      setIsSheetDragging(false);
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [open]);

  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape" && open) {
        onClose();
      }
    };
    window.addEventListener("keydown", handleEscape);
    return () => window.removeEventListener("keydown", handleEscape);
  }, [open, onClose]);

  const handleTouchStart = (e: React.TouchEvent) => {
    if (!dragEnabled) return;
    if (contentRef.current && contentRef.current.scrollTop > 0) {
      return;
    }

    const touch = e.touches[0];
    setIsDragging(true);
    setDragStarted(false);
    setStartY(touch.clientY);
    setLastY(touch.clientY);
    setStartTime(Date.now());
    setVelocity(0);
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (!isDragging) return;

    if (contentRef.current && contentRef.current.scrollTop > 0) {
      setIsDragging(false);
      setDragStarted(false);
      setIsSheetDragging(false);
      return;
    }

    const currentY = e.touches[0].clientY;
    const diff = currentY - startY;

    if (!dragStarted && Math.abs(diff) < DRAG_THRESHOLD) {
      return;
    }

    if (!dragStarted) {
      setDragStarted(true);
      setIsSheetDragging(true);
    }

    if (diff > 0) {
      const now = Date.now();
      const timeDelta = now - startTime;
      const yDelta = currentY - lastY;

      if (timeDelta > 0) {
        setVelocity(yDelta / timeDelta);
      }

      setLastY(currentY);
      setDragY(diff);
    }
  };

  const handleTouchEnd = () => {
    if (!isDragging) return;
    setIsDragging(false);
    setDragStarted(false);
    setIsSheetDragging(false);

    const sheetHeight = sheetRef.current?.offsetHeight || window.innerHeight * 0.8;
    const dismissDistance = sheetHeight * DISMISS_DISTANCE_RATIO;
    const shouldDismiss = dragY > dismissDistance || velocity > DISMISS_VELOCITY;

    if (shouldDismiss) {
      onClose();
    } else {
      setDragY(0);
    }

    setVelocity(0);
  };

  if (!open || !player) return null;

  const trendData = generateTrendData(player, lens);
  const insight = generateInsight(player, lens, locked);

  return (
    <>
      <div
        className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm"
        onClick={onClose}
        style={{ opacity: open ? 1 : 0, transition: "opacity 0.3s" }}
      />

      <div
        ref={sheetRef}
        className="fixed inset-x-0 bottom-0 z-50 flex flex-col rounded-t-3xl border-t border-white/10 bg-[#0b0b0b] shadow-2xl"
        style={{
          height: "80vh",
          transform: `translateY(${dragY}px)`,
          transition: isDragging ? "none" : "transform 0.35s cubic-bezier(0.32, 0.72, 0, 1)",
        }}
      >
        <div
          ref={handleRef}
          className="sticky top-0 z-10 flex flex-col border-b border-white/10 bg-[#0b0b0b] px-4 pb-3 pt-2 cursor-grab active:cursor-grabbing"
          style={{ touchAction: "pan-y" }}
          onTouchStart={handleTouchStart}
          onTouchMove={handleTouchMove}
          onTouchEnd={handleTouchEnd}
        >
          <div className="mx-auto mb-2 h-1 w-12 rounded-full bg-white/30 transition-colors" />

          <div className="flex items-start justify-between gap-3">
            <div className="flex-1 min-w-0">
              <div className="text-base font-bold text-white truncate">{player.name}</div>
              <div className="text-sm text-white/60">{player.teamName}</div>
            </div>

            <button
              onClick={onClose}
              className="shrink-0 flex h-8 w-8 items-center justify-center rounded-full border border-white/10 bg-white/5 text-white/70 hover:bg-white/10 transition-colors"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        <div
          ref={contentRef}
          className="flex-1 overflow-y-auto px-4 py-4"
          style={{ touchAction: "pan-y", WebkitOverflowScrolling: "touch" }}
          onPointerDown={() => setDragEnabled(false)}
          onPointerUp={() => setDragEnabled(true)}
          onPointerCancel={() => setDragEnabled(true)}
        >
          <div className="mb-4">
            <div className="text-xs uppercase tracking-wider text-white/50 mb-2">Trend Chart</div>
            <TrendChart data={trendData} player={player} lens={lens} isSheetDragging={isSheetDragging} />
          </div>

          {locked && (
            <div className="rounded-xl border border-amber-400/20 bg-amber-400/5 p-4 mb-4">
              <div className="flex items-center gap-2 mb-2">
                <Lock className="h-4 w-4 text-amber-400" />
                <div className="text-sm font-semibold text-amber-200">Neeko+ Feature</div>
              </div>
              <div className="text-xs text-white/70">
                Unlock detailed projections and AI insights with Neeko+
              </div>
            </div>
          )}
        </div>

        <div className="sticky bottom-0 z-10 border-t border-white/10 bg-[#0b0b0b] px-4 py-4">
          <div className="text-xs uppercase tracking-wider text-white/50 mb-2">AI Insight</div>
          <div className="text-sm text-white/85">{insight}</div>
        </div>
      </div>
    </>
  );
}

function TrendChart(props: { data: any[]; player: PlayerPoint; lens: LensKey; isSheetDragging: boolean }) {
  const { data, player, lens, isSheetDragging } = props;
  const [activePoint, setActivePoint] = useState<number | null>(null);
  const [tooltipPos, setTooltipPos] = useState<{ x: number; y: number } | null>(null);

  const W = 320;
  const H = 200;
  const PAD = 24;

  const maxVal = Math.max(...data.map((d) => d.value), 100);
  const x = (i: number) => PAD + (i / (data.length - 1)) * (W - PAD * 2);
  const y = (v: number) => H - PAD - ((v / maxVal) * (H - PAD * 2));

  const pathD = data.map((d, i) => `${i === 0 ? "M" : "L"} ${x(i)} ${y(d.value)}`).join(" ");

  const handlePointTouch = (e: React.TouchEvent, index: number) => {
    if (isSheetDragging) return;

    e.stopPropagation();
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    const touchX = e.touches[0].clientX - rect.left;
    const touchY = e.touches[0].clientY - rect.top;

    setActivePoint(index);
    setTooltipPos({ x: touchX, y: touchY });
  };

  return (
    <div
      className="relative rounded-xl border border-white/10 bg-black/20 p-3"
      style={{ pointerEvents: isSheetDragging ? "none" : "auto" }}
    >
      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="w-full h-[200px]"
        style={{ touchAction: "none" }}
      >
        <defs>
          <linearGradient id="trendGradient" x1="0" x2="0" y1="0" y2="1">
            <stop offset="0%" stopColor="rgba(251,191,36,0.3)" />
            <stop offset="100%" stopColor="rgba(251,191,36,0.05)" />
          </linearGradient>
        </defs>

        <path
          d={`${pathD} L ${x(data.length - 1)} ${H - PAD} L ${x(0)} ${H - PAD} Z`}
          fill="url(#trendGradient)"
        />

        <path d={pathD} fill="none" stroke="rgba(251,191,36,0.8)" strokeWidth={2.5} />

        {data.map((d, i) => (
          <g key={i}>
            <circle
              cx={x(i)}
              cy={y(d.value)}
              r={16}
              fill="transparent"
              onTouchStart={(e) => handlePointTouch(e, i)}
              onTouchEnd={() => {
                if (!isSheetDragging) {
                  setActivePoint(null);
                  setTooltipPos(null);
                }
              }}
            />
            <circle
              cx={x(i)}
              cy={y(d.value)}
              r={activePoint === i ? 5 : 3.5}
              fill={d.predicted ? "rgba(251,191,36,0.6)" : "rgba(251,191,36,0.95)"}
              stroke={activePoint === i ? "rgba(255,255,255,0.5)" : "none"}
              strokeWidth={2}
              pointerEvents="none"
            />
          </g>
        ))}
      </svg>

      {activePoint !== null && tooltipPos && !isSheetDragging && (
        <div
          className="absolute z-20 rounded-lg border border-white/20 bg-[#0b0b0b] px-3 py-2 shadow-xl pointer-events-none"
          style={{
            left: Math.min(tooltipPos.x, W - 100),
            top: Math.max(tooltipPos.y - 60, 10),
          }}
        >
          <div className="text-xs text-white/60">{data[activePoint].round}</div>
          <div className="text-sm font-semibold text-white">{data[activePoint].value}</div>
          {data[activePoint].predicted && (
            <div className="text-[10px] text-amber-400">Predicted</div>
          )}
        </div>
      )}
    </div>
  );
}

function generateTrendData(player: PlayerPoint, lens: LensKey) {
  const rounds = 5;
  const base = lens === "fantasy" ? player.momentum * 8 : lens === "disposals" ? 22 : 1.5;

  return Array.from({ length: rounds + 2 }, (_, i) => ({
    round: `R${i + 1}`,
    value: Math.round(base + Math.random() * base * 0.3),
    predicted: i >= rounds,
  }));
}

function generateInsight(player: PlayerPoint, lens: LensKey, locked: boolean) {
  if (locked) {
    return `Unlock detailed AI analysis for ${player.name} with Neeko+.`;
  }

  if (player.momentum > 70 && player.ceiling > 70) {
    return `${player.name} shows elite momentum and ceiling. Strong slate correlation likely.`;
  }

  if (player.momentum > 60) {
    return `${player.name} trending upward with solid recent form.`;
  }

  return `${player.name} shows steady baseline with room for ceiling spike.`;
}
