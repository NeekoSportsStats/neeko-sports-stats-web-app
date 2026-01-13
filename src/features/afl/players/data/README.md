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

## getPositionTrendData

Fetches and calculates position-based trend analysis for the Position Trends section.

### Usage Example

```typescript
import { getPositionTrendData } from "@/features/afl/players/data/getPositionTrendData";

// In a React component
const fetchData = async () => {
  try {
    const data = await getPositionTrendData({
      season: 2025,
      stat: "fantasy"
    });

    // data.MID.hot = top 5 hot movers for midfielders
    // data.MID.cold = bottom 5 cooling players for midfielders
    setPositionData(data);
  } catch (error) {
    console.error("Failed to load Position Trends:", error);
  }
};
```

### Required Database Schema

This function uses the `public.afl_player_stats` table:

```sql
CREATE TABLE afl_player_stats (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  player TEXT NOT NULL,
  team TEXT,
  position TEXT,
  round_order INTEGER,
  disposals INTEGER DEFAULT 0,
  goals INTEGER DEFAULT 0,
  fantasy_points INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_afl_player_stats_player ON afl_player_stats(player);
CREATE INDEX idx_afl_player_stats_position ON afl_player_stats(position);
```

### Data Calculations

For each player, the function calculates:

1. **Last 5 Values**: Most recent 5 game statistics (ordered by round)
2. **Season Average**: Mean across all games in the season
3. **L5 Average**: Mean of last 5 games
4. **Delta vs Season**: Difference between L5 avg and season avg
5. **Volatility**: Standard deviation of last 5 games
6. **Stability Score**: 0-100 score based on consistency (100 = perfectly stable)
7. **Composite Score**: Delta × (0.3 + 0.7 × stability/100)

### Position Grouping

Players are grouped into four position categories:
- **MID**: Position string contains "MID"
- **FWD**: Position string contains "FWD"
- **DEF**: Position string contains "DEF"
- **RUC**: Position string contains "RUC"

Players can appear in multiple position groups if their position string contains multiple role types (e.g., "MID/FWD").

### Returns

```typescript
{
  MID: { hot: Player[], cold: Player[] },
  FWD: { hot: Player[], cold: Player[] },
  DEF: { hot: Player[], cold: Player[] },
  RUC: { hot: Player[], cold: Player[] }
}
```

- **hot**: Top 5 players sorted by composite score (descending)
- **cold**: Bottom 5 players sorted by composite score (ascending)

### Error Handling

Returns empty arrays for all positions if:
- The database table doesn't exist
- No data exists for the requested season
- Player has insufficient games (<3) for analysis

This graceful fallback allows the UI to display "Not enough data yet" messaging.
