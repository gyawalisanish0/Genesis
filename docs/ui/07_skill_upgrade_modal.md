# Screen: Skill Upgrade Modal

## Purpose

In-battle bottom sheet that lets the player spend Skill Points (SP) to level
up one of their active skills. Triggered by long-pressing a skill button or
tapping the SP indicator on the active unit panel. Appears only when the
active unit has unspent SP.

This is a **modal overlay** — it does not navigate away from the Battle screen.

---

## Entry / Exit

| | |
|---|---|
| **Trigger** | Long-press on any skill button · Tap SP indicator ("SP: ●●○") on active unit panel |
| **Dismiss** | Tap outside · swipe down · tap CANCEL · tap CONFIRM to spend SP |

---

## Dimensions

```
Canvas     : 360 × 640 dp  (battle screen remains behind)
Sheet      : 360 × 360 dp  (slides up from bottom)
Backdrop   : 360 × 640 dp  $bg-overlay (80% black)
```

---

## Layout Schematic

```
┌──────────────────────────────────────────┐  y=0
│                                          │
│         BATTLE SCREEN (dimmed)           │  280dp  backdrop
│                                          │
├──────────────────────────────────────────┤  y=280
│   ▬                                      │  8dp   drag handle
├──────────────────────────────────────────┤  y=288
│  UPGRADE SKILL             SP: ●● (2)   │  48dp  modal header
├──────────────────────────────────────────┤  y=336
│  ┌────────────────────────────────────┐  │
│  │ [icon]  Slash                      │  │  72dp  skill identity card
│  │ Physical · Melee                   │  │
│  │ TU: 8  ·  Base 80%  ·  SP cost: 1 │  │
│  └────────────────────────────────────┘  │
├──────────────────────────────────────────┤  y=408
│  Lv 1 ──────●──── Lv 2 ──── Lv 3 ····  │  40dp  level track
├──────────────────────────────────────────┤  y=448
│  CURRENT              →   AFTER UPGRADE │  24dp  column headers
│  Base value: 80%          Base value: 90%│  32dp  upgrade diff row
│  Output (est): 60 dmg     Output: 68 dmg │  32dp  estimate row
│                                          │  16dp
├──────────────────────────────────────────┤  y=552
│  ╭──────────────────────────────────────╮│
│  │  UPGRADE  (costs 1 SP)               ││  48dp  confirm button
│  ╰──────────────────────────────────────╯│
│  ╭──────────────────────────────────────╮│
│  │  CANCEL                              ││  40dp  cancel button
│  ╰──────────────────────────────────────╯│
└──────────────────────────────────────────┘  y=640
```

---

## Zone Breakdown

| Zone | Y | Height | Content |
|---|---|---|---|
| Backdrop | 0 | 280 | Dimmed battle screen; tap dismisses |
| Drag handle | 280 | 8 | 32×4dp centred pill `$bg-elevated` |
| Modal header | 288 | 48 | "UPGRADE SKILL" + current SP count |
| Skill card | 336 | 72 | Skill identity — icon, name, tags, base stats |
| Level track | 408 | 40 | Visual progress through all skill levels |
| Upgrade diff | 448 | 104 | Before/after comparison table |
| Buttons | 552 | 88 | UPGRADE (primary) + CANCEL (ghost) |

---

## Component Specifications

### Modal Shell

| Component | Size (dp) | Properties |
|---|---|---|
| Backdrop | 360 × 640 | `$bg-overlay`; tap outside dismisses modal |
| Sheet bg | 360 × 360 | `$bg-panel`; top corners `$r-xl`; slides up 300ms ease-out |
| Drag handle | 32 × 4 | `$bg-elevated` `$r-pill`; center x, 284 |

### Modal Header

| Component | Size (dp) | Position | Properties |
|---|---|---|---|
| Header bg | 360 × 48 | 0, 288 | `$bg-panel`; bottom border 1dp `$bg-elevated` |
| Title | — | 16, 304 | "UPGRADE SKILL" `$t-subheading` `$text-primary` |
| SP badge | 72 × 24 | 272, 300 | "SP: ●● (2)" `$t-label`; dots `$accent-gold`; count in parentheses |

### Skill Identity Card

| Component | Size (dp) | Position | Properties |
|---|---|---|---|
| Card bg | 328 × 72 | 16, 336 | `$bg-card` `$r-md` |
| Skill icon | 40 × 40 | 28, 352 | Skill image / colour block |
| Skill name | 220 × 20 | 80, 344 | `$t-subheading` |
| Tag row | 220 × 14 | 80, 368 | `$t-micro` `$text-secondary`; comma-separated tags |
| Stats row | 220 × 14 | 80, 386 | `$t-micro` `$text-muted`; TU · Base % · SP cost |

### Level Track

```
  Lv 1  ────●────  Lv 2  ─ ─ ─  Lv 3  ·····  Lv 4  ·····  Lv 5
   ↑           ↑
current      target
(filled)    (pulsing)
```

| Component | Size (dp) | Properties |
|---|---|---|
| Track bg | 328 × 4 | `$bg-elevated` `$r-pill`; y-center of zone |
| Filled segment | dynamic × 4 | `$accent-genesis`; from Lv 1 to current |
| Current node | 20 × 20 | `$accent-genesis` filled circle; "1" label below `$t-micro` |
| Target node | 20 × 20 | `$accent-gold` pulsing ring; "2" label |
| Future nodes | 16 × 16 | `$bg-elevated` circle; level number `$t-micro` `$text-muted` |
| Level labels | — | `$t-micro` below each node |

### Upgrade Diff Table

| Component | Size (dp) | Properties |
|---|---|---|
| Column headers | 156 × 24 each | "CURRENT" / "AFTER UPGRADE" `$t-micro` `$text-muted` |
| Diff row | 328 × 32 | Label left; current value center-left; arrow; new value center-right highlighted `$accent-gold` |
| Changed stat | — | New value in `$accent-gold` bold; unchanged values `$text-secondary` |
| Output estimate | 328 × 32 | "(est)" `$t-micro`; uses unit's current relevant stat for rough preview |

### Buttons

| Component | Size (dp) | Position | Properties |
|---|---|---|---|
| UPGRADE | 328 × 48 | 16, 552 | `PrimaryButton`; label "UPGRADE (costs 1 SP)"; disabled if 0 SP or skill at max level |
| CANCEL | 328 × 40 | 16, 608 | `Ghost button`; "CANCEL" |

---

## States

| State | Description |
|---|---|
| Normal | UPGRADE enabled; shows current → next level diff |
| Max level | UPGRADE disabled `$text-muted`; level track shows all filled; "MAX LEVEL" badge |
| Zero SP | UPGRADE disabled; SP badge shows "SP: ○ (0)" `$text-muted` |
| Skill not equipped | Cannot be triggered — button only appears for occupied slots |

---

## Interactions

| Action | Result |
|---|---|
| Tap UPGRADE | Deduct 1 SP; increment skill level; update battle state; dismiss modal |
| Tap CANCEL | Dismiss without changes |
| Tap backdrop | Dismiss without changes |
| Swipe sheet down | Dismiss without changes |
| Tap different level node on track | Preview that level's diff (does not cost SP yet) |

---

## Animations

| Element | Animation | Trigger |
|---|---|---|
| Sheet enter | Slide up 300ms ease-out | Modal open |
| Sheet exit | Slide down 200ms ease-in | Dismiss |
| UPGRADE confirm | Level node fills with `$accent-genesis` 300ms | Tap UPGRADE |
| SP badge | Dot changes from filled to empty 300ms | After upgrade |
| Diff values | Old value fades out; new value scales in 200ms | After upgrade |
