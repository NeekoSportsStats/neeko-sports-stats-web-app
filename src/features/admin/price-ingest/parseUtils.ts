import type { ParsedPriceRow } from "./types";

export interface ParseError {
  line: number;
  raw: string;
  reason: string;
}

export interface ParseResult {
  rows: ParsedPriceRow[];
  errors: ParseError[];
}

function cleanPrice(raw: string): number | null {
  const cleaned = raw.replace(/[$,\s]/g, "");
  const n = parseInt(cleaned, 10);
  if (isNaN(n) || n < 50_000 || n > 3_000_000) return null;
  return n;
}

export function parseCSVText(text: string): ParseResult {
  const lines = text.split("\n");
  const rows: ParsedPriceRow[] = [];
  const errors: ParseError[] = [];

  for (let i = 0; i < lines.length; i++) {
    const raw = lines[i].trim();
    if (!raw) continue;

    // Try comma-separated first (CSV)
    let name: string | null = null;
    let priceStr: string | null = null;

    const commaParts = raw.split(",");
    if (commaParts.length >= 2) {
      name = commaParts[0].trim().replace(/^"|"$/g, "");
      priceStr = commaParts.slice(1).join(",").trim().replace(/^"|"$/g, "");
    } else {
      // Tab-separated fallback
      const tabParts = raw.split("\t");
      if (tabParts.length >= 2) {
        name = tabParts[0].trim();
        priceStr = tabParts[1].trim();
      } else {
        errors.push({ line: i + 1, raw, reason: "Could not find comma or tab separator" });
        continue;
      }
    }

    if (!name) {
      errors.push({ line: i + 1, raw, reason: "Empty player name" });
      continue;
    }

    const price = priceStr ? cleanPrice(priceStr) : null;
    if (price === null) {
      errors.push({ line: i + 1, raw, reason: `Invalid price: "${priceStr}"` });
      continue;
    }

    rows.push({
      source_name: name,
      cleaned_price: price,
    });
  }

  return { rows, errors };
}

export function parseCSVFile(file: File): Promise<ParseResult> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = e => {
      const text = e.target?.result as string;
      resolve(parseCSVText(text));
    };
    reader.onerror = () => reject(new Error("Failed to read file"));
    reader.readAsText(file);
  });
}

export function fmtPrice(p: number | null | undefined): string {
  if (!p) return "—";
  if (p >= 1_000_000) return `$${(p / 1_000_000).toFixed(3).replace(/\.?0+$/, "")}M`;
  if (p >= 1_000) return `$${(p / 1_000).toFixed(1)}k`;
  return `$${p}`;
}
