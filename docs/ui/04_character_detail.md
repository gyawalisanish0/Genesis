# Screen: Character Detail

## Purpose

Full read-out for a single character — stats, skill loadout, passive, lore,
and a shortcut into their Mastery Road. Read-only in browse context; shows
equipped genesis items when entered from Pre-Battle.

---

## Entry / Exit

| | Screen |
|---|---|
| **Entry from** | Roster (tap card) |
| **Exit to** | Back to Roster |

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
│  ← [back]                  [MASTERY ROAD]│  56dp      header
├──────────────────────────────────────────┤  y=56
│▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒│
│▒▒▒▒▒▒  [portrait 120×120]  ▒▒▒▒▒▒▒▒▒▒▒▒│  200dp     hero zone
│▒▒▒▒▒▒                      ▒▒▒▒▒▒▒▒▒▒▒▒│            (rarity gradient bg)
│▒▒▒▒   Iron Warden ★★★       ▒▒▒▒▒▒▒▒▒▒│
│▒▒▒▒   Warrior  ·  Rarity 3  ▒▒▒▒▒▒▒▒▒▒│
├──────────────────────────────────────────┤  y=256
│  STATS                           ▼       │  40dp      section header (collapsible)
├──────────────────────────────────────────┤  y=296
│  STR  ████████████████░░  75            │
│  END  █████████████░░░░░  60            │
│  PWR  ████░░░░░░░░░░░░░░  20            │  156dp     stat bars (6 × 26dp)
│  RES  ████████░░░░░░░░░░  45            │
│  SPD  ████████░░░░░░░░░░  40            │
│  PRC  ██████████░░░░░░░░  55            │
├──────────────────────────────────────────┤  y=452
│  SKILLS                          ▼       │  40dp      section header
├──────────────────────────────────────────┤  y=492
│  ┌──────────────┐  ┌──────────────┐      │
│  │  Skill 1     │  │  Skill 2     │      │  80dp      skill row 1
│  │  TU:8  AP:20 │  │  TU:10 AP:35 │      │
│  └──────────────┘  └──────────────┘      │
│  ┌──────────────┐  ┌──────────────┐      │
│  │  Skill 3     │  │  Skill 4     │      │  80dp      skill row 2
│  │  …           │  │  …           │      │
│  └──────────────┘  └──────────────┘      │
├──────────────────────────────────────────┤  y=652  (scrollable — continues below)
│  PASSIVE                                 │  section (scrollable)
│  LORE                                    │  section (scrollable)
└──────────────────────────────────────────┘
```

> The full screen is a **single scrollable column**. The hero zone is sticky
> at the top until the user scrolls 80dp, then it collapses to a 56dp mini
> header showing portrait (40dp) + name only.

---

## Zone Breakdown

| Zone | Y | Height | Content |
|---|---|---|---|
| Header | 0 | 56 | Back · Mastery Road button |
| Hero zone | 56 | 200 | Portrait, name, class, rarity — rarity gradient background |
| Stats section | 256 | 196 | Collapsible; 6 labelled stat bars |
| Skills section | 452 | 208 | 2×2 read-only skill cards |
| Passive section | 660+ | 80 | Passive name + one-line description (scrollable) |
| Lore section | 740+ | variable | Flavour text (scrollable) |

---

## Component Specifications

### Header

| Component | Size (dp) | Position | Properties |
|---|---|---|---|
| Back button | 48 × 48 | 4, 4 | `←` icon |
| Mastery Road button | 140 × 36 | 204, 10 | Ghost variant `$r-md`; "MASTERY ROAD" `$t-label`; `$accent-genesis` border |

### Hero Zone

| Component | Size (dp) | Position | Properties |
|---|---|---|---|
| Hero bg | 360 × 200 | 0, 56 | Vertical gradient: `$rarity-N` 30% → `$bg-deep`; subtle particle aura |
| Portrait | 120 × 120 | center x, 64 | `UnitPortrait xl`; rarity-coloured border 3dp; idle animation |
| Name | 328 × 28 | 16, 192 | `$t-heading`, `$text-primary`, centered |
| Class · rarity | 328 × 20 | 16, 224 | `$t-label`, `$text-secondary`, centered; rarity shown as filled stars |

### Stat Bar Row (× 6)

```
STR  [████████████░░░░]  75
 ↑        ↑              ↑
12sp   full-width 8dp   12sp value
```

| Component | Size (dp) | Properties |
|---|---|---|
| Row container | 328 × 26 | Horizontal flex; 16dp side pad |
| Stat label | 32 × 16 | `$t-label` `$text-secondary`, right-aligned 4dp gap |
| Bar track | 240 × 8 | `$bg-elevated`, `$r-pill` |
| Bar fill | dynamic × 8 | `$accent-genesis` fill; width = value/100 × track-width |
| Value label | 32 × 16 | `$t-label` `$text-primary`, left of bar |

Stat label abbreviations: STR · END · PWR · RES · SPD · PRC

### Skill Card (read-only variant)

```
┌───────────────────────────────┐  156 × 80dp
│ Slash                    Lv — │  $t-subheading  (no level — not in battle)
│ Physical · Melee              │  $t-micro tags, $text-secondary
│ TU: 8  ·  AP: 20  ·  Base 80%│  $t-micro stats
└───────────────────────────────┘
```

| Component | Size (dp) | Properties |
|---|---|---|
| Card bg | 156 × 80 | `$bg-card` `$r-md`; tag-coloured left accent 3dp |
| Skill name | 140 × 20 | `$t-subheading` |
| Tags | 140 × 14 | `$t-micro` `$text-secondary`, comma-separated |
| Stats row | 140 × 14 | `$t-micro`; TU · AP · Base |

### Passive Section

| Component | Size (dp) | Properties |
|---|---|---|
| Section header | 328 × 32 | "PASSIVE" `$t-label` `$text-secondary`; separator line |
| Passive name | 328 × 20 | `$t-subheading` `$text-primary` |
| Description | 328 × 36 | `$t-body` `$text-secondary`, 2 lines max |

---

## Collapsed Mini-Header (scroll > 80dp)

```
┌──────────────────────────────────────────┐  56dp
│  ←  [port 40dp]  Iron Warden  Warrior    │
└──────────────────────────────────────────┘
```

Animates in over 200 ms ease-out as the hero zone scrolls out of view.

---

## States

| State | Description |
|---|---|
| Default | Full hero zone visible; stats and skills expanded |
| Scrolled | Mini header replaces hero zone; rest of content scrolls |
| Sections collapsed | Tapping section header toggles collapse with 200ms height animation |

---

## Interactions

| Action | Result |
|---|---|
| Tap back | Navigate back to Roster |
| Tap MASTERY ROAD | Navigate to Mastery Road (filtered to this character) |
| Tap skill card | Expand skill detail tooltip (240dp bottom sheet, shows all level upgrades) |
| Tap stat label | Brief tooltip explaining stat role |
| Scroll | Collapses hero zone into mini header |
