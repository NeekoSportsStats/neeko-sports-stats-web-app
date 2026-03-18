import { useState, useCallback, useEffect } from "react";
import { supabase } from "@/lib/supabaseClient";
import type { MappingRow, IngestByIdResult, PlayerOption } from "./types";

async function callAdminCommand(command: string, payload: Record<string, unknown>) {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) throw new Error("Not authenticated");

  const url = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/admin-command`;
  const res = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${session.access_token}`,
      "Content-Type": "application/json",
      apikey: import.meta.env.VITE_SUPABASE_ANON_KEY,
    },
    body: JSON.stringify({ command, payload }),
  });
  const json = await res.json();
  if (!json.success) throw new Error(json.error ?? "Command failed");
  return json.result;
}

export function usePlayerOptions(): PlayerOption[] {
  const [players, setPlayers] = useState<PlayerOption[]>([]);

  useEffect(() => {
    supabase
      .schema("afl" as never)
      .from("players" as never)
      .select("player_id,player_name,position_group")
      .eq("active" as never, true)
      .order("player_name" as never)
      .limit(1500)
      .then(({ data }) => {
        if (data) setPlayers(data as unknown as PlayerOption[]);
      });
  }, []);

  return players;
}

export function useCommitPrices() {
  const [committing, setCommitting] = useState(false);

  const commitPrices = useCallback(async (rows: MappingRow[]): Promise<IngestByIdResult | null> => {
    setCommitting(true);
    try {
      const payload = rows
        .filter(r => r.player_id !== null)
        .map(r => ({ player_id: r.player_id, cleaned_price: r.cleaned_price }));

      const result = await callAdminCommand("commit_price_ingest", { rows: payload });
      return result as IngestByIdResult;
    } catch {
      return null;
    } finally {
      setCommitting(false);
    }
  }, []);

  return { committing, commitPrices };
}

export function useSavePending() {
  const [saving, setSaving] = useState(false);

  const savePending = useCallback(async (
    rows: MappingRow[],
  ): Promise<{ saved: number; total: number } | null> => {
    setSaving(true);
    try {
      const payload = rows.map(r => ({
        source_name: r.source_name,
        manual_input_name: r.manual_input_name ?? null,
        cleaned_price: r.cleaned_price,
      }));
      const result = await callAdminCommand("save_pending_players", { rows: payload });
      return result as { saved: number; total: number };
    } catch {
      return null;
    } finally {
      setSaving(false);
    }
  }, []);

  return { saving, savePending };
}

export async function resolvePlayerName(
  normalizedName: string,
  playerId: number,
): Promise<{ success: boolean; error?: string }> {
  try {
    await callAdminCommand("resolve_player_name", {
      normalized_name: normalizedName,
      player_id: playerId,
    });
    return { success: true };
  } catch (e) {
    return { success: false, error: e instanceof Error ? e.message : "Failed" };
  }
}
