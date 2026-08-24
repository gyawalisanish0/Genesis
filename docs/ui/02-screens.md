# Genesis — Screens

Per-screen composition. Every screen is assembled from `01-components.md` and
styled by `00-design-system.md`; nothing bespoke is introduced here.

Routing, safe-area modes, and back-button contracts are defined in `CLAUDE.md`
§ Screen System. Screen IDs come from `SCREEN_IDS` — never string literals.

---

## Navigation map

```
Splash
  └── Main Menu
        ├── PLAY ──► Campaign ──► Dungeon ──► Battle ──► Battle Result
        │                           ▲                        │
        │                           └────────── return ──────┘
        ├── ROSTER ──► Roster
        └── SETTINGS ──► Settings

Pre-Battle (3 steps) ──► Battle          [backup flow — not used by campaign]
```

| Screen | ID | Safe area | Back |
|---|---|---|---|
| Splash | `splash` | `none` | exits app |
| Main Menu | `main-menu` | `full` | quit confirm |
| Campaign | `campaign` | `full` | → main menu |
| Dungeon | `dungeon` | `none` | → campaign |
| Pre-Battle | `pre-battle` | `full` | step back, then → main menu |
| Battle | `battle` | `none` | pause ⇄ resume only |
| Battle Result | `battle-result` | `full` | → return screen |
| Roster | `roster` | `full` | → main menu |
| Settings | `settings` | `full` | → main menu |

---

## Splash

Loads all game data, then gates entry.

```
┌────────────────────────┐
│                        │
│          G             │  logo mark — 64 art px, cyan-4 glow
│      G E N E S I S      │  --t-display, pixel
│   Turn-based tactical   │  --t-body-sm, --text-secondary
│                        │
│   ▓▓▓▓▓▓▓▓░░░░░  72%   │  ResourceBar variant="xp"
│                        │
│  TAP ANYWHERE TO ENTER │  browser-tab only; 2-frame blink
│         v0.1.0 · ©      │  --t-micro
└────────────────────────┘
```

Progress is real `DataService` work (characters → campaign → stages). In a
plain browser tab, navigation holds until first tap so the same gesture can
fire `requestFullscreen()`. Native/PWA auto-advance after 400 ms.

On load failure the tagline becomes `{error} — tap to retry`.

---

## Main Menu

```
┌────────────────────────┐
│                    ⚙   │  settings cog — top right, --touch-min
│      G E N E S I S     │
│                        │
│   ╔══════════════════╗ │
│   ║    ▶  PLAY       ║ │  PixelButton primary
│   ╚══════════════════╝ │
│   ╔══════════════════╗ │
│   ║      ROSTER      ║ │  PixelButton secondary
│   ╚══════════════════╝ │
│   ╔══════════════════╗ │
│   ║     SETTINGS     ║ │  PixelButton ghost
│   ╚══════════════════╝ │
└────────────────────────┘
```

Back triggers a quit confirm (`PromptOverlay`). PLAY → Campaign.

---

## Campaign

Stage select and unlock state — the primary demo flow.

```
┌────────────────────────┐
│ ‹  CAMPAIGN            │  TopBar
├────────────────────────┤
│ ╔════════════════════╗ │
│ ║ 01  MARS DESCENT   ║ │  Panel raised — unlocked
│ ║ Signal source ...  ║ │  --t-body
│ ╚════════════════════╝ │
│ ╔════════════════════╗ │
│ ║ 02  🔒 LOCKED      ║ │  Panel default, --text-muted
│ ╚════════════════════╝ │
└────────────────────────┘
```

Stage cards are in a scrollable column ⇒ **must** use `useScrollAwarePointer`
(CLAUDE.md § Scroll-Aware Pointer Detection). Selecting an unlocked stage
loads its `StageDef` + `MapDef` and enters the Dungeon.

---

## Dungeon

Turn-based grid exploration. Full-bleed; no `TopBar`.

```
┌────────────────────────┐
│ ◈ Reach the relay   ▓  │  StatusPill — objective + party HP
│                        │
│      ░░░░░░░░░░        │  DungeonGrid — 48 dp cells
│      ░░▓▓░░◆░░         │  follow camera: party always centred
│      ░░░◈░░░░░         │  ◈ party · ◆ enemy · ▣ chest · ▶ exit
│      ░░░░░░░░░         │
│                        │
│         ▲              │  D-pad — 3 × 3, centre empty
│       ◄ ● ►            │  each arrow --touch-min
│         ▼              │
└────────────────────────┘
```

**Turn loop:** move party → advance patrols → check wave phase → encounter
banner (`DUNGEON_ENCOUNTER_BANNER_MS`) → launch battle → return.

Only the **party leader** renders as a token; the rest of the party is implicit
(CLAUDE.md § Single controlled unit). Fog of war reveals at
`DUNGEON_REVEAL_RADIUS`; previously-seen entities persist greyscale.

Encounter sequence: spot shake → white flash → Battle. Multiple parties in
range trigger wave phase — a vignette plus selectable `EntityToken`s.

Chest step-on opens a `Sheet`. First-time hints use `Toaster tone="hint"` with
an `onceId`.

---

## Pre-Battle

Three-step wizard. **Backup flow** — campaign goes straight to Dungeon → Battle.

| Step | Content |
|---|---|
| 0 · Mode | Mode cards (story / ranked / draft) |
| 1 · Team | `PagedGrid` 5 × 4 character select, 1–2 units |
| 2 · Items | Equipment slots (stub) |

```
┌────────────────────────┐
│ ‹  SELECT TEAM         │
│ ●──○──○                │  step dots
├────────────────────────┤
│    [ PagedGrid ]       │
├────────────────────────┤
│ ╔════════════════════╗ │
│ ║      CONTINUE      ║ │  disabled until canContinue
│ ╚════════════════════╝ │
└────────────────────────┘
```

Back steps backward through the wizard before leaving the screen. Cards live in
a scroll container ⇒ `useScrollAwarePointer`.

---

## Battle

The core screen. **Hybrid framing:** GBA sprite staging up top, Genesis's own
tick timeline and skill grid below.

```
┌──┬─────────────────────────────┐
│t │ ╔═══════════╗         ▓▓▓   │  ← SpriteArena
│i │ ║enemy plate║       ▓▓███▓▓ │    enemy: sprite ↗ / plate ↖
│m │ ╚═══════════╝        ═════  │
│e │                             │
│l │       ‹ OutcomeBurst ›      │
│i │                             │
│n │   ▓▓▓          ╔══════════╗ │    ally: sprite ↙ (back-facing)
│e │ ▓▓███▓▓        ║ally plate║ │          plate ↘
│  │  ═════         ╚══════════╝ │
├──┴─────────────────────────────┤
│ Turn 4 · Tick 27    [BATTLE LOG]│
├────────────────────────────────┤
│ ╔════╗  HUGO ★3                │  ← leader panel
│ ║port║  HP ▓▓▓▓▓▓░░░░  84/120  │    UnitPortrait size="lg"
│ ╚════╝  AP ▓▓▓▓░░░░░░  40/100  │    ResourceBar × 2
│         [◆][◆][◆]              │    StatusChipBar compact
├────────────────────────────────┤
│ ┌────────────┐ ┌─────────────┐ │  ← ActionGrid
│ │Attack      │ │Nanite Slash │ │
│ │TU 8 · AP 0 │ │TU 8 · AP 20 │ │
│ └────────────┘ └─────────────┘ │
│ ┌────────────┐ ┌─────────────┐ │
│ │Hammer Bash │ │    SKIP     │ │
│ │TU12·AP35 ⏱3│ │             │ │
│ └────────────┘ └─────────────┘ │
└────────────────────────────────┘
```

**Timeline** runs vertically down the left edge — the tick stream is unbounded
and vertical scroll suits it. Now-line sits at `TIMELINE_NOW_FRACTION` (75 %)
from the top.

**Interaction**
- Tap skill → auto-target, or open target picker when >1 valid enemy
- Long-press skill → detail `Sheet`, battle freezes (`inspectingSkill`)
- Tap arena hotzone during dice → skip to the attack
- Tap status chip → status detail `Sheet`
- Back → pause ⇄ resume. **No navigation escape** — only LEAVE BATTLE in the
  pause menu exits.

**Overlays** — all `PromptOverlay` or `Sheet`:

| Trigger | Overlay | Blocking |
|---|---|---|
| Cross-team tick clash with `clashUniqueEnabled` | Clash QTE | yes |
| Same-team speed tie | Now/Later choice | yes |
| Player evade + counter skill | Counter prompt `[COUNTER] [SKIP]` | yes |
| Engine throw | `Toaster tone="fatal"` | yes |
| Insufficient AP | `Toaster tone="warn"` + button shake | no |

**HUD binds one unit.** The leader panel shows the party leader only; AI allies
appear on the timeline and in the arena but never in the HUD
(CLAUDE.md § Party leader).

---

## Battle Result

```
┌────────────────────────┐
│       V I C T O R Y     │  --t-display; gold (win) / blood (loss)
│                        │
│ ╔════════════════════╗ │
│ ║ ╔══╗ HUGO          ║ │  per-unit result rows
│ ║ ║pt║ XP ▓▓▓▓░░ +100║ │  greyscale portrait if fallen
│ ║ ╚══╝               ║ │
│ ╚════════════════════╝ │
│ ╔════════════════════╗ │
│ ║ Turns 14 · XP 200  ║ │  battle stats
│ ╚════════════════════╝ │
│ ╔════════════════════╗ │
│ ║      CONTINUE      ║ │
│ ╚════════════════════╝ │
└────────────────────────┘
```

Banner slams in on `steps(8)`. CONTINUE returns to `returnScreen` (Dungeon in
campaign flow, else Main Menu).

---

## Roster

```
┌────────────────────────┐
│ ‹  ROSTER              │
│ [Class▾][Rarity▾][A-Z] │  filter row
├────────────────────────┤
│  ┌────┐ ┌────┐ ┌────┐  │  PagedGrid 3 × 3
│  │port│ │port│ │port│  │  rarity border per card
│  │HUGO│ │HUST│ │TARA│  │
│  └────┘ └────┘ └────┘  │
│      ‹ ● ○ ○ 1/3 ›     │
└────────────────────────┘
```

Grid is scrollable ⇒ `useScrollAwarePointer`. Tap opens Character Detail
(**not yet built** — see below).

---

## Settings

Grouped rows inside `Panel`s: Audio (music / SFX volume, mute), Display
(quality tier, reduce animations, damage numbers), Notifications, Account.

Sliders are exempt from `useScrollAwarePointer` — they own their own drag
semantics. All other rows use it.

---

## Planned — not yet built

Design intent retained from the superseded docs. No route, screen file, or
`SCREEN_IDS` entry exists for these.

| Screen | Intent |
|---|---|
| **Character Detail** | Full stat block, skill list with level-up costs, passive description, lore. Reached from Roster. |
| **Skill Upgrade** | `Sheet` over Character Detail — spend currency to raise `currentLevel`, showing the `levelUpgrades` diff (before → after) per patched field. |
| **Mastery Road** | Per-character progression track; milestone nodes unlock skills and passives. |

Build them from this catalogue when the time comes — they need no new
primitives beyond `Panel`, `Sheet`, `ResourceBar`, and `UnitPortrait`.
