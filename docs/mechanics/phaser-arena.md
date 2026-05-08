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
                    ├── UnitStage         (Stage 2 — unit figures)
                    ├── DicePanel         (Stage 3 — dice spin)
                    ├── AttackPanel       (Stage 3 — attack animation)
                    ├── FeedbackPanel     (Stage 3 — damage numbers)
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
│                                 │    hide → 150 ms pause → show between turns
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
| `attack` | Acting unit shoves toward target; target flashes on hit |
| `feedback` | Damage/outcome text rises and fades from centre of content zone |

---

## React → Phaser Commands (`BattleArenaHandle`)

The battle log is **not** in this interface — it lives in `BattleLogOverlay` (React).

```ts
// Stage 2 — unit display
arenaRef.current.setTurnState(actingDefId, targetDefId)
// If units are currently on screen: triggers hide → 150 ms pause → show for incoming pair.
// If canvas is idle: units slide in immediately.
arenaRef.current.clearTurn()                              // slides current units out

// Stage 3 — animations (phase-gated: React awaits onDone before advancing)
arenaRef.current.playDice(outcome, onDone)
arenaRef.current.playAttack(casterId, targetId, outcome, damage, onDone)
arenaRef.current.playFeedback(text, colour)              // fire-and-forget

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
        arena.playAttack(…, () => {                ← shove + flash (~0.5 s)
          arena.playFeedback(text, colour)         ← rising text (fire-and-forget)
          setTimeout(applyState, BATTLE_FEEDBACK_HOLD_MS)
        })
      })
```

Without arena: `setTimeout(applyState, DICE_RESULT_DISMISS_MS)` as before.

---

## `setTurnState` + `showTurnDisplay` call points

| Moment | Calls |
|---|---|
| Phase derivation → player turn | `setTurnState(player.defId, firstEnemy.defId)` |
| Player executes skill | `showTurnDisplay({ actor: null, … })` + dismiss timer |
| Enemy AI telegraph fires | `setTurnState(enemy.defId, player.defId)` + `showTurnDisplay({ actor: enemy, … })` |
| `applyState` / `applyEnemyState` | `hideTurnDisplay()` + `clearTurn()` (or `playDeath → clearTurn`) |
| `skipTurn` | `clearTurn()` (no turn display for skips) |

---

## Phaser helper modules (`src/scenes/battle/`)

| File | Responsibility |
|---|---|
| `TurnDisplayPanel.ts` | Skill name + TU/AP cost + actor (enemy-only) + target rows with HP/AP bars; slides in/out from top of canvas |
| `UnitStage.ts` | Creates, slides, and destroys the two unit figure containers; drives evasion dodge and death collapse tweens |
| `DicePanel.ts` | Renders the spinning die face; calls `onDone` after the hold |
| `AttackPanel.ts` | Drives the shove tween, target flash, particle burst, and camera shake via `UnitStage` + `ParticleEmitter` |
| `FeedbackPanel.ts` | Creates the rising damage/outcome text tween |
| `ParticleEmitter.ts` | One-shot burst effects: colour and count vary per outcome; uses runtime-generated particle texture |

Each helper receives `scene: Phaser.Scene` in its constructor and manages its
own game objects. `BattleScene` orchestrates them with no cross-helper coupling.

---

## Unit figure visual (placeholder, Stage 2)

```
┌──────────────────────┐
│  ▲ ACTING            │  ← role label (purple / red)
│                      │
│      WARRIOR         │  ← name line 1 (bold, derived from defId)
│        001           │  ← name line 2
│                      │
│      [ art ]         │  ← placeholder; swap for idle.png in Stage 4
└──────────────────────┘
```

- **Acting unit**: purple (`--accent-genesis`) border, `▲ ACTING` label
- **Target unit**: red (`--accent-danger`) border, `◎ TARGET` label
- Slides in with `Back.easeOut` (300 ms); slides out with `Back.easeIn` (300 ms)
- Between turns: exit tween completes → 150 ms pause (`BETWEEN_TURN_PAUSE_MS`) → enter tween starts

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
- Tweens `angle → 85°`, `alpha → 0`, `y + 44 px` over 580 ms
- Destroys the container, then calls `onDone`
- `BattleContext` passes `() => arena.clearTurn()` as `onDone`, so surviving
  figures slide out only after the death animation completes

---

## Asset upgrade path (Stage 4+)

Unit figures start as placeholder rectangles. Real art slots in with zero
architecture change:

```
public/images/characters/{defId}/idle.png   ← static illustration
public/images/characters/{defId}/hurt.png   ← (optional) hurt frame
```

`BattleScene.preload()` loads `idle.png` keyed by `defId`. Replace the
`bg` rectangle in `UnitStage.buildFigure()` with `scene.add.image(0, 0, defId)`.
All tween targets remain identical.

---

## Design token colours in Phaser

CSS vars are not readable by Phaser's canvas context. `tokenToHex()` in
`BattleScene.ts` maps every design token to its exact hex value:

```ts
import { tokenToHex } from '../scenes/BattleScene'

tokenToHex('var(--accent-danger)')  // → '#ef4444'
tokenToHex('var(--accent-gold)')    // → '#f59e0b'
```

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
