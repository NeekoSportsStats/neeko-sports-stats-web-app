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

// ── AFL team name lookup ─────────────────────────────────────────────────────

const AFL_TEAMS: Record<string, string> = {
  "ADELAIDE": "Adelaide",        "CROWS": "Adelaide",
  "BRISBANE": "Brisbane",        "LIONS": "Brisbane",
  "CARLTON": "Carlton",          "BLUES": "Carlton",
  "COLLINGWOOD": "Collingwood",  "PIES": "Collingwood", "MAGPIES": "Collingwood",
  "ESSENDON": "Essendon",        "BOMBERS": "Essendon",
  "FREMANTLE": "Fremantle",      "DOCKERS": "Fremantle",
  "GEELONG": "Geelong",          "CATS": "Geelong",
  "GOLD COAST": "Gold Coast",    "SUNS": "Gold Coast",
  "GWS": "GWS",                  "GIANTS": "GWS",
  "HAWTHORN": "Hawthorn",        "HAWKS": "Hawthorn",
  "MELBOURNE": "Melbourne",      "DEMONS": "Melbourne",
  "NORTH MELBOURNE": "North Melbourne", "KANGAROOS": "North Melbourne", "ROOS": "North Melbourne",
  "PORT ADELAIDE": "Port Adelaide", "POWER": "Port Adelaide",
  "RICHMOND": "Richmond",        "TIGERS": "Richmond",
  "ST KILDA": "St Kilda",        "SAINTS": "St Kilda",
  "SYDNEY": "Sydney",            "SWANS": "Sydney",
  "WEST COAST": "West Coast",    "EAGLES": "West Coast",
  "WESTERN BULLDOGS": "Western Bulldogs", "BULLDOGS": "Western Bulldogs", "DOGGIES": "Western Bulldogs",
};

const AFL_POSITIONS = ["DEF", "MID", "FWD", "RUC"];

function extractTeam(tokens: string[]): { team: string | null; remaining: string[] } {
  const upper = tokens.map(t => t.toUpperCase());

  // Try two-word team matches first (NORTH MELBOURNE, PORT ADELAIDE, etc.)
  for (let i = 0; i < upper.length - 1; i++) {
    const two = `${upper[i]} ${upper[i + 1]}`;
    if (AFL_TEAMS[two]) {
      return {
        team: AFL_TEAMS[two],
        remaining: [...tokens.slice(0, i), ...tokens.slice(i + 2)],
      };
    }
  }
  // Single-word team
  for (let i = 0; i < upper.length; i++) {
    if (AFL_TEAMS[upper[i]]) {
      return {
        team: AFL_TEAMS[upper[i]],
        remaining: [...tokens.slice(0, i), ...tokens.slice(i + 1)],
      };
    }
  }
  return { team: null, remaining: tokens };
}

function extractPosition(tokens: string[]): { position: string | null; remaining: string[] } {
  const upper = tokens.map(t => t.toUpperCase());

  // Multi-token positions like "DEF/MID", "MID/FWD"
  for (let i = 0; i < upper.length; i++) {
    if (/^(DEF|MID|FWD|RUC)(\/?(DEF|MID|FWD|RUC))*$/.test(upper[i])) {
      const position = upper[i].split("/").map(p => p.trim()).find(p => AFL_POSITIONS.includes(p)) ?? upper[i];
      return {
        position,
        remaining: [...tokens.slice(0, i), ...tokens.slice(i + 1)],
      };
    }
  }
  return { position: null, remaining: tokens };
}

// ── Raw AFL Fantasy paste parser ─────────────────────────────────────────────
//
// The AFL Fantasy site table looks like (when pasted raw):
//
//   Nick Daicos  MID  Collingwood  $1,182,000
//   Zach Merrett  MID  Essendon  $956,000
//   ...
//
// But it can also come in garbled/merged forms. We anchor on the price ($NNN,NNN)
// and work backwards to extract name, position, team.

export function parseRawFantasyText(text: string): ParseResult {
  const rows: ParsedPriceRow[] = [];
  const errors: ParseError[] = [];

  if (!text.trim()) return { rows, errors };

  // Normalise the text: collapse multiple spaces/tabs to single space,
  // normalise newlines, strip zero-width chars
  const normalised = text
    .replace(/\r\n/g, "\n")
    .replace(/\r/g, "\n")
    .replace(/[^\S\n]+/g, " ")         // collapse horizontal whitespace
    .replace(/\u00a0/g, " ")           // non-breaking spaces
    .replace(/[\u200b\u200c\u200d\ufeff]/g, "") // zero-width chars
    .trim();

  // Strategy: split by price pattern as anchor
  // Each price ($nnn,nnn) terminates a player record
  // Regex: matches $NNN,NNN or $N,NNN,NNN (1 or 2 groups of 3 digits after first)
  const PRICE_RE = /\$[1-9]\d{0,2}(?:,\d{3}){1,2}/g;

  const priceMatches: Array<{ match: string; index: number }> = [];
  let m: RegExpExecArray | null;
  PRICE_RE.lastIndex = 0;
  while ((m = PRICE_RE.exec(normalised)) !== null) {
    priceMatches.push({ match: m[0], index: m.index });
  }

  if (priceMatches.length === 0) {
    // No prices found — fall back to line-by-line CSV parse
    return parseCSVText(text);
  }

  // Build segments: text from previous price end to current price (inclusive)
  const segments: string[] = [];
  let cursor = 0;
  for (const pm of priceMatches) {
    const segEnd = pm.index + pm.match.length;
    const seg = normalised.slice(cursor, segEnd).trim();
    if (seg) segments.push(seg);
    cursor = segEnd;
  }
  // Handle trailing text (non-price rows at end)
  const trailing = normalised.slice(cursor).trim();
  if (trailing) {
    // trailing may have partial info — skip it
  }

  for (let si = 0; si < segments.length; si++) {
    const seg = segments[si];

    // Extract price from this segment (always the last price in it)
    const segPriceMatch = seg.match(/\$[1-9]\d{0,2}(?:,\d{3}){1,2}$/);
    if (!segPriceMatch) {
      errors.push({ line: si + 1, raw: seg.slice(0, 60), reason: "No price found in segment" });
      continue;
    }

    const price = cleanPrice(segPriceMatch[0]);
    if (price === null) {
      errors.push({ line: si + 1, raw: seg.slice(0, 60), reason: `Invalid price: ${segPriceMatch[0]}` });
      continue;
    }

    // Text before price
    const beforePrice = seg.slice(0, seg.lastIndexOf(segPriceMatch[0])).trim();
    if (!beforePrice) {
      errors.push({ line: si + 1, raw: seg.slice(0, 60), reason: "No player info before price" });
      continue;
    }

    // Tokenise beforePrice — split by whitespace and newlines
    let tokens = beforePrice.split(/[\s\n]+/).filter(Boolean);

    // Remove leading rank/number tokens like "1", "23", "123."
    while (tokens.length > 0 && /^\d+\.?$/.test(tokens[0])) {
      tokens = tokens.slice(1);
    }

    // Remove known junk tokens (e.g. avg score columns, % owned)
    tokens = tokens.filter(t => !/^\d+(\.\d+)?%?$/.test(t) || /^\d{4,}$/.test(t));

    // Extract position
    const posResult = extractPosition(tokens);
    const position = posResult.position;
    tokens = posResult.remaining;

    // Extract team
    const teamResult = extractTeam(tokens);
    const team = teamResult.team;
    tokens = teamResult.remaining;

    // Remaining tokens = player name
    // Validate: must have at least 2 tokens for a valid name
    const name = tokens.join(" ").trim();

    // Filter out obvious non-name leftovers (single chars, pure numbers)
    const cleanedName = name.replace(/\s+/g, " ").trim();
    if (!cleanedName || cleanedName.length < 2) {
      errors.push({ line: si + 1, raw: seg.slice(0, 60), reason: "Could not extract player name" });
      continue;
    }

    // Final sanity: name should have at least one letter
    if (!/[A-Za-z]/.test(cleanedName)) {
      errors.push({ line: si + 1, raw: seg.slice(0, 60), reason: `Name looks invalid: "${cleanedName}"` });
      continue;
    }

    rows.push({
      source_name: cleanedName,
      cleaned_price: price,
      position,
      team,
    });
  }

  return { rows, errors };
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
