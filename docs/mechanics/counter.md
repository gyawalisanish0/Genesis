# Counter Mechanic

## Overview

When an attack resolves as **Evasion** against a **single-target** skill, the
evading unit may fire a reactive counter-attack as a **free action** — no TU
cost; only AP is spent. A separate counter dice roll (see formula below)
determines success. Chains are unbounded: each successful counter gives the
original attacker the same opportunity to counter back, with AP re-checked at
every link.

---

## Trigger Conditions (all must hold)

| Condition | Rule |
|---|---|
| Dice outcome | `Evasion` |
| Skill targeting | `targeting.selector === 'enemy'` (single-target only — AOE and self skills do not trigger) |
| Counter skill exists | The evading unit owns a skill tagged `counter` or `uniqueCounter` |
| AP available | `unit.ap >= counterSkill.apCost` at the time the counter fires |

---

## Counter Dice Formula

```
chance(depth) = max(COUNTER_MIN, COUNTER_BASE − depth × COUNTER_STEP)
             = max(0.01,         0.15        − depth × 0.02)
```

| Chain depth | Chance |
|---|---|
| 0 (first counter) | 15% |
| 1 | 13% |
| 2 | 11% |
| 3 | 9% |
| 4 | 7% |
| 5 | 5% |
| 6 | 3% |
| 7+ | 1% (minimum) |

Constants in `src/core/constants.ts`:
- `COUNTER_BASE = 0.15`
- `COUNTER_STEP = 0.02`
- `COUNTER_MIN  = 0.01`
- `COUNTER_ANNOUNCE_MS = 800` — delay between Evasion display and the counter
  dice roll appearing

---

## Chain Rules

1. A successful counter fires the counter skill as normal attack resolution
   (uses its own dice table, baseChance, effects).
2. After the counter resolves, the *original attacker* becomes the potential
   evading unit — if they also evade, their counter skill is evaluated.
3. `depth` increments by 1 each link, reducing the probability.
4. A link terminates when:
   - The counter dice fails
   - The new potential counter-unit has no `counter`/`uniqueCounter` skill
   - The new potential counter-unit lacks sufficient AP

---

## `counter` vs `uniqueCounter` Tags

| Tag | Dice + chain | Effects |
|---|---|---|
| `counter` | Standard counter dice (see formula) | Defined in skill JSON — typically a single damage effect |
| `uniqueCounter` | Identical dice + chain rules | Custom effects — may include status applications, stat mods, etc. |

The two tags are mechanically identical. `uniqueCounter` signals a
character-specific thematic skill rather than a generic reactive strike.

---

## Counter Decision Window

When the counter dice succeeds, what happens next depends on whose unit is
countering:

### Player counter (player unit evaded)
A **Counter Opportunity** prompt appears in the battle screen:

```
┌────────────────────────┐
│  Counter Opportunity!  │
│  Parry Riposte  AP: 20 │
│  [COUNTER]  [SKIP]     │
└────────────────────────┘
```

- **COUNTER** — fires the counter-tagged skill immediately. AP is deducted from
  the snapshot at confirm time.
- **SKIP** — forfeits the opportunity; no AP is spent, no attack fires. This is
  a deliberate strategic option (AP conservation, bait avoidance, etc.).

### Enemy AI counter (enemy unit evaded)
The AI evaluates its AP reserve before firing:

```
if enemy.ap − counterSkill.apCost >= AI_COUNTER_AP_RESERVE (20):
    fire counter immediately
else:
    skip silently (preserve AP for own offensive turn)
```

`AI_COUNTER_AP_RESERVE = 20` is defined in `src/core/constants.ts`.

---

## Cooldown Interaction

Counter reactions **bypass cooldown entirely** — for both player and enemy:

- The counter-tagged skill is **never placed on cooldown** when used as a
  reactive counter (neither `tickCooldown` nor `turnCooldown` is applied).
- If the same skill is used on a **normal offensive turn** (via the action grid
  + Roll button), cooldown applies as normal.
- A counter reaction may fire even if the skill is currently on cooldown from
  a prior normal use — the CD check is skipped for reactive counters.

This keeps counter skills available as defensive tools even after the player
spent them offensively, and preserves the strategic richness of having cooldown
matter only for proactive use.

---

## Free Action Semantics

- **No TU cost** — the counter-attacker's `tickPosition` does not advance.
- **AP cost** is paid at the moment the counter fires (for AI) or when the
  player confirms (for the choice prompt).
- **No cooldown applied** — see Cooldown Interaction above.
- The counter is not logged in the timeline strip; it appears only in the
  combat log and the DiceResult overlay.

---

## Implementation Files

| File | Role |
|---|---|
| `src/core/combat/CounterResolver.ts` | `findCounterSkill`, `canCounter`, `isSingleTarget` — pure eligibility checks |
| `src/core/combat/DiceResolver.ts` | `resolveCounterRoll(depth)` — returns bool |
| `src/core/constants.ts` | `COUNTER_BASE`, `COUNTER_STEP`, `COUNTER_MIN`, `COUNTER_ANNOUNCE_MS`, `AI_COUNTER_AP_RESERVE` |
| `src/screens/BattleContext.tsx` | `scheduleCounterChain`, `confirmCounter`, `skipCounter`, `pendingCounterDecision` |
| `src/screens/BattleScreen.tsx` | `CounterPromptOverlay` — player choice UI |

---

## Skill JSON Example

```json
{
  "type": "skill",
  "id": "warrior_001_parry_riposte",
  "name": "Parry Riposte",
  "tuCost": 0,
  "apCost": 20,
  "tickCooldown": 20,
  "tags": ["counter", "physical", "melee"],
  "maxLevel": 1,
  "targeting": { "selector": "enemy", "range": "melee" },
  "resolution": { "baseChance": 0.8 },
  "effects": [
    {
      "id": "warrior_001_parry_riposte_dmg",
      "when": { "event": "onCast" },
      "type": "damage",
      "amount": { "stat": "strength", "percent": 60 },
      "damageType": "physical"
    }
  ],
  "levelUpgrades": []
}
```

Key fields:
- `tuCost: 0` — free action
- `tags` includes `"counter"` (or `"uniqueCounter"`)
- `targeting.selector: "enemy"` — required for the counter to chain correctly
- `resolution.baseChance` — the counter attack's own hit dice chance
- `tickCooldown` / `turnCooldown` — optional; applies only to **normal use**,
  never to reactive counter use. See `docs/mechanics/cooldown.md`.
