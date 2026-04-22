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

## Free Action Semantics

- **No TU cost** — the counter-attacker's `tickPosition` does not advance.
- **AP cost** is paid at counter-fire time from the in-flight snapshot (`snap`).
- The counter is not logged in the timeline strip; it appears only in the
  combat log and the DiceResult overlay.

---

## Implementation Files

| File | Role |
|---|---|
| `src/core/combat/CounterResolver.ts` | `findCounterSkill`, `canCounter`, `isSingleTarget` — pure eligibility checks |
| `src/core/combat/DiceResolver.ts` | `resolveCounterRoll(depth)` — returns bool |
| `src/core/constants.ts` | `COUNTER_BASE`, `COUNTER_STEP`, `COUNTER_MIN`, `COUNTER_ANNOUNCE_MS` |
| `src/screens/BattleContext.tsx` | `scheduleCounterChain` — animation sequencing + recursive chain |

---

## Skill JSON Example

```json
{
  "type": "skill",
  "id": "warrior_001_parry_riposte",
  "name": "Parry Riposte",
  "tuCost": 0,
  "apCost": 20,
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
- `resolution.baseChance` — used for the counter attack's own hit dice (separate
  from the trigger Evasion roll; this is the counter's chance to hit the target)
- `tickCooldown` / `turnCooldown` — optional; counter skills may carry cooldowns
  to prevent rapid chaining. Example: `"tickCooldown": 20` on Parry Riposte means
  the warrior cannot counter again for 20 ticks. See `docs/mechanics/cooldown.md`.
