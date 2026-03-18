import { useState, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Upload, FileText, RefreshCw, CircleCheck as CheckCircle,
  TriangleAlert as AlertTriangle, ArrowLeft,
} from "lucide-react";
import { parseCSVText, parseCSVFile, fmtPrice, type ParseError } from "./parseUtils";
import { usePlayerOptions, useCommitPrices } from "./usePriceIngest";
import { PlayerSearchDropdown } from "./PlayerSearchDropdown";
import type { ParsedPriceRow, MappingRow, IngestByIdResult } from "./types";

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

function MappingStatusBadge({ row }: { row: MappingRow }) {
  if (row.player_id !== null)
    return <Badge className="bg-emerald-500/15 text-emerald-400 border-emerald-500/25 text-[10px]">MAPPED</Badge>;
  return <Badge className="bg-red-500/15 text-red-400 border-red-500/25 text-[10px]">UNMAPPED</Badge>;
}

export function FantasyPricesTab() {
  const [step, setStep] = useState<Step>("input");
  const [pasteText, setPasteText] = useState("");
  const [parseErrors, setParseErrors] = useState<ParseError[]>([]);
  const [inputMode, setInputMode] = useState<"paste" | "csv">("paste");
  const [mappingRows, setMappingRows] = useState<MappingRow[]>([]);
  const [commitResult, setCommitResult] = useState<IngestByIdResult | null>(null);
  const [commitError, setCommitError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const players = usePlayerOptions();
  const { committing, commitPrices } = useCommitPrices();

  function buildMappingRows(parsed: ParsedPriceRow[]): MappingRow[] {
    return sortByLastName(
      parsed.map(r => ({ source_name: r.source_name, cleaned_price: r.cleaned_price, player_id: null, player_name: null }))
    );
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
      prev.map(r => r.source_name === sourceName ? { ...r, player_id: playerId, player_name: playerName } : r)
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

  function handleReset() {
    setStep("input");
    setPasteText("");
    setMappingRows([]);
    setParseErrors([]);
    setCommitResult(null);
    setCommitError(null);
    if (fileRef.current) fileRef.current.value = "";
  }

  const mappedCount = mappingRows.filter(r => r.player_id !== null).length;
  const unmappedCount = mappingRows.filter(r => r.player_id === null).length;

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
        <strong>Interactive mapper.</strong> Paste your price list, then assign each player using the search dropdown. Only mapped rows are inserted. Existing prices are never overwritten.
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
            <div className="flex items-center gap-3 flex-wrap">
              <div className="text-xs text-muted-foreground">
                <span className="font-semibold text-foreground">{mappingRows.length}</span> rows parsed
                {parseErrors.length > 0 && (
                  <span className="text-amber-400 ml-2">· {parseErrors.length} parse errors</span>
                )}
              </div>
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
            onClick={() => setStep("mapping")}
            disabled={mappingRows.length === 0}
          >
            Map Players ({mappingRows.length} rows)
          </Button>
        </>
      )}

      {step === "mapping" && (
        <MappingStep
          rows={mappingRows}
          players={players}
          mappedCount={mappedCount}
          unmappedCount={unmappedCount}
          committing={committing}
          commitError={commitError}
          onSelect={handlePlayerSelect}
          onCommit={handleCommit}
          onBack={() => setStep("input")}
        />
      )}
    </div>
  );
}

interface MappingStepProps {
  rows: MappingRow[];
  players: ReturnType<typeof usePlayerOptions>;
  mappedCount: number;
  unmappedCount: number;
  committing: boolean;
  commitError: string | null;
  onSelect: (sourceName: string, playerId: number | null, playerName: string | null) => void;
  onCommit: () => void;
  onBack: () => void;
}

function MappingStep({
  rows, players, mappedCount, unmappedCount, committing, commitError, onSelect, onCommit, onBack,
}: MappingStepProps) {
  return (
    <>
      <div className="grid grid-cols-3 gap-3">
        <div className="rounded-lg border border-border bg-muted/10 px-4 py-3 text-center">
          <div className="text-2xl font-bold tabular-nums">{rows.length}</div>
          <div className="text-xs text-muted-foreground mt-0.5">Total Rows</div>
        </div>
        <div className="rounded-lg border border-emerald-500/30 bg-emerald-950/10 px-4 py-3 text-center">
          <div className="text-2xl font-bold text-emerald-400 tabular-nums">{mappedCount}</div>
          <div className="text-xs text-muted-foreground mt-0.5">Mapped</div>
        </div>
        <div className={`rounded-lg px-4 py-3 text-center border ${unmappedCount > 0 ? "border-red-500/30 bg-red-950/10" : "border-border bg-muted/10"}`}>
          <div className={`text-2xl font-bold tabular-nums ${unmappedCount > 0 ? "text-red-400" : ""}`}>{unmappedCount}</div>
          <div className="text-xs text-muted-foreground mt-0.5">Unmapped</div>
        </div>
      </div>

      {unmappedCount > 0 && (
        <div className="rounded-lg border border-amber-500/25 bg-amber-950/10 px-4 py-3 text-sm text-amber-300 flex items-start gap-2.5">
          <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
          <span>{unmappedCount} rows without a player selected. Only mapped rows will be inserted. Unmapped rows are skipped.</span>
        </div>
      )}

      {commitError && (
        <div className="rounded-lg border border-red-500/25 bg-red-950/15 px-4 py-3 text-sm text-red-400">{commitError}</div>
      )}

      <div className="overflow-x-auto rounded-lg border border-border">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border/60 bg-muted/20">
              <th className="text-left py-2 px-3 text-[10px] font-semibold text-muted-foreground uppercase tracking-wide w-24">Status</th>
              <th className="text-left py-2 px-3 text-[10px] font-semibold text-muted-foreground uppercase tracking-wide w-32">Input Name</th>
              <th className="text-left py-2 px-3 text-[10px] font-semibold text-muted-foreground uppercase tracking-wide">Map to Player</th>
              <th className="text-right py-2 px-3 text-[10px] font-semibold text-muted-foreground uppercase tracking-wide w-24">Price</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row, i) => (
              <tr
                key={i}
                className={`border-b border-border/20 last:border-0 transition-colors ${
                  row.player_id !== null
                    ? "hover:bg-emerald-950/10"
                    : "bg-red-950/5 hover:bg-red-950/10"
                }`}
              >
                <td className="py-2 px-3">
                  <MappingStatusBadge row={row} />
                </td>
                <td className="py-2 px-3 font-mono text-xs text-muted-foreground">{row.source_name}</td>
                <td className="py-2 px-3">
                  <PlayerSearchDropdown
                    players={players}
                    value={row.player_id}
                    onChange={(id, name) => onSelect(row.source_name, id, name)}
                  />
                </td>
                <td className="py-2 px-3 text-right tabular-nums font-mono text-xs">
                  {fmtPrice(row.cleaned_price)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="flex items-center gap-3 flex-wrap">
        <Button
          onClick={onCommit}
          disabled={mappedCount === 0 || committing}
        >
          {committing
            ? <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
            : <CheckCircle className="h-4 w-4 mr-2" />}
          Commit Prices {mappedCount > 0 ? `(${mappedCount})` : ""}
        </Button>
        <Button variant="outline" onClick={onBack} disabled={committing}>
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back
        </Button>
        {mappedCount === 0 && (
          <span className="text-xs text-muted-foreground">Select at least one player to enable commit.</span>
        )}
      </div>
    </>
  );
}
