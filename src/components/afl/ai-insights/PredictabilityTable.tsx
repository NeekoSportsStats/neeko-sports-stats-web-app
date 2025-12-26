import React, {
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { Lock, X } from "lucide-react";
import type { PredictRow, PremiumMode } from "./types";
import { confLabel, volLabel } from "./utils";

/* -------------------------------------------------------------------------- */
/* TYPES                                                                      */
/* -------------------------------------------------------------------------- */

type Chip = "all" | "safe" | "ceiling" | "risky";

type PlaceholderRow = {
  __placeholder: true;
  key: string;
};

/* -------------------------------------------------------------------------- */
/* COMPONENT                                                                  */
/* -------------------------------------------------------------------------- */

export default function PredictabilityTable(props: {
  rows: PredictRow[];
  mode: PremiumMode;
  statLabel: string;
  matchContext?: string;
  insight?: string;
  hint?: string;
  contextLabel?: string;
  onUnlock?: () => void;
  unlockLabel?: string;
}) {
  const {
    rows,
    mode,
    statLabel,
    matchContext,
    insight,
    hint,
    contextLabel,
    onUnlock,
    unlockLabel,
  } = props;

  const locked = mode !== "premium";

  const FREE_PREVIEW_COUNT = 3;
  const MAX_LOCKED_PLACEHOLDERS = 16;

  const UNLOCK_LABEL = unlockLabel ?? "Unlock Neeko+";

  /* -------------------------------------------------------------------------- */
  /* STATE                                                                     */
  /* -------------------------------------------------------------------------- */

  const [q, setQ] = useState("");
  const [chip, setChip] = useState<Chip>("all");

  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState<PredictRow | null>(null);

  const didInitChip = useRef(false);

  /* -------------------------------------------------------------------------- */
  /* AUTO CHIP DEFAULT (RUN ONCE ONLY)                                          */
  /* -------------------------------------------------------------------------- */

  useEffect(() => {
    if (didInitChip.current) return;
    didInitChip.current = true;

    const s = (statLabel ?? "").toLowerCase();
    if (s.includes("goal")) setChip("ceiling");
    else if (s.includes("disposal")) setChip("safe");
  }, [statLabel]);

  /* -------------------------------------------------------------------------- */
  /* AI SENTENCE BUILDER (DETAILED)                                             */
  /* -------------------------------------------------------------------------- */

  function aiSentence(r: PredictRow) {
    const c = r.confidence01;
    const v = r.volatility01;

    if (c >= 0.72 && v <= 0.4) {
      return "This player shows strong role stability with repeatable scoring output. Expect a reliable floor unless game flow or on-field role shifts materially.";
    }

    if (v >= 0.65) {
      return "This profile carries significant upside driven by volatility. Ceiling outcomes are matchup-sensitive and benefit from positive game flow.";
    }

    if (c <= 0.45) {
      return "Outcomes vary widely due to role uncertainty or opposition pressure. This is a high-variance profile best suited to contrarian builds.";
    }

    return "This is a balanced profile with moderate confidence and variability. Suitable for neutral game scripts without extreme conditions.";
  }

  /* -------------------------------------------------------------------------- */
  /* RANGE FORMAT (TABLE FRIENDLY)                                              */
  /* -------------------------------------------------------------------------- */

  function fmtRange(r: PredictRow) {
    const lo = r.rangeLow;
    const hi = r.rangeHigh;

    if (typeof lo === "number" && typeof hi === "number") {
      return `${lo}–${hi}`;
    }
    if (typeof lo === "number") return `${lo}–—`;
    if (typeof hi === "number") return `—–${hi}`;
    return "—";
  }

  /* -------------------------------------------------------------------------- */
  /* FILTER + RANK (CONFIDENCE DESC)                                            */
  /* -------------------------------------------------------------------------- */

  const ranked = useMemo(() => {
    let r = rows;

    if (chip === "safe") {
      r = r.filter(
        (x) => x.confidence01 >= 0.7 && x.volatility01 <= 0.4
      );
    }

    if (chip === "ceiling") {
      r = r.filter((x) => x.volatility01 >= 0.65);
    }

    if (chip === "risky") {
      r = r.filter((x) => x.confidence01 <= 0.45);
    }

    return [...r].sort((a, b) => b.confidence01 - a.confidence01);
  }, [rows, chip]);

  /* -------------------------------------------------------------------------- */
  /* VISIBILITY LOGIC (FIXES EMPTY TABLE BUG)                                   */
  /* -------------------------------------------------------------------------- */

  const visibleRows = useMemo(() => {
    if (locked) {
      return ranked.slice(0, FREE_PREVIEW_COUNT);
    }

    if (!q.trim()) return ranked;

    const s = q.toLowerCase();
    return ranked.filter((x) =>
      x.name.toLowerCase().includes(s)
    );
  }, [ranked, locked, q]);

  const lockedPlaceholderCount = useMemo(() => {
    if (!locked) return 0;
    const remaining = Math.max(0, ranked.length - FREE_PREVIEW_COUNT);
    return Math.min(remaining, MAX_LOCKED_PLACEHOLDERS);
  }, [locked, ranked.length]);

  const placeholders: PlaceholderRow[] = useMemo(() => {
    if (!locked) return [];
    return Array.from({ length: lockedPlaceholderCount }, (_, i) => ({
      __placeholder: true,
      key: `locked-${i}`,
    }));
  }, [locked, lockedPlaceholderCount]);

  const renderRows = useMemo(() => {
    if (!locked) return visibleRows as Array<PredictRow | PlaceholderRow>;
    return [...visibleRows, ...placeholders] as Array<
      PredictRow | PlaceholderRow
    >;
  }, [locked, visibleRows, placeholders]);
  /* -------------------------------------------------------------------------- */
  /* MODAL + SCROLL LOCK + ESC                                                   */
  /* -------------------------------------------------------------------------- */

  function closeModal() {
    setOpen(false);
    setSelected(null);
  }

  useEffect(() => {
    if (!open) return;

    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") closeModal();
    };

    window.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [open]);

  /* -------------------------------------------------------------------------- */
  /* MICROCOPY                                                                  */
  /* -------------------------------------------------------------------------- */

  const proTip =
    hint ??
    "Safe Picks = high confidence & stable floor · Ceiling Plays = volatility-driven upside · Risky = wide outcome range";

  /* -------------------------------------------------------------------------- */
  /* RENDER                                                                     */
  /* -------------------------------------------------------------------------- */

  return (
    <div className="grid gap-4">
      {insight && (
        <div className="rounded-xl border border-amber-400/20 bg-amber-500/10 px-4 py-3">
          <div className="text-[11px] uppercase tracking-wide text-amber-200/80">
            {contextLabel ?? "AI Round Snapshot"} · {statLabel}
          </div>
          <div className="mt-1 text-sm text-amber-50/90">{insight}</div>
          {matchContext && (
            <div className="mt-1 text-xs text-amber-100/50">
              Adjusted for {matchContext}
            </div>
          )}
        </div>
      )}

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap gap-2">
          {(["all", "safe", "ceiling", "risky"] as Chip[]).map((c) => (
            <button
              key={c}
              onClick={() => setChip(c)}
              className={`rounded-full px-3 py-1 text-xs ${
                chip === c
                  ? "bg-amber-500/20 text-amber-200 border border-amber-400/30"
                  : "border border-white/10 text-white/60 hover:bg-white/5"
              }`}
            >
              {c === "all"
                ? "All"
                : c === "safe"
                ? "Safe Picks"
                : c === "ceiling"
                ? "Ceiling Plays"
                : "Risky"}
            </button>
          ))}
        </div>

        {!locked && (
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search…"
            className="w-44 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs text-white placeholder:text-white/40"
          />
        )}
      </div>

      <div className="text-xs text-white/45">{proTip}</div>

      <div className="overflow-hidden rounded-xl border border-white/10">
        <div className="sticky top-0 z-10 grid grid-cols-[40px_1.6fr_0.9fr_2.2fr] bg-[#0b0f18] px-3 py-2 text-[11px] uppercase tracking-wide text-white/50">
          <div>#</div>
          <div>Name</div>
          <div className="text-right pr-2">Range</div>
          <div>AI Insight</div>
        </div>

        <div className="divide-y divide-white/10">
          {renderRows.map((row, i) => {
            if ((row as PlaceholderRow).__placeholder) {
              return (
                <div
                  key={(row as PlaceholderRow).key}
                  className="grid grid-cols-[40px_1.6fr_0.9fr_2.2fr] px-3 py-3 opacity-60"
                >
                  <div>—</div>
                  <div className="h-4 w-32 rounded bg-white/10" />
                  <div className="text-right pr-2">—</div>
                  <div className="h-3 w-48 rounded bg-white/10" />
                </div>
              );
            }

            const r = row as PredictRow;
            const w = Math.round((r.confidence01 ?? 0) * 100);

            return (
              <button
                key={r.id}
                onClick={() => {
                  setSelected(r);
                  setOpen(true);
                }}
                className="grid grid-cols-[40px_1.6fr_0.9fr_2.2fr] px-3 py-3 text-left hover:bg-white/6"
              >
                <div className="text-xs text-white/40">#{i + 1}</div>

                <div>
                  <div className="text-sm font-medium text-white">{r.name}</div>
                  <div className="mt-1 flex gap-1 text-[11px] text-white/60">
                    <span className="rounded-full border border-white/10 px-2 py-0.5">
                      {confLabel(r.confidence01)}
                    </span>
                    <span className="rounded-full border border-white/10 px-2 py-0.5">
                      {volLabel(r.volatility01)}
                    </span>
                  </div>
                  <div className="mt-2 h-[6px] w-full rounded-full bg-white/10">
                    <div
                      className="h-[6px] rounded-full bg-amber-400"
                      style={{ width: `${w}%` }}
                    />
                  </div>
                </div>

                <div className="flex items-center justify-end pr-2 text-sm text-white">
                  {fmtRange(r)}
                </div>

                <div className="text-sm text-white/70">{aiSentence(r)}</div>
              </button>
            );
          })}
        </div>
      </div>

      {locked && (
        <div className="sticky bottom-3 z-20 rounded-xl border border-amber-400/20 bg-amber-500/10 px-3 py-2 text-sm text-amber-100 flex items-center justify-between gap-3 backdrop-blur">
          <div>
            <div className="font-medium">
              You’re viewing top {FREE_PREVIEW_COUNT} picks only.
            </div>
            <div className="text-xs text-amber-100/80">
              Unlock full projections, ranges and matchup reasoning with Neeko+.
            </div>
          </div>

          <button
            onClick={onUnlock}
            className="inline-flex items-center gap-2 rounded-full border border-amber-400/30 bg-amber-500/20 px-3 py-1.5"
          >
            <Lock className="h-4 w-4" />
            {UNLOCK_LABEL}
          </button>
        </div>
      )}

      {open && selected && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          onMouseDown={closeModal}
        >
          <div className="absolute inset-0 bg-black/70" />
          <div
            className="relative w-full max-w-lg max-h-[90vh] overflow-y-auto rounded-2xl border border-white/10 bg-[#0b0f18] p-4"
            onMouseDown={(e) => e.stopPropagation()}
          >
            <div className="flex justify-between">
              <div>
                <div className="text-base font-semibold text-white">
                  {selected.name}
                </div>
                <div className="text-xs text-white/60">
                  {statLabel}
                  {matchContext ? ` · ${matchContext}` : ""}
                </div>
              </div>
              <button onClick={closeModal}>
                <X className="h-4 w-4 text-white/70" />
              </button>
            </div>

            <div className="mt-4 rounded-xl border border-white/10 bg-white/5 p-3">
              <div className="text-sm font-semibold text-white">
                {fmtRange(selected)}
              </div>
              <div className="mt-2 h-2 rounded-full bg-white/10">
                <div
                  className="h-2 rounded-full bg-amber-400"
                  style={{ width: `${Math.round(
                    (selected.confidence01 ?? 0) * 100
                  )}%` }}
                />
              </div>
              <div className="mt-3 text-sm text-white/75">
                {aiSentence(selected)}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
