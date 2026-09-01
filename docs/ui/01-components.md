# Genesis — Component Library

Every reusable UI part, its anatomy, props, and states. Screens
(`02-screens.md`) compose from this catalogue and add nothing bespoke.

Foundations (pixel grid, palette, panel variants, motion) come from
`00-design-system.md`.

**Rule — reuse first.** Walk this ladder top-down and stop at the first rung
that works:

1. **Use** a component here as-is.
2. **Extend** one with a new prop (`Sheet` gained `placement`; `PromptOverlay`
   gained `onBackdropTap`). Prefer this over a new component.
3. **Compose** existing ones (`Panel` + `PixelButton` + `ResourceBar`).
4. **Extract** a new shared component — catalogue it *here first*, then build it
   once in `components/`.
5. **Screen-local styling** for genuinely one-off **content** — never chrome.

There is no sixth rung. A one-off inlined in a screen file is how the previous
system grew six different modal backdrops, three toasts, and three portrait
renderings. `npm run validate:ui`'s `no-duplicate-chrome` rule now fails the
build when a screen reaches for `--bg-overlay` instead of `Sheet`.

---

## Consolidation

Redundancy found in the current implementation, and what replaces it. This is
the intended refactor target, not a description of today's code.

| Today | Replaced by | Why |
|---|---|---|
| ~~`HintToaster` + `ErrorToaster` + inline AP chip~~ ✅ | **`Toaster`** (3 tones) | Done — a fourth duplicate turned up inline in `BattleScreen`. The blocking `BattleErrorToast` composes `PromptOverlay` rather than being a Toaster tone. |
| ~~`SkillInfoOverlay`, `StatusInfoOverlay`, `ChestOverlay`, `BattleLogOverlay` + backdrops~~ ✅ | **`Sheet`** + content children | Done — four bespoke backdrops collapsed into one shared `Sheet`. |
| ~~`TeamCollisionOverlay`, `ClashQteOverlay`~~ ✅ | **`PromptOverlay`** + content children | Done — blocking chrome shared; each keeps its own body. |
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

Backdrop + dismissible content panel. **Replaces four bespoke overlay
implementations** (skill info, status info, battle log, chest) — one backdrop,
one animation, one close contract instead of four.

| Prop | Type | Default |
|---|---|---|
| `open` | `boolean` | `true` — render nothing when false |
| `title` | `string?` | — · renders a header bar with the title + ✕ |
| `onClose` | `() => void` | — |
| `dismissible` | `boolean` | `true` — enables backdrop-tap, ✕, and Esc |
| `placement` | `'bottom' \| 'centre'` | `'bottom'` |
| `accent` | `string?` | — · overrides the panel border colour (status chip colour, chest gold) |
| `children` | `ReactNode` | — |

Backdrop `--bg-overlay`, tap-to-close (when `dismissible`). Content is a
`Panel variant="default"` that scrolls internally and never exceeds 80 % of the
canvas. `placement="bottom"` is a full-width panel rising from the bottom edge;
`placement="centre"` is a width-capped card that rises and settles in the middle.
Both animate with `--motion-modal-in` (`steps(4)`). When `dismissible` is false
(chest — the player must act) there is no ✕, no backdrop-tap, and no Esc.

**Back button is the owning screen's job, not the Sheet's.** `backButtonRegistry`
holds one handler at a time (CLAUDE.md § Input Handling); a Sheet that
self-registered would clobber a screen's existing chain — in battle,
`BattleScreen` runs a single `useBackButton` that closes overlays in priority
order (skill → chip → log → pause). Wire hardware-back to `onClose` there, the
same place the rest of the screen's back logic already lives.

---

### `PromptOverlay`

A blocking decision the battle waits on. **Replaces `TeamCollisionOverlay` and
`ClashQteOverlay` chrome.**

| Prop | Type | Default |
|---|---|---|
| `title` | `string` | — |
| `subtitle` | `string?` | — · progress line ("2 of 3", "Round 1 of 3") |
| `children` | `ReactNode` | — · the decision body |
| `actions` | `{ label, variant?, onPress }[]?` | — · rendered as `PixelButton`s in a row |
| `onBackdropTap` | `() => void` | — · when the *surface* is the input |

Never dismissible — there is no ✕, no Esc, no tap-to-close. The player must
decide; the engine is blocked until they do. Backdrop is `--bg-overlay`,
everything behind it inert.

**`actions` and `onBackdropTap` are both optional and mutually exclusive in
practice** — a prompt takes input either through buttons (team collision:
NOW / LATER) or through the surface itself (clash QTE: tap anywhere to stop the
needle). Do not force buttons onto a prompt whose body *is* the interaction.

---

### `Toaster`

Transient, **non-blocking** notification chip. **Replaces `HintToaster`,
`ErrorToaster`, and the inline AP-warning chip in `BattleScreen`.**

| Prop | Type | Default |
|---|---|---|
| `message` | `string \| null` | — · `null` renders nothing |
| `tone` | `'hint' \| 'warn' \| 'error'` | `'hint'` |
| `position` | `'top' \| 'bottom' \| 'inline'` | `'top'` |
| `onceId` | `string?` | — · localStorage key; shows at most once ever |
| `durationMs` | `number?` | `HINT_TOASTER_DURATION_MS` |
| `dismissible` | `boolean` | `true` — tap to close |
| `onDismiss` | `() => void` | — · fired on tap **and** on auto-expiry |

| Tone | Border | Glyph |
|---|---|---|
| `hint` | `--accent-genesis` | 💡 |
| `warn` | `--accent-warn` | ⚠ |
| `error` | `--accent-danger` | ✖ |

`onceId` present ⇒ persistence-backed one-shot hint (never shown twice on a
device). Absent ⇒ shows whenever `message` is non-null, restarting the timer.

`position="inline"` stretches within the nearest positioned ancestor instead of
the screen — for a chip that belongs to a panel (the AP warning sits over the
action grid). Pair with `dismissible={false}` so it never eats a tap meant for
the UI underneath.

> **A blocking error is not a Toaster.** An earlier draft of this spec gave
> `Toaster` a `fatal` tone that dimmed the screen and offered an exit action.
> That would have meant re-implementing `PromptOverlay`'s backdrop and actions
> row inside `Toaster` — the exact duplication this catalogue exists to
> prevent. Blocking messages compose `PromptOverlay` instead (rung 3 of the
> reuse ladder); see `BattleErrorToast`, which supplies a countdown subtitle
> and a LEAVE BATTLE action.

---

## Battle components

### `SpriteActor`

One combatant on the battle stage. Drives a sprite sheet from
`AnimationManifest`.

| Prop | Type |
|---|---|
| `defId` | `string` |
| `name` | `string` — seeds the fallback letter |
| `manifest` | `AnimationManifest \| null` |
| `facing` | `'front' \| 'back'` |
| `isDamaged` | `boolean` — swaps to `*_damaged` states below the HP threshold |
| `dead` | `boolean` |
| `acting` | `boolean` — pauses the idle bob for the resolving combatant |

Sprite is 48 × 48 art px (96 dp), anchored bottom-centre on a **platform
ellipse** — a 64 × 16 art px shadow disc in `hull-1`. Playback uses `steps(n)`
at the manifest's `frameRate`; `repeat: -1` loops (idle), `0` plays once.

Ally renders `facing="back"`, enemy `facing="front"` — the GBA convention.
Facing resolves through `withFacing()` in `core/battle/AnimationResolver.ts`: a
`{state}_back` entry wins when the actor faces away, otherwise the front pose is
reused and mirrored. **Mirroring is a placeholder, not a substitute** — a
mirrored front pose still plainly faces the camera, so a real back pose is
required art, and it is the most-seen asset in the game.

`display.scale` in the manifest is deliberately **ignored**: it was authored
against the deleted Phaser coordinate space and double-scales against the CSS
box. The slot is a fixed 96 dp and the frame is fitted to it, which holds for
any source resolution.

**Built.** Renders real frames where art exists and a lettered fallback box
where it does not, so the stage is complete before any sprite is authored.

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

**Built** as the GBA duel frame: enemy front-facing upper-right with its plate
upper-left, ally back-facing lower-left with its plate lower-right. The pair on
stage is whatever `setTurnState(acting, target)` last named, so a party larger
than one shows whoever is in the current exchange — the Pokémon convention.

`allyDefIds` decides which side a combatant occupies. Without it the arena
assumed *acting = ally*, which put an attacking enemy in the player's slot.

Stage state and the imperative handle live in `useArenaStage.ts`; the component
itself is presentational.

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
| Graze | `GRAZE!` | `--text-muted` |

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

### `ErrorBoundary`

The last line of defence. A React class component — the only kind that can
catch a render error — wrapping a subtree so a throw inside it replaces that
subtree with a recoverable panel instead of unmounting the app.

| Prop | Type | Default |
|---|---|---|
| `children` | `ReactNode` | — |
| `area` | `string` | — · named in the panel and the console line, so a report says *where* |
| `onRecover` | `() => void` | — · second action beside RELOAD; omit for reload-only |
| `recoverLabel` | `string` | `'BACK TO MENU'` |

Composes `Panel` + `PixelButton` (rung 3). It deliberately depends on **nothing
else** — no router, no screen context, no store. A boundary that needs the
thing that just broke is not a boundary.

Mounted at two levels, which do different jobs:

| Level | Where | Catches | Recovery |
|---|---|---|---|
| Root | `main.tsx`, around `<App />` | anything, including a failure in the router or providers | reload |
| Screen | `App.tsx`, inside `<Routes>` | one screen's render | reload **or** back to the menu, session intact |

> **This is not the engine's error path.** `BattleContext.safeEngineCall`
> already wraps synchronous engine calls and surfaces failures through
> `BattleErrorToast`, which is better UX because the battle can end cleanly.
> The boundary catches what that cannot: a throw during render, and anything
> escaping the engine's own async timers. Reaching the boundary means a bug got
> past the engine's own handling — it is a backstop, not a design.
