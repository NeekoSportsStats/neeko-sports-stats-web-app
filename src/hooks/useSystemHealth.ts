import { useState, useCallback, useEffect, useRef } from "react";
import { supabase } from "@/lib/supabaseClient";

export interface PipelineData {
  last_run_id: string | null;
  status: string | null;
  label: string | null;
  started_at: string | null;
  finished_at: string | null;
  duration_ms: number | null;
  total_tasks: number;
  completed_tasks: number;
  current_step: string | null;
}

export interface PipelineStep {
  step_name: string;
  step_label: string;
  status: string;
  started_at: string | null;
  completed_at: string | null;
  duration_ms: number | null;
  error: string | null;
}

export interface IngestionData {
  games_raw_count: number;
  games_2026_count: number;
  player_stats_count: number;
  player_stats_2026: number;
  last_stat_week: number | null;
  last_game_date: string | null;
  ingest_log_count: number;
  last_ingest_at: string | null;
  ingest_errors: number;
  seasons_covered: number[] | null;
}

export interface AIStats {
  rankings_cache_rows: number;
  rankings_with_ai: number;
  rankings_with_reco: number;
  rankings_cache_refreshed_at: string | null;
  projection_rows: number;
  projection_refreshed_at: string | null;
  command_log_rows: number;
  commands_last_24h: number;
  commands_success_24h: number;
  commands_error_24h: number;
  last_command_at: string | null;
}

export interface DataFreshness {
  unique_players_2026: number;
  unique_players_all: number;
  latest_round: number | null;
  total_stat_rows: number;
  players_in_roster: number;
  players_with_projection: number;
  players_missing_projection: number;
  rankings_cache_age_mins: number | null;
  projection_age_mins: number | null;
}

export interface DbCounts {
  players: number;
  teams: number;
  games_raw: number;
  raw_player_stats: number;
  player_projection: number;
  player_rankings_cache: number;
  pipeline_runs: number;
  pipeline_steps: number;
  command_logs: number;
  mv_edge_board: number;
  projection_accuracy: number;
  start_sit_cache: number;
  afl_2026_roster: number;
}

export interface RecentError {
  id: string;
  command: string;
  status: string;
  error: string | null;
  duration_ms: number | null;
  created_at: string;
}

export interface SystemHealthData {
  pipeline: PipelineData;
  pipeline_steps: PipelineStep[];
  ingestion: IngestionData;
  ai_stats: AIStats;
  data_freshness: DataFreshness;
  db_counts: DbCounts;
  recent_errors: RecentError[];
  generated_at: string;
}

export interface SystemHealthState {
  data: SystemHealthData | null;
  loading: boolean;
  error: string | null;
  lastRefreshed: Date | null;
}

export function useSystemHealth() {
  const [state, setState] = useState<SystemHealthState>({
    data: null,
    loading: true,
    error: null,
    lastRefreshed: null,
  });
  const hasLoaded = useRef(false);

  const refresh = useCallback(async () => {
    setState(prev => ({ ...prev, loading: true, error: null }));
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error("Not authenticated");

      const url = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/admin-health`;
      const res = await fetch(url, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${session.access_token}`,
          "Content-Type": "application/json",
          apikey: import.meta.env.VITE_SUPABASE_ANON_KEY,
        },
      });

      const json = await res.json();
      if (!json.success) throw new Error(json.error ?? "Failed to fetch health data");

      setState({
        data: json.data as SystemHealthData,
        loading: false,
        error: null,
        lastRefreshed: new Date(),
      });
    } catch (err) {
      setState(prev => ({
        ...prev,
        loading: false,
        error: err instanceof Error ? err.message : "Unknown error",
      }));
    }
  }, []);

  useEffect(() => {
    if (hasLoaded.current) return;
    hasLoaded.current = true;
    refresh();
  }, [refresh]);

  return { ...state, refresh };
}
