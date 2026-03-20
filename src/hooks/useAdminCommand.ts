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

  console.log("Running command:", command);

  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${session.access_token}`,
      "Content-Type": "application/json",
      "apikey": import.meta.env.VITE_SUPABASE_ANON_KEY,
    },
    body: JSON.stringify({ command, payload }),
  });

  const raw = await res.json() as Record<string, unknown>;

  const success = raw.ok === true || raw.success === true;
  if (success) {
    console.log("Command success:", command, `(${raw.duration_ms ?? "?"}ms)`);
  } else {
    console.error("Command failed:", command, raw.error ?? raw);
  }

  return {
    success,
    result: raw.result,
    error: typeof raw.error === "string" ? raw.error : undefined,
    duration_ms: typeof raw.duration_ms === "number" ? raw.duration_ms : undefined,
    log_id: typeof raw.log_id === "string" ? raw.log_id : undefined,
  };
}

export function useAdminCommand() {
  return { runCommand };
}
