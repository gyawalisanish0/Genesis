# Cooldown Mechanic

## Overview

Skills may declare one or both cooldown types in their JSON definition. Both
types are optional — a skill with neither field has no cooldown. When a skill
has both, **both must clear** before the skill is usable again.

---

## Two Cooldown Types

### Tick Cooldown (`tickCooldown`)

The owning unit's `tickPosition` must reach a threshold after the skill is used.

```json
"tickCooldown": 20
```

- Set on use: `cooldownReadyAtTick = unit.tickPosition + tickCooldown`
- Ready check: `unit.tickPosition >= cooldownReadyAtTick`
- Badge: `⏳{n}t` (e.g. `⏳20t`)

Fast units reach the threshold sooner; slow units wait longer.

### Turn Cooldown (`turnCooldown`)

The owning unit's **own** `actionCount` must increase by `turnCooldown` after
the skill is used. One "turn" = one action taken by the skill's owner.

```json
"turnCooldown": 2
```

- Set on use: `cooldownReadyAtAction = unit.actionCount + turnCooldown`
- Ready check: `unit.actionCount >= cooldownReadyAtAction`
- Badge: `⏳{n}` (e.g. `⏳2`)
- No global round concept — each unit tracks its own action count independently

### Dual Cooldown

A skill may carry both fields. Both thresholds must be reached before the
skill is available:

```json
"tickCooldown": 10,
"turnCooldown": 1
```

Badge when both are active: `⏳10t ⏳1`

---

## Runtime Tracking

Cooldown state lives on `SkillInstance` (never on the static `SkillDef`):

| Field | Type | Meaning |
|---|---|---|
| `cooldownReadyAtTick` | `number` | 0 = ready; skill usable when `unit.tickPosition >= this` |
| `cooldownReadyAtAction` | `number` | 0 = ready; skill usable when `unit.actionCount >= this` |

Both fields initialise to `0` (`createSkillInstance`). They are set
immediately when the skill fires — before the dice animation ends — so the
button reflects cooldown state as soon as the player acts.

---

## Level-Upgrade Patchability

`tickCooldown` and `turnCooldown` are normal `SkillDef` fields, so
`levelUpgrades` patches can reduce them at higher levels:

```json
"levelUpgrades": [
  { "level": 3, "patch": { "turnCooldown": 1 } }
]
```

`applyCooldown` always receives the **patched** `SkillDef`
(`getCachedSkill(inst)`) so upgraded cooldown values are respected.

---

## Counter Reaction Exemption

**Counter reactions bypass cooldown entirely.** This is symmetric for both
player and enemy:

- When a `counter`- or `uniqueCounter`-tagged skill fires as a **reactive
  counter** (triggered by Evasion), no cooldown is applied and no CD check is
  performed — even if the skill is already on cooldown from a prior normal use.
- When the same skill is used on a **normal offensive turn** (action grid +
  Roll), cooldown applies as usual.

This design keeps counter-tagged skills available as defensive tools regardless
of their offensive CD state, while still gating their offensive use.

See `docs/mechanics/counter.md` for the full counter mechanic specification.

---

## UI

When a skill is on cooldown its action-grid button is:
- **Disabled** (cannot be tapped or selected for the Roll button)
- **Semi-transparent** (`.skillBtnCooldown`, opacity 0.45 — more visible than
  the phase-locked disabled state at 0.2)
- **Badged** with remaining counts in amber (`--accent-warn`)

```
[ Parry Riposte  Lv1  TU: 0  Lv1 ]
[          ⏳18t               ]
```

---

## Implementation Files

| File | Role |
|---|---|
| `src/core/effects/types.ts` | `tickCooldown?`, `turnCooldown?` on `SkillDef`; `cooldownReadyAtTick`, `cooldownReadyAtAction` on `SkillInstance` |
| `src/core/engines/skill/SkillInstance.ts` | Initialise both fields to `0` in `createSkillInstance` |
| `src/core/combat/CooldownResolver.ts` | `isOnCooldown`, `isOnTickCooldown`, `isOnTurnCooldown`, `ticksRemaining`, `turnsRemaining`, `applyCooldown` |
| `src/screens/BattleContext.tsx` | Cooldown guard in `executeSkill`; `applyCooldown` after player cast, enemy AI cast, and counter cast |
| `src/screens/BattleScreen.tsx` | Per-skill `isOnCooldown` check + badge in `ActionGrid` |
| `src/screens/BattleScreen.module.css` | `.skillBtnCooldown` + `.skillCdBadge` |

---

## `CooldownResolver` API

```ts
isOnTickCooldown(unit, inst)  → boolean
isOnTurnCooldown(unit, inst)  → boolean
isOnCooldown(unit, inst)      → boolean   // either type active

ticksRemaining(unit, inst)    → number    // 0 if not on tick CD
turnsRemaining(unit, inst)    → number    // 0 if not on turn CD

applyCooldown(unit, inst, patchedDef) → SkillInstance
// Returns a new instance with thresholds set; call with getCachedSkill(inst).
```

---

## Skill JSON Examples

### Tick cooldown only (Parry Riposte — warrior_001)

```json
{
  "id": "warrior_001_parry_riposte",
  "tuCost": 0,
  "apCost": 20,
  "tickCooldown": 20,
  "tags": ["counter", "physical", "melee"],
  ...
}
```

Warrior cannot counter again for 20 ticks after Parry Riposte fires.

### Turn cooldown only (Evasive Strike — hunter_001)

```json
{
  "id": "hunter_001_evasive_strike",
  "tuCost": 0,
  "apCost": 15,
  "turnCooldown": 2,
  "tags": ["counter", "energy", "ranged"],
  ...
}
```

Hunter must take 2 of their own actions before Evasive Strike is ready again.

### No cooldown (Slash — warrior_001)

```json
{
  "id": "slash_001",
  "tuCost": 8,
  "apCost": 20,
  "tags": ["physical", "melee"],
  ...
}
```

No `tickCooldown` or `turnCooldown` fields → always available (subject to AP).
