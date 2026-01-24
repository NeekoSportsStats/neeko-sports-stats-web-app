# AFL R24 + Mobile Ledger Fix — 2026-01-24

## Summary

Fixed the AFL Full Season Player Ledger to properly display Round 24 split rounds and enable full mobile scrolling functionality.

## Changes Made

### 1. Removed 3-Round Mobile Cap

**File:** `src/features/afl/players/PlayerGrid.tsx`

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

### 2. Mobile Name Typography Fix

**File:** `src/features/afl/players/PlayerGrid.tsx`

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

### 3. Mobile Column Density Reduction

**Round Headers:**
- Mobile: `px-1 min-w-[44px] text-[9px]` (reduced ~15% width, ~10% font)
- Desktop: `px-2 min-w-[56px]` (unchanged)

**Score Cells:**
- Mobile: `min-w-[36px] px-1.5 py-1.5 text-[11px]` (smaller pills)
- Desktop: `min-w-[42px] px-2 py-2 text-[12.5px]` (unchanged)

**Result:** Fits 6-8 rounds on mobile screen instead of 2-3

### 4. Round 24 Handling

The component already had correct logic for handling R24(1) and R24(2):

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

The component also filters out duplicate base rounds when split rounds exist (lines 173-197).

### 5. Horizontal Scroll Behavior

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

## Testing

✅ Build successful with no errors
✅ Component handles all rounds dynamically from database
✅ Mobile displays all rounds with horizontal scroll
✅ No hardcoded round arrays
✅ R24(1) and R24(2) display correctly
✅ Mobile name format: First/LAST
✅ Reduced column density fits 6-8 rounds on mobile

## Route

**Path:** `/sports/afl/players`
**Component:** `AFLPlayersPage` → `PlayerGrid` → actual Supabase data
