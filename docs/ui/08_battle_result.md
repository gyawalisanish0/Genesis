# Screen: Battle Result

## Purpose

Shown immediately after the win or loss condition is met. Summarises the
battle outcome, XP and currency earned, skill levels reached, and provides
clear paths forward — retry, next, or return to menu.

---

## Entry / Exit

| | Screen |
|---|---|
| **Entry from** | Battle (win/loss event) |
| **Exit to** | Battle (retry) · Pre-Battle (next battle) · Main Menu |

---

## Dimensions

```
Canvas     : 360 × 640 dp
Safe zone  : 360 × 568 dp
Side pad   : 16 dp
```

---

## Layout Schematic — Victory

```
┌──────────────────────────────────────────┐  y=0
│░░░░░░░░ status bar (transparent) ░░░░░░░│  24dp
├──────────────────────────────────────────┤  y=24
│                                          │
│   ★    V I C T O R Y    ★               │  88dp  result hero banner
│          Ranked · Wave 1                 │
│                                          │
├──────────────────────────────────────────┤  y=112
│  ┌────────────────────────────────────┐  │
│  │  XP        +  840                  │  │  48dp  rewards card row 1
│  │  Currency  +  120 💎               │  │
│  └────────────────────────────────────┘  │
├──────────────────────────────────────────┤  y=168
│  SURVIVING UNITS                         │  24dp  section label
├──────────────────────────────────────────┤  y=192
│ ┌────────┐ Iron Warden  Lv 3→4  +240 XP │  64dp  unit result row
│ │[port]  │ ████████████░░░░░░  HP: 640  │
│ └────────┘ Skills: Slash Lv 2 · Guard 1 │
├──────────────────────────────────────────┤  y=256
│ ┌────────┐ Swift Veil   Lv 2    +180 XP │  64dp
│ └────────┘ ██████████████████  HP: 800  │
├──────────────────────────────────────────┤  y=320
│  BATTLE STATS                            │  24dp  section label
├──────────────────────────────────────────┤  y=344
│  Total ticks elapsed      ·        148   │  28dp stat row
│  Boosted outcomes         ·          3   │  28dp
│  Evasion chains           ·          1   │  28dp
│  Highest damage hit       ·        234   │  28dp
├──────────────────────────────────────────┤  y=456
│                                          │  40dp  spacer
├──────────────────────────────────────────┤  y=496
│  ╭──────────────────────────────────────╮│
│  │         CONTINUE  →                  ││  56dp  primary CTA
│  ╰──────────────────────────────────────╯│
│  ╭──────────────────────────────────────╮│
│  │            MAIN MENU                 ││  48dp
│  ╰──────────────────────────────────────╯│
└──────────────────────────────────────────┘  y=600  (+40dp nav pad)
```

---

## Layout Schematic — Defeat

The defeat layout mirrors victory with these differences:

```
┌──────────────────────────────────────────┐
│                                          │
│      ✕    D E F E A T                   │  88dp  $accent-danger banner
│          All units eliminated            │
│                                          │
├──────────────────────────────────────────┤
│  FALLEN UNITS                            │
│ ┌────────┐ Iron Warden  Lv 2  eliminated │  64dp  (portrait greyscale, ×)
│ └────────┘ ░░░░░░░░░░░░░░░░  HP:   0    │
├──────────────────────────────────────────┤
│  … battle stats (same) …                 │
├──────────────────────────────────────────┤
│  ╭──────────────────────────────────────╮│
│  │         ↺  RETRY                     ││  56dp  retry is primary on defeat
│  ╰──────────────────────────────────────╯│
│  ╭──────────────────────────────────────╮│
│  │            MAIN MENU                 ││  48dp
│  ╰──────────────────────────────────────╯│
└──────────────────────────────────────────┘
```

---

## Zone Breakdown

| Zone | Y | Height | Content |
|---|---|---|---|
| Status bar | 0 | 24 | Transparent system bar |
| Result banner | 24 | 88 | Victory / Defeat label + mode info |
| Rewards card | 112 | 56 | XP + Currency earned (victory only) |
| Unit results | 168 | variable | One row (64dp) per team member |
| Battle stats | 344 | 112 | 4 summary stats |
| Spacer | 456 | 40 | Breathing room |
| Action buttons | 496 | 104 | Primary CTA + Main Menu |

---

## Component Specifications

### Result Banner

| Component | Size (dp) | Properties |
|---|---|---|
| Banner bg | 360 × 88 | Animated: victory — golden particle burst from center; defeat — desaturated fade-in |
| Outcome label | 280 × 44 | "V I C T O R Y" or "D E F E A T"; `$t-display`; `$accent-gold` (victory) or `$accent-danger` (defeat); letter-spacing 6sp |
| Mode info | 200 × 18 | `$t-label` `$text-secondary` centered; "Ranked · Wave 1" |
| Decorative stars | 24 × 24 each | Two stars flanking label (victory only); `$accent-gold`; scale-in animation |

### Rewards Card (Victory)

| Component | Size (dp) | Properties |
|---|---|---|
| Card bg | 328 × 56 | `$bg-card` `$r-md` |
| XP row | 328 × 24 | Icon + "XP" `$t-label` left; "+840" `$t-subheading` `$accent-genesis` right |
| Currency row | 328 × 24 | 💎 icon + "Currency" `$t-label`; "+120" `$t-subheading` `$accent-gold` right |

### Unit Result Row

| Component | Size (dp) | Properties |
|---|---|---|
| Row bg | 328 × 64 | `$bg-card` `$r-md` |
| Portrait | 52 × 52 | `UnitPortrait sm`; defeat: greyscale + red `×` badge |
| Unit name | 180 × 18 | `$t-subheading` |
| Level change | 80 × 14 | "Lv 3→4" `$t-label` `$accent-genesis`; no change: "Lv 3" `$text-secondary` |
| XP gained | 60 × 14 | "+240 XP" `$t-label` `$accent-genesis` |
| HP bar | 216 × 6 | `ResourceBar HP`; defeated units show 0 |
| Skill levels | 216 × 14 | "Skills: Slash Lv 2 · Guard 1" `$t-micro` `$text-muted` |

### Battle Stats Row

```
  Total ticks elapsed            ·        148
  ─────────────────────────────────────────
```

| Component | Size (dp) | Properties |
|---|---|---|
| Row container | 328 × 28 | Horizontal flex; separator 1dp `$bg-elevated` |
| Label | 240 × 16 | `$t-label` `$text-secondary` |
| Dot separator | — | `$text-muted` |
| Value | 60 × 16 | `$t-subheading` `$text-primary` right-aligned |

### Action Buttons

| Component | Size (dp) | Properties |
|---|---|---|
| CONTINUE (victory) | 328 × 56 | `PrimaryButton`; "CONTINUE →" |
| RETRY (defeat) | 328 × 56 | `PrimaryButton`; "↺ RETRY" |
| MAIN MENU | 328 × 48 | `Ghost button` |

---

## States

| State | Description |
|---|---|
| Victory | Gold banner; XP rewards shown; CONTINUE as primary CTA |
| Defeat | Red banner; no rewards; RETRY as primary CTA |
| Perfect victory (no HP lost) | Additional "PERFECT" sub-label with star burst animation |

---

## Animations

| Element | Animation | Trigger |
|---|---|---|
| Screen enter | Full-screen white flash → fade in (150ms) | After last combat action |
| Victory banner | Gold particle burst 600ms | On screen appear |
| Defeat banner | Desaturate + fade-in 400ms | On screen appear |
| XP bar fill | Tween 800ms | 300ms after screen loads |
| Level-up indicator | Glow pulse on "→4" text | If level increased |
| Currency count | Count-up number animation | 500ms after screen loads |
