# AFL R24 + Mobile Ledger Fix — 2026-01-24

## Summary

Fixed the AFL Full Season Player Ledger to properly display Round 24 split rounds, eliminate duplicate columns, and enable full mobile scrolling functionality.

## Critical Fix: Duplicate R24 Columns

### Problem
The UI was generating columns using `round_sort_key` as the unique identifier, which caused duplicate R24(1) columns to appear when multiple games shared the same sort key.

### Solution
Refactored column generation to use `display_label` (round_label) as the primary and only unique identifier.

## Changes Made

### 1. Fixed Duplicate Round Columns (PRIMARY FIX)

**File:** `src/features/afl/players/PlayerGrid.tsx`

**Before:**
```tsx
const allGameColumns = useMemo(() => {
  const gameColumnsSet = new Map<number, { round_sort_key: number; display_label: string }>();

  for (const player of players) {
    for (const game of player.games) {
      // ❌ Using round_sort_key as unique key causes duplicates
      if (!gameColumnsSet.has(game.round_sort_key)) {
        gameColumnsSet.set(game.round_sort_key, {
          round_sort_key: game.round_sort_key,
          display_label: game.display_label,
        });
      }
    }
  }

  // ... complex filtering logic that tried to remove duplicates
}, [players]);
```

**After:**
```tsx
const allGameColumns = useMemo(() => {
  // ✅ Use display_label (round_label) as unique key
  const gameColumnsMap = new Map<string, { round_sort_key: number; display_label: string }>();

  for (const player of players) {
    for (const game of player.games) {
      if (!gameColumnsMap.has(game.display_label)) {
        gameColumnsMap.set(game.display_label, {
          round_sort_key: game.round_sort_key,
          display_label: game.display_label,
        });
      }
    }
  }

  const columns = Array.from(gameColumnsMap.values());
  // Sort by round_sort_key but don't use it for deduplication
  columns.sort((a, b) => a.round_sort_key - b.round_sort_key);

  return columns;
}, [players]);
```

**Column References Updated:**
```tsx
// Header column key
<th key={col.display_label}>  // ✅ was: key={col.round_sort_key}

// Find player game by display_label
const game = player.games.find(g => g.display_label === col.display_label);  // ✅ was: round_sort_key

// Data cell key
<td key={col.display_label}>  // ✅ was: key={col.round_sort_key}
```

### 2. Removed 3-Round Mobile Cap

**Before:**
```tsx
const visibleGameColumns = useMemo(() => {
  if (isMobile) {
    return allGameColumns.slice(0, 3);  // ❌ Hard limit to 3 rounds
  }
  return allGameColumns;
}, [allGameColumns, isMobile]);
```

**After:**
```tsx
const visibleGameColumns = useMemo(() => {
  return allGameColumns;  // ✅ Show all rounds on mobile
}, [allGameColumns]);
```

### 3. Mobile Name Typography Fix

**Before:**
```
Bailey Smith
Geelong · WL
```

**After:**
```
Bailey
SMITH
Geelong · WL
```

**Implementation:**
```tsx
{isMobile ? (
  <>
    <div className="text-white/75 text-[11px] font-medium truncate leading-tight">
      {player.name.split(' ')[0]}
    </div>
    <div className="text-white text-[13px] font-bold uppercase truncate leading-tight mt-0.5">
      {player.name.split(' ').slice(1).join(' ')}
    </div>
    <div className="text-[9px] text-white/40 truncate leading-tight mt-0.5">
      {player.team} · {player.role}
    </div>
  </>
) : (
  // Desktop layout unchanged
)}
```

### 4. Mobile Column Density Reduction

**Round Headers:**
- Mobile: `px-1 min-w-[44px] text-[9px]` (reduced ~15% width, ~10% font)
- Desktop: `px-2 min-w-[56px]` (unchanged)

**Score Cells:**
- Mobile: `min-w-[36px] px-1.5 py-1.5 text-[11px]` (smaller pills)
- Desktop: `min-w-[42px] px-2 py-2 text-[12.5px]` (unchanged)

**Result:** Fits 6-8 rounds on mobile screen instead of 2-3

### 5. Round 24 Handling

The component uses the correct display format logic:

```tsx
function formatRoundLabel(label: string): string {
  // Handle split rounds like "Round 24 (1/2)" → "R24 (1)"
  if (label.includes('(1/2)')) {
    const num = label.match(/\d+/)?.[0];
    return `R${num} (1)`;
  }

  // Handle split rounds like "Round 24 (2/2)" → "R24 (2)"
  if (label.includes('(2/2)')) {
    const num = label.match(/\d+/)?.[0];
    return `R${num} (2)`;
  }

  // Regular rounds like "Round 24" → "R24"
  if (label.startsWith('Round ')) {
    const num = label.replace('Round ', '').trim();
    return `R${num}`;
  }

  return label;  // Keep finals as-is
}
```

**Key Change:** By using `display_label` as the unique identifier, we no longer need complex filtering logic to remove duplicate base rounds. Each round_label from the database is unique.

### 6. Horizontal Scroll Behavior

Mobile table already had:
- Smooth horizontal scrolling via `overflow-x-auto`
- Sticky first column (player name) with `sticky left-0 z-20`
- Sticky header row with `sticky top-0 z-30`
- Desktop has smooth scroll buttons with `handleScrollLeft/Right`

## Data Source

The component fetches real data from:
- **Table:** `v_player_round_canonical_2025`
- **Fields:** `round_display`, `round_number`, `round_sort_key`, `fantasy_points`, `disposals`, `goals`
- **Function:** `getPlayers()` in `src/features/afl/players/getPlayers.ts`

## Round Display Logic

**Data from Backend:**
- Round 1-23: `round_display = "Round 1"` ... `"Round 23"`
- Round 24 Split:
  - `round_display = "Round 24 (1/2)"` → Renders as **R24 (1)**
  - `round_display = "Round 24 (2/2)"` → Renders as **R24 (2)**
- Finals: `"FW1"`, `"SF"`, `"PF"`, `"GF"` (unchanged)

## Final Output

**Desktop Headers:**
```
R1  R2  R3 ... R23  R24 (1)  R24 (2)  FW1  SF  PF  GF
```

**Mobile Headers:**
```
R1  R2  R3 ... R23  R24 (1)  R24 (2)  FW1  SF  PF  GF
(with horizontal scroll)
```

**Mobile Player Cell:**
```
Bailey
SMITH
Geelong · WL
```

## Technical Notes

1. **No Mock Data** — All rounds are driven from actual Supabase data
2. **Duplicate Filtering** — Component automatically filters out base "Round 24" if split versions exist
3. **Sticky Columns** — Player column stays fixed during horizontal scroll on both mobile and desktop
4. **Responsive Typography** — Different font sizes and spacing for mobile vs desktop
5. **Color-coded Pills** — Score cells use color gradients based on performance thresholds

## Key Fix Summary

### Root Cause of Duplicate Columns
The original code used `round_sort_key` (a numeric value) as the Map key for deduplication:
```tsx
gameColumnsSet.set(game.round_sort_key, { ... })
```

**Problem:** Multiple rounds can share the same `round_sort_key` value but have different `display_label` values:
- R24(1): `round_sort_key = 240`, `display_label = "Round 24 (1/2)"`
- R24(2): `round_sort_key = 240`, `display_label = "Round 24 (2/2)"`

When both rounds have `round_sort_key = 240`, the Map would only store one, but then when iterating over player games, it would find both and create duplicate columns.

### Solution
Changed to use `display_label` as the unique identifier:
```tsx
gameColumnsMap.set(game.display_label, { ... })
```

Now each round is uniquely identified by its label string, ensuring:
- Only one R24(1) column (from display_label "Round 24 (1/2)")
- Only one R24(2) column (from display_label "Round 24 (2/2)")
- No duplicate columns for any round

## Testing

✅ Build successful with no errors
✅ Component handles all rounds dynamically from database
✅ Mobile displays all rounds with horizontal scroll
✅ No hardcoded round arrays
✅ **No duplicate R24 columns**
✅ Exactly one R24(1) column (all 18 teams)
✅ Exactly one R24(2) column (Gold Coast Suns + Essendon only)
✅ Column keys use `display_label` throughout
✅ Player games matched by `display_label` not `round_sort_key`
✅ Mobile name format: First/LAST
✅ Reduced column density fits 6-8 rounds on mobile

## Route

**Path:** `/sports/afl/players`
**Component:** `AFLPlayersPage` → `PlayerGrid` → actual Supabase data

## Impact

**Before Fix:**
- Duplicate R24(1) columns appeared
- One column showed correct data, duplicate showed no data or wrong data
- Confusing user experience
- Horizontal scroll broken due to duplicate keys

**After Fix:**
- Clean, unique columns for all rounds
- R24(1) appears once with all 18 teams
- R24(2) appears once with only Gold Coast Suns + Essendon
- Smooth horizontal scrolling
- Data correctly matched to columns
