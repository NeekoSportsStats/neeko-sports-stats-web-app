import { useState, useRef, useMemo, useCallback } from "react";
import { Button } from "@/components/ui/button";
import {
  Upload, FileText, RefreshCw, CircleCheck as CheckCircle,
  TriangleAlert as AlertTriangle, ArrowLeft, Zap, Clock,
  CircleHelp as HelpCircle, User, Search, Eye, EyeOff, Copy,
  Sparkles,
} from "lucide-react";
import { parseCSVText, parseCSVFile, parseRawFantasyText, fmtPrice, type ParseError } from "./parseUtils";
import { usePlayerOptions, useCommitPrices, useSavePending } from "./usePriceIngest";
import { PlayerSearchDropdown } from "./PlayerSearchDropdown";
import { applyAutoMatch } from "./matchEngine";
import type { ParsedPriceRow, MappingRow, IngestByIdResult, MatchStatus } from "./types";

type Step = "input" | "mapping" | "done";
type InputMode = "raw" | "paste" | "csv";

const GROUP_ORDER: MatchStatus[] = [
  "pending_player_record",
  "manual_input",
  "manual_required",
  "suggested",
  "manually_matched",
  "auto_matched",
];

function extractLastName(sourceName: string): string {
  const parts = sourceName.trim().split(/\s+/);
  return parts.length >= 2 ? parts[parts.length - 1].toLowerCase() : sourceName.toLowerCase();
}

function sortAndGroupRows(rows: MappingRow[]): MappingRow[] {
  return [...rows].sort((a, b) => {
    const ga = GROUP_ORDER.indexOf(a.match_status);
    const gb = GROUP_ORDER.indexOf(b.match_status);
    if (ga !== gb) return ga - gb;
    return extractLastName(a.source_name).localeCompare(extractLastName(b.source_name));
  });
}

function genId(): string {
  return Math.random().toString(36).slice(2) + Date.now().toString(36);
}

interface StatusBadgeProps { status: MatchStatus; confidence: number }
function StatusBadge({ status, confidence }: StatusBadgeProps) {
  if (status === "auto_matched")
    return (
      <span className="inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-400 border border-emerald-500/25 whitespace-nowrap">
        <Zap className="h-2.5 w-2.5" />AUTO {confidence}%
      </span>
    );
  if (status === "manually_matched")
    return (
      <span className="inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full bg-sky-500/15 text-sky-400 border border-sky-500/25 whitespace-nowrap">
        <User className="h-2.5 w-2.5" />MANUAL
      </span>
    );
  if (status === "manual_input")
    return (
      <span className="inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full bg-amber-500/15 text-amber-400 border border-amber-500/25 whitespace-nowrap">
        <Clock className="h-2.5 w-2.5" />PENDING PLAYER
      </span>
    );
  if (status === "suggested")
    return (
      <span className="inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full bg-amber-500/15 text-amber-400 border border-amber-500/25 whitespace-nowrap">
        <HelpCircle className="h-2.5 w-2.5" />SUGGEST
      </span>
    );
  if (status === "manual_required")
    return (
      <span className="inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full bg-orange-500/15 text-orange-400 border border-orange-500/25 whitespace-nowrap">
        <AlertTriangle className="h-2.5 w-2.5" />SEARCH
      </span>
    );
  return (
    <span className="inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full bg-slate-500/15 text-slate-400 border border-slate-500/25 whitespace-nowrap">
      <Clock className="h-2.5 w-2.5" />PENDING
    </span>
  );
}

function rowBgClass(row: MappingRow): string {
  if (row.player_id !== null) return "hover:bg-emerald-950/10";
  if (row.match_status === "pending_player_record") return "bg-red-950/5 hover:bg-red-950/10";
  if (row.match_status === "manual_input") return "bg-amber-950/5 hover:bg-amber-950/10";
  if (row.match_status === "manual_required") return "bg-orange-950/5 hover:bg-orange-950/10";
  if (row.match_status === "suggested") return "bg-amber-950/5 hover:bg-amber-950/10";
  return "hover:bg-muted/10";
}

export function FantasyPricesTab() {
  const [step, setStep] = useState<Step>("input");
  const [pasteText, setPasteText] = useState("");
  const [parseErrors, setParseErrors] = useState<ParseError[]>([]);
  const [inputMode, setInputMode] = useState<InputMode>("raw");
  const [mappingRows, setMappingRows] = useState<MappingRow[]>([]);
  const [commitResult, setCommitResult] = useState<IngestByIdResult | null>(null);
  const [commitError, setCommitError] = useState<string | null>(null);
  const [pendingSaved, setPendingSaved] = useState(false);
  const [copiedCsv, setCopiedCsv] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const players = usePlayerOptions();
  const { committing, commitPrices } = useCommitPrices();
  const { saving, savePending } = useSavePending();

  function buildMappingRows(parsed: ParsedPriceRow[]): MappingRow[] {
    const raw: MappingRow[] = parsed.map(r => ({
      id: genId(),
      source_name: r.source_name,
      cleaned_price: r.cleaned_price,
      position: r.position ?? null,
      team: r.team ?? null,
      player_id: null,
      player_name: null,
      manual_input_name: null,
      match_status: "manual_required" as const,
      confidence: 0,
      suggestions: [],
    }));

    if (players.length > 0) {
      return sortAndGroupRows(applyAutoMatch(raw, players));
    }
    return sortAndGroupRows(raw);
  }

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const result = await parseCSVFile(file);
    setParseErrors(result.errors);
    setMappingRows(buildMappingRows(result.rows));
  }

  function handlePasteChange(text: string) {
    setPasteText(text);
    const result = inputMode === "raw" ? parseRawFantasyText(text) : parseCSVText(text);
    setParseErrors(result.errors);
    setMappingRows(buildMappingRows(result.rows));
  }

  function handleModeChange(mode: InputMode) {
    setInputMode(mode);
    if (pasteText) {
      const result = mode === "raw" ? parseRawFantasyText(pasteText) : parseCSVText(pasteText);
      setParseErrors(result.errors);
      setMappingRows(buildMappingRows(result.rows));
    }
  }

  const handlePlayerSelect = useCallback((rowId: string, playerId: number | null, playerName: string | null, isManualInput?: boolean) => {
    setMappingRows(prev =>
      prev.map(r => {
        if (r.id !== rowId) return r;
        if (isManualInput) {
          return {
            ...r,
            player_id: null,
            player_name: null,
            manual_input_name: playerName,
            match_status: "manual_input" as const,
          };
        }
        return {
          ...r,
          player_id: playerId,
          player_name: playerName,
          manual_input_name: null,
          match_status: playerId !== null ? "manually_matched" : r.match_status,
        };
      })
    );
  }, []);

  async function handleCommit() {
    const mapped = mappingRows.filter(r => r.player_id !== null);
    if (mapped.length === 0) return;
    setCommitError(null);
    const { result, error } = await commitPrices(mapped);
    if (result) {
      setCommitResult(result);
      setStep("done");
    } else {
      setCommitError(error ?? "Commit failed — check admin logs");
    }
  }

  async function handleSavePending() {
    const pending = mappingRows.filter(
      r => r.match_status === "pending_player_record" || r.match_status === "manual_input"
    );
    if (pending.length === 0) return;
    const result = await savePending(pending);
    if (result) setPendingSaved(true);
  }

  function handleReset() {
    setStep("input");
    setPasteText("");
    setMappingRows([]);
    setParseErrors([]);
    setCommitResult(null);
    setCommitError(null);
    setPendingSaved(false);
    if (fileRef.current) fileRef.current.value = "";
  }

  function handleGoToMapping() {
    if (players.length > 0) {
      const rerun = mappingRows.map(r => ({
        ...r,
        player_id: null,
        player_name: null,
        manual_input_name: r.manual_input_name,
        match_status: r.match_status === "manual_input" ? ("manual_input" as const) : ("manual_required" as const),
        confidence: 0,
        suggestions: [],
      }));
      setMappingRows(sortAndGroupRows(applyAutoMatch(rerun, players)));
    }
    setStep("mapping");
  }

  function handleCopyCleanCsv() {
    const header = "player_name,team,position,price";
    const lines = mappingRows
      .filter(r => r.cleaned_price > 0)
      .map(r => {
        const name = (r.player_name ?? r.source_name).replace(/,/g, "");
        const team = (r.team ?? "").replace(/,/g, "");
        const pos = r.position ?? "";
        return `${name},${team},${pos},${r.cleaned_price}`;
      });
    const csv = [header, ...lines].join("\n");
    navigator.clipboard.writeText(csv).then(() => {
      setCopiedCsv(true);
      setTimeout(() => setCopiedCsv(false), 2000);
    });
  }

  const counts = useMemo(() => {
    const auto = mappingRows.filter(r => r.match_status === "auto_matched").length;
    const manual = mappingRows.filter(r => r.match_status === "manually_matched").length;
    const suggested = mappingRows.filter(r => r.match_status === "suggested" && r.player_id === null).length;
    const manualReq = mappingRows.filter(r => r.match_status === "manual_required").length;
    const pending = mappingRows.filter(r => r.match_status === "pending_player_record").length;
    const manualInput = mappingRows.filter(r => r.match_status === "manual_input").length;
    const readyToInsert = auto + manual;
    const hasPositions = mappingRows.filter(r => r.position != null).length;
    const hasTeams = mappingRows.filter(r => r.team != null).length;
    return { auto, manual, suggested, manualReq, pending, manualInput, readyToInsert, total: mappingRows.length, hasPositions, hasTeams };
  }, [mappingRows]);

  if (step === "done" && commitResult) {
    const refresh = commitResult.refresh;
    const allRefreshed = refresh
      ? refresh.projection_engine.ok && refresh.rankings_cache.ok && refresh.refresh_rankings.ok
      : false;
    const anyRefreshFailed = refresh
      ? !refresh.projection_engine.ok || !refresh.rankings_cache.ok || !refresh.refresh_rankings.ok
      : false;

    const refreshSteps = refresh
      ? [
          { label: "Projection engine refreshed", ok: refresh.projection_engine.ok, error: refresh.projection_engine.error },
          { label: "Rankings cache rebuilt", ok: refresh.rankings_cache.ok, error: refresh.rankings_cache.error },
          { label: "Projection model rebuilt", ok: refresh.rebuild_projection.ok, error: refresh.rebuild_projection.error },
          { label: "Materialized view refreshed", ok: refresh.refresh_mv.ok, error: refresh.refresh_mv.error },
          { label: "Rankings finalised", ok: refresh.refresh_rankings.ok, error: refresh.refresh_rankings.error },
        ]
      : [];

    return (
      <div className="space-y-4">
        <div className="rounded-xl border border-emerald-500/30 bg-emerald-950/20 px-6 py-8 text-center">
          <CheckCircle className="h-10 w-10 text-emerald-500 mx-auto mb-3" />
          <h3 className="text-base font-semibold">
            {allRefreshed ? "Prices updated — projections refreshed" : "Prices imported — refresh partial"}
          </h3>
          <p className="text-sm text-muted-foreground mt-1.5">
            {commitResult.inserted} prices inserted &nbsp;·&nbsp; {commitResult.skipped_dup} already existed
          </p>
        </div>

        {refreshSteps.length > 0 && (
          <div className="rounded-lg border border-border bg-card px-4 py-3 space-y-2">
            <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
              Post-ingest refresh
            </p>
            {refreshSteps.map((s, i) => (
              <div key={i} className="flex items-center gap-2 text-xs">
                {s.ok
                  ? <CheckCircle className="h-3.5 w-3.5 text-emerald-500 shrink-0" />
                  : <AlertTriangle className="h-3.5 w-3.5 text-amber-400 shrink-0" />
                }
                <span className={s.ok ? "text-foreground" : "text-amber-400"}>{s.label}</span>
                {!s.ok && s.error && (
                  <span className="text-muted-foreground truncate max-w-[240px]" title={s.error}>
                    — {s.error}
                  </span>
                )}
              </div>
            ))}
            {anyRefreshFailed && (
              <p className="text-[10px] text-amber-400/70 mt-1">
                Prices were saved. Failed refresh steps can be re-run from the Command Center.
              </p>
            )}
          </div>
        )}

        <Button variant="outline" onClick={handleReset}>
          <ArrowLeft className="h-4 w-4 mr-2" />
          Import More
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {step === "input" && (
        <>
          <div className="flex gap-2 flex-wrap">
            <ModeButton active={inputMode === "raw"} onClick={() => handleModeChange("raw")} icon={<Sparkles className="h-3.5 w-3.5" />}>
              Raw site paste
            </ModeButton>
            <ModeButton active={inputMode === "paste"} onClick={() => handleModeChange("paste")} icon={<FileText className="h-3.5 w-3.5" />}>
              CSV paste
            </ModeButton>
            <ModeButton active={inputMode === "csv"} onClick={() => handleModeChange("csv")} icon={<Upload className="h-3.5 w-3.5" />}>
              Upload CSV
            </ModeButton>
          </div>

          {inputMode === "raw" && (
            <div className="rounded-lg border border-sky-500/20 bg-sky-950/10 px-4 py-3 text-sm text-sky-300">
              <strong>Raw paste mode.</strong> Copy the entire player table from AFL Fantasy and paste it below — messy spacing, merged columns, and extra rows are handled automatically. Prices ($NNN,NNN) are used as anchors to detect each player row.
              <br />
              <span className="text-sky-400/70 text-xs mt-0.5 block">
                Extracts: player name, position (DEF/MID/FWD/RUC), team, and price.
              </span>
            </div>
          )}

          {inputMode === "paste" && (
            <div className="rounded-lg border border-amber-500/20 bg-amber-950/10 px-4 py-3 text-sm text-amber-300">
              <strong>CSV paste mode.</strong> Expects clean comma or tab-separated rows.
              <br />
              <span className="text-amber-400/70 text-xs mt-0.5 block">
                Format: <code className="font-mono">N Daicos, $1,182,000</code> — one player per line.
              </span>
            </div>
          )}

          {inputMode !== "csv" ? (
            <textarea
              value={pasteText}
              onChange={e => handlePasteChange(e.target.value)}
              placeholder={
                inputMode === "raw"
                  ? "Paste AFL Fantasy player table here — raw copy from site is fine\n\nExample:\n1 Nick Daicos MID Collingwood $1,182,000\n2 Zach Merrett MID Essendon $956,000\n..."
                  : "N Daicos, $1,182,000\nL D-Uniacke, $785,000\nM Gawn, $1,050,000"
              }
              rows={16}
              className="w-full border border-border rounded-md px-3 py-2.5 text-sm font-mono bg-background text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring resize-y"
            />
          ) : (
            <div
              onClick={() => fileRef.current?.click()}
              className="border-2 border-dashed border-border rounded-xl px-6 py-12 text-center cursor-pointer hover:border-foreground/30 transition-colors"
            >
              <Upload className="h-8 w-8 text-muted-foreground mx-auto mb-3" />
              <p className="text-sm font-medium">Click to select CSV file</p>
              <p className="text-xs text-muted-foreground mt-1">First column: player name · Second column: price</p>
              <input ref={fileRef} type="file" accept=".csv,.txt" className="hidden" onChange={handleFileChange} />
            </div>
          )}

          {mappingRows.length > 0 && (
            <>
              <div className="grid grid-cols-3 gap-2.5 sm:grid-cols-6">
                <StatTile label="Total" value={counts.total} />
                <StatTile label="Auto-matched" value={counts.auto} color="emerald" />
                <StatTile label="Suggested" value={counts.suggested} color="amber" />
                <StatTile label="Needs Search" value={counts.manualReq} color="orange" />
                <StatTile label="Pending" value={counts.pending} color="red" />
                <StatTile label="Ready" value={counts.readyToInsert} color="emerald" />
              </div>

              {counts.hasPositions > 0 && (
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <CheckCircle className="h-3.5 w-3.5 text-emerald-500" />
                  Position extracted for {counts.hasPositions} of {counts.total} players
                  {counts.hasTeams > 0 && ` · Team for ${counts.hasTeams}`}
                </div>
              )}

              <div className="flex items-center gap-3 flex-wrap">
                <Button onClick={handleGoToMapping}>
                  <Zap className="h-4 w-4 mr-2" />
                  Review &amp; Map Players ({mappingRows.length} rows)
                </Button>
                <Button variant="outline" size="sm" onClick={handleCopyCleanCsv} className="text-xs h-9">
                  <Copy className="h-3.5 w-3.5 mr-1.5" />
                  {copiedCsv ? "Copied!" : "Copy Clean CSV"}
                </Button>
              </div>
            </>
          )}

          {mappingRows.length === 0 && inputMode !== "csv" && pasteText.trim() && (
            <div className="rounded-lg border border-red-500/20 bg-red-950/10 px-4 py-3 text-sm text-red-400">
              No player rows detected. Make sure the pasted content includes prices in the format $NNN,NNN.
            </div>
          )}

          {parseErrors.length > 0 && (
            <div className="rounded-lg border border-amber-500/20 bg-amber-950/10 px-3 py-2.5 space-y-1">
              <p className="text-xs font-semibold text-amber-400">Parse warnings ({parseErrors.length})</p>
              {parseErrors.slice(0, 6).map((e, i) => (
                <p key={i} className="text-xs text-muted-foreground font-mono">
                  Row {e.line}: {e.reason} — <span className="text-amber-400/70">{e.raw.slice(0, 60)}</span>
                </p>
              ))}
              {parseErrors.length > 6 && <p className="text-xs text-muted-foreground">…and {parseErrors.length - 6} more</p>}
            </div>
          )}
        </>
      )}

      {step === "mapping" && (
        <MappingStep
          rows={mappingRows}
          players={players}
          counts={counts}
          committing={committing}
          saving={saving}
          pendingSaved={pendingSaved}
          commitError={commitError}
          onSelect={handlePlayerSelect}
          onCommit={handleCommit}
          onSavePending={handleSavePending}
          onBack={() => setStep("input")}
          onCopyCleanCsv={handleCopyCleanCsv}
          copiedCsv={copiedCsv}
        />
      )}
    </div>
  );
}

function ModeButton({ active, onClick, icon, children }: {
  active: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={`flex items-center gap-1.5 px-3 py-1.5 rounded text-xs font-medium border transition-colors ${
        active
          ? "bg-foreground text-background border-foreground"
          : "border-border text-muted-foreground hover:text-foreground hover:border-foreground/30"
      }`}
    >
      {icon}
      {children}
    </button>
  );
}

function StatTile({ label, value, color }: { label: string; value: number; color?: "emerald" | "amber" | "orange" | "red" | "slate" }) {
  const colorCls = {
    emerald: "text-emerald-400",
    amber: "text-amber-400",
    orange: "text-orange-400",
    red: "text-red-400",
    slate: "text-slate-400",
  }[color ?? ""] ?? "text-foreground";

  return (
    <div className="rounded-lg border border-border bg-muted/10 px-3 py-2.5 text-center">
      <div className={`text-xl font-bold tabular-nums ${colorCls}`}>{value}</div>
      <div className="text-[10px] text-muted-foreground mt-0.5 leading-tight">{label}</div>
    </div>
  );
}

interface MappingCounts {
  auto: number;
  manual: number;
  suggested: number;
  manualReq: number;
  pending: number;
  manualInput: number;
  readyToInsert: number;
  total: number;
  hasPositions: number;
  hasTeams: number;
}

interface MappingStepProps {
  rows: MappingRow[];
  players: ReturnType<typeof usePlayerOptions>;
  counts: MappingCounts;
  committing: boolean;
  saving: boolean;
  pendingSaved: boolean;
  commitError: string | null;
  onSelect: (rowId: string, playerId: number | null, playerName: string | null, isManualInput?: boolean) => void;
  onCommit: () => void;
  onSavePending: () => void;
  onBack: () => void;
  onCopyCleanCsv: () => void;
  copiedCsv: boolean;
}

function MappingStep({
  rows, players, counts, committing, saving, pendingSaved, commitError,
  onSelect, onCommit, onSavePending, onBack, onCopyCleanCsv, copiedCsv,
}: MappingStepProps) {
  const [search, setSearch] = useState("");
  const [showUnmatchedOnly, setShowUnmatchedOnly] = useState(false);

  const showPositionCol = counts.hasPositions > 0;
  const showTeamCol = counts.hasTeams > 0;

  const visibleRows = useMemo(() => {
    let filtered = rows;
    if (showUnmatchedOnly) {
      filtered = filtered.filter(r => r.player_id === null);
    }
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      filtered = filtered.filter(r =>
        r.source_name.toLowerCase().includes(q) ||
        (r.player_name ?? "").toLowerCase().includes(q) ||
        (r.team ?? "").toLowerCase().includes(q)
      );
    }
    return filtered;
  }, [rows, search, showUnmatchedOnly]);

  let lastGroup: MatchStatus | null = null;

  return (
    <>
      <div className="grid grid-cols-3 gap-3 sm:grid-cols-6 lg:grid-cols-7">
        <StatTile label="Total" value={counts.total} />
        <StatTile label="Auto-matched" value={counts.auto} color="emerald" />
        <StatTile label="Manual Match" value={counts.manual} color="emerald" />
        <StatTile label="Suggested" value={counts.suggested} color="amber" />
        <StatTile label="Needs Search" value={counts.manualReq} color="orange" />
        <StatTile label="Pending Player" value={counts.manualInput} color="amber" />
        <StatTile label="Not In DB" value={counts.pending} color="red" />
      </div>

      {counts.auto > 0 && (
        <div className="rounded-lg border border-emerald-500/20 bg-emerald-950/10 px-4 py-2.5 text-sm text-emerald-300 flex items-center gap-2">
          <Zap className="h-4 w-4 shrink-0" />
          <span>{counts.auto} players auto-matched (95%+ confidence). Override any by clicking their dropdown.</span>
        </div>
      )}

      {counts.manualInput > 0 && (
        <div className="rounded-lg border border-amber-500/20 bg-amber-950/10 px-4 py-2.5 text-sm text-amber-300 flex items-center gap-2">
          <Clock className="h-4 w-4 shrink-0" />
          <span>
            {counts.manualInput} row{counts.manualInput !== 1 ? "s" : ""} marked as <strong>Pending Player</strong> — stored with custom name, will not be inserted until a player record is mapped.
          </span>
        </div>
      )}

      {(counts.pending > 0 || counts.manualInput > 0) && !pendingSaved && (
        <div className="rounded-lg border border-red-500/20 bg-red-950/10 px-4 py-2.5 text-sm text-red-300 flex items-center justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-2">
            <Clock className="h-4 w-4 shrink-0" />
            <span>
              {counts.pending + counts.manualInput} player{counts.pending + counts.manualInput !== 1 ? "s" : ""} unresolved. Save for later resolution once player records exist.
            </span>
          </div>
          <Button size="sm" variant="outline" onClick={onSavePending} disabled={saving} className="shrink-0 text-xs h-7 border-red-500/30 text-red-400 hover:bg-red-950/20">
            {saving ? <RefreshCw className="h-3 w-3 mr-1.5 animate-spin" /> : <Clock className="h-3 w-3 mr-1.5" />}
            Save Pending
          </Button>
        </div>
      )}

      {pendingSaved && (
        <div className="rounded-lg border border-emerald-500/25 bg-emerald-950/10 px-4 py-2.5 text-sm text-emerald-300 flex items-center gap-2">
          <CheckCircle className="h-4 w-4 shrink-0" />
          Pending players saved. They will appear in the Name Resolver once their player records are created.
        </div>
      )}

      {commitError && (
        <div className="rounded-lg border border-red-500/25 bg-red-950/15 px-4 py-3 text-sm text-red-400">{commitError}</div>
      )}

      <div className="flex items-center gap-3 flex-wrap">
        <div className="relative flex-1 min-w-[180px]">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground pointer-events-none" />
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search by name, team…"
            className="w-full pl-7 pr-3 py-1.5 border border-border rounded-md text-xs bg-background text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring"
          />
        </div>
        <button
          onClick={() => setShowUnmatchedOnly(v => !v)}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded text-xs font-medium border transition-colors ${
            showUnmatchedOnly ? "bg-amber-500/20 text-amber-300 border-amber-500/30" : "border-border text-muted-foreground hover:text-foreground"
          }`}
        >
          {showUnmatchedOnly ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
          {showUnmatchedOnly ? "Showing unmatched" : "Unmatched only"}
        </button>
        <button
          onClick={onCopyCleanCsv}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded text-xs font-medium border border-border text-muted-foreground hover:text-foreground transition-colors"
        >
          <Copy className="h-3.5 w-3.5" />
          {copiedCsv ? "Copied!" : "Copy CSV"}
        </button>
        <span className="text-xs text-muted-foreground ml-auto">
          {visibleRows.length} of {rows.length} rows
        </span>
      </div>

      <div className="overflow-x-auto rounded-lg border border-border">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border/60 bg-muted/20">
              <th className="text-left py-2 px-3 text-[10px] font-semibold text-muted-foreground uppercase tracking-wide w-28">Status</th>
              <th className="text-left py-2 px-3 text-[10px] font-semibold text-muted-foreground uppercase tracking-wide">Input Name</th>
              {showPositionCol && (
                <th className="text-left py-2 px-3 text-[10px] font-semibold text-muted-foreground uppercase tracking-wide w-16">Pos</th>
              )}
              {showTeamCol && (
                <th className="text-left py-2 px-3 text-[10px] font-semibold text-muted-foreground uppercase tracking-wide w-28">Team</th>
              )}
              <th className="text-left py-2 px-3 text-[10px] font-semibold text-muted-foreground uppercase tracking-wide">Matched Player</th>
              <th className="text-right py-2 px-3 text-[10px] font-semibold text-muted-foreground uppercase tracking-wide w-24">Price</th>
            </tr>
          </thead>
          <tbody>
            {visibleRows.map(row => {
              const showDivider = row.match_status !== lastGroup;
              lastGroup = row.match_status;
              return (
                <MappingTableRow
                  key={row.id}
                  row={row}
                  players={players}
                  onSelect={onSelect}
                  showGroupDivider={showDivider}
                  showPositionCol={showPositionCol}
                  showTeamCol={showTeamCol}
                />
              );
            })}
            {visibleRows.length === 0 && (
              <tr>
                <td colSpan={4 + (showPositionCol ? 1 : 0) + (showTeamCol ? 1 : 0)} className="py-8 text-center text-xs text-muted-foreground">
                  No rows match your filter
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <div className="flex items-center gap-3 flex-wrap">
        <Button onClick={onCommit} disabled={counts.readyToInsert === 0 || committing}>
          {committing
            ? <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
            : <CheckCircle className="h-4 w-4 mr-2" />}
          Commit Prices {counts.readyToInsert > 0 ? `(${counts.readyToInsert})` : ""}
        </Button>
        <Button variant="outline" onClick={onBack} disabled={committing}>
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back
        </Button>
        {counts.readyToInsert === 0 && (
          <span className="text-xs text-muted-foreground">Map at least one player to enable commit.</span>
        )}
      </div>
    </>
  );
}

const GROUP_LABELS: Partial<Record<MatchStatus, string>> = {
  pending_player_record: "Not in database — pending player record",
  manual_input: "Custom name entered — pending player record",
  manual_required: "No match found — search manually",
  suggested: "Multiple candidates — select the correct player",
  manually_matched: "Manually matched",
  auto_matched: "Auto-matched",
};

function MappingTableRow({
  row, players, onSelect, showGroupDivider, showPositionCol, showTeamCol,
}: {
  row: MappingRow;
  players: ReturnType<typeof usePlayerOptions>;
  onSelect: (rowId: string, playerId: number | null, playerName: string | null, isManualInput?: boolean) => void;
  showGroupDivider: boolean;
  showPositionCol: boolean;
  showTeamCol: boolean;
}) {
  const isHardPending = row.match_status === "pending_player_record";
  const colSpan = 4 + (showPositionCol ? 1 : 0) + (showTeamCol ? 1 : 0);

  const dropdownPlayers = useMemo(() => {
    if (row.suggestions.length > 0 && row.player_id === null) {
      const suggestionIds = new Set(row.suggestions.map(s => s.player_id));
      return [...row.suggestions, ...players.filter(p => !suggestionIds.has(p.player_id))];
    }
    return players;
  }, [row.suggestions, row.player_id, players]);

  return (
    <>
      {showGroupDivider && GROUP_LABELS[row.match_status] && (
        <tr>
          <td colSpan={colSpan} className="py-1.5 px-3 bg-muted/30 border-b border-t border-border/40">
            <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">
              {GROUP_LABELS[row.match_status]}
            </span>
          </td>
        </tr>
      )}
      <tr className={`border-b border-border/20 last:border-0 transition-colors ${rowBgClass(row)}`}>
        <td className="py-2 px-3">
          <StatusBadge status={row.match_status} confidence={row.confidence} />
        </td>
        <td className="py-2 px-3 font-mono text-xs text-muted-foreground">{row.source_name}</td>
        {showPositionCol && (
          <td className="py-2 px-3">
            {row.position ? (
              <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-muted/30 text-muted-foreground">
                {row.position}
              </span>
            ) : (
              <span className="text-[10px] text-muted-foreground/40">—</span>
            )}
          </td>
        )}
        {showTeamCol && (
          <td className="py-2 px-3 text-xs text-muted-foreground truncate max-w-[96px]">
            {row.team ?? "—"}
          </td>
        )}
        <td className="py-2 px-3 min-w-[220px]">
          <PlayerSearchDropdown
            players={dropdownPlayers}
            value={row.player_id}
            manualInputName={row.manual_input_name}
            onChange={(id, name, isManual) => onSelect(row.id, id, name, isManual)}
            placeholder={isHardPending ? "Type name or search…" : (row.player_name ?? "Search player…")}
          />
        </td>
        <td className="py-2 px-3 text-right tabular-nums font-mono text-xs">
          {fmtPrice(row.cleaned_price)}
        </td>
      </tr>
    </>
  );
}
