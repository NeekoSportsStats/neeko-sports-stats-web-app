export interface ParsedPriceRow {
  source_name: string;
  cleaned_price: number;
}

export interface PreviewRow {
  source_name: string;
  normalized_name: string;
  cleaned_price: number;
  player_id: number | null;
  player_name: string | null;
  existing_price: number | null;
  status: "matched" | "duplicate" | "unmatched";
}

export interface PlayerOption {
  player_id: number;
  player_name: string;
  position_group: string | null;
}

export type MatchStatus =
  | "auto_matched"
  | "suggested"
  | "manual_required"
  | "pending_player_record"
  | "manually_matched"
  | "manual_input";

export interface MappingRow {
  id: string;
  source_name: string;
  cleaned_price: number;
  player_id: number | null;
  player_name: string | null;
  manual_input_name: string | null;
  match_status: MatchStatus;
  confidence: number;
  suggestions: PlayerOption[];
}

export interface IngestByIdResult {
  inserted: number;
  skipped_dup: number;
  total: number;
}

export interface IngestResult {
  inserted: number;
  skipped_dup: number;
  unmatched: number;
  total: number;
}

export interface UnmatchedRow {
  id: string;
  source_name: string;
  normalized_source_name: string;
  example_price: number | null;
  resolved: boolean;
  resolved_player_id: number | null;
  created_at: string;
}
