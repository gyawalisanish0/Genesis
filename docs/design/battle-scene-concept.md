# Battle scene — concept and findings

> Produced 2026-08-23 by a 13-agent workflow (6 subsystem readers → 3 independent
> concept proposals → 3 judges on feasibility / fiction fidelity / player legibility
> → synthesis), plus direct measurement of the shipped art.
> Report: https://claude.ai/code/artifact/562a9584-59df-4f7f-8589-9eb27caedb04

## The finding in one line

The battle scene is not unbuilt — it is a fully authored animation pipeline
terminating in a stub renderer.

- `SpriteArena.playAttack()` declares 10 parameters and binds 9; `customSequence`
  (the authored choreography) is dropped **by arity**. `SpriteArena.tsx:42` vs `:104`.
- `setTurnState()` declares 5 and binds 2 — both animation manifests and the
  `isDamaged` flags are discarded.
- `AnimPhase` (`core/types.ts:393`) is a 15-verb language with **no executor**.
  Commit `fd2587b` ("Remove orphaned Phaser renderer") deleted `SequenceRunner.ts`
  and `DefaultSequences.ts`. `core/types.ts:384` still points at the deleted path.
- `AnimationResolver` exports 5 resolvers; 4 are imported only by their own test.
- **14 of the 15 AnimPhase verbs need no art.** Only `playAnim` requires a PNG.

## Sprite scale — measured, not assumed

`hugo_001/idle/0.png` is **not** pixel art on a grid: 25,305 distinct colours,
158 alpha levels, run lengths peaking at 1px, and a flat edge-offset histogram at
every grid size tested (N=4 → 26.4% vs 25% uniform; N=8 → 14.5% vs 12.5%).
It is pixel-art-*styled* illustration rendered smooth at high resolution.

There is therefore no exact downsample available. Content box is 220×501 (~1:2.3),
so at 64px tall the head lands in ~10×10px. `design-philosophy.md:61-63` derives
48×48 from the GBA 26.7%-of-canvas ratio, so that number is fiction-derived.

**Open decision:** ship the existing 49 frames as-is and narrow the grid rule to UI
chrome only, or hold the grid and redraw Hugo at 48×48. See the report.

## Dead for want of data, not code

| System | State | Missing |
|---|---|---|
| Status chips | 27 of 31 invisible | `ui.chip` blocks in StatusDef JSON |
| `ClashQteOverlay` | never fires | zero `clash` keys in character data |
| `CounterPromptOverlay` | never fires | no player-side counter-tagged skill |

## Still unanswered in the fiction

`CONCEPT.md:648` — the only unticked item in the concept doc's checklist:
**"What does 'power' look like visually on the Tick stream?"**

---

# THE GATE — final committed concept for the Genesis battle scene

## Thesis

The tick stream is a 40 dp spine that feeds a single glowing gate, and everything below the gate is a **motion rig** — each combatant is a transform stack that shoves, dodges, flashes, shakes and dissolves identically whether its slot holds a 48-art-px sprite or a lettered fallback box — so ordering, tempo and consequence are all legible on day one, before a single pixel is authored.

**Spine taken from:** Two-Pose Stage (art-independent rig). **Grafted:** TickGhost, the promoted gate, and `onTickDisplaced` from The Approach; MessageBox, the real platform PNG, `allyDefIds`, and the DataService fixes from Duel Frame.

**Killed outright:**
- Duel Frame's **64×64 re-standardisation** — it was derived from a false measurement. I re-checked `public/images/characters/hugo_001/idle/0.png`: 512×512, ~25k distinct opaque colours, ~26% of 2×2 blocks non-uniform. There is no native art grid to halve. 48×48 art px stays, because `docs/design/design-philosophy.md:61-63` derives it from the 26.7%-of-canvas GBA ratio, and that ratio is the fiction.
- Duel Frame's **two-combatant stage** — all three shipped stages deploy `[hugo_001, husty_001, tara_001]` with `playerControl: 'single'`, so a 2-slot arena permanently hides two of the player's own units. Replaced with 3-per-side fan decks.
- The Approach's **264 dp full-width stream with 96 dp plates** — a plate row spans 4.4 ticks at `TIMELINE_PX_PER_TICK = 10` and the shipped names ("Kiragen Controller", 18 chars) truncate identically at Silkscreen 12 dp in 96 dp. The stream stays a rail; identity moves to a 16-art-px token.
- Two-Pose Stage's **`border-radius: 50%` platform ellipse** — it passes `uiRules.ts` (`ALLOWED_RADIUS` whitelists `50%`) and fails pixel rule 1, because a browser-rasterised ellipse antialiases its own edge. The platform is a 64×16 art px PNG.
- Two-Pose Stage's **CSS 2 dp particle squares** — 1 art px reads as screen dirt on a phone. Replaced with a 3-frame 32×32 art px impact ring.
- The word **"Turn"** anywhere in the chrome. `CONCEPT.md:106` — no rounds. The top bar reads `TICK 27` and nothing else.

**Stated position on HUD diegesis** (the docs leave it open): the chrome *is* the Commander's instrumentation. That is why `--glow-*` is licensed on chrome and banned on sprite art, and it is why an odds readout is legal — it is an instrument, not a tutorial.

---

## Layout — 360 × 640 dp portrait, `ScreenShell safeAreaMode='top-only'`

### Vertical bands (full width unless noted)

| y | Band | dp | Notes |
|---|---|---|---|
| 0–24 | **Top bar** | 24 | `TICK 27` at `--t-micro`, left. Nothing else. |
| 24–260 | **Arena** | 236 | `flex: 1 1 auto; min-height: 200dp`. Absorbs all safe-area variance. |
| 260–264 | **The Gate** | 4 | Full-width rule, `--accent-genesis` + `--glow-genesis`. Chrome, so glow is licensed. |
| 264–304 | **MessageBox** | 40 | Panel `default`. One line + 40 dp `▸` chevron (48 dp hit rect via `padding-block:4dp; margin-block:-4dp`). |
| 304–400 | **Leader panel** | 96 | Binds the party leader only (`CLAUDE.md` principle 4). |
| 400–592 | **ActionGrid** | 192 | Full 360 dp width. |
| 592–640 | **Command bar** | 48 | `8 + SKIP 104 + 8 + ROLL 232 + 8 = 360`. Bottom-edge anchored — best thumb reach. |

**24 + 236 + 4 + 40 + 96 + 192 + 48 = 640 ✓**

### Horizontal split, y 24 → 400

`40 dp TimelineStrip | 320 dp main column`. Below y=400 the ActionGrid and command bar take the full 360 dp — controls get width, the world gets the spine.

### TimelineStrip (40 dp × 376 dp, y 24–400)

- 32 dp `TickToken` per unit (16×16 art px at exactly 2×), 4 dp gutters.
- **Future segment** y 24–260 = 236 dp = **~23 ticks** at `TIMELINE_PX_PER_TICK = 10`.
- **Past segment** y 264–400 = 136 dp = ~13 ticks, carrying wake bars.
- The gate is where the stream terminates and the stage begins. A token descending the rail lands on the gate and its sprite rises in the ally deck directly above it.
- Existing drag-to-pan + `TIMELINE_RECENTER_DELAY_MS` auto-recenter port over verbatim from `BattleScreen.BattleTimeline`.

### Arena internals (320 × 236 dp) — CSS grid, `overflow: hidden`

`grid-template-rows: 108dp 32dp 96dp`

- **Row 1, ENEMY DECK (y 0–108).** Rank 0 (nearest) feet at y=100, sprite 96 dp spanning 4–100, platform PNG (64×16 art px = 128×32 dp) spanning 92–108. Ranks step **inward 56 dp and up 4 dp**: x = 216 / 160 / 104, right edge of rank 0 at 312.
- **Row 2, CENTRE LANE (y 108–140), 32 dp.** `OutcomeBurst` at `--t-heading` (24 dp / lh 32 dp). Projectile tracer flies along y=124. Tap-to-skip chip pinned to the lane base.
- **Row 3, ALLY DECK (y 140–236).** Rank 0 feet at y=228, sprite spanning 132–228 (8 dp of deliberate near-battler crowding into the lane; `OutcomeBurst` is z-above), platform 220–236. Ranks: x = 8 / 64 / 120.
- **Cap 3 visible per side**, `+N` micro chip beyond. This is a **UI cap only** — `core/` roster stays an open collection, and the arena never enumerates it (`setTurnState` and the `roster` prop drive it).
- **Plates** (`CombatantPlate`, acting/target pair only, crossed per `docs/ui/01-components.md:321`): enemy 140×44 at (8,8); ally 140×44 at (172,184). Opaque, z-above the fan — a back-rank sprite is partially occluded and that reads as depth. Non-plated units get a 64×8 dp `ResourceBar variant='hp'` on their platform.
- **Ambient:** six 2 dp squares in `--hull-4` drifting at two depths, `steps(12)` over 8 s. **One of the six is `--void-1` and is never labelled** — the pixel-era expression of the `·` Creator residue (`docs/lore/perception-tiers.md:30-35`), which currently has no home outside the retired ASCII register. Gated off on `data-quality="low"`.

### Leader panel (320 × 96 dp)

`8 pad + 80 dp row + 8 pad`. Left: `UnitPortrait size='md'` (64 dp). Right column: name + `Lv n` (16) · 4 · HP `ResourceBar` 8 dp + `84/120` readout (16) · 4 · AP `ResourceBar` 6 dp + `40/100` readout (16) · 4 · `StatusChipBar size='compact'` (16) = 76 dp in 80. The AP **number** is not dropped — today's `PortraitPanel` shows it and losing it would be a regression.

### ActionGrid (360 × 192 dp)

`8 + 84 + 8 + 84 + 8`. Cards 168 × 84 dp in a fixed 2×2 grid — exactly `MAX_SKILL_SLOTS`, never paged. A unit equips **up to 4 active skills** (CONCEPT.md § Unit Anatomy), so a fifth is not content the grid should scroll to; it is content that should not exist. An earlier draft of this line specified paging "when a unit has >4 skills", which contradicts that cap and reads as licence to author a fifth. Card anatomy: name (16) · `TU 8 · AP 20 · +5 AP` (16) · **odds strip** (8) · badge row (16).

The **odds strip** is one 8 dp horizontal `ResourceBar`-style segmented bar split into four proportional widths in `--accent-gold` / `--text-primary` / `--accent-evasion` / `--text-muted`. No numbers, no legend. The widths *are* the probabilities for this caster and this skill after the `precision/50` multiplier. It is a shape, not an explanation — which is the only form `docs/design/design-philosophy.md:121-125` permits.

Every dimension above is a multiple of 2 dp = one whole art pixel.

---

## Beat-by-beat: one full player turn

1. **`advance_tick`.** Every token on the rail slides down, 200 ms `steps(4)` (`--motion-timeline`). The leader's token comes to rest on the gate; the gate flashes one frame.
2. **`clash_check`** finds one controlled unit at `tickValue`, fires `onUnitTurnStart` once per `${unitId}:${tick}`, calls `showPlayerTurnUnits(actor)` → `cb.onSetTurnState(actingDefId, targetDefId, actingManifest, targetManifest, isDamaged)` (`BattleTickRunner.ts:149-152`). Step → `player_turn`, UI phase `'player'`.
3. **The arena finally spends all five arguments.** The leader's `SpriteActor` in ally rank 0 steps forward 8 dp and gains a 2 dp hard outline in `--accent-genesis` — a four-way `drop-shadow` chain at blur 0, not a glow, so it is legal on sprite art. Ally `CombatantPlate` slides in bottom-right, enemy plate top-left. ActionGrid pulses cyan.
4. **Player taps NANITES SLASH.** `BattleContext.selectSkill` auto-targets and calls `arenaRef.current.setTurnState(...)` directly (`BattleContext.tsx:609-613`). The target's plate flips to `Panel variant='active'` (cyan-4 outer line) — a whole object asserts itself as the target. On the rail, a dimmed `TickGhost` appears 8 ticks above the gate labelled `+8 TU`. MessageBox: `NANITES SLASH — TU 8 · AP 20 · +5 AP`. The card's odds strip fills.
5. **Player taps HAMMER BASH instead.** The ghost jumps to `+14 TU`, the AP preview reads `+9 AP`, and the odds strip redraws. Two taps have exposed the entire TU/AP tempo trade — the game's core economy, which is invisible today — before anything is committed.
6. **ROLL.** 250 ms pre-delay (`BattleScreen.tsx:548`) → `executeSkill` (`BattlePlayerActions.ts:19`). All combat math resolves synchronously. `showTurnDisplay` (:69), then `playDice` (:107). Step → `player_acting`.
7. **`OutcomeBurst`** slams `BOOSTED!` into the 32 dp lane in `--accent-gold` — 8 dp offset collapsing over `steps(2)`, then flat hold, no fade, no scale. `TAP TO SKIP` chip at the lane base. Holds `DICE_RESULT_DISMISS_MS = 1200`, or the arena hotzone tap fires `skipActiveDice` + `skipDiceAnim` (`BattleEngine.ts:228`).
8. **`playAttack` arrives with all ten arguments** and `SequenceRunner` starts. Boosted branch: 80 ms backward wind-up, then a **1.5× shove of 120 dp** (`meleeDashDx = 80`) over 190 ms `steps(3)`, attack pose playing across the outbound leg. The div moved; no PNG did.
9. **Contact, one frame.** Target's `mask-image` silhouette flashes flat `--accent-gold` for 96 ms and cuts. The 3-frame 32×32 art px impact ring plays at 10 fps. The whole `.arena` translates ±4 dp on a 320 ms `steps(4)` shake. Boosted vs Hit is now readable from dash distance, flash colour and shake magnitude alone.
10. **`parallel[damageNumber, feedback]`.** `★ −34` rises 24 dp over 800 ms `steps(8)` above the target and **cuts** (no fade — pixel rule 5). `−34 HP` prints in the lane. The target's plate HP bar ticks its discrete segments at `--motion-bar` 400 ms `steps(16)`; its rail token's HP arc ticks in sync.
11. **Total ≈ 1290 ms**, inside the runner's 1400 ms clamp, so the stage is at rest before the engine's blind `setTimeout(ANIM_TIMEOUT_MS = 1500)` at `BattlePlayerActions.ts:117-120` flips to `player_applying`.
12. **`runPlayerApplying`** commits the snapshot, re-registers the actor at `advanceTick(tickPosition, 8)`, calls `onHideTurnDisplay` (`BattleApplyRunner.ts:125`). The leader's token flies up the rail and **lands exactly on its ghost**; the ghost clears; a 4 dp wake bar draws in behind it across the 8 ticks just paid. The sprite steps back and resumes its idle bob.
13. **MessageBox** holds `Hugo lands a boosted hit.` — the engine's own `buildOutcomeMessage` line (`BattleResolution.ts:71-82`), previously visible only behind a button. `onClearTurn` drops both plates. Step → `advance_tick`.

## Beat-by-beat: one full AI turn

1. **`clash_check`** finds an active AI unit → `enemy_telegraph`, which flips to `enemy_acting` at `BattleEnemyTelegraphRunner.ts:67-68` **before any timer**. Think delay = `remainingDice + randomMs(1500, 2000)`.
2. **Think window.** Today this is dead air. Now: at `onSetTurnState` (:95-98) the acting enemy gains a `--accent-danger` outline and Hugo gains four 8×2 dp corner brackets pulsing `steps(2)` at 500 ms. Everything else keeps bobbing — the stage is never frozen.
3. **`showTurnDisplay`** (:102) delivers `skillName`, `tuCost`, `apCost`, all of which the current arena discards. MessageBox: `NETROLUME GRUNT — GREAT GROWL — TU 9`. A **red `TickGhost`** appears 9 ticks above the gate on the enemy lane. For `inputMs = 800–1600 ms` the player watches the enemy commit to a landing tick *before it acts* — `CONCEPT.md:13`, "the only person who can see time," rendered as a mechanic.
4. **`applyTimer`** fires → `runAttack` resolves everything → `onPlayDice` (:181). `OutcomeBurst`: `EVADED!` in `--accent-evasion`.
5. **`attackTimer` at 1200 ms** → `pendingAttackCb` → `onPlayAttack`. **Evade branch:** the attacker shoves as normal, and *in parallel* Hugo's rig sidesteps 16 dp away with a 4 dp hop, 170 ms `steps(2)`, yoyo. No flash on Hugo. Void-3 spark. **The player reads Evade from who moved** — and on a Fail the opposite happens: the attacker's shove travels half distance and stops dead, he recoils, and the defender does not move at all. This is the cheapest possible fix for a measured defect: Evade and Fail both deal 0 damage, differ today only by one word and one colour token, and only Evade opens the counter window (`CounterResolver.ts:20`).
6. **Counter window.** `COUNTER_ANNOUNCE_MS = 800` → MessageBox: `Hugo attempts a counter!` → `Counter! (15% chance)` — the engine already formats this string at `BattleAttackResolver.ts:215-219` and it is currently buried. On success, `PromptOverlay` `COUNTER OPPORTUNITY!` with skill name, AP cost and current AP, `[COUNTER] [SKIP]`. The odds line stays in the MessageBox so the decision is informed, because SKIP is a real strategic option.
7. **`enemy_applying`.** Snapshot commits, tick re-registers, `onHideTurnDisplay` (`BattleApplyRunner.ts:37`). Enemy token flies to its ghost; wake bar draws in.
8. **Displacement.** If the landing tick already holds `TICK_MAX_OCCUPANCY = 4`, `resolveTickDisplacement` fires inside `registerTickInternal` (`BattleEngine.ts:266-271`). `onTickDisplaced` emits → `playDisplacement` slides the token two ticks further up over 200 ms `steps(4)` with one shove flash, and MessageBox prints `Netrolume Grunt shoved to tick 41.` **For the first time the stream stops lying to the player** — today a marker can jump four ticks with no log line, no callback and no arena signal, on a screen whose entire premise (`CLAUDE.md` principle 3) is that the tick stream is the only ordering truth.
9. **`onClearTurn`** → outlines and brackets drop, everything returns to idle bob, step → `advance_tick`.

---

## Components

### NEW

| File | Lines | Role |
|---|---|---|
| `src/utils/spriteClock.ts` | ~40 | One module-level `setInterval` at 83 ms with subscribers. Fixes a real leak: `SpriteArena.tsx:77-81` pushes timers into `timersRef` and the file imports no `useEffect` at `:10`, so nothing is ever cleared. N actors now cost one timer. |
| `src/hooks/useSpriteFrames.ts` | ~60 | `(manifest, stateKey)` → current frame index + URL. `repeat: -1` loops, `0` plays once and holds. Returns null when unauthored so the caller renders the box. |
| `src/components/SpriteActor.tsx` + `.module.css` | ~95 | The rig. Three nested transform layers — `.rig` (engine motion), `.body` (idle bob), `.frame` (`<img>`) — plus `.shadow`, `.flash` (mask-image silhouette), `.outline`. Imperative ref: `shove / dodge / flash / recoil / dither / setOutline`. Falls back to `Panel variant='sunken'` + initial at 96 dp, and **every effect still plays on the box**. |
| `src/components/CombatantPlate.tsx` + `.module.css` | ~70 | 140×44 dp. Finally spends `className`, `rarity`, `ap`, `maxAp`, `secondaryResource`, `statusSlots`, `shieldHp` — all computed at `BattleScreen.tsx:659-678` and thrown away today. |
| `src/components/OutcomeBurst.tsx` + `.module.css` | ~55 | Dice outcome, feedback label, `statusText` callouts, rising damage numbers. Replaces the two raw `<span>`s at `SpriteArena.tsx:133-134`. |
| `src/components/ImpactFx.tsx` + `.module.css` | ~70 | Impact ring, hit spark, aura ring, and the `.arena` shake driver. Shared PNGs tinted at runtime via `mask-image` from a semantic token — one ring asset serves every character and every outcome. |
| `src/components/battle/SequenceRunner.ts` | ~140 | The `AnimPhase[]` executor, semantics recovered from `git show fd2587b^:genesis-web/src/scenes/battle/SequenceRunner.ts`. **Budget-aware:** hard-clamps to `ANIM_TIMEOUT_MS` and drops trailing `wait` phases. Non-negotiable — `hugo_001_hyper_sense_expiry` really costs ~1.9 s (a 7-frame @10 fps `playAnim` alone is 700 ms), so it *will* be clamped on day one. |
| `src/components/battle/defaultSequence.ts` | ~40 | `buildDefaultSequence(isMelee, outcome)` — restores the reference cited-but-missing at `DataService.ts:217` and `docs/engine/01_battle_runtime.md:61`, upgraded to a **4-way outcome branch**. |
| `src/components/battle/arenaHandle.ts` | ~90 | The `useImperativeHandle` body, extracted so `SpriteArena.tsx` clears the 150-line limit. |
| `src/components/MessageBox.tsx` + `.module.css` | ~50 | 320×40 dp running narration + `▸` to the log Sheet. **Discipline rule: Toaster owns interrupts, MessageBox owns narration. A line in both means one is wrong** — delete the now-redundant "tap the canvas to skip" Toaster (`BattleScreen.tsx:730`). |
| `src/components/TimelineStrip.tsx` + `.module.css` | ~140 | Extracted from `BattleScreen.BattleTimeline` (removes ~150 lines from a 781-line file), widened to 40 dp, plus the gate, ghosts, wake bars and displacement slide. |
| `src/components/TickToken.tsx` + `.module.css` | ~60 | 32 dp token (16×16 art px at 2×) + HP arc + dead greyscale + at-gate highlight. Fixes `TimelineMarker` accepting a `name` prop it never destructures (`BattleScreen.tsx:78, :83`). |
| `src/components/TickGhost.tsx` | ~40 | Projected-landing marker: dimmed token + `+N TU`. One component, two feeds — `selectedSkill.tuCost` for the player, `TurnDisplayData.tuCost` for the enemy telegraph. |

### REUSE (exists, unchanged)

`Panel.tsx` · `PixelButton.tsx` · `ResourceBar.tsx` · `UnitPortrait.tsx` · `StatusChipBar.tsx` · `Sheet.tsx` · `PromptOverlay.tsx` · `Toaster.tsx` · `PagedGrid.tsx` · `core/battle/AnimationResolver.ts` (four of its five exports currently have no production caller — `resolveIdle/Reaction/Dash/Death` all get one) · `ClashQteOverlay.tsx` · `TeamCollisionOverlay.tsx` · `SkillInfoOverlay.tsx` · `BattleLogOverlay.tsx`

### REWRITE in place

- `src/components/SpriteArena.tsx` (~110 lines) — keeps `BattleArenaHandle` declared exactly where the engine finds it. Deletes the lettered `Slot` and the `sprite art pending` string. Drops its `ui-baseline.json` `module-line-limit` entry from 1 to **0**.
- `src/screens/BattleScreen.tsx` — extract `BattleTimeline`, `ActionGrid` and `PortraitPanel` into modules rather than editing the 781-line file in place.

---

## Art budget (exact PNG counts)

**Correction that invalidates every prior estimate:** `hugo_001`'s 49 frames are **not** pixel art. They are 512×512 smooth renders (~25k colours, ~26% non-uniform 2×2 blocks) displayed at `scale: 0.32` → 163.84 dp, a non-integer factor. No downsample, batch script or manifest edit converts them. **Hugo enters the authoring queue like everyone else.** Every one of the three proposals claimed "hugo needs 0 new files"; all three were wrong.

**Per-character tiers**

| Tier | Files | Sizes |
|---|---|---|
| **Minimum** (renders correctly) | 6 | `idle/0-1.png`, `attack/0-1.png` @ 48×48 art px · `token.png` @ 16×16 · `portrait.png` @ 32×32 |
| **+ Reactions** | +3 | `hurt/0.png`, `death/0-1.png` @ 48×48 |
| **+ Damaged tier** | +4 | `idle_damaged/0-1`, `attack_damaged/0-1` — **leader only** |

`_damaged` is optional because **`isDamaged` is a motion parameter**, not an art tier: below `idleSwapBelowHpPercent` the rig slows the bob to a 2400 ms period with a deeper 4 dp dip and flickers the outline one frame in `--accent-danger` every 1600 ms. That deletes 8 of hugo's 17 states from every future character's budget, finally consumes the flag `setTurnState` has been discarding, and delivers Hugo's documented "goes quiet at critical HP" read (`docs/characters/in-game/hugo-rekrot.md:96-101`) for zero pixels.

`hurt`, `dodge`, `dash` and `death` resolve to `null` and fall back cleanly — pinned by `AnimationResolver.minimal.test.ts:71-76`.

### FIRST PLAYABLE — **28 PNGs**

- 4 characters × 6 = **24** — `hugo_001`, `husty_001`, `tara_001`, `netrolume_grunt_001` (the demo's actual cast)
- `images/fx/platform.png` (64×16 art px) — **1**
- `images/fx/impact_ring/0-2.png` (32×32 art px) — **3**

Tilesets: **0** (the stage is two flat token fills + one 2 dp horizon line). Status icons: **0** (`StatusChipBar` already falls back to text).

### POLISHED — **88 PNGs total**

- 7 indexed characters × 9 (minimum + reactions) = **63**
- `hugo_001` damaged tier = **4**
- Shared FX: platform 1 + impact_ring 3 + hit_spark 3 (16×16) + projectile 2 (8×8) = **9**
- Status icons @ 16×16 art px for the ~12 statuses live in the demo stages = **12**

Data-only work with no art cost: **27 missing `ui.chip` blocks** — 27 of 31 shipped `StatusDef`s are mechanically live and visually absent, the largest measured legibility deficit in the project. Also `hugo_001`'s `tagMap`, which is `{}` today, meaning step 3 of `resolveAttackAnimation` can never fire for him: set `{melee, ranged, energy, physical} → "attack"`.

---

## Engine / contract changes

**One addition. Everything else is zero.**

1. **`BattleEngineCallbacks`** — add `onTickDisplaced?(defId: string, fromTick: number, toTick: number): void` (`core/battle/EngineTypes.ts:113-151`). Optional, so zero test breakage: all six `BattleEngine` test files route through one typed `_testHelpers.makeCallbacks()`. Safe at init: the constructor seeds `registeredTicks` directly (`BattleEngine.ts:98`), so no displacement fires at battle start.
2. **Fire site** — `BattleEngine.registerTickInternal` (`:266-271`), when `resolveTickDisplacement` returns a tick other than the requested one.
3. **`BattleArenaHandle`** — add a 9th method `playDisplacement(defId, fromTick, toTick): void`, bridged in `BattleContext.buildCallbacks` inside the existing `safe()` wrapper. **All eight existing signatures are byte-identical.** The animation is 200 ms, purely visual, and interruptible — it can land mid-`ANIM_TIMEOUT_MS` and nothing waits on it.

**Not contract changes:**

4. **`SpriteArena` props** (props ≠ handle) — add `allyDefIds: ReadonlySet<string>` and `roster: ArenaUnit[]`. `allyDefIds` is a **bug fix**: `SpriteArena.tsx:123-124` falls back to `actingDefId/targetDefId` when `turn` is null, so an acting enemy currently renders in the lower-left *ally* slot. It also drives facing (ally `back`, enemy `front`).
5. **`services/DataService.ts`** — add `characterFrameUrl(defId, stateKey, index)` and `characterTokenUrl(defId)` alongside the existing sync helpers; **fix the negative-caching asymmetry at `:210`** by copying the sibling's `cache.has()` / store-null pattern from `:220-222`. Six of seven indexed characters re-fetch a 404 `animations.json` on every battle load.
6. **`core/combat/`** — extract the effective-base-chance computation out of `BattleAttackResolver.ts:48-56` into a pure exported helper, so the odds strip and the resolver share one source of truth (status `rangedBaseChanceBonus` included). Pure refactor, no contract change, no new callback — `components/` may import `core/` directly.
7. **`core/constants.ts`** — additive motion constants: `SHOVE_OUT_MS 190`, `SHOVE_HOLD_MS 60`, `EVADE_DODGE_MS 170`, `EVADE_DODGE_DX 16`, `FLASH_HOLD_MS 96`, `SHAKE_BOOSTED_MS 320`, `SHAKE_HIT_MS 160`, `DEATH_DITHER_STEP_MS 120`, `SPRITE_BOB_PERIOD_MS 1600`, `SPRITE_BOB_DAMAGED_PERIOD_MS 2400`, `SPRITE_CLOCK_MS 83`, `SPRITE_FAN_MAX 3`, `SPRITE_FAN_DX 56`, `SPRITE_FAN_DY 4`, `SEQUENCE_BUDGET_MS 1400`. Delete the three dead ones: `BATTLE_FEEDBACK_HOLD_MS`, `ANIM_FRAME_INTERVAL_MS`, `TIMELINE_NOW_FRACTION`.

**Explicitly unchanged:** `BattleStep`, `YIELDED_STEPS`, `drive()`, all five runner modules, `BattleEngineSnapshot`, `TurnDisplayData` / `TurnDisplayUnitData`, `AnimPhase`, `AnimationManifest`, `AnimSequenceManifest`, `core/schemas.ts`, and the fire-and-forget model — **no promise, no completion callback, no done event is added.** The runner clamps instead.

**AnimPhase reinterpretation table** (schema untouched, semantics pinned to what the pixel rules permit):
- `shove` → rig translate of `dashDx` (magnitude honoured, unlike Duel Frame which discarded it)
- `particles` → 3-frame `hit_spark` PNG burst
- `aura` → flat 2-frame ramp-step ring honouring `AuraDef.colour` and `.radius`; `pulse.period` becomes the alternation period; **`.alpha`, `.blendMode`, `.fadeIn`, `.fadeOut` are ignored** because opacity fades on sprite art and additive blends are both banned
- `flash` → `mask-image` silhouette filled with a flat semantic token, cut after 2 frames
- **`rotate()` is forbidden anywhere in the arena.** Any angle that is not a multiple of 90° breaks the pixel grid, and the grid is the fiction. The dither dissolve exists so nobody reaches for one. Promote this as a seventh pixel rule in `docs/ui/00-design-system.md`.

---

## Build order — increment 1 is playable

1. **The rig on boxes. Zero art.** `spriteClock` + `useSpriteFrames` + `SpriteActor` (fallback box, idle bob, mask-image flash) + rewritten `SpriteArena` (3-row grid, 3-per-side fan decks, gate rule) + `arenaHandle` + the `allyDefIds` / `roster` props. Ships five bobbing combatants in correct GBA staging with the acting outline and target brackets — strictly better than today's two lettered boxes, and it makes the player's own AI allies visible for the first time. **Go/no-go on device: `mask-image` in the Capacitor WebView.**
2. **Outcome vocabulary.** `OutcomeBurst` + `ImpactFx` + `SequenceRunner` + `defaultSequence`'s 4-way branch. Wire `playAttack`'s six dropped params and finally destructure `customSequence`. Evade vs Fail becomes readable by who moves. Still zero art.
3. **Narration + instruments.** `MessageBox` replacing `logButtonRow`; the shared base-chance helper; the odds strip; the AP-regen preview. Delete the redundant skip-dice Toaster. The clash line with both speed averages and the counter odds string stop being invisible.
4. **The spine.** Extract `TimelineStrip`; widen to 40 dp; `TickToken`; `TickGhost` on both feeds; wake bars. Reflow `BattleScreen` into the seven bands.
5. **Displacement.** `onTickDisplaced` + fire site + `playDisplacement` + bridge + the 200 ms slide + MessageBox line. **Landed alone** so it is trivially revertable — it is the only contract addition in the whole plan.
6. **Death + damaged.** `playDeath` four-step ordered-dither dissolve (inline SVG masks, 480 ms) + platform shrink; `isDamaged` as a motion parameter.
7. **Content unlock — JSON only, no art.** 27 `ui.chip` blocks; hugo's `tagMap`; `characterFrameUrl` / `characterTokenUrl` / the negative-cache fix; and the `clash.uniqueClash` + counter-tag authoring that makes `ClashQteOverlay` (160 lines, currently unreachable) and `CounterPromptOverlay` (currently unreachable) fire at all.
8. **First art pass — 28 PNGs.** Add `npm run validate:art` first (exact dimensions, palette drawn only from the ten ramps, no antialiased edges), then author. Each character upgrades from box to sprite the moment its folder appears — **no code change**.
9. **Polish — to 88 PNGs.** Remaining characters, reactions, hit spark, projectile, status icons. Re-record `ui-baseline.json` (the `SpriteArena` entry should be gone). Move `SpriteActor` / `CombatantPlate` / `OutcomeBurst` from spec to built in `docs/ui/01-components.md`, correct the band allocation in `docs/ui/02-screens.md`, and fix the three stale pointers to the deleted `scenes/` tree (`core/types.ts:384`, `DataService.ts:217`, `docs/engine/01_battle_runtime.md:61`).

---

## Three biggest risks

**1 — The art on disk is not usable, and every prior plan assumed it was.**
`hugo_001` needs 6–13 files authored from scratch, so the real roster cost is ~88 PNGs, not the ~30–73 the proposals claimed. *Mitigation:* the rig is art-independent by construction — increments 1–7 ship a complete, animated, legible battle scene with zero PNGs, so **nothing is blocked on the art pipeline**. Art becomes a parallel track that upgrades slots in place. `validate:art` in increment 8 prevents a second round of unusable assets landing.

**2 — `mask-image` is load-bearing and unverified on the target WebView.**
The silhouette flash and the dither death both depend on `-webkit-mask-image` against a PNG in Android System WebView / WKWebView. *Mitigation:* it is the explicit go/no-go at the end of increment 1, before anything depends on it, with documented degradations already chosen — flash falls back to `filter: brightness(4) saturate(0)` (keeps the hit, loses the outcome colour) and death falls back to a 4-step frame-drop on `.body`. Both prefixes emitted.

**3 — Two finished systems are dead in content, so two of the beats above cannot occur.**
Zero characters declare a `clash` key, so `ClashQteOverlay` never renders. Of 25 shipped skills exactly one carries a counter tag and it is an enemy summon (`kiragen_controller_001_critical_spawn`), so the player counter prompt is unreachable. No amount of design fixes this. *Mitigation:* it is **increment 7, a blocking step**, not a "later" — the scene does not ship until the clash and counter beats are reachable with shipped data. The design also keeps both paths cheap: both reuse `PromptOverlay` and the MessageBox, so no new UI is gated on them.

---

## Four open questions for a human

**Q1 — Timeline horizon.** Keep `TIMELINE_PX_PER_TICK = 10` (~23 ticks visible above the gate, a 32 dp token spans 3.2 ticks, drag-to-pan for deeper planning) **or** drop to 6 (~39 ticks visible, covering `tara_001_intell_of_goddess`'s 40-tick cooldown in one view, at the cost of tokens overlapping and same-tick fanning getting busy)?
*My recommendation: 10. A 40-tick cooldown is a badge on a card; 23 ticks is ~2 actions for everyone on the field, which is the horizon that actually decides a turn.*

**Q2 — Counter and clash content.** Author `clash.uniqueClash` and a `counter`-tagged skill onto a **player-side** character as part of this work (both overlays become reachable in the demo, but it is a balance change) **or** ship the scene with both untestable and treat them as post-demo content (safer, but two finished systems stay dead and two beats in this document are unverifiable)?

**Q3 — Battle safe area.** `CLAUDE.md § Screen System` says `'top-only'`; `docs/ui/02-screens.md:32` says `'none'`. With the ROLL button flush to the bottom edge: **inset the bottom** (loses 24–34 dp, arena shrinks toward its 200 dp minimum, gesture bar is safe) **or** keep it flush (arena keeps its full 236 dp, ROLL risks gesture-bar overlap on modern Android)? Whichever wins, one of the two docs must be corrected.

**Q4 — The odds strip.** Persistent on every skill card (the player reads the 4-outcome split before committing; instrumentation, consistent with the HUD-as-Commander's-instruments position) **or** only inside the long-press `SkillInfoOverlay` Sheet (keeps the resting screen quieter and closer to `design-philosophy.md`'s "never explain, plant the signal")?
*My recommendation: persistent. It is a shape, not a number, and the `precision/50` multiplier means the same skill genuinely reads differently on Hugo than on Husty — that is exactly the structure the fiction says the Commander perceives.*