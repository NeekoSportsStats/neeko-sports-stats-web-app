import { supabase } from "@/integrations/supabase/client";

export async function getLatestCompletedRound(season: number): Promise<number> {
  const { data, error } = await supabase
    .schema("afl")
    .from("latest_completed_round")
    .select("round_number")
    .eq("season", season)
    .maybeSingle();

  if (error) {
    throw new Error(`Failed to fetch latest completed round: ${error.message}`);
  }

  if (!data) {
    throw new Error(
      `No completed round found for season ${season}. Please ensure the afl.latest_completed_round table is populated.`
    );
  }

  return data.round_number;
}
