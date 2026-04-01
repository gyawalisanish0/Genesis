# Screen: Main Menu

## Purpose

Hub screen between sessions. Provides navigation to all major modes: play,
roster management, mastery progression, and settings. Also surfaces currency
and user-level status at a glance.

---

## Entry / Exit

| | Screen |
|---|---|
| **Entry from** | Splash (auto), Battle Result (back), Settings (back) |
| **Exit to** | Pre-Battle, Roster, Mastery Road, Settings |

---

## Dimensions

```
Canvas     : 360 × 640 dp
Safe zone  : 360 × 568 dp  (24dp top · 48dp bottom)
Side pad   : 16 dp
```

---

## Layout Schematic

```
┌──────────────────────────────────────────┐  y=0
│  [⚙]  status bar (24dp)          [👤]   │  y=0..24   system
├──────────────────────────────────────────┤  y=24
│  [lv 14]  [Genesis]  [💎 2,450]  [⚙][👤]│  56dp      header bar
├──────────────────────────────────────────┤  y=80
│                                          │
│         ╔════════════════╗               │
│         ║  [animated     ║               │
│         ║   hero art /   ║  220dp        │  hero zone
│         ║   logo mark]   ║               │
│         ╚════════════════╝               │
│                                          │
├──────────────────────────────────────────┤  y=300
│ ╭──────────────────────────────────────╮ │
│ │           ▶  PLAY                   │ │  64dp  primary CTA
│ ╰──────────────────────────────────────╯ │
├──────────────────────────────────────────┤  y=372  (8dp gap)
│ ╭──────────────────────────────────────╮ │
│ │              ROSTER                  │ │  56dp
│ ╰──────────────────────────────────────╯ │
├──────────────────────────────────────────┤  y=436  (8dp gap)
│ ╭──────────────────────────────────────╮ │
│ │           MASTERY ROAD               │ │  56dp
│ ╰──────────────────────────────────────╯ │
├──────────────────────────────────────────┤  y=500  (8dp gap)
│ ╭────────────────────╮ ╭───────────────╮ │
│ │      SETTINGS      │ │     SHOP      │ │  48dp  secondary row
│ ╰────────────────────╯ ╰───────────────╯ │
└──────────────────────────────────────────┘  y=596  (+44dp bottom padding)
                                                       640dp total
```

---

## Zone Breakdown

| Zone | Y | Height | Content |
|---|---|---|---|
| Header bar | 24 | 56 | User level badge · wordmark · currency chip · settings + profile icons |
| Hero zone | 80 | 220 | Animated character art / rotating character silhouette on dark background |
| PLAY button | 300 | 64 | Primary CTA — `$accent-genesis` fill |
| ROSTER | 372 | 56 | Secondary button |
| MASTERY ROAD | 436 | 56 | Secondary button |
| Bottom row | 500 | 48 | SETTINGS (half) + SHOP (half) side by side |
| Bottom padding | 548 | 92 | Breathing room + nav bar inset |

Total: 24 + 56 + 220 + 64 + 8 + 56 + 8 + 56 + 8 + 48 + 92 = 640 dp ✓

---

## Component Specifications

### Header Bar

| Component | Size (dp) | Position | Properties |
|---|---|---|---|
| Header background | 360 × 56 | 0, 24 | `$bg-panel`, bottom border 1dp `$bg-elevated` |
| User level badge | 48 × 24 | 16, 40 | `$bg-elevated` pill; "Lv 14" `$t-label` `$text-primary` |
| Wordmark | — | center x, 52 | "GENESIS" `$t-label` letter-spacing 4sp `$accent-genesis` |
| Currency chip | 80 × 28 | 208, 38 | `$bg-elevated` pill; 💎 icon 16dp + amount `$t-label` `$accent-gold` |
| Settings icon | 48 × 48 | 272, 24 | Icon button, `$text-secondary`; opens Settings |
| Profile icon | 48 × 48 | 312, 24 | Icon button, `$text-secondary`; opens Profile (future) |

### Hero Zone

| Component | Size (dp) | Position | Properties |
|---|---|---|---|
| Hero background | 360 × 220 | 0, 80 | `$bg-deep`; radial glow `$accent-genesis` 20% opacity at center |
| Character art | 180 × 200 | center x, 80 | PNG/Lottie; slow idle animation; rotates through featured characters every 6 s |
| Universe badge | 80 × 24 | 140, 276 | `$r-pill` `$bg-elevated`; character universe name `$t-micro` `$text-secondary` |

### Navigation Buttons

| Component | Size (dp) | Position | Properties |
|---|---|---|---|
| PLAY | 328 × 64 | 16, 300 | `$accent-genesis` fill `$r-md`; "▶  PLAY" `$t-subheading` `$text-on-accent`; minimum touch target met |
| ROSTER | 328 × 56 | 16, 372 | `$bg-elevated` fill `$r-md`; "ROSTER" `$t-subheading` `$text-primary` |
| MASTERY ROAD | 328 × 56 | 16, 436 | `$bg-elevated` fill `$r-md`; "MASTERY ROAD" `$t-subheading`; unread-quest dot badge `$accent-gold` 8dp |
| SETTINGS | 156 × 48 | 16, 500 | `$bg-card` fill `$r-md` |
| SHOP | 156 × 48 | 188, 500 | `$bg-card` fill `$r-md`; "SHOP" with gem icon |

---

## States

| State | Description |
|---|---|
| Default | All buttons enabled; hero art animating |
| New quest badge | Gold dot on MASTERY ROAD button when unseen quest completions exist |
| No currency | Currency chip unchanged — shop is always accessible |

---

## Interactions

| Action | Result |
|---|---|
| Tap PLAY | Navigate to Pre-Battle, Step 1 (Mode Select) |
| Tap ROSTER | Navigate to Roster screen |
| Tap MASTERY ROAD | Navigate to Mastery Road screen |
| Tap SETTINGS | Navigate to Settings screen |
| Tap SHOP | Navigate to Shop screen |
| Tap Settings icon in header | Navigate to Settings (same as button) |
| Tap Profile icon | Navigate to Profile / Account screen (Phase 3) |

---

## Animations

| Element | Animation | Trigger |
|---|---|---|
| Screen entry | Fade-in from black | On first load from Splash |
| Hero art | Idle pose loop | Continuous |
| Character rotation | Cross-fade to next character | Every 6 s |
| PLAY button | Scale 0.95 on press, back on release | Tap |
| Badge pulse | Gold dot gentle scale pulse | While unseen quests exist |
