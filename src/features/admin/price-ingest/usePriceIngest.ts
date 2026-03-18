import { useState, useCallback } from "react";
import { supabase } from "@/lib/supabaseClient";
import type { ParsedPriceRow, PreviewRow, IngestResult } from "./types";

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

export function usePriceIngest() {
  const [previewing, setPreviewing] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [previewRows, setPreviewRows] = useState<PreviewRow[] | null>(null);
  const [ingestResult, setIngestResult] = useState<IngestResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const preview = useCallback(async (rows: ParsedPriceRow[]) => {
    setError(null);
    setPreviewing(true);
    try {
      const result = await callAdminCommand("preview_price_ingest", { rows });
      setPreviewRows(result as PreviewRow[]);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Preview failed");
    } finally {
      setPreviewing(false);
    }
  }, []);

  const confirm = useCallback(async (rows: ParsedPriceRow[]) => {
    setError(null);
    setConfirming(true);
    try {
      const result = await callAdminCommand("process_price_ingest", { rows });
      setIngestResult(result as IngestResult);
      return result as IngestResult;
    } catch (e) {
      setError(e instanceof Error ? e.message : "Insert failed");
      return null;
    } finally {
      setConfirming(false);
    }
  }, []);

  const reset = useCallback(() => {
    setPreviewRows(null);
    setIngestResult(null);
    setError(null);
  }, []);

  return { preview, confirm, reset, previewing, confirming, previewRows, ingestResult, error };
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
