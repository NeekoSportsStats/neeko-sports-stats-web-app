import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabaseClient";

interface SparklineConfig {
  sport: "afl" | "nba" | "epl";
  playerName: string;
  statKey?: string;
}

const STAT_DEFAULTS = {
  afl: "fantasy_points",
  nba: "points",
  epl: "rating"
};

export const usePlayerSparkline = ({ sport, playerName, statKey }: SparklineConfig) => {
  const [sparklineData, setSparklineData] = useState<number[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchSparklineData();
  }, [sport, playerName, statKey]);

  const fetchSparklineData = async () => {
    if (!playerName) {
      setSparklineData([]);
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      const defaultStat = statKey || STAT_DEFAULTS[sport];
      let data: any[] = [];

      if (sport === "afl") {
        const { data: aflData, error } = await supabase
          .from("afl_player_stats")
          .select(`${defaultStat}, round_order`)
          .eq("player", playerName)
          .order("round_order", { ascending: true });
        
        if (error) throw error;
        data = aflData || [];
      } else if (sport === "nba") {
        const nameParts = playerName.split(" ");
        if (nameParts.length >= 2) {
          const firstName = nameParts[0];
          const lastName = nameParts.slice(1).join(" ");
          const { data: nbaData, error } = await supabase
            .from("nba_player_stats")
            .select(`${defaultStat}, game_id`)
            .eq("player_firstname", firstName)
            .eq("player_lastname", lastName)
            .order("game_id", { ascending: true });
          
          if (error) throw error;
          data = nbaData || [];
        }
      } else if (sport === "epl") {
        const { data: eplData, error } = await supabase
          .from("epl_player_stats")
          .select(`${defaultStat}, fixture_id`)
          .eq("player_name", playerName)
          .order("fixture_id", { ascending: true });
        
        if (error) throw error;
        data = eplData || [];
      }

      if (data && data.length > 0) {
        // Clean and parse data
        const cleanData = data
          .map((row: any) => {
            const value = row[defaultStat];
            // Handle different data types
            if (typeof value === "number") return value;
            if (typeof value === "string") {
              const parsed = parseFloat(value);
              return isNaN(parsed) ? null : parsed;
            }
            return null;
          })
          .filter((v): v is number => v !== null && !isNaN(v) && isFinite(v));

        setSparklineData(cleanData);
      } else {
        setSparklineData([]);
      }
    } catch (error) {
      console.error(`Error fetching ${sport} sparkline for ${playerName}:`, error);
      setSparklineData([]);
    } finally {
      setLoading(false);
    }
  };

  return { sparklineData, loading, hasData: sparklineData.length >= 2 };
};
