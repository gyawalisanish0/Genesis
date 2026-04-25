# Phaser Battle Arena

The battle arena is a Phaser 3 canvas mounted inside `BattleScreen`, sitting
between the `TurnDisplayPanel` and the action grid. It is the **cinematic
stage** — it owns the visual storytelling of each turn. React owns all
interaction (skill grid, roll button, overlays, HUD).

---

## Architecture

```
React (BattleScreen)
  └── BattleArena (React wrapper)
        └── Phaser.Game
              └── BattleScene (orchestrator)
                    ├── UnitStage     (Stage 2 — unit figures)
                    ├── DicePanel     (Stage 3 — dice spin)
                    ├── AttackPanel   (Stage 3 — attack animation)
                    └── FeedbackPanel (Stage 3 — damage numbers)
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

## Canvas Layout

```
┌─────────────────────────────────┐
│  [ACTING]          [TARGET]     │  ← Unit Stage (top 58%)
│   ▲ ACTING          ◎ TARGET    │    slides in from both sides on turn start
│                                 │
│         ┌──────────┐            │
│         │ ★ BOOSTED│            │  ← Dice Panel (centre overlay, Stage 3)
│         └──────────┘            │
│                                 │
│         −25 HP (rising text)    │  ← Feedback Panel (Stage 3)
├─────────────────────────────────┤
│ ▏ Battle log text here...       │  ← Log (lower 42% when units active,
│ ▏ More log text...              │        full height in idle)
└─────────────────────────────────┘
```

---

## Canvas State Machine

```
IDLE ──(turn starts)──▶ UNIT_ENTER ──(ROLL / AI acts)──▶ DICE
                                                            │
                         IDLE ◀──(clearTurn)── FEEDBACK ◀── ATTACK
```

| State | Canvas shows |
|---|---|
| `idle` | Scrollable battle log (full height) |
| `unit_enter` | Acting unit + target slide in; log compresses to lower 42% |
| `dice` | `DicePanel` appears between units: face spins → lands on outcome |
| `attack` | Acting unit shoves toward target; target flashes on hit |
| `feedback` | Damage/outcome text rises and fades from centre |

---

## React → Phaser Commands (`BattleArenaHandle`)

```ts
// Stage 1 — log
arenaRef.current.addLog(text, colour)

// Stage 2 — unit display
arenaRef.current.setTurnState(actingDefId, targetDefId)  // slides units in
arenaRef.current.clearTurn()                              // slides units out

// Stage 3 — animations (phase-gated: React awaits onDone before advancing)
arenaRef.current.playDice(outcome, onDone)
arenaRef.current.playAttack(casterId, targetId, outcome, damage, onDone)
arenaRef.current.playFeedback(text, colour)              // fire-and-forget
```

`playDice` and `playAttack` are **phase-gated**: BattleContext does not apply
HP changes or advance the timeline until `onDone` fires. If the Phaser canvas
is not mounted the handle calls `onDone` immediately so battle logic is never
blocked.

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

## `setTurnState` call points

| Moment | Call |
|---|---|
| Phase derivation → player turn | `setTurnState(player.defId, firstEnemy.defId)` |
| Enemy AI telegraph fires | `setTurnState(enemy.defId, player.defId)` |

`clearTurn` is called inside `applyState` (after state is committed) and
inside `skipTurn`. Units slide out after HP bars update.

---

## Phaser helper modules (`src/scenes/battle/`)

| File | Responsibility |
|---|---|
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
- Slides in with `Back.easeOut` (300 ms); slides out with `Back.easeIn`

---

## Stage 4 effects

### Particle bursts
`ParticleEmitter.burst(x, y, outcome)` fires from the target's centre on any
damaging outcome. Colour and count match the outcome:

| Outcome | Colour | Count |
|---|---|---|
| `Boosted` | `--accent-gold` | 22 |
| `Success` | `--accent-danger` | 12 |
| `GuardUp` | `--accent-info` | 10 |
| `Tumbling` | `--accent-warn` | 12 |

Evasion and Fail produce no particles. Particle texture is a white circle
generated at runtime in `BattleScene.create()` — no image file needed.

### Camera shake
Applied on hit via `this.cameras.main.shake(durationMs, intensity)`:

| Outcome | Duration | Intensity |
|---|---|---|
| `Boosted` | 320 ms | 0.024 |
| `Success` | 160 ms | 0.010 |
| `GuardUp` | 120 ms | 0.007 |
| `Tumbling` | 160 ms | 0.010 |

### Evasion dodge
When `outcome === 'Evasion'`: the attacker shoves (`shoveActing`) and the
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
| 1 | Canvas mounts; scrolling battle log in Phaser | ✅ Done |
| 2 | Acting unit + target placeholder figures; slide in/out per turn | ✅ Done |
| 3 | Dice spin → attack animation → feedback numbers; phase-gated | ✅ Done |
| 4 | Particles, screen shake, evasion slide, death collapse | ✅ Done |
