# Screen: Mastery Road

## Purpose

Per-character web of cosmetic nodes unlocked by completing character-specific
quests. Purely visual rewards — no gameplay power. Displays a character's
unique progression web, active quests, and unlocked cosmetics.

---

## Entry / Exit

| | Screen |
|---|---|
| **Entry from** | Main Menu (MASTERY ROAD button) · Character Detail (MASTERY ROAD button) |
| **Exit to** | Back to entry screen |

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
│  ← [back]    MASTERY ROAD      [🔍]     │  56dp   header
├──────────────────────────────────────────┤  y=56
│ [Iron Warden ▼] [Swift Veil] [……]       │  48dp   character selector (scroll)
├──────────────────────────────────────────┤  y=104
│ ▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓░░░░░░░░░░░░░░░░░░░  │  8dp    mastery progress bar
│  12 / 30 nodes unlocked                  │  20dp   progress label
├──────────────────────────────────────────┤  y=132
│                                          │
│      ╔═══╗                               │
│      ║ ✓ ║──────── ╔═══╗                │
│      ╚═══╝         ║ ✓ ║──── ╔═══╗     │
│        │           ╚═══╝     ║ ? ║     │  330dp  NODE WEB
│        │                     ╚═══╝     │         (pannable canvas)
│      ╔═══╗──── ╔═══╗                   │
│      ║ ✓ ║     ║ ✦ ║ ← active quest    │
│      ╚═══╝     ╚═══╝                   │
│                                          │
│          (scroll / pan to explore)       │
├──────────────────────────────────────────┤  y=462
│  ACTIVE QUESTS                           │  24dp   section label
├──────────────────────────────────────────┤  y=486
│ ┌────────────────────────────────────┐   │
│ │ ✦  Win 5 battles with Iron Warden  │   │  72dp   quest card
│ │    ████████░░░░░░  4 / 5           │   │
│ │    Reward: "Iron Sentinel" title   │   │
│ └────────────────────────────────────┘   │
├──────────────────────────────────────────┤  y=566
│ ┌────────────────────────────────────┐   │
│ │    (next quest card — partial)     │   │  partial card (indicates scroll)
│ └────────────────────────────────────┘   │
└──────────────────────────────────────────┘  y=640
```

---

## Zone Breakdown

| Zone | Y | Height | Content |
|---|---|---|---|
| Header | 0 | 56 | Back button · title · search |
| Character selector | 56 | 48 | Horizontal scroll tabs — one per owned character |
| Progress bar | 104 | 28 | Mastery progress bar + "X / Y nodes" label |
| Node web | 132 | 330 | Pannable/zoomable node graph |
| Active quests | 462 | 178 | Scrollable list of in-progress quests |

---

## Component Specifications

### Character Selector

| Component | Size (dp) | Properties |
|---|---|---|
| Selector bg | 360 × 48 | `$bg-panel`; bottom border 1dp `$bg-elevated` |
| Character tab | 80 × 40 | Horizontal scroll; portrait 32×32dp + name `$t-micro`; active: `$accent-genesis` underline 2dp; inactive: `$text-muted` |

### Progress Bar

| Component | Size (dp) | Properties |
|---|---|---|
| Bar track | 328 × 8 | `$bg-elevated` `$r-pill` |
| Bar fill | dynamic × 8 | `$accent-genesis`; width = unlocked/total |
| Label | 328 × 16 | `$t-micro` `$text-secondary`; "12 / 30 nodes unlocked" right-aligned |

### Node Web (Pannable Canvas)

The web is a **free-form directed graph** rendered on a scrollable/pannable
surface. The canvas is larger than the viewport; the player pans to explore.

```
Node types:

  ╔═══╗   Unlocked cosmetic node
  ║ ✓ ║   — filled $accent-genesis
  ╚═══╝   — checkmark icon

  ╔═══╗   Locked but available (quest complete)
  ║ ✦ ║   — pulsing $accent-gold border
  ╚═══╝   — unlock icon

  ╔═══╗   Locked (quest in progress)
  ║ ░ ║   — $bg-elevated fill
  ╚═══╝   — progress indicator beneath

  ╔═══╗   Locked (prerequisites not met)
  ║ 🔒║   — $bg-panel fill, muted
  ╚═══╝

  ─────   Edge: unlocked path — $accent-genesis 2dp
  ─ ─ ─   Edge: locked path — $bg-elevated 1dp dashed
```

| Component | Size (dp) | Properties |
|---|---|---|
| Node circle | 48 × 48 | `$r-pill`; minimum touch target met; tap opens Node Detail |
| Node icon | 24 × 24 | Centered in circle; state-dependent (see above) |
| Node label | 64 × 14 | Below circle; `$t-micro` `$text-secondary`; reward type |
| Edge line | 2 dp wide | Connecting nodes; color and style by state |

**Pan behaviour**: Two-finger pan; single-finger scroll on the quest list below
does not pan the web. Pinch to zoom the web (0.7× – 1.5× scale).

**Web initial position**: Centers on the character's "origin node" (first
unlocked node) on load.

### Node Detail Bottom Sheet (280dp — slides up on tap)

```
╭──────────────────────────────────────────╮
│  ▬                                        │
│  [icon 48dp]  Iron Sentinel               │  48dp   node identity
│  Title Cosmetic                           │
├──────────────────────────────────────────┤
│  QUEST REQUIREMENT                        │  16dp
│  Win 5 battles with Iron Warden          │  32dp   quest description
│  ████████░░░░░░  4 / 5                   │  24dp   progress bar
├──────────────────────────────────────────┤
│  REWARD PREVIEW                           │
│  [preview image 240×80dp]                │  96dp   cosmetic preview
├──────────────────────────────────────────┤
│  ╭──────────────────────────────────────╮│
│  │            CLAIM                     ││  48dp   (enabled if quest complete)
│  ╰──────────────────────────────────────╯│
╰──────────────────────────────────────────╯  280dp total
```

| Component | Size (dp) | Properties |
|---|---|---|
| Sheet bg | 360 × 280 | `$bg-panel`; top corners `$r-xl` |
| Node icon | 48 × 48 | `$r-pill`; reward type colour |
| Node name | 240 × 22 | `$t-heading` `$text-primary` |
| Type label | 120 × 14 | `$t-label` `$text-secondary`; "Title" / "Skin" / "Effect" |
| Quest text | 328 × 36 | `$t-body` |
| Progress bar | 328 × 8 | `ResourceBar` `$accent-genesis` |
| Progress label | 328 × 14 | `$t-micro`; "4 / 5" right-aligned |
| Reward preview | 240 × 80 | Image / Lottie preview; centered; `$r-md` |
| CLAIM button | 328 × 48 | `PrimaryButton`; `$accent-gold` (ready) or `$bg-elevated` (locked) |

### Active Quest Card

| Component | Size (dp) | Properties |
|---|---|---|
| Card bg | 328 × 72 | `$bg-card` `$r-md`; left accent 3dp `$accent-genesis` |
| Quest name | 280 × 18 | `$t-subheading` |
| Progress bar | 280 × 6 | `ResourceBar` thin variant `$accent-genesis` |
| Progress label | 120 × 14 | `$t-micro` `$text-secondary`; "4 / 5" |
| Reward label | 280 × 14 | `$t-micro` `$text-muted`; "Reward: …" |

---

## States

| State | Description |
|---|---|
| Default | Web shows all nodes; active quests listed below |
| New unlock available | Gold pulsing node in web; "Claim available" banner at top of quest list |
| All nodes unlocked | Progress bar full; "MASTERED" badge on character tab; empty quest list |
| No quests started | Quest list shows "Complete battles to unlock quests" placeholder |

---

## Interactions

| Action | Result |
|---|---|
| Tap character tab | Switch web and quest list to that character |
| Pan / pinch web | Navigate the node graph |
| Tap node | Open Node Detail sheet |
| Tap CLAIM | Unlock cosmetic; node fills; progress bar updates |
| Swipe sheet down | Dismiss Node Detail |
| Scroll quest list | Vertical scroll independent of web pan |
