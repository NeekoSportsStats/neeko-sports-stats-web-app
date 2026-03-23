import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import type { MarketingPlayer } from "./types";

export default function useMarketingPlayers() {
  const [players, setPlayers] = useState<MarketingPlayer[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      setLoading(true);
      const { data } = await supabase
        .from("v_rankings_free")
        .select(
          "player_id, player_name, team, position, projection_final, ceiling_estimate, floor_estimate, consistency_score, form_rating, matchup_rating, upside_rating, risk_rating, projection_confidence, captain_score, neeko_rating, price, value_score, value_tag, value_tier, consistency_tier, price_tier, ai_recommendation"
        )
        .order("neeko_rating", { ascending: false })
        .limit(300);
      if (data) setPlayers(data as MarketingPlayer[]);
      setLoading(false);
    }
    load();
  }, []);

  return { players, loading };
}
