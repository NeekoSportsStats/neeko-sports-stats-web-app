import type { PlayerOption, MappingRow } from "./types";

export type MatchStatus =
  | "auto_matched"
  | "suggested"
  | "manual_required"
  | "pending_player_record";

export interface MatchResult {
  status: MatchStatus;
  confidence: number;
  player_id: number | null;
  player_name: string | null;
  suggestions: PlayerOption[];
}

function normalize(s: string): string {
  return s.toUpperCase().trim().replace(/[^A-Z0-9\s]/g, "");
}

interface ParsedName {
  initial: string;
  surname: string;
  raw: string;
}

function parseName(sourceName: string): ParsedName | null {
  const cleaned = sourceName.trim();
  const parts = cleaned.split(/\s+/);
  if (parts.length < 2) return null;

  const initial = parts[0].replace(/\./g, "").toUpperCase().charAt(0);
  const surname = parts.slice(1).join(" ").toUpperCase().replace(/[^A-Z\s]/g, "").trim();

  if (!initial || !surname) return null;
  return { initial, surname, raw: cleaned };
}

function parsePlayerName(playerName: string): { initial: string; surname: string } | null {
  const parts = playerName.trim().split(/\s+/);
  if (parts.length < 2) return null;

  const initial = parts[0].toUpperCase().charAt(0);
  const surname = parts.slice(1).join(" ").toUpperCase().replace(/[^A-Z\s]/g, "").trim();

  return { initial, surname };
}

export function matchPlayer(sourceName: string, players: PlayerOption[]): MatchResult {
  const parsed = parseName(sourceName);

  if (!parsed) {
    return {
      status: "pending_player_record",
      confidence: 0,
      player_id: null,
      player_name: null,
      suggestions: [],
    };
  }

  const { initial, surname } = parsed;

  const exactSurnameInitial: PlayerOption[] = [];
  const exactSurnameOnly: PlayerOption[] = [];

  for (const p of players) {
    const pp = parsePlayerName(p.player_name);
    if (!pp) continue;

    const surnameMatch = pp.surname === surname;
    const initialMatch = pp.initial === initial;

    if (surnameMatch && initialMatch) {
      exactSurnameInitial.push(p);
    } else if (surnameMatch) {
      exactSurnameOnly.push(p);
    }
  }

  if (exactSurnameInitial.length === 1) {
    return {
      status: "auto_matched",
      confidence: 97,
      player_id: exactSurnameInitial[0].player_id,
      player_name: exactSurnameInitial[0].player_name,
      suggestions: [],
    };
  }

  if (exactSurnameInitial.length > 1) {
    return {
      status: "suggested",
      confidence: 75,
      player_id: null,
      player_name: null,
      suggestions: exactSurnameInitial.slice(0, 5),
    };
  }

  if (exactSurnameOnly.length >= 1) {
    return {
      status: "suggested",
      confidence: 60,
      player_id: null,
      player_name: null,
      suggestions: exactSurnameOnly.slice(0, 5),
    };
  }

  const partialSurname = players.filter(p => {
    const pp = parsePlayerName(p.player_name);
    return pp && pp.surname.startsWith(surname.slice(0, 4));
  });

  if (partialSurname.length > 0) {
    return {
      status: "manual_required",
      confidence: 35,
      player_id: null,
      player_name: null,
      suggestions: partialSurname.slice(0, 5),
    };
  }

  return {
    status: "pending_player_record",
    confidence: 0,
    player_id: null,
    player_name: null,
    suggestions: [],
  };
}

export function applyAutoMatch(
  rows: MappingRow[],
  players: PlayerOption[],
): Array<MappingRow & { match_status: MatchStatus; confidence: number; suggestions: PlayerOption[] }> {
  return rows.map(row => {
    const result = matchPlayer(row.source_name, players);

    if (result.status === "auto_matched") {
      return {
        ...row,
        player_id: result.player_id,
        player_name: result.player_name,
        match_status: result.status,
        confidence: result.confidence,
        suggestions: result.suggestions,
      };
    }

    return {
      ...row,
      match_status: result.status,
      confidence: result.confidence,
      suggestions: result.suggestions,
    };
  });
}
