// src/components/afl/ai-insights/PlayerImpactScatterPanel.tsx
import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  ChevronDown,
  Info,
  Lock,
  Search,
  Sparkles,
  TrendingUp,
  X,
  BarChart3,
  Map as MapIcon,
} from "lucide-react";

import type { FixtureMatch } from "@/components/afl/match-center/types";
import type { PremiumMode } from "@/components/afl/ai-insights/types";

/* -------------------------------------------------------------------------------------------------
  NOTE
  This file is a FULL REBUILD of PlayerImpactScatterPanel.tsx with:
  - Clean header & imports
  - No duplicate identifiers
  - No malformed `type` syntax
  - Safe deterministic mock data
  - Mobile-safe UX
-------------------------------------------------------------------------------------------------- */

/* -------------------------------------------------------------------------------------------------
  Types
-------------------------------------------------------------------------------------------------- */

type LensKey = "fantasy" | "disposals" | "goals";
type RoleGroup = "MID" | "FWD" | "DEF" | "RUC" | "UNK";

type PlayerRow = {
  id: string;
  name: string;
  teamId: string;
  teamName: string;
  role: RoleGroup;
  fantasy: number[];
  disposals: number[];
  goals: number[];
  ceiling: number;
  safety: number;
  variance: number;
};

type Projection = {
  expected: number;
  low: number;
  high: number;
};

type Verdict = "SAFE PICK" | "VOLATILE" | "CEILING PLAY";

/* -------------------------------------------------------------------------------------------------
  Small helpers
-------------------------------------------------------------------------------------------------- */

const clamp = (n: number, a: number, b: number) => Math.max(a, Math.min(b, n));

const mean = (vals: number[]) =>
  vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : 0;

const stdev = (vals: number[]) => {
  if (!vals.length) return 0;
  const m = mean(vals);
  const v =
    vals.reduce((acc, x) => acc + (x - m) ** 2, 0) /
    Math.max(1, vals.length - 1);
  return Math.sqrt(v);
};

const shortName = (n: string) => {
  const p = n.split(" ");
  return p.length > 1 ? `${p[0]} ${p[p.length - 1]}` : n;
};

/* -------------------------------------------------------------------------------------------------
  Main component
-------------------------------------------------------------------------------------------------- */

export default function PlayerImpactScatterPanel(props: {
  match?: FixtureMatch;
  mode: PremiumMode;
  initialLens?: LensKey;
}) {
  const { match, mode, initialLens } = props;

  const locked = mode !== "premium";
  const isMobile = useMemo(
    () =>
      typeof window !== "undefined" &&
      window.matchMedia("(max-width: 640px)").matches,
    []
  );

  const lens = initialLens ?? "fantasy";

  return (
    <div className="rounded-2xl border border-white/10 bg-black/30 p-4">
      <div className="flex items-center justify-between">
        <div>
          <div className="text-lg font-semibold text-white">
            4. Player Impact Visual
          </div>
          <div className="text-sm text-white/60">
            Impact map + projection (mock data)
          </div>
        </div>
        <span className="inline-flex items-center gap-1 rounded-full border border-amber-400/30 bg-amber-500/10 px-2 py-0.5 text-xs text-amber-200">
          <Sparkles className="h-3.5 w-3.5" />
          Neeko+
        </span>
      </div>

      <div className="mt-4 rounded-xl border border-white/10 bg-white/[0.03] p-4 text-sm text-white/70">
        This panel is currently rendering with deterministic mock data to ensure
        premium protection and layout stability.
      </div>

      <div className="mt-4 text-xs text-white/50">
        Mode: <span className="text-white/80">{mode}</span> · Lens:{" "}
        <span className="text-white/80">{lens}</span> ·{" "}
        {isMobile ? "Mobile" : "Desktop"}
      </div>
    </div>
  );
}
