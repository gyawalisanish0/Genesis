# Genesis — Component Library

Every reusable UI part, its anatomy, props, and states. Screens
(`02-screens.md`) compose from this catalogue and add nothing bespoke.

Foundations (pixel grid, palette, panel variants, motion) come from
`00-design-system.md`.

**Rule:** if a screen needs a visual that isn't here, add it here first. A
one-off implemented inside a screen file is how the previous system grew six
different modal backdrops.

---

## Consolidation

Redundancy found in the current implementation, and what replaces it. This is
the intended refactor target, not a description of today's code.

| Today | Replaced by | Why |
|---|---|---|
| `HintToaster` + `ErrorToaster` + `BattleErrorToast` | **`Toaster`** (one component, 3 tones) | Three implementations; two already share a stylesheet. Only difference is tone, persistence, and whether it blocks. |
| `SkillInfoOverlay`, `StatusInfoOverlay`, `ChestOverlay`, `BattleLogOverlay` + backdrops | **`Sheet`** + content children | Six separate `.backdrop` rules (`inset: 0` + `--bg-overlay`) across six files. |
| `TeamCollisionOverlay`, `ClashQteOverlay` | **`PromptOverlay`** + content children | Both are "battle halts, player chooses, battle resumes". Only the body differs. |
| `UnitPortrait` · battle portrait circle · timeline marker | **`UnitPortrait`** (`size` prop) | Three renderings of the same thing. `BattleScreen` drew its own circle. |
| `--r-sm` … `--r-xl` | nine-slice `Panel` | Rounded corners are not in the art direction. |
| `AsciiArena`, `AsciiPortrait`, `SymbolFigure`, `dungeonTileArt`, `src/ascii/*` | **`SpriteArena`**, `UnitPortrait`, `SpriteActor`, tileset `color`/`art` | ASCII render layer removed. |

---

## Primitives

### `Panel`

The nine-slice box. The only container in the system.

```
╔════════════════════╗
║ ┌────────────────┐ ║   variant: default | raised | sunken | active | danger
║ │    children    │ ║   border slice 4 art px (8 dp)
║ └────────────────┘ ║
╚════════════════════╝
```

| Prop | Type | Default |
|---|---|---|
| `variant` | `'default' \| 'raised' \| 'sunken' \| 'active' \| 'danger'` | `'default'` |
| `children` | `ReactNode` | — |
| `className` | `string?` | — · layout (size, padding, flex) belongs to the consumer |

`panelClass(variant)` exports the same class pair for consumers that need the
surface on an existing element rather than a wrapper `<div>` — that is how
`PixelButton` composes it.

---

### `PixelButton`

Replaces `PrimaryButton`. A `Panel variant="raised"` with a label and press
behaviour.

| Prop | Type | Default |
|---|---|---|
| `variant` | `'primary' \| 'secondary' \| 'danger' \| 'ghost'` | `'primary'` |
| `disabled` | `boolean` | `false` |
| `fullWidth` | `boolean` | `true` |
| `onPress` | `() => void` | — |
| `label` | `string?` | — · accessible name when `children` is a glyph |

Composes Panel's surface via CSS Modules `composes`, then overrides
`--panel-fill`/`--panel-inner` per variant — the border mechanics exist in
exactly one place.

| Variant | Height | Fill | Label |
|---|---|---|---|
| primary | 56 dp | `cyan-4` | `--text-on-accent` |
| secondary | 56 dp | `hull-4` | `--text-primary` |
| danger | 56 dp | `blood-3` | `--text-on-accent` |
| ghost | 48 dp | transparent, 1 art px `hull-4` border | `--text-secondary` |

**States** — `default` · `pressed` (offset down 1 art px, no shadow) ·
`disabled` (fill → `hull-3`, label → `--text-muted`) · `focus` (border →
`cyan-4`).

---

### `ResourceBar`

Segmented HP / AP / XP bar. **Segmented, not continuous** — the fill is drawn
as discrete 2 art px blocks with 1 art px gaps, so it ticks down visibly.

```
┌────────────────────────────┐
│▓▓▓▓▓▓▓▓▓▓▓▓░░░░░░░░░░░░░░░│  sunken track, blocked fill
└────────────────────────────┘  optional  value/max  label (--t-micro)
```

| Prop | Type | Note |
|---|---|---|
| `variant` | `'hp' \| 'ap' \| 'xp'` | drives height + fill ramp |
| `value` | `number` | |
| `max` | `number` | |
| `shieldHp` | `number` | overlay segment drawn past `value` |
| `showLabel` | `boolean` | renders `value/max` |

| Variant | Height | Fill |
|---|---|---|
| hp | 8 dp | `blood-3`, → `flare-3` under 50 %, → `blood-2` under 25 % |
| ap | 6 dp | `azure-3` |
| xp | 4 dp | `cyan-4` |
| shield | overlay | `bone-3` |

Tween is `steps(16)` — never a smooth width transition.

---

### `UnitPortrait`

Portrait with a rarity-coloured border. Falls back to the name's initial while
art is unauthored or fails to load.

| Prop | Type | Default |
|---|---|---|
| `name` | `string` | — |
| `rarity` | `1–7` | — |
| `defId` | `string?` | enables the portrait image |
| `size` | `'sm' \| 'md' \| 'lg' \| 'xl'` | `'md'` |
| `greyscale` | `boolean` | `false` — fallen units |

Sizes: `sm` 40 · `md` 64 · `lg` 96 · `xl` 120 dp. Border is 2 art px in the
rarity colour; rarity 7 alternates per `00-design-system.md § Rarity`.

---

### `StatusChip` / `StatusChipBar`

| Prop (bar) | Type |
|---|---|
| `chips` | `StatusChipData[]` |
| `size` | `'full' \| 'compact'` |
| `onTap` | `(chip) => void` |

```
┌────┐          full:    32 dp icon + duration badge + label
│icon│ 3t       compact: 16 dp icon + badge only
└────┘
```

Duration badge renders per `durationDisplay`: `ticks` → `"3t"`, `turns` →
`"3"`, `fade` → bar, `none` → hidden. Chips smaller than `--touch-min` get a
padded hit area. Tapping opens the status detail `Sheet`.

---

### `PagedGrid<T>`

Generic paged grid — roster (3 × 3), team select (5 × 4).

| Prop | Type |
|---|---|
| `items` | `T[]` |
| `cols` / `rows` | `number` |
| `renderItem` | `(item, index) => ReactNode` |
| `emptyText` | `string?` |

Partial rows centre horizontally (never left-clustered). Swipe threshold 40 px.
Pagination row hides at ≤ 1 page. Arrows are `--touch-min`; dots are 8 dp,
active `cyan-4`.

---

### `Sheet`

Bottom sheet + backdrop. **Replaces four bespoke overlay implementations.**

| Prop | Type | Default |
|---|---|---|
| `open` | `boolean` | — |
| `title` | `string?` | — |
| `onClose` | `() => void` | — |
| `dismissible` | `boolean` | `true` — backdrop tap + back button close |
| `children` | `ReactNode` | — |

Backdrop `--bg-overlay`, tap-to-close. Panel rises from the bottom edge with
`steps(4)` over 200 ms, drops in 120 ms. Registers a back-button handler while
open. Content scrolls internally; the sheet never exceeds 80 % canvas height.

---

### `PromptOverlay`

A blocking decision the battle waits on. **Replaces `TeamCollisionOverlay` and
`ClashQteOverlay` chrome.**

| Prop | Type |
|---|---|
| `title` | `string` |
| `children` | `ReactNode` — the decision body |
| `actions` | `{ label, variant, onPress }[]` |

Not dismissible — the player must choose. Backdrop is opaque
(`--bg-overlay`); everything behind it is inert.

---

### `Toaster`

Transient notification chip. **Replaces `HintToaster`, `ErrorToaster`, and
`BattleErrorToast`.**

| Prop | Type | Default |
|---|---|---|
| `message` | `string \| null` | — `null` renders nothing |
| `tone` | `'hint' \| 'warn' \| 'fatal'` | `'hint'` |
| `onceId` | `string?` | localStorage key — shows at most once ever |
| `onDismiss` | `() => void` | — |

| Tone | Border | Duration | Blocking |
|---|---|---|---|
| `hint` | `cyan-4` | `HINT_TOASTER_DURATION_MS` | no |
| `warn` | `flare-3` | `HINT_TOASTER_DURATION_MS` | no |
| `fatal` | `blood-3` | `BATTLE_ERROR_TOAST_MS` | yes — dims screen, offers an exit action |

`onceId` present ⇒ persistence-backed one-shot hint. Absent ⇒ shows on every
non-null message, restarting the timer.

---

## Battle components

### `SpriteActor`

One combatant on the battle stage. Drives a sprite sheet from
`AnimationManifest`.

| Prop | Type |
|---|---|
| `defId` | `string` |
| `manifest` | `AnimationManifest \| null` |
| `state` | `'idle' \| 'attack' \| 'hurt' \| 'dodge' \| 'death'` |
| `facing` | `'front' \| 'back'` |
| `damaged` | `boolean` — swaps to `*_damaged` states below the HP threshold |

Sprite is 48 × 48 art px (96 dp), anchored bottom-centre on a **platform
ellipse** — a 64 × 16 art px shadow disc in `hull-1`. Playback uses `steps(n)`
at the manifest's `frameRate`; `repeat: -1` loops (idle), `0` plays once.

Ally renders `facing="back"`, enemy `facing="front"` — the GBA convention.

---

### `CombatantPlate`

The floating name/HP box beside each combatant. Pure GBA chrome.

```
╔═══════════════════════╗
║ HUGO            Lv 12 ║   --t-label
║ ▓▓▓▓▓▓▓▓▓▓░░░░░  84/120║   ResourceBar variant="hp"
║ ▓▓▓▓▓░░░░░░░░░░       ║   ResourceBar variant="ap"
║ [◆][◆][◆]             ║   StatusChipBar size="compact"
╚═══════════════════════╝
```

| Prop | Type |
|---|---|
| `info` | `TurnDisplayUnitData` |
| `side` | `'ally' \| 'enemy'` |
| `onChipTap` | `(chip) => void` |

Enemy plate sits upper-**left** (opposite its sprite); ally plate lower-**right**.
Both are `Panel variant="default"`.

---

### `SpriteArena`

The battle stage. Owns `BattleArenaHandle` — the imperative contract
`BattleEngine` drives.

**Staging (GBA framing):**

```
┌──────────────────────────────────┐
│ ╔═══════════╗            ▓▓▓     │  enemy plate ↖ / enemy sprite ↗
│ ║enemy plate║          ▓▓███▓▓   │
│ ╚═══════════╝           ═════    │  platform ellipse
│                                  │
│         ‹ outcome burst ›        │  centre band: dice + feedback
│                                  │
│    ▓▓▓            ╔═══════════╗  │  ally sprite ↙ / ally plate ↘
│  ▓▓███▓▓          ║ally  plate║  │
│   ═════           ╚═══════════╝  │
└──────────────────────────────────┘
```

`BattleArenaHandle` methods: `setTurnState` · `clearTurn` · `playDice` ·
`skipActiveDice` · `playAttack` · `playDeath` · `showTurnDisplay` ·
`hideTurnDisplay`.

Currently a placeholder rendering labelled slots — sprite sheets are not
authored yet. The handle contract is real and already engine-driven.

---

### `TimelineStrip` / `TimelineMarker`

Genesis's own mechanic — no Pokémon equivalent. Kept, restyled.

```
 tick →  12    14    17      21          28
        ─●─────○─────○───────○───────────○──
         ▲ now
```

Markers are 24 dp `UnitPortrait size="sm"` crops on the tick axis; the active
marker is 32 dp with a `cyan-4` ring and a 2-frame pulse. Ally markers tint
`moss-3`, enemy `blood-3`. Reposition is `steps(4)` / 200 ms.

Auto-recenters after `TIMELINE_RECENTER_DELAY_MS` of scroll-idle.

---

### `SkillButton` / `ActionGrid`

The bottom half of battle — Genesis's grid, **not** the GBA four-option box.

```
┌──────────────────┐ ┌──────────────────┐
│[icon] Nanite Slash│ │[icon] Hammer Bash│
│ AP 20 · TU 8      │ │ AP 35 · TU 12  ⏱3│
└──────────────────┘ └──────────────────┘
```

| State | Presentation |
|---|---|
| available | `Panel variant="raised"` |
| selected | `Panel variant="active"` |
| insufficient AP | fill `hull-3`, label `--text-muted`, AP cost `blood-3` |
| on cooldown | dimmed + `⏱n` badge (ticks or turns remaining) |
| locked (`minTurns`) | dimmed + lock glyph |

Long-press opens the skill detail `Sheet` and freezes the battle
(`inspectingSkill`). Grid pulses `cyan-4` on player turn start.

---

### `OutcomeBurst`

Dice result. Slams in, holds, cuts out — `steps(8)`, no fade.

| Outcome | Text | Colour |
|---|---|---|
| Boosted | `BOOSTED!` | `--accent-gold` |
| Hit | `HIT!` | `--text-primary` |
| Evade | `EVADED!` | `--accent-evasion` |
| Fail | `MISS!` | `--text-muted` |

Tap anywhere in the arena hotzone skips to the attack
(`skipActiveDice` → `skipDiceAnim`).

---

### `TurnDisplayPanel`

Pre-resolution preview: actor, skill, costs, target. `Panel variant="default"`,
auto-dismisses after the engine-supplied duration.

---

### `BattleLog`

Scrolling combat history inside a `Sheet`. Opened by the `BATTLE LOG` button;
auto-scrolls to newest. Log lines use `--t-body` (sans — it is prose).

---

## Dungeon components

### `DungeonGrid`

48 dp cells, follow-camera (party always centred), `overflow: hidden`.
Owns `DungeonArenaHandle`.

Tiles fill with `TilesetDef.tiles[id].color` until tile art is authored.
Unrevealed cells are solid `hull-1`.

### `EntityToken`

16 × 16 art px sprite on a dungeon cell.

| State | Presentation |
|---|---|
| in range | full colour |
| out of range (remembered) | greyscale |
| wave-selectable | `cyan-4` ring, 2-frame pulse |
| spotted | shake, 2 art px amplitude |

### `StatusPill`

Compact top-of-screen readout — stage objective, party HP. `Panel` with
`--t-label`, 32 dp tall.

---

## Layout shells

### `ScreenShell`

Outermost element of every screen. Applies safe-area padding per the screen's
`SafeAreaMode` (`full` / `top-only` / `none`). Mandatory — see `CLAUDE.md`
§ Screen System.

### `TopBar`

Back affordance + title + optional right action, 48 dp tall. Used by roster,
settings, campaign, pre-battle. Battle and dungeon do **not** use it (they own
their full canvas).
