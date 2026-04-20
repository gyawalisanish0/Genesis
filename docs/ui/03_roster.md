# Screen: Roster

## Purpose

Browse the player's full character collection. Filter by class or rarity,
search by name, and tap any character to open their detail view. Characters
not yet unlocked appear as locked silhouettes.

---

## Entry / Exit

| | Screen |
|---|---|
| **Entry from** | Main Menu (ROSTER button) · Pre-Battle Step 2 (team compose) |
| **Exit to** | Character Detail (tap card) · back to entry screen |

---

## Dimensions

```
Canvas     : 360 × 640 dp
Safe zone  : 360 × 568 dp
Side pad   : 16 dp
```

---

## Layout Schematic

```
┌──────────────────────────────────────────┐  y=0
│  ← [back]   ROSTER          [🔍 search] │  56dp      header
├──────────────────────────────────────────┤  y=56
│ [All][Hunter][Ranger][Caster][Warrior]…  │  40dp      class filter tabs (scrollable)
├──────────────────────────────────────────┤  y=96
│ Rarity: [All][★][★★][★★★][★★★★][★★★★★] │  36dp      rarity filter chips
├──────────────────────────────────────────┤  y=132
│ ┌──────┐ ┌──────┐ ┌──────┐               │
│ │[port]│ │[port]│ │[port]│   row 1        │  3-column paged grid
│ │ Name │ │ Name │ │ Name │               │  (~108dp per card)
│ │Class │ │Class │ │Class │               │
│ │ ★★★  │ │ ★★   │ │ ★★★★ │               │
│ └──────┘ └──────┘ └──────┘               │
│ ┌──────┐ ┌──────┐ ┌──────┐               │
│ │[port]│ │[port]│ │[port]│   row 2        │
│ │ …    │ │ …    │ │ …    │               │
│ └──────┘ └──────┘ └──────┘               │
│ ┌──────┐ ┌──────┐ ┌──────┐               │
│ │[port]│ │[port]│ │[port]│   row 3        │
│ └──────┘ └──────┘ └──────┘               │
├──────────────────────────────────────────┤
│   ‹     ● ○ ○     1/3     ›              │  48dp      pagination (hidden ≤9 chars)
└──────────────────────────────────────────┘  y=640
```

---

## Zone Breakdown

| Zone | Y | Height | Content |
|---|---|---|---|
| Header | 0 | 56 | Back button · "ROSTER" title · search icon |
| Class filter | 56 | 40 | Horizontal scroll tab row — one tab per class + "All" (reduced from 48dp) |
| Rarity filter | 96 | 36 | Horizontal scroll chip row — rarity stars + "All" |
| Card grid (PagedGrid) | 132 | 460 | 3×3 paged grid — 9 cards per page; swipe or arrows to paginate |
| Pagination | 592 | 48 | Arrow buttons + dot indicators + "N/M" counter (hidden when ≤9 total) |

---

## Component Specifications

### Header

| Component | Size (dp) | Position | Properties |
|---|---|---|---|
| Header bg | 360 × 56 | 0, 0 | `$bg-panel` |
| Back button | 48 × 48 | 4, 4 | `←` icon, `$text-primary`; taps navigate back |
| Title | — | center x, 20 | "ROSTER" `$t-subheading`, `$text-primary` |
| Search icon | 48 × 48 | 308, 4 | 🔍 icon button; opens inline search bar in header |

### Class Filter Tabs

| Component | Size (dp) | Properties |
|---|---|---|
| Tab bar | 360 × 40 | `$bg-panel`; horizontal scroll; bottom border 1dp `$bg-elevated` |
| Each tab | min 56 × 32 | `$t-micro`; active: `$accent-genesis` text + 2dp bottom indicator; inactive: `$text-muted` |
| Tab labels | — | "All" · "Hunter" · "Ranger" · "Caster" · "Warrior" · "Enchanter" · "Guardian" |

### Rarity Filter

| Component | Size (dp) | Properties |
|---|---|---|
| Chip bar | 360 × 36 | `$bg-deep`; horizontal scroll; `$s-sm` left padding |
| Each chip | 32 × 24 | `$r-pill`; inactive `$bg-elevated`; active `$accent-genesis` fill; star count `$t-micro` |

### Character Card (compact 3×3)

```
┌────────┐  ~108 × 125 dp (aspect 1:1.2)
│[port sm│  40×40dp portrait (centered)
│ 40×40] │
│  Name  │  $t-micro  $text-primary
│  Class │  $t-micro  $text-muted
│  ★★★   │  $t-micro  $accent-gold
└────────┘
```

| Component | Size (dp) | Properties |
|---|---|---|
| Card bg | ~108 × 125 (1:1.2 aspect) | `$bg-card` `$r-md` |
| Portrait | 40 × 40 | `UnitPortrait sm`; centered horizontally |
| Name label | full-width | `$t-micro`, `$text-primary`; truncate with ellipsis |
| Class | full-width | `$t-micro`, `$text-muted` |
| Rarity stars | full-width | `$t-micro`, `$accent-gold`; letter-spacing tight |

Card gap: `$s-xs` (4 dp) both axes. Grid padding: 8 dp. Data loaded from `DataService` via `useRosterData` hook.

---

## Inline Search State

When search icon is tapped the header transitions:

```
┌──────────────────────────────────────────┐
│  ×  [  search characters…         ]  🔍  │  56dp
└──────────────────────────────────────────┘
```

- Text input replaces title; real-time filter on name
- `×` clears search and restores normal header
- Filter tabs remain active below

---

## Data Source

Characters are loaded dynamically from `DataService` via the `useRosterData` hook:
1. `loadCharacterIndex()` → `string[]` of character IDs
2. `Promise.all(ids.map(loadCharacter))` → `CharacterDef[]`

Both calls use the in-memory cache — subsequent renders are instant. A loading state is shown while the first fetch is in progress.

---

## States

| State | Description |
|---|---|
| Loading | Spinner/message while `useRosterData` awaits DataService |
| Default | All real characters from index.json, shown in 3×3 paged grid |
| Filtered | Class and/or rarity filters applied; empty state if none match |
| Search active | Name-match filter overlaid on current class/rarity filter |
| Empty | "No characters match" message centered in grid area |

---

## Interactions

| Action | Result |
|---|---|
| Tap card (browse mode) | Navigate to Character Detail |
| Tap card (pre-battle mode) | Toggle selected; confirm button activates when ≥1 selected |
| Tap class tab | Filter grid to that class |
| Tap rarity chip | Filter grid to that rarity |
| Swipe card left | Quick-view stat summary (peek panel, 200dp tall from bottom) |
| Scroll grid | Smooth vertical scroll; header sticks |
