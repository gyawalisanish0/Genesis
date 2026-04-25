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
              └── BattleScene (state machine)
```

React communicates **in** via the `BattleArenaHandle` imperative ref.
Phaser communicates **out** via callbacks passed through `BattleSceneCallbacks`.

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

## Canvas State Machine

```
IDLE ──(turn starts)──▶ UNIT_ENTER ──(ROLL / AI acts)──▶ DICE
                                                            │
                         IDLE ◀──(1.5s)── FEEDBACK ◀── ATTACK
```

| State | Canvas shows |
|---|---|
| `idle` | Scrollable battle log |
| `unit_enter` | Acting unit + target slide into frame |
| `dice` | Die face spins → lands on outcome |
| `attack` | Attacker animates toward target; hit FX plays |
| `feedback` | Damage number + outcome text rise and fade |

---

## React → Phaser Commands (`BattleArenaHandle`)

```ts
// Stage 1 — log
arenaRef.current.addLog(text, colour)

// Stage 2 — unit display
arenaRef.current.setTurnState(actingDefId, targetDefId)
arenaRef.current.clearTurn()

// Stage 3 — animations (phase-gated: React waits for onDone before advancing)
arenaRef.current.playDice(outcome, onDone)
arenaRef.current.playAttack(casterId, targetId, outcome, damage, onDone)
arenaRef.current.playFeedback(text, colour)
```

---

## Phaser → React Callbacks (`BattleSceneCallbacks`)

```ts
interface BattleSceneCallbacks {
  onDiceAnimationDone?:   () => void  // React applies damage after die lands
  onAttackAnimationDone?: () => void  // React advances phase after hit plays
}
```

Pass callbacks via the `callbacks` prop on `<BattleArena callbacks={...} />`.

---

## Asset upgrade path (Stage 2+)

Unit figures start as placeholder rectangles + name text. Real art slots in
by adding PNG files — zero architecture change:

```
public/images/characters/{defId}/idle.png   ← static illustration
public/images/characters/{defId}/hurt.png   ← (optional) hurt frame
```

`BattleScene.preload()` loads `idle.png` keyed by `defId`. The placeholder
rectangle is swapped for `this.add.image(x, y, defId)`. All tween animations
remain identical.

---

## Design token colours in Phaser

CSS vars are not readable by Phaser's canvas context. `tokenToHex()` in
`BattleScene.ts` maps every design token to its exact hex value, keeping
the arena visually consistent with the React UI.

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
| 2 | Acting unit + target placeholder figures; idle state between turns | Pending |
| 3 | Dice spin → attack animation → feedback numbers; phase-gated | Pending |
| 4 | Particles, screen shake, evasion slide, death collapse | Pending |
