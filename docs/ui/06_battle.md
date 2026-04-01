# Screen: Battle

## Purpose

The core gameplay screen. Displays the live Tick timeline, all combatants,
the combat feed, and the active unit's action bar. Every interaction the
player takes during a battle flows through this single screen.

This is the most complex screen in Genesis — all zones must be readable
at arm's length on a 360dp-wide portrait display.

---

## Entry / Exit

| | Screen |
|---|---|
| **Entry from** | Pre-Battle (Step 3 CONTINUE) |
| **Exit to** | Battle Result (win/loss condition met) · Main Menu (forfeit) |

---

## Dimensions

```
Canvas     : 360 × 640 dp   FULL-BLEED — no safe-zone insets
Status bar : transparent overlay
Nav bar    : transparent overlay (gesture nav)
Side pad   : 12 dp
```

---

## Layout Schematic

```
┌──────────────────────────────────────────┐  y=0
│░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░│  24dp  status bar (transparent)
├──────────────────────────────────────────┤  y=24
│ ◀NOW  [U1][  ][U3][     ][U2][  ][E1]▶ │  40dp  TIMELINE STRIP
├──────────────────────────────────────────┤  y=64
│  [E1 port][HP══════════░░░░][AP═══░░]   │
│  Bone Tyrant  ★★★★         [💀][🔥]    │  64dp  enemy unit row (per enemy)
├──────────────────────────────────────────┤  y=128  (second enemy)
│  [E2 port][HP══════░░░░░░░░][AP═░░░░]   │  64dp
├──────────────────────────────────────────┤  y=192
│  ╔══════════════════════════════════════╗│
│  ║                                     ║│
│  ║     ✦  BOOSTED!                     ║│
│  ║                                     ║│  152dp  COMBAT FEED
│  ║       + 187 DMG                     ║│
│  ║                                     ║│
│  ╚══════════════════════════════════════╝│
│  [Iron Warden → Slash → Bone Tyrant]    │  24dp  action log line
├──────────────────────────────────────────┤  y=368
│  [port 64dp]  Iron Warden     SP: ●●○   │
│  HP  ████████████████████░░░░   960/1200│  96dp  ACTIVE UNIT PANEL
│  AP  ██████████████░░░░░░░░░░    65/100 │
│  [💀][🔥][⬆]  Lv 3  · Warrior         │
├──────────────────────────────────────────┤  y=464
│  ┌──────────────────┐ ┌────────────────┐ │
│  │ [icon] Slash   1 │ │[icon] Power  2 │ │  72dp  skill row 1
│  │ ▓▓▓▓▓▓░░  AP:20  │ │ ▓▓▓▓▓░░  AP:35│ │
│  │ TU: 8            │ │ TU: 10        │ │
│  └──────────────────┘ └────────────────┘ │
├──────────────────────────────────────────┤  y=544  (8dp gap)
│  ┌──────────────────┐ ┌────────────────┐ │
│  │ [icon] Skill 3 3 │ │[icon] Skill 4 1│ │  72dp  skill row 2
│  │ ▓▓░░░░  AP:50    │ │  ——  AP: 0     │ │
│  └──────────────────┘ └────────────────┘ │
├──────────────────────────────────────────┤  y=616  (8dp gap)
│  ┌──────────────────┐ ┌────────────────┐ │
│  │  ⚔  BASIC ATK   │ │  ⏭  END TURN  │ │  48dp  basic + end turn
│  └──────────────────┘ └────────────────┘ │
└──────────────────────────────────────────┘  y=664  (24dp extends under nav)
                                            ↑ gesture bar region (transparent)
```

Note: Bottom 24dp flows under the transparent navigation bar.

---

## Zone Breakdown

| Zone | Y | Height | Content |
|---|---|---|---|
| Status bar | 0 | 24 | System — transparent overlay |
| Timeline strip | 24 | 40 | All unit markers on the Tick stream |
| Enemy area | 64 | 128 | Up to 2 enemies at 64dp each (scrollable if 3+) |
| Combat feed | 192 | 176 | Dice outcome display · action log · animations |
| Active unit panel | 368 | 96 | Active unit portrait, HP/AP, status, skill points, level |
| Skill row 1 | 464 | 72 | Skill slots 1 + 2 |
| Skill row 2 | 544 | 72 | Skill slots 3 + 4 |
| Action row | 624 | 40 | Basic Attack + End Turn (extends 24dp under nav bar) |

Total: 24+40+128+176+96+72+72+40 = 648dp (8dp extends under nav bar) ✓

---

## Component Specifications

### Timeline Strip

```
◀NOW  ┌──┐     ┌──┐        ┌──┐    ┌──┐  ▶
      │U1│     │U3│        │E1│    │U2│
      └──┘  ↑  └──┘        └──┘    └──┘
            TICK
            marker
            line
```

| Component | Size (dp) | Properties |
|---|---|---|
| Strip bg | 360 × 40 | `$bg-elevated`; bottom border 1dp `$bg-panel` |
| "NOW" label | 32 × 12 | `$t-micro` `$accent-genesis`; left edge 8dp; left arrow |
| Tick axis | 296 × 2 | `$bg-panel`; horizontal; y-center of strip |
| Unit marker | 28 × 28 | `UnitPortrait` circle; player team `$accent-genesis` ring 2dp; enemy `$accent-danger` ring 2dp |
| Active marker | 32 × 32 | `$accent-genesis` ring 3dp; pulse animation |
| Marker tick label | 24 × 10 | `$t-micro` `$text-muted`; below each marker |
| Future marker (≥20 ticks away) | 20 × 20 | Faded 40% opacity |

The strip auto-scrolls so the current unit's marker stays within the leftmost
25% of the strip width. Player and enemy markers are colour-coded.

---

### Enemy Unit Row

```
┌──────────────────────────────────────────┐  64 × 64dp
│ ┌────────┐  Bone Tyrant        [💀][🔥]  │
│ │[port   │  ════════════════░░░  HP 82%  │
│ │ 52×52] │  ══════░░░░░░░░░░░░  AP 30%  │
│ └────────┘                               │
└──────────────────────────────────────────┘
```

| Component | Size (dp) | Position | Properties |
|---|---|---|---|
| Row bg | 336 × 60 | 12, y | `$bg-panel` `$r-md` |
| Portrait | 52 × 52 | 12 + 8, y + 4 | `UnitPortrait sm` |
| Name | 180 × 18 | 80, y + 6 | `$t-subheading` `$text-primary` |
| Status icons | 16 × 16 each | 252, y + 6 | `StatusEffectChip` row, max 4 visible |
| HP bar | 216 × 8 | 80, y + 28 | `ResourceBar HP`; value label right-aligned `$t-micro` |
| AP bar | 216 × 6 | 80, y + 40 | `ResourceBar AP` |

Tapping an enemy shows a 240dp tooltip with full stat read-out.

---

### Combat Feed

```
┌──────────────────────────────────────────┐
│                                          │
│         ✦ BOOSTED!                       │  $t-display $accent-gold
│                                          │
│            +187 DMG                      │  48sp bold $accent-danger float-up
│                                          │
│                                          │
└──────────────────────────────────────────┘
────────────────────────────────────────────  1dp separator
 Iron Warden → Slash → Bone Tyrant         $t-micro $text-muted
```

| Component | Size (dp) | Position | Properties |
|---|---|---|---|
| Feed bg | 360 × 152 | 0, 192 | `$bg-deep`; subtle vignette border |
| Outcome label | 240 × 44 | center, feed center-y − 20 | `$t-display`; coloured by outcome (see design system); appears with spring animation |
| Outcome icon | 40 × 40 | center − 140, feed center-y − 20 | Outcome-specific glyph (✦ Boosted · ✓ Success · ↯ Tumbling · 🛡 Guard Up · ✦ Evasion) |
| Damage/heal number | dynamic | center, feed center-y + 16 | 48sp bold; `$accent-danger` (dmg) or `$accent-heal` (heal); float-up 40dp then fade |
| Tick delay indicator | 160 × 24 | center, feed bottom − 32 | Tumbling only: "+3 Tick delay" `$t-label` `$accent-warn` |
| Action log bar | 360 × 24 | 0, 344 | `$bg-panel`; "Unit → Skill → Target" `$t-micro` `$text-muted`; left-scrollable for last 5 actions |

**Idle state** (waiting for player input): feed shows unit name and a subtle
prompt "Choose your action" — `$t-body` `$text-secondary` centered.

---

### Active Unit Panel

```
┌──────────────────────────────────────────┐  96dp
│ ┌───────┐  Iron Warden             SP:●●○│
│ │[port  │  HP  ████████████████░░   960  │
│ │ 64×64]│  AP  █████████████░░░░     65  │
│ └───────┘  [💀][🔥][⬆]  Lv 3 · Warrior  │
└──────────────────────────────────────────┘
```

| Component | Size (dp) | Position | Properties |
|---|---|---|---|
| Panel bg | 360 × 96 | 0, 368 | `$bg-panel`; top border 1dp `$accent-genesis` |
| Portrait | 64 × 64 | 12, 376 | `UnitPortrait md`; `$accent-genesis` ring during this unit's turn |
| Name | 200 × 18 | 88, 376 | `$t-subheading` `$text-primary` |
| SP indicator | 72 × 18 | 276, 376 | "SP: ●●○" — filled dots = available points; `$accent-gold`; tap → Skill Upgrade modal |
| HP bar + label | 256 × 16 | 88, 398 | `ResourceBar HP`; value right of bar `$t-micro` |
| AP bar + label | 256 × 14 | 88, 418 | `ResourceBar AP`; value right of bar `$t-micro` |
| Status row | 180 × 20 | 88, 436 | Up to 5 `StatusEffectChip` 20×20dp |
| Level badge | 60 × 16 | 252, 440 | "Lv 3" `$t-micro` `$bg-elevated` `$r-pill` |
| Class label | 52 × 16 | 320, 440 | "Warrior" `$t-micro` `$text-muted` |

---

### Skill Button (in-battle variant)

Each slot: **164 × 72 dp**

```
┌──────────────────────────────────────────┐
│ [icon 28dp]  Slash                  Lv 1 │  $t-subheading  level right
│ ▓▓▓▓▓▓▓▓░░░ AP mini-bar (4dp)          │  shows % of AP needed
│ AP: 20  ·  TU: 8                         │  $t-micro $text-secondary
└──────────────────────────────────────────┘
```

Slot layout in action bar:
```
┌───────────────────────┬───────────────────────┐  y=464
│       Skill 1         │       Skill 2          │  72dp
├───────────────────────┴───────────────────────┤  y=544  8dp gap
├───────────────────────┬───────────────────────┤
│       Skill 3         │       Skill 4          │  72dp
└───────────────────────┴───────────────────────┘
```

Column width: (360 − 12 − 8 − 12) / 2 = 164 dp. Gap: 8 dp. Outer pad: 12 dp each side.

| State | Visual |
|---|---|
| Available | `$bg-card`; full opacity |
| Insufficient AP | `$bg-card` 50% opacity; AP bar shows deficit in `$accent-danger` |
| Empty slot | Dashed border `$bg-elevated`; "—" centered |
| Selected (held) | `$accent-genesis` border 2dp; scale 0.97 |
| Long-press | Triggers Skill Upgrade modal if SP available |

---

### Basic Attack + End Turn Row

| Component | Size (dp) | Position | Properties |
|---|---|---|---|
| Row bg | 360 × 40 | 0, 624 | `$bg-deep` |
| Basic Attack | 164 × 40 | 12, 624 | `$bg-elevated` `$r-md`; "⚔ BASIC ATK" `$t-label`; always available on player turn |
| End Turn | 164 × 40 | 184, 624 | `$bg-elevated` `$r-md`; "⏭ END TURN" `$t-label` `$text-secondary` |

---

## Enemy Turn State

When it is an enemy unit's turn, the action bar is disabled:

```
│  ═══════════════════════════════════════ │
│  [Enemy portrait]  Bone Tyrant is acting │  overlay on action bar
│  ═══════════════════════════════════════ │
```

- Skill buttons dim to 20% opacity
- "Thinking…" label with animated dots
- Enemy's action plays out in the combat feed
- Auto-advances after animation completes

---

## Forfeit / Pause

Accessed via long-press anywhere outside the action bar for 1 second:

```
╭──────────────────────────────────────────╮  bottom sheet 200dp
│  ▬                                        │
│  Pause                                    │
│  ╭────────────────────────────────────╮   │
│  │           RESUME                   │   │  56dp
│  ╰────────────────────────────────────╯   │
│  ╭────────────────────────────────────╮   │
│  │           FORFEIT                  │   │  48dp  $accent-danger
│  ╰────────────────────────────────────╯   │
╰──────────────────────────────────────────╯
```

---

## Animations Summary

| Element | Animation | Trigger |
|---|---|---|
| Timeline markers | Slide to new position | After each action |
| Active marker | Pulse ring | During player turn |
| Damage number | Float up 40dp + fade out | On hit |
| Outcome label | Spring scale 0.5 → 1.05 → 1.0 | Dice resolved |
| HP bar | Width tween | Damage / heal applied |
| AP bar | Width tween | After each tick advance |
| Tumbling overlay | Unit marker bumps right on timeline | Tumbling outcome |
| Enemy thinking | Three dots pulsing | Enemy turn |
| Evasion counter chain | Each counter animates sequentially | Evasion chain |
