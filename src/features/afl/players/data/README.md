# AFL Players Data Layer

This directory contains data fetching functions for the AFL Players feature.

## getRoundSummaryData

Fetches and aggregates player statistics for the Round Summary section.

### Usage Example

```typescript
import { getRoundSummaryData } from "@/features/afl/players/data/getRoundSummaryData";
import { AFL_STAT_CONFIG } from "@/lib/stats/afl/statConfig";

// In a React component or loader
const fetchData = async () => {
  try {
    const data = await getRoundSummaryData({
      season: 2025,
      round: AFL_STAT_CONFIG.sportMeta.currentRound,
      stat: "fantasy"
    });

    setRoundSummaryData(data);
  } catch (error) {
    console.error("Failed to load Round Summary:", error);
  }
};
```

### Required Database Schema

This function expects a table named `afl_player_game_stats` with the following structure:

```sql
CREATE TABLE afl_player_game_stats (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  player_id UUID NOT NULL,
  player_name TEXT NOT NULL,
  season INTEGER NOT NULL,
  round INTEGER NOT NULL,
  fantasy NUMERIC DEFAULT 0,
  disposals INTEGER DEFAULT 0,
  goals INTEGER DEFAULT 0,
  kicks INTEGER DEFAULT 0,
  marks INTEGER DEFAULT 0,
  tackles INTEGER DEFAULT 0,
  hitouts INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_afl_player_stats_lookup
  ON afl_player_game_stats(season, round);
```

### Data Aggregations

The function calculates:

1. **Sparkline**: Average stat value per round over the last 8 rounds
2. **Top Scorer**: Player with the highest stat value in the current round
3. **Biggest Riser**: Player with the largest week-on-week improvement
4. **Most Consistent**: Player with the highest % of games above league average (last 10 games)

### Error Handling

The function will throw descriptive errors if:
- The database table doesn't exist
- No data exists for the requested season/round
- Required data for calculations is missing

**This is intentional.** The function fails loudly rather than returning partial or default data.
