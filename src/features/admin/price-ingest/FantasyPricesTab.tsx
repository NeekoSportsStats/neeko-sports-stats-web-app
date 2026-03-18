import { useState, useRef, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Upload, FileText, RefreshCw, CircleCheck as CheckCircle, TriangleAlert as AlertTriangle, ArrowLeft, Zap, Clock, CircleHelp as HelpCircle, User } from "lucide-react";
import { parseCSVText, parseCSVFile, fmtPrice, type ParseError } from "./parseUtils";
import { usePlayerOptions, useCommitPrices, useSavePending } from "./usePriceIngest";
import { PlayerSearchDropdown } from "./PlayerSearchDropdown";
import { applyAutoMatch } from "./matchEngine";
import type { ParsedPriceRow, MappingRow, IngestByIdResult, MatchStatus } from "./types";

type Step = "input" | "mapping" | "done";

function extractLastName(sourceName: string): string {
  const parts = sourceName.trim().split(/\s+/);
  return parts.length >= 2 ? parts[parts.length - 1].toLowerCase() : sourceName.toLowerCase();
}

function sortByLastName(rows: MappingRow[]): MappingRow[] {
  return [...rows].sort((a, b) =>
    extractLastName(a.source_name).localeCompare(extractLastName(b.source_name))
  );
}

interface StatusBadgeProps { status: MatchStatus; confidence: number }
function StatusBadge({ status, confidence }: StatusBadgeProps) {
  if (status === "auto_matched")
    return (
      <span className="inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-400 border border-emerald-500/25">
        <Zap className="h-2.5 w-2.5" />AUTO {confidence}%
      </span>
    );
  if (status === "manually_matched")
    return (
      <span className="inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full bg-sky-500/15 text-sky-400 border border-sky-500/25">
        <User className="h-2.5 w-2.5" />MANUAL
      </span>
    );
  if (status === "suggested")
    return (
      <span className="inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full bg-amber-500/15 text-amber-400 border border-amber-500/25">
        <HelpCircle className="h-2.5 w-2.5" />SUGGEST
      </span>
    );
  if (status === "manual_required")
    return (
      <span className="inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full bg-orange-500/15 text-orange-400 border border-orange-500/25">
        <AlertTriangle className="h-2.5 w-2.5" />MANUAL
      </span>
    );
  return (
    <span className="inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full bg-slate-500/15 text-slate-400 border border-slate-500/25">
      <Clock className="h-2.5 w-2.5" />PENDING
    </span>
  );
}

function rowBgClass(row: MappingRow): string {
  if (row.player_id !== null) return "hover:bg-emerald-950/10";
  if (row.match_status === "pending_player_record") return "bg-slate-500/5 hover:bg-slate-500/10";
  return "bg-amber-950/5 hover:bg-amber-950/10";
}

export function FantasyPricesTab() {
  const [step, setStep] = useState<Step>("input");
  const [pasteText, setPasteText] = useState("");
  const [parseErrors, setParseErrors] = useState<ParseError[]>([]);
  const [inputMode, setInputMode] = useState<"paste" | "csv">("paste");
  const [mappingRows, setMappingRows] = useState<MappingRow[]>([]);
  const [commitResult, setCommitResult] = useState<IngestByIdResult | null>(null);
  const [commitError, setCommitError] = useState<string | null>(null);
  const [pendingSaved, setPendingSaved] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const players = usePlayerOptions();
  const { committing, commitPrices } = useCommitPrices();
  const { saving, savePending } = useSavePending();

  function buildMappingRows(parsed: ParsedPriceRow[]): MappingRow[] {
    const raw: MappingRow[] = parsed.map(r => ({
      source_name: r.source_name,
      cleaned_price: r.cleaned_price,
      player_id: null,
      player_name: null,
      match_status: "manual_required" as const,
      confidence: 0,
      suggestions: [],
    }));

    if (players.length > 0) {
      const matched = applyAutoMatch(raw, players);
      return sortByLastName(matched);
    }

    return sortByLastName(raw);
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
    const result = parseCSVText(text);
    setParseErrors(result.errors);
    setMappingRows(buildMappingRows(result.rows));
  }

  function handlePlayerSelect(sourceName: string, playerId: number | null, playerName: string | null) {
    setMappingRows(prev =>
      prev.map(r => {
        if (r.source_name !== sourceName) return r;
        return {
          ...r,
          player_id: playerId,
          player_name: playerName,
          match_status: playerId !== null ? "manually_matched" : r.match_status,
        };
      })
    );
  }

  async function handleCommit() {
    const mapped = mappingRows.filter(r => r.player_id !== null);
    if (mapped.length === 0) return;
    setCommitError(null);
    const result = await commitPrices(mapped);
    if (result) {
      setCommitResult(result);
      setStep("done");
    } else {
      setCommitError("Commit failed — check admin logs");
    }
  }

  async function handleSavePending() {
    const pending = mappingRows.filter(r => r.match_status === "pending_player_record");
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
      const matched = applyAutoMatch(
        mappingRows.map(r => ({ ...r, player_id: null, player_name: null, match_status: "manual_required" as const, confidence: 0, suggestions: [] })),
        players,
      );
      setMappingRows(sortByLastName(matched));
    }
    setStep("mapping");
  }

  const counts = useMemo(() => {
    const auto = mappingRows.filter(r => r.match_status === "auto_matched").length;
    const manual = mappingRows.filter(r => r.match_status === "manually_matched").length;
    const suggested = mappingRows.filter(r => r.match_status === "suggested" && r.player_id === null).length;
    const manualReq = mappingRows.filter(r => r.match_status === "manual_required").length;
    const pending = mappingRows.filter(r => r.match_status === "pending_player_record").length;
    const readyToInsert = auto + manual;
    return { auto, manual, suggested, manualReq, pending, readyToInsert, total: mappingRows.length };
  }, [mappingRows]);

  if (step === "done" && commitResult) {
    return (
      <div className="space-y-5">
        <div className="rounded-xl border border-emerald-500/30 bg-emerald-950/20 px-6 py-10 text-center">
          <CheckCircle className="h-10 w-10 text-emerald-500 mx-auto mb-3" />
          <h3 className="text-base font-semibold">Import Complete</h3>
          <p className="text-sm text-muted-foreground mt-1.5">
            {commitResult.inserted} prices inserted &nbsp;·&nbsp; {commitResult.skipped_dup} already existed
          </p>
        </div>
        <Button variant="outline" onClick={handleReset}>
          <ArrowLeft className="h-4 w-4 mr-2" />
          Import More
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div className="rounded-lg border border-amber-500/20 bg-amber-950/10 px-4 py-3 text-sm text-amber-300">
        <strong>Interactive mapper with auto-match.</strong> Paste your price list — common players auto-match instantly. Ambiguous names require manual selection. Players not yet in the database are held safely.
        <br />
        <span className="text-amber-400/70 text-xs mt-0.5 block">
          Format: Column 1 = player name (e.g. <code className="font-mono">N Daicos</code>), Column 2 = price (e.g. <code className="font-mono">$1,182,000</code>). Comma or tab separated.
        </span>
      </div>

      {step === "input" && (
        <>
          <div className="flex gap-2">
            <button
              onClick={() => setInputMode("paste")}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded text-xs font-medium border transition-colors ${
                inputMode === "paste" ? "bg-foreground text-background border-foreground" : "border-border text-muted-foreground hover:text-foreground"
              }`}
            >
              <FileText className="h-3.5 w-3.5" />
              Paste text
            </button>
            <button
              onClick={() => setInputMode("csv")}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded text-xs font-medium border transition-colors ${
                inputMode === "csv" ? "bg-foreground text-background border-foreground" : "border-border text-muted-foreground hover:text-foreground"
              }`}
            >
              <Upload className="h-3.5 w-3.5" />
              Upload CSV
            </button>
          </div>

          {inputMode === "paste" ? (
            <textarea
              value={pasteText}
              onChange={e => handlePasteChange(e.target.value)}
              placeholder={"N Daicos, $1,182,000\nP Laird, $987,500\nL Neale, $945,000"}
              rows={14}
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
            <div className="grid grid-cols-3 gap-2.5 sm:grid-cols-6">
              <StatTile label="Total" value={counts.total} />
              <StatTile label="Auto-matched" value={counts.auto} color="emerald" />
              <StatTile label="Suggested" value={counts.suggested} color="amber" />
              <StatTile label="Manual Req." value={counts.manualReq} color="orange" />
              <StatTile label="Pending" value={counts.pending} color="slate" />
              <StatTile label="Ready" value={counts.readyToInsert} color="emerald" />
            </div>
          )}

          {parseErrors.length > 0 && (
            <div className="rounded-lg border border-amber-500/20 bg-amber-950/10 px-3 py-2.5 space-y-1">
              <p className="text-xs font-semibold text-amber-400">Parse warnings ({parseErrors.length})</p>
              {parseErrors.slice(0, 5).map((e, i) => (
                <p key={i} className="text-xs text-muted-foreground font-mono">
                  Line {e.line}: {e.reason} — <span className="text-amber-400/70">{e.raw.slice(0, 50)}</span>
                </p>
              ))}
              {parseErrors.length > 5 && <p className="text-xs text-muted-foreground">…and {parseErrors.length - 5} more</p>}
            </div>
          )}

          <Button
            onClick={handleGoToMapping}
            disabled={mappingRows.length === 0}
          >
            <Zap className="h-4 w-4 mr-2" />
            Review &amp; Map Players ({mappingRows.length} rows)
          </Button>
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
        />
      )}
    </div>
  );
}

function StatTile({ label, value, color }: { label: string; value: number; color?: "emerald" | "amber" | "orange" | "slate" }) {
  const colorCls = {
    emerald: "text-emerald-400",
    amber: "text-amber-400",
    orange: "text-orange-400",
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
  readyToInsert: number;
  total: number;
}

interface MappingStepProps {
  rows: MappingRow[];
  players: ReturnType<typeof usePlayerOptions>;
  counts: MappingCounts;
  committing: boolean;
  saving: boolean;
  pendingSaved: boolean;
  commitError: string | null;
  onSelect: (sourceName: string, playerId: number | null, playerName: string | null) => void;
  onCommit: () => void;
  onSavePending: () => void;
  onBack: () => void;
}

function MappingStep({
  rows, players, counts, committing, saving, pendingSaved, commitError,
  onSelect, onCommit, onSavePending, onBack,
}: MappingStepProps) {
  return (
    <>
      <div className="grid grid-cols-3 gap-3 sm:grid-cols-6">
        <StatTile label="Total" value={counts.total} />
        <StatTile label="Auto-matched" value={counts.auto} color="emerald" />
        <StatTile label="Manual Match" value={counts.manual} color="emerald" />
        <StatTile label="Suggested" value={counts.suggested} color="amber" />
        <StatTile label="Manual Req." value={counts.manualReq} color="orange" />
        <StatTile label="Pending Record" value={counts.pending} color="slate" />
      </div>

      {counts.auto > 0 && (
        <div className="rounded-lg border border-emerald-500/20 bg-emerald-950/10 px-4 py-2.5 text-sm text-emerald-300 flex items-center gap-2">
          <Zap className="h-4 w-4 shrink-0" />
          <span>{counts.auto} players auto-matched with high confidence (95%+). Review and override if needed.</span>
        </div>
      )}

      {counts.pending > 0 && !pendingSaved && (
        <div className="rounded-lg border border-slate-500/20 bg-slate-500/5 px-4 py-2.5 text-sm text-slate-300 flex items-center justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-2">
            <Clock className="h-4 w-4 shrink-0" />
            <span>{counts.pending} players not yet in the database. Save them as pending for later resolution.</span>
          </div>
          <Button size="sm" variant="outline" onClick={onSavePending} disabled={saving} className="shrink-0 text-xs h-7">
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

      <div className="overflow-x-auto rounded-lg border border-border">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border/60 bg-muted/20">
              <th className="text-left py-2 px-3 text-[10px] font-semibold text-muted-foreground uppercase tracking-wide w-28">Status</th>
              <th className="text-left py-2 px-3 text-[10px] font-semibold text-muted-foreground uppercase tracking-wide w-28">Input Name</th>
              <th className="text-left py-2 px-3 text-[10px] font-semibold text-muted-foreground uppercase tracking-wide">Matched Player</th>
              <th className="text-right py-2 px-3 text-[10px] font-semibold text-muted-foreground uppercase tracking-wide w-24">Price</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row, i) => (
              <MappingTableRow
                key={i}
                row={row}
                players={players}
                onSelect={onSelect}
              />
            ))}
          </tbody>
        </table>
      </div>

      <div className="flex items-center gap-3 flex-wrap">
        <Button
          onClick={onCommit}
          disabled={counts.readyToInsert === 0 || committing}
        >
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

function MappingTableRow({
  row, players, onSelect,
}: {
  row: MappingRow;
  players: ReturnType<typeof usePlayerOptions>;
  onSelect: (sourceName: string, playerId: number | null, playerName: string | null) => void;
}) {
  const isPending = row.match_status === "pending_player_record";

  return (
    <tr className={`border-b border-border/20 last:border-0 transition-colors ${rowBgClass(row)}`}>
      <td className="py-2 px-3">
        <StatusBadge status={row.match_status} confidence={row.confidence} />
      </td>
      <td className="py-2 px-3 font-mono text-xs text-muted-foreground">{row.source_name}</td>
      <td className="py-2 px-3 min-w-[220px]">
        {isPending ? (
          <span className="text-xs text-slate-500 italic">Not in player database yet</span>
        ) : (
          <PlayerSearchDropdown
            players={row.suggestions.length > 0 && row.player_id === null
              ? row.suggestions.concat(players.filter(p => !row.suggestions.find(s => s.player_id === p.player_id)))
              : players
            }
            value={row.player_id}
            onChange={(id, name) => onSelect(row.source_name, id, name)}
            placeholder={row.player_name ?? "Search player…"}
          />
        )}
      </td>
      <td className="py-2 px-3 text-right tabular-nums font-mono text-xs">
        {fmtPrice(row.cleaned_price)}
      </td>
    </tr>
  );
}
