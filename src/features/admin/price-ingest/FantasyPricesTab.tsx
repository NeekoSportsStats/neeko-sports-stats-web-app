import { useState, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Upload, FileText, RefreshCw, CircleCheck as CheckCircle,
  TriangleAlert as AlertTriangle, ArrowLeft, Eye,
} from "lucide-react";
import { parseCSVText, parseCSVFile, fmtPrice, type ParseError } from "./parseUtils";
import { usePriceIngest } from "./usePriceIngest";
import type { ParsedPriceRow, PreviewRow } from "./types";

type Step = "input" | "preview" | "done";

function StatusBadge({ status }: { status: PreviewRow["status"] }) {
  if (status === "matched")
    return <Badge className="bg-emerald-500/15 text-emerald-400 border-emerald-500/25 text-[10px]">MATCHED</Badge>;
  if (status === "duplicate")
    return <Badge variant="secondary" className="text-[10px]">SAME PRICE</Badge>;
  return <Badge className="bg-red-500/15 text-red-400 border-red-500/25 text-[10px]">UNMATCHED</Badge>;
}

export function FantasyPricesTab() {
  const [step, setStep] = useState<Step>("input");
  const [pasteText, setPasteText] = useState("");
  const [parsedRows, setParsedRows] = useState<ParsedPriceRow[]>([]);
  const [parseErrors, setParseErrors] = useState<ParseError[]>([]);
  const [inputMode, setInputMode] = useState<"paste" | "csv">("paste");
  const fileRef = useRef<HTMLInputElement>(null);

  const { preview, confirm, reset, previewing, confirming, previewRows, ingestResult, error } = usePriceIngest();

  function handleParse(rows: ParsedPriceRow[], errors: ParseError[]) {
    setParsedRows(rows);
    setParseErrors(errors);
  }

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const result = await parseCSVFile(file);
    handleParse(result.rows, result.errors);
  }

  function handlePasteChange(text: string) {
    setPasteText(text);
    const result = parseCSVText(text);
    handleParse(result.rows, result.errors);
  }

  async function handlePreview() {
    if (parsedRows.length === 0) return;
    await preview(parsedRows);
    setStep("preview");
  }

  async function handleConfirm() {
    if (!previewRows) return;
    const matchedRows = parsedRows.filter(r => {
      const pr = previewRows.find(p => p.source_name === r.source_name);
      return pr?.status === "matched";
    });
    const result = await confirm(matchedRows);
    if (result) setStep("done");
  }

  function handleReset() {
    reset();
    setStep("input");
    setPasteText("");
    setParsedRows([]);
    setParseErrors([]);
    if (fileRef.current) fileRef.current.value = "";
  }

  const matchedCount = previewRows?.filter(r => r.status === "matched").length ?? 0;
  const duplicateCount = previewRows?.filter(r => r.status === "duplicate").length ?? 0;
  const unmatchedCount = previewRows?.filter(r => r.status === "unmatched").length ?? 0;

  if (step === "done" && ingestResult) {
    return (
      <div className="space-y-5">
        <div className="rounded-xl border border-emerald-500/30 bg-emerald-950/20 px-6 py-10 text-center">
          <CheckCircle className="h-10 w-10 text-emerald-500 mx-auto mb-3" />
          <h3 className="text-base font-semibold">Import Complete</h3>
          <p className="text-sm text-muted-foreground mt-1.5">
            {ingestResult.inserted} prices inserted &nbsp;·&nbsp; {ingestResult.skipped_dup} already existed &nbsp;·&nbsp; {ingestResult.unmatched} unmatched (check Name Resolver)
          </p>
        </div>
        {ingestResult.unmatched > 0 && (
          <div className="rounded-lg border border-amber-500/25 bg-amber-950/10 px-4 py-3 text-sm text-amber-300 flex items-start gap-2.5">
            <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
            <span>{ingestResult.unmatched} player names could not be matched. Switch to the <strong>Name Resolver</strong> tab to map them, then re-run the import.</span>
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

      <div className="rounded-lg border border-amber-500/20 bg-amber-950/10 px-4 py-3 text-sm text-amber-300">
        <strong>Safe insert only.</strong> Existing prices are never overwritten. Unmatched names are stored in the Name Resolver for manual mapping.
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

          {parsedRows.length > 0 && (
            <div className="flex items-center gap-3 flex-wrap">
              <div className="text-xs text-muted-foreground">
                <span className="font-semibold text-foreground">{parsedRows.length}</span> rows parsed
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

          {error && (
            <div className="rounded-lg border border-red-500/25 bg-red-950/15 px-4 py-3 text-sm text-red-400">{error}</div>
          )}

          <Button onClick={handlePreview} disabled={parsedRows.length === 0 || previewing}>
            {previewing ? <RefreshCw className="h-4 w-4 mr-2 animate-spin" /> : <Eye className="h-4 w-4 mr-2" />}
            Preview {parsedRows.length > 0 ? `${parsedRows.length} rows` : ""}
          </Button>
        </>
      )}

      {step === "preview" && previewRows && (
        <>
          <div className="grid grid-cols-3 gap-3">
            <div className="rounded-lg border border-emerald-500/30 bg-emerald-950/10 px-4 py-3 text-center">
              <div className="text-2xl font-bold text-emerald-400 tabular-nums">{matchedCount}</div>
              <div className="text-xs text-muted-foreground mt-0.5">Ready to Insert</div>
            </div>
            <div className="rounded-lg border border-border bg-muted/20 px-4 py-3 text-center">
              <div className="text-2xl font-bold tabular-nums">{duplicateCount}</div>
              <div className="text-xs text-muted-foreground mt-0.5">Same Price (skip)</div>
            </div>
            <div className="rounded-lg border border-red-500/30 bg-red-950/10 px-4 py-3 text-center">
              <div className="text-2xl font-bold text-red-400 tabular-nums">{unmatchedCount}</div>
              <div className="text-xs text-muted-foreground mt-0.5">Unmatched</div>
            </div>
          </div>

          {unmatchedCount > 0 && (
            <div className="rounded-lg border border-amber-500/25 bg-amber-950/10 px-4 py-3 text-sm text-amber-300 flex items-start gap-2.5">
              <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
              <span>{unmatchedCount} names have no match in the name map. They will be stored in the Name Resolver — use that tab to map them, then re-run.</span>
            </div>
          )}

          {error && (
            <div className="rounded-lg border border-red-500/25 bg-red-950/15 px-4 py-3 text-sm text-red-400">{error}</div>
          )}

          <div className="overflow-x-auto rounded-lg border border-border">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border/60 bg-muted/20">
                  <th className="text-left py-2 px-3 text-[10px] font-semibold text-muted-foreground uppercase tracking-wide w-28">Status</th>
                  <th className="text-left py-2 px-3 text-[10px] font-semibold text-muted-foreground uppercase tracking-wide">Input Name</th>
                  <th className="text-left py-2 px-3 text-[10px] font-semibold text-muted-foreground uppercase tracking-wide hidden sm:table-cell">Matched Player</th>
                  <th className="text-right py-2 px-3 text-[10px] font-semibold text-muted-foreground uppercase tracking-wide">New Price</th>
                  <th className="text-right py-2 px-3 text-[10px] font-semibold text-muted-foreground uppercase tracking-wide hidden sm:table-cell">Existing</th>
                </tr>
              </thead>
              <tbody>
                {previewRows.map((row, i) => (
                  <tr
                    key={i}
                    className={`border-b border-border/20 last:border-0 transition-colors ${
                      row.status === "matched" ? "hover:bg-emerald-950/10"
                      : row.status === "unmatched" ? "bg-red-950/5 hover:bg-red-950/10"
                      : "hover:bg-muted/10"
                    }`}
                  >
                    <td className="py-1.5 px-3"><StatusBadge status={row.status} /></td>
                    <td className="py-1.5 px-3 font-mono text-xs">{row.source_name}</td>
                    <td className="py-1.5 px-3 font-medium text-xs hidden sm:table-cell">
                      {row.player_name ?? <span className="text-red-400/70 italic">no match</span>}
                    </td>
                    <td className="py-1.5 px-3 text-right tabular-nums font-mono text-xs">
                      {fmtPrice(row.cleaned_price)}
                    </td>
                    <td className="py-1.5 px-3 text-right tabular-nums font-mono text-xs text-muted-foreground hidden sm:table-cell">
                      {fmtPrice(row.existing_price)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="flex items-center gap-3 flex-wrap">
            <Button onClick={handleConfirm} disabled={matchedCount === 0 || confirming}>
              {confirming
                ? <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                : <CheckCircle className="h-4 w-4 mr-2" />}
              Confirm Insert {matchedCount > 0 ? `(${matchedCount} prices)` : ""}
            </Button>
            <Button variant="outline" onClick={() => { reset(); setStep("input"); }} disabled={confirming}>
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back
            </Button>
            {matchedCount === 0 && (
              <span className="text-xs text-muted-foreground">No matched prices to insert.</span>
            )}
          </div>
        </>
      )}
    </div>
  );
}
