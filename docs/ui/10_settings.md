# Screen: Settings

## Purpose

Player preferences: audio volumes, display options, notification toggles,
account management links, and app information. All settings persist via the
save service. No gameplay-affecting options live here.

---

## Entry / Exit

| | Screen |
|---|---|
| **Entry from** | Main Menu (Settings icon or SETTINGS button) |
| **Exit to** | Main Menu (back) |

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
│  ← [back]         SETTINGS              │  56dp   header
├──────────────────────────────────────────┤  y=56
│                                          │
│  AUDIO                                   │  24dp   section header
│  ┌────────────────────────────────────┐  │
│  │ Music Volume      [════════░░]  80 │  │  48dp   slider row
│  │ SFX Volume        [═══════░░░]  70 │  │  48dp
│  │ Mute All                    [ ●  ]│  │  48dp   toggle
│  └────────────────────────────────────┘  │
│                                          │
│  DISPLAY                                 │  24dp   section header
│  ┌────────────────────────────────────┐  │
│  │ Reduce Animations           [ ○  ]│  │  48dp   toggle
│  │ Show Damage Numbers         [ ●  ]│  │  48dp
│  │ Timeline Zoom     [═══░░░░░░]  30 │  │  48dp   slider
│  └────────────────────────────────────┘  │
│                                          │
│  NOTIFICATIONS                           │  24dp   section header
│  ┌────────────────────────────────────┐  │
│  │ Battle Reminders            [ ●  ]│  │  48dp
│  │ New Content Alerts          [ ○  ]│  │  48dp
│  └────────────────────────────────────┘  │
│                                          │
│  ACCOUNT                                 │  24dp   section header
│  ┌────────────────────────────────────┐  │
│  │ Sync / Cloud Save                 →│  │  48dp   nav row
│  │ Restore Purchases                 →│  │  48dp
│  │ Privacy Policy                    →│  │  48dp
│  │ Terms of Service                  →│  │  48dp
│  └────────────────────────────────────┘  │
│                                          │
│  Genesis  v0.1.0  ·  Build 001           │  32dp   version footer
└──────────────────────────────────────────┘  y=640  (scrollable)
```

---

## Zone Breakdown

All content is a **single scrollable column** below the sticky header.

| Zone | Y | Height | Content |
|---|---|---|---|
| Header | 0 | 56 | Back button + "SETTINGS" title |
| Audio section | 56 | 168 | Music · SFX sliders + Mute toggle |
| Display section | 224 | 168 | Animations · Damage numbers toggles + Timeline zoom |
| Notifications | 392 | 120 | Two notification toggles |
| Account | 512 | 200 | Four nav rows |
| Version footer | 712+ | 32 | App version + build (scrollable) |

---

## Component Specifications

### Header

| Component | Size (dp) | Properties |
|---|---|---|
| Header bg | 360 × 56 | `$bg-panel`; bottom border 1dp `$bg-elevated`; sticky |
| Back button | 48 × 48 | 4, 4 |
| Title | — | center x, 20 | "SETTINGS" `$t-subheading` |

### Section Header

| Component | Size (dp) | Properties |
|---|---|---|
| Label | 328 × 24 | `$t-label` `$text-muted`; uppercase letter-spacing 2sp; 16dp left pad |

### Slider Row

```
│ Music Volume          [══════════░░]  80  │
│ label 14sp            slider 160dp   val  │
```

| Component | Size (dp) | Position | Properties |
|---|---|---|---|
| Row bg | 328 × 48 | 16, y | `$bg-card` `$r-md`; 16dp horizontal padding |
| Label | 140 × 16 | 16, y+16 | `$t-body` `$text-primary` |
| Slider track | 120 × 4 | 164, y+22 | `$bg-elevated` `$r-pill` |
| Slider fill | dynamic × 4 | 164, y+22 | `$accent-genesis` |
| Thumb | 24 × 24 | track-fill-end − 12, y+10 | `$accent-genesis` circle; touch target padded to 48×48 |
| Value label | 32 × 16 | 308, y+16 | `$t-label` `$text-secondary` right-aligned |

### Toggle Row

```
│ Mute All                          [ ●  ]  │
│ label 14sp                   toggle 48dp  │
```

| Component | Size (dp) | Position | Properties |
|---|---|---|---|
| Row bg | 328 × 48 | 16, y | `$bg-card` `$r-md` |
| Label | 240 × 16 | 32, y+16 | `$t-body` `$text-primary` |
| Toggle track | 44 × 24 | 268, y+12 | `$r-pill`; on: `$accent-genesis`; off: `$bg-elevated` |
| Toggle thumb | 20 × 20 | track-x+2 (off) or track-x+22 (on), y+14 | White circle; animates 150ms ease |

Touch target for toggle: 48 × 48 dp (extends beyond visible track).

### Navigation Row

```
│ Privacy Policy                          → │
│ label 14sp                       chevron  │
```

| Component | Size (dp) | Properties |
|---|---|---|
| Row bg | 328 × 48 | `$bg-card` `$r-md`; `$bg-elevated` on press |
| Label | 280 × 16 | `$t-body` `$text-primary` |
| Chevron | 16 × 16 | `→` or `›`; `$text-muted`; right edge 12dp |

---

## Grouping Within Sections

Rows within each section share a single `$bg-card` rounded container. Top and
bottom corners are only rounded on the first and last row respectively:

```
  ╭──────────────────────────────────────╮  ← $r-md top corners only
  │  Row 1                               │
  ├──────────────────────────────────────┤  ← 1dp divider $bg-elevated
  │  Row 2                               │
  ├──────────────────────────────────────┤
  │  Row 3                               │
  ╰──────────────────────────────────────╯  ← $r-md bottom corners only
```

---

## States

| State | Description |
|---|---|
| Mute All ON | Music and SFX sliders dim to 40% and become non-interactive |
| Reduce Animations ON | Damage numbers and timeline animations disabled in battle |
| Notifications OFF | System permission prompt shown on first toggle-on |

---

## Interactions

| Action | Result |
|---|---|
| Drag slider thumb | Update value in real time; save on release |
| Tap toggle | Flip state; save immediately |
| Tap nav row | Open external link (Privacy, ToS) or sub-screen (Sync, Restore) |
| Tap back | Return to Main Menu; all changes already persisted |
| Scroll | Vertical scroll; header sticks |

---

## Version Footer

| Component | Size (dp) | Properties |
|---|---|---|
| Footer label | 328 × 16 | `$t-micro` `$text-muted`; centered; "Genesis v0.1.0 · Build 001" |
| Long-press footer | — | Dev debug panel (Phase 3 only; hidden in release builds) |
