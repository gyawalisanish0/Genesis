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
│ [All][Hunter][Ranger][Caster][Warrior]…  │  48dp      class filter tabs (scrollable)
├──────────────────────────────────────────┤  y=104
│ Rarity: [All][★][★★][★★★][★★★★][★★★★★] │  40dp      rarity filter chips
├──────────────────────────────────────────┤  y=144
│ ┌─────────────┐  ┌─────────────┐         │
│ │  [portrait] │  │  [portrait] │         │  row 1
│ │  Iron Warden│  │  Swift Veil │         │  192dp per row
│ │  Warrior ★★★│  │  Hunter ★★  │         │
│ │  [EQUIPPED] │  │             │         │
│ └─────────────┘  └─────────────┘         │
├──────────────────────────────────────────┤
│ ┌─────────────┐  ┌─────────────┐         │
│ │  [portrait] │  │  [🔒 locked]│         │  row 2
│ │  …          │  │  ???        │         │  192dp per row
│ └─────────────┘  └─────────────┘         │
│        (scrollable grid continues)       │
└──────────────────────────────────────────┘  y=640
```

---

## Zone Breakdown

| Zone | Y | Height | Content |
|---|---|---|---|
| Header | 0 | 56 | Back button · "ROSTER" title · search icon |
| Class filter | 56 | 48 | Horizontal scroll tab row — one tab per class + "All" |
| Rarity filter | 104 | 40 | Horizontal scroll chip row — rarity stars + "All" |
| Card grid | 144 | 496 | 2-column scrollable grid of character cards |

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
| Tab bar | 360 × 48 | `$bg-panel`; horizontal scroll; bottom border 1dp `$bg-elevated` |
| Each tab | min 72 × 40 | `$t-label`; active: `$accent-genesis` text + 2dp bottom indicator; inactive: `$text-muted` |
| Tab labels | — | "All" · "Hunter" · "Ranger" · "Caster" · "Warrior" · "Enchanter" · "Guardian" |

### Rarity Filter

| Component | Size (dp) | Properties |
|---|---|---|
| Chip bar | 360 × 40 | `$bg-deep`; horizontal scroll; `$s-md` left padding |
| Each chip | 40 × 28 | `$r-pill`; inactive `$bg-elevated`; active `$accent-genesis` fill; star count `$t-micro` |

### Character Card

```
┌───────────────────────────────┐  156 × 192 dp
│  ╔═══════════════════════╗    │
│  ║   [portrait 96×96]   ║    │  96dp portrait (centered)
│  ╚═══════════════════════╝    │
│  Iron Warden                  │  $t-subheading
│  Warrior  · ★★★              │  $t-label  $text-secondary
│  ████████████░░  HP 1200      │  HP bar 6dp
│  [EQUIPPED]                   │  status chip (optional)
└───────────────────────────────┘
```

| Component | Size (dp) | Properties |
|---|---|---|
| Card bg | 156 × 192 | `$bg-card` `$r-md`; rarity-coloured left border 3dp |
| Portrait | 96 × 96 | `UnitPortrait lg`; centered horizontally; top pad 12dp |
| Name label | 140 × 20 | `$t-subheading`, `$text-primary`; 8dp from portrait bottom |
| Class · rarity | 140 × 16 | `$t-label`, `$text-secondary` |
| HP bar | 140 × 6 | `ResourceBar HP` |
| Status chip | 72 × 20 | `$r-sm` `$accent-genesis` bg; "EQUIPPED" / "IN BATTLE" `$t-micro` `$text-on-accent` |
| Locked overlay | 156 × 192 | `$bg-deep` 80% opacity; 🔒 icon 40dp centered; "???" name |

Card gap: `$s-sm` (8 dp) both axes.
Grid side padding: 16 dp → usable width 328 dp → 2 × 156 dp + 8 dp gap + 8 dp remaining (4 dp each side).

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

## States

| State | Description |
|---|---|
| Default | All owned characters, sorted by rarity desc then name |
| Filtered | Class and/or rarity filters applied; empty state if none match |
| Search active | Name-match filter overlaid on current class/rarity filter |
| Empty | "No characters match" illustration + message centered in grid area |
| Pre-Battle mode | Cards have a selection checkbox; "Select up to N" hint in header |

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
