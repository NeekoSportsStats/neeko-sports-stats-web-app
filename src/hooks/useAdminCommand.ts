import { supabase } from "@/lib/supabaseClient";

export interface CommandResponse {
  success: boolean;
  result?: unknown;
  error?: string;
  duration_ms?: number;
  log_id?: string;
}

export async function runCommand(command: string, payload?: Record<string, unknown>): Promise<CommandResponse> {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) {
    return { success: false, error: "Not authenticated" };
  }

  const url = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/admin-command`;

  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${session.access_token}`,
      "Content-Type": "application/json",
      "apikey": import.meta.env.VITE_SUPABASE_ANON_KEY,
    },
    body: JSON.stringify({ command, payload }),
  });

  const data = await res.json() as CommandResponse;
  return data;
}

export function useAdminCommand() {
  return { runCommand };
}
