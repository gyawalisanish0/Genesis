# Phaser Battle Arena

The battle arena is a Phaser 3 canvas that fills a fixed region of `BattleScreen`.
It is the **cinematic stage** — it owns the visual storytelling of each turn. React
owns all interaction (skill grid, roll button, overlays, HUD, battle log). The canvas
never resizes in response to React UI panels appearing or disappearing; those panels
overlay the canvas instead.

---

## Architecture

```
React (BattleScreen)
  ├── BattleLogOverlay  (React overlay — full log history, opened by BATTLE LOG button)
  └── BattleArena (React wrapper)
        └── Phaser.Game
              └── BattleScene (orchestrator)
                    ├── TurnDisplayPanel  (Stage 5 — turn info overlay inside canvas)
                    ├── UnitStage         (Stage 2 — unit figures + animation + aura)
                    │     ├── AnimationPlayer   (per-figure sprite animation loop)
                    │     └── AuraPanel ×2      (acting aura + target aura, scene-root)
                    ├── DicePanel         (Stage 3 — dice spin)
                    ├── SequenceRunner    (Stage 3 — declarative attack sequence executor)
                    │     └── ProjectilePanel   (ranged attack projectile tween)
                    ├── FeedbackPanel     (Stage 3 — damage numbers + outcome label)
                    └── ParticleEmitter   (Stage 4 — hit burst effects)
```

`BattleContext` holds `arenaRef` (`RefObject<BattleArenaHandle | null>`) and
calls arena methods directly at the right battle moments. `BattleLayout` in
`BattleScreen.tsx` reads `arenaRef` from context and passes it as
`<BattleArena ref={arenaRef} />` so Phaser can populate it via
`useImperativeHandle`.

---

## Key principle — unit-agnostic

The arena never assumes "player left, enemy right." It receives an
`actingDefId` and `targetDefId` and displays whoever those are. This covers:

- Player attacks enemy
- Enemy attacks player
- Enemy attacks enemy (AI vs AI modes)
- Counter (defender becomes attacker)

The React HUD (portrait panel, HP/AP bars) still shows the controlling
player's unit. The canvas shows whoever is *currently acting*.

---

## Canvas sizing — `Phaser.Scale.NONE` + manual resize

The Phaser game uses `Scale.NONE` (no auto-resize). The `ResizeObserver` in
`BattleArena.tsx` is the sole source of truth for canvas dimensions:

- **On first non-zero size**: creates the game with `width: w, height: h`
- **On every subsequent callback**: calls `game.scale.resize(w, h)`

This eliminates the conflict between CSS `inset: 0` (which sets positional
offsets on the canvas) and `Scale.RESIZE` (which wrote inline `style.width` /
`style.height`, causing the CSS `bottom`/`right` constraints to be silently
ignored and the canvas to overflow its container).

The `BattleScene` `resize` event subscriber reads the new dimensions from
`gameSize.width` / `gameSize.height` (first argument), not from the 5th/6th
arguments which carry stale `previousWidth`/`previousHeight` values.

---

## Canvas Layout

The top 160 px are permanently reserved for the TurnDisplayPanel (`TURN_PANEL_RESERVE`).
All other canvas content (unit figures, dice, feedback text) is positioned below this
boundary. The battle log is no longer in the canvas — it lives in `BattleLogOverlay`
(a React slide-up panel opened by the **BATTLE LOG** button below the arena).

```
┌─────────────────────────────────┐
│ ┌─────────────────────────────┐ │  ← TurnDisplayPanel (Stage 5)
│ │  ⚔ Slash  ·  TU 20 · AP 10 │ │    slides in from top of canvas;
│ │  Target: Iron Warden  ██░░  │ │    overlays canvas without resizing it
│ └─────────────────────────────┘ │  ← 160 px TURN_PANEL_RESERVE boundary
│  [ACTING]          [TARGET]     │  ← Unit Stage (below TOP_INSET, ~55% of content zone)
│   ▲ ACTING          ◎ TARGET    │    slides in from both sides on turn start;
│    ○ animated sprite             │    hide → 150 ms pause → show between turns
│                                 │
│         ┌──────────┐            │
│         │ ★ BOOSTED│            │  ← Dice Panel (centre of content zone, Stage 3)
│         └──────────┘            │
│                                 │
│         −25 HP (rising text)    │  ← Feedback Panel (Stage 3)
│                                 │
└─────────────────────────────────┘
```

---

## Canvas State Machine

```
IDLE ──(turn starts)──▶ UNIT_EXIT ──(150 ms pause)──▶ UNIT_ENTER ──(ROLL / AI acts)──▶ DICE
                                                                                           │
                              IDLE ◀──(clearTurn)────────────── FEEDBACK ◀── ATTACK ◀─────┘
```

| State | Canvas shows |
|---|---|
| `idle` | Clean canvas (log is in React overlay, not canvas) |
| `unit_exit` | Previous units slide off screen (300 ms `Back.easeIn`) |
| `unit_enter` | Incoming units slide in from both sides (300 ms `Back.easeOut`) after 150 ms gap |
| `turn_display` | TurnDisplayPanel slides in from top of canvas (overlaid, not resizing canvas) |
| `dice` | `DicePanel` appears in content zone: face spins → lands on outcome |
| `attack` | Acting unit shoves toward target (melee) or projectile travels (ranged); target flashes on hit |
| `feedback` | Damage/outcome text rises and fades from centre of content zone |

---

## React → Phaser Commands (`BattleArenaHandle`)

The battle log is **not** in this interface — it lives in `BattleLogOverlay` (React).

```ts
// Stage 2 — unit display
arenaRef.current.setTurnState(
  actingDefId, targetDefId,
  actingManifest?,   // AnimationManifest | null — drives sprite animation + aura
  targetManifest?,   // AnimationManifest | null
  isDamaged?         // { acting: boolean; target: boolean }
)
// If units are currently on screen: triggers hide → 150 ms pause → show for incoming pair.
// If canvas is idle: units slide in immediately.
arenaRef.current.clearTurn()                              // slides current units out

// Stage 3 — animations (phase-gated: React awaits onDone before advancing)
arenaRef.current.playDice(outcome, onDone)
arenaRef.current.playAttack(
  casterId, targetId, outcome, damage,
  isMelee,         // boolean — melee=shove, ranged=projectile
  dashDx,          // canvas pixels the acting unit shoves toward target
  projectile,      // AnimationProjectileDef | null — drives projectile visuals
  feedbackText,    // outcome label string, e.g. "BOOSTED!", "EVADED!"
  feedbackColour,  // CSS token, e.g. 'var(--accent-gold)'
  onDone,
  customSequence?, // AnimPhase[] | undefined — overrides DefaultSequences when provided
)

// Stage 4 — death collapse (phase-gated)
arenaRef.current.playDeath(defId, onDone)

// Stage 5 — turn display (overlaid inside canvas, no resize)
arenaRef.current.showTurnDisplay(data: TurnDisplayData)  // slides in from top
arenaRef.current.hideTurnDisplay()                        // slides out
```

`playDice`, `playAttack`, and `playDeath` are **phase-gated**: BattleContext
does not apply HP changes or advance the timeline until `onDone` fires. If the
Phaser canvas is not mounted the handle calls `onDone` immediately so battle
logic is never blocked.

`showTurnDisplay` and `hideTurnDisplay` are fire-and-forget. BattleContext
drives timing via its existing dismiss timer (`dismissTimerRef`), which calls
`hideTurnDisplay()` instead of clearing a React state variable.

---

## `TurnDisplayData` type (exported from `BattleArena.tsx`)

```ts
export interface TurnDisplayUnitData {
  name:        string
  className:   string
  rarity:      number
  hp:          number
  maxHp:       number
  ap:          number
  maxAp:       number
  statusSlots: Array<{ id: string; name: string }>
}

export interface TurnDisplayData {
  actor:      TurnDisplayUnitData | null  // null = player turn (actor row hidden)
  skillName:  string
  tuCost:     number
  apCost:     number
  skillLevel: number
  target:     TurnDisplayUnitData
  isAlly:     boolean  // true = player attacking; drives accent colour (blue/red)
}
```

Defined in `BattleArena.tsx` (components layer) and imported by
`BattleContext.tsx` (screens layer) so the data type flows in the correct
layer direction without a circular dependency.

---

## TurnDisplayPanel visual (Stage 5)

```
┌─────────────────────────────────────┐
│ Hunter 001          ◎ TARGET        │  ← actor row (enemy turns only)
│ ████████░░  HP 82/100               │    HP bar (Phaser Graphics rect)
│ ████░░░░░░  AP 40/100               │    AP bar
│ [Poison] [Bleed]                    │    status chips (text objects)
├─────────────────────────────────────┤
│  ⚔ Arcane Bolt  ·  TU 18  ·  AP 10 │  ← skill row (always shown)
│  Lv 2                               │
├─────────────────────────────────────┤
│ Iron Warden         ◎ TARGET        │  ← target row (always shown)
│ ████████████  HP 120/120            │
│ ████████░░░░  AP 60/100             │
└─────────────────────────────────────┘
```

- Slides in from top of canvas with `Back.easeOut` (250 ms)
- Canvas animations (dice spin, attack) continue live behind the panel
- No dim layer — canvas stays fully visible
- HP/AP bars rendered as Phaser `Graphics` `fillRect` calls using `tokenToHex`
  colour values (same approach as unit figures)
- Rarity accent: actor/target name colour matches `--rarity-N` via `RARITY_HEX`
  map in `TurnDisplayPanel.ts`
- Status chips: small `Text` objects with a rounded `Graphics` background,
  laid out left-to-right with wrapping

---

## Phase-gated animation chain (Stage 3)

```
runAttack(caster, target, skill, snap)  →  { tumbleDelay, outcome, damage }
  │
  ├── React: showDiceResult(outcome, msg)          ← overlay (4 s auto-dismiss)
  │
  └── arena.playDice(outcome, () => {              ← Phaser dice spin (~2.8 s)
        arena.playAttack(…, feedbackText, feedbackColour, () => {   ← sequence runs:
          // inside sequence: shove/projectile → impact FX → parallel(damageNumber, feedback)
          setTimeout(applyState, BATTLE_FEEDBACK_HOLD_MS)
        })
      })
```

Without arena: `setTimeout(applyState, DICE_RESULT_DISMISS_MS)` as before.

---

## `setTurnState` + `showTurnDisplay` call points

| Moment | Calls |
|---|---|
| Phase derivation → player turn | `setTurnState(player.defId, firstEnemy.defId, actingManifest, targetManifest, isDamaged)` |
| Player executes skill | `showTurnDisplay({ actor: null, … })` + dismiss timer |
| Enemy AI telegraph fires | `setTurnState(enemy.defId, player.defId, …)` + `showTurnDisplay({ actor: enemy, … })` |
| `applyState` / `applyEnemyState` | `hideTurnDisplay()` + `clearTurn()` (or `playDeath → clearTurn`) |
| `skipTurn` | `clearTurn()` (no turn display for skips) |

---

## Phaser helper modules (`src/scenes/battle/`)

| File | Responsibility |
|---|---|
| `tokens.ts` | `tokenToHex(colour)` + `tokenToInt(colour)` — maps CSS design tokens to hex/integer for Phaser; extracted to break circular dependency |
| `TurnDisplayPanel.ts` | Skill name + TU/AP cost + actor (enemy-only) + target rows with HP/AP bars; slides in/out from top of canvas |
| `UnitStage.ts` | Creates, slides, and destroys the two unit figure containers; drives animation, aura, evasion dodge, and death collapse tweens; exposes `pureFlash()` (tint-only flash, no hurt anim), `playFigureAnim()` (plays a named state on a figure), `setAura()` (show/hide aura via sequence phase), `isAnimating()` (animation lock gate); holds dash pose during shove tween; plays death animation + fade on collapse |
| `AnimationPlayer.ts` | Per-figure sprite animation loop — swaps individual PNG frame textures on a Phaser timer; provides `play()`, `stop()`, `isPlaying()` |
| `AnimationResolver.ts` | Resolves which animation state to play given a skill ID, tags, and isDamaged flag; fallback chain: skill-damaged → skill → tag-mapped-damaged → tag-mapped → null |
| `DicePanel.ts` | Renders the spinning die face; calls `onDone` after the hold |
| `SequenceRunner.ts` | Executes declarative `AnimPhase[]` sequences with support for `parallel`, `branch`, and `skip`; owns impact FX dispatch (flash, particles, shake); injects `FeedbackPanel` for `damageNumber` and `feedback` phases |
| `DefaultSequences.ts` | Builds the default `AnimPhase[]` for melee and ranged attacks; outcomes route to `shove`/`projectile` + `parallel(damageNumber, feedback)` |
| `SequenceTypes.ts` | Re-exports `AnimPhase` from `core/types.ts`; defines `SequenceContext` (runtime data threaded through phase execution) |
| `ProjectilePanel.ts` | Tweens a scene-root image from caster position to target; fires `onImpact` on arrival; falls back to runtime-generated `battle_orb` purple circle texture |
| `FeedbackPanel.ts` | Two-layer outcome display: `show()` for outcome label (spawns above figure centre, 20 px), `showDamageNumber()` for damage value (spawns below figure centre, 26 px); both fired in parallel by the sequence |
| `ParticleEmitter.ts` | One-shot burst effects: colour and count vary per outcome; uses runtime-generated particle texture |
| `AuraPanel.ts` | Scene-root radial glow that tracks a Phaser container via `update` listener; hue driven by `setTint()`, intensity by `setAlpha()`, character by `setBlendMode()` |

Each helper receives `scene: Phaser.Scene` in its constructor and manages its
own game objects. `BattleScene` orchestrates them with no cross-helper coupling.

---

## Animation system

Unit figures display character-specific sprite animations driven by per-character
`AnimationManifest` JSON files at `public/data/characters/{defId}/animations.json`.

### Manifest structure

```json
{
  "type": "animations",
  "defId": "hugo_001",
  "display": { "sourceWidth": 512, "sourceHeight": 512, "scale": 0.32, "anchorX": 0.5, "anchorY": 1.0 },
  "idleSwapBelowHpPercent": 0.4,
  "meleeDashDx": 80,
  "tagMap": { "melee": "melee_attack" },
  "animations": {
    "idle":           { "frames": 2, "frameRate": 8,  "repeat": -1 },
    "idle_damaged":   { "frames": 2, "frameRate": 6,  "repeat": -1, "aura": { … } },
    "hurt":           { "frames": 2, "frameRate": 12, "repeat": 0 },
    "dodge":          { "frames": 2, "frameRate": 12, "repeat": 0 },
    "dash":           { "frames": 1, "frameRate": 12, "repeat": 0 },
    "dash_damaged":   { "frames": 1, "frameRate": 12, "repeat": 0 },
    "death":          { "frames": 2, "frameRate": 8,  "repeat": 0 },
    "death_damaged":  { "frames": 2, "frameRate": 8,  "repeat": 0 },
    "skills": {
      "hugo_001_nanites_slash":  { "frames": 3, "frameRate": 12, "repeat": 0 },
      "hugo_001_shelling_point": { "frames": 4, "frameRate": 12, "repeat": 0 }
    }
  },
  "projectile": null
}
```

> `sourceWidth`/`sourceHeight` are art reference dimensions only (the pixel size of the source PNGs); `scale` is the uniform scale applied to the sprite at render time.

### Frame file convention

Each animation state corresponds to a subfolder of `public/images/characters/{defId}/`:

```
public/images/characters/hugo_001/
  idle/             0.png  1.png  2.png  3.png  4.png  5.png
  idle_damaged/     0.png  1.png  2.png  3.png
  melee_attack/     0.png … 7.png
  skills/
    hugo_001_nanites_slash/  0.png … 7.png
```

`AnimationPlayer.preloadState(scene, defId, stateKey, frames)` loads all frames as
`scene.load.image(frameKey(defId, stateKey, i), framePath(defId, stateKey, i))`.
During play, it drives a `Phaser.Time.TimerEvent` loop that calls `sprite.setTexture(frameKey(…))`.

### Animation resolution (attack)

`AnimationResolver.resolveAttackAnimation(manifest, skillId, tags, isDamaged)` uses
the fallback chain:

```
skill-damaged key  →  skill key  →  tag-mapped-damaged  →  tag-mapped  →  null (fallback to placeholder)
```

A `null` result means the character has no animation loaded for that action —
the unit placeholder box shows without art.

### `isDamaged` state

`UnitStage` tracks `isDamaged: boolean` per figure. When HP drops below
`manifest.idleSwapBelowHpPercent`, `BattleContext` calls
`UnitStage.setDamaged(defId, true)`, which swaps idle → idle_damaged (including
its aura) without rebuilding the container.

---

## Aura system

`AuraPanel` renders a scene-root radial glow that follows its target container
through any tween (slide-in, shove, yoyo-return) by registering a
`scene.events.on('update')` listener that reads
`container.getWorldTransformMatrix().tx/ty` each frame.

### `AuraDef` (defined in `core/types.ts`)

```ts
export interface AuraDef {
  colour:    string                          // CSS token or hex ('var(--accent-danger)')
  blendMode: 'ADD' | 'SCREEN' | 'MULTIPLY' | 'NORMAL'
  radius:    number                          // glow radius in canvas pixels
  alpha:     number                          // peak opacity 0–1
  pulse?:    { period: number; minAlpha: number }  // optional breathing effect
  fadeIn?:   number                          // ms to reach peak alpha (default 200)
  fadeOut?:  number                          // ms to reach 0 alpha on hide (default 400)
}
```

Attached to any `AnimationStateDef` via `aura?: AuraDef | null`. `null` explicitly
disables the aura for that state (overrides any previous state's aura).

### Texture generation

`AuraPanel` generates a single 256×256 white radial gradient texture
(`aura_radial`) using the browser Canvas 2D API on first construction.
`setTint(tokenToInt(colour))` drives hue — the full colour space is available
without any additional textures.

```
gradient stops:
  0.00 → rgba(255,255,255,1.0)   centre
  0.35 → rgba(255,255,255,0.7)
  0.70 → rgba(255,255,255,0.25)
  1.00 → rgba(255,255,255,0.0)   edge
```

### Aura lifetime

| State `repeat` | Aura lifetime |
|---|---|
| `-1` (looping — idle_damaged) | Persists until `setDamaged` swaps state or unit exits |
| `0` (play-once — skill cast) | Transient; caller hides with `auraFor(fig).stop()` after animation |

### `UnitStage` aura API

`UnitStage` owns two `AuraPanel` instances (`actingAura`, `targetAura`) and exposes
`getActingContainer()` / `getTargetContainer()` so external scene objects can sync
their positions to unit containers. Internally:

- `buildFigure`: shows initial aura if `entry.aura` is set
- `setDamaged`: stops old aura, shows new aura for swapped idle state
- `collapseByDefId`: hides aura before collapse tween
- `hide` / `destroyAll`: stops both auras

---

## Stage 4 effects

### Particle bursts
`ParticleEmitter.burst(x, y, outcome)` fires from the target's centre on any
damaging outcome. Colour and count match the outcome:

| Outcome | Colour | Count |
|---|---|---|
| `Boosted` | `--accent-gold`    | 22 |
| `Hit`     | `--accent-danger`  | 12 |
| `Evade`   | `--accent-evasion` |  8 |

Fail produces no particles (small dust puff on empty air). Particle texture
is a white circle generated at runtime in `BattleScene.create()` — no image
file needed.

### Camera shake
Applied on hit via `this.cameras.main.shake(durationMs, intensity)`:

| Outcome | Duration | Intensity |
|---|---|---|
| `Boosted` | 320 ms | 0.024 |
| `Hit`     | 160 ms | 0.010 |

### Evade dodge
When `outcome === 'Evade'`: the attacker shoves (`shoveActing`) and the
target slides away (`evasionDodge`) simultaneously. A two-counter `both()`
callback fires `onDone` only after both tweens complete.

### Death collapse (`playDeath`)
`BattleScene.playDeath(defId, onDone)` delegates to
`UnitStage.collapseByDefId(defId, onDone)`:
- Finds the figure (acting or target) whose `defId` matches
- Hides the figure's aura before the animation starts
- Plays the death animation (2-frame) via `playDeathAndFade`
- Then tweens `alpha → 0`, `y + 24 px` over 420 ms (`FADE_MS`)
- Destroys the container, then calls `onDone`
- `BattleContext` passes `() => arena.clearTurn()` as `onDone`, so surviving
  figures slide out only after the death animation completes

---

## Art upgrade path

Art is fully manifest-driven. Each character needs:

1. **`public/data/characters/{defId}/animations.json`** — `AnimationManifest`
   declaring all animation states, frame counts, frame rates, and optional auras.
   `DataService.loadAnimationManifest(defId)` fetches and caches this; returns
   `null` silently if absent (falls back to placeholder rectangle).

2. **Individual PNG frames** at `public/images/characters/{defId}/{stateKey}/{i}.png`
   (0-indexed, e.g. `idle/0.png … idle/5.png`).
   Skill animation frames live at `public/images/characters/{defId}/skills/{skillId}/{i}.png`.

3. **Projectile sprite** (optional) at `public/images/characters/{defId}/projectile/{i}.png`
   if `manifest.projectile` is non-null. Falls back to the runtime-generated purple orb.

4. **`public/data/characters/{defId}/anim_sequence.json`** (optional) — `AnimSequenceManifest`
   mapping `skill.id → AnimPhase[]`. Overrides the engine default sequence for each listed skill.
   Missing keys fall back to `buildDefaultSequence`. Absent file = all skills use defaults.

No architecture change is required to add art — `BattleContext` fetches the manifest
in its `load()` phase and passes it through `setTurnState`. `UnitStage.buildFigure`
checks texture existence before switching from the placeholder rectangle to sprites.

---

## Design token colours in Phaser

CSS vars are not readable by Phaser's canvas context. `tokenToHex()` and `tokenToInt()`
live in `src/scenes/battle/tokens.ts` and map every design token to its exact hex / integer value:

```ts
import { tokenToHex, tokenToInt } from './battle/tokens'

tokenToHex('var(--accent-danger)')   // → '#ef4444'
tokenToInt('var(--accent-gold)')     // → 0xf59e0b  (Phaser tint format)
```

`BattleScene.ts` re-exports `tokenToHex` for backward compatibility with any
existing callers. All new helper modules (`AuraPanel`, `ParticleEmitter`, `TurnDisplayPanel`)
import directly from `./tokens`.

---

## Build stages

| Stage | Branch deliverable | Status |
|---|---|---|
| 1 | Canvas mounts; scrolling battle log in Phaser | ✅ Superseded — log moved to React overlay |
| 2 | Acting unit + target placeholder figures; slide in/out per turn | ✅ Done |
| 3 | Dice spin → attack animation → feedback numbers; phase-gated | ✅ Done |
| 4 | Particles, screen shake, evasion slide, death collapse | ✅ Done |
| 5 | TurnDisplayPanel overlaid at top of canvas; 160 px reserved zone; between-turn pause | ✅ Done |
| 6 | Battle log moved to React BattleLogOverlay; BATTLE LOG button below canvas | ✅ Done |
| 7 | AnimationManifest system: sprite frame sequences, AnimationPlayer, AnimationResolver, ProjectilePanel, AuraPanel; `isDamaged` idle swap; aura on AnimationStateDef | ✅ Done |
