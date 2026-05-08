# Engine Content Contract

This document defines the **content contract** for the Genesis combat engine —
the shape of the JSON files that drive skills, statuses, passives, and items,
and the corresponding TypeScript surface in `core/` that runs them.

It is the source of truth for:
- What a skill / status / passive / item JSON file looks like
- What events, conditions, effects, targets, and value expressions are available
- How level upgrades patch a skill during a run
- What the Skill / Status / Passive engines read from the content layer

If `core/` needs a code change to support a new skill that should have been
expressible in JSON, the contract is wrong — not the skill.

Related documents:
- `CONCEPT.md` §Engine Architecture — design intent and high-level rules
- `CLAUDE.md` §Game Design Principles — load-bearing invariants `core/` must obey

---

## Design decisions (locked)

| # | Decision | Value |
|---|---|---|
| 1 | Script shape | **Flat effect list** — one `effects: Effect[]` array per script; each entry carries its own `when` |
| 2 | Patch syntax | **Named-key patch** — effects carry an `id` inside the skill; patches reference effects by name, not index |
| 3 | `when` field | **Object form** — `{ "event": "...", ...params }`; parameterised events carry their config inside the `when` block |
| 4 | Conditions | **First-class `condition` field** on every effect, separate from `when`; fires the effect only if the condition evaluates true |
| 5 | Targeting | **Top-level skill target + per-effect override** — skill declares a default `targeting` block; individual effects may override |
| 6 | Skill ownership | **Character-exclusive** — `SkillDef` objects live inside `characters/{id}/skills.json`; there is no global `data/skills/` directory. A skill belongs to exactly one character. Cross-character skill grants (items, passives) reference the skill by `id` but do not duplicate its definition |

These six decisions are frozen. Any proposed change to them is a contract
revision, not a bugfix.

---

## Canonical example — a skill

Every locked decision above is visible in this file. If a designer can write
this without reading the rest of the doc, the contract is working.

```json
{
  "type":     "skill",
  "id":       "drain_slash_001",
  "name":     "Drain Slash",
  "tuCost":   5,
  "apCost":   12,
  "tags":     ["physical", "melee"],
  "maxLevel": 5,

  "targeting": {
    "selector": "single-enemy",
    "range":    "melee"
  },

  "resolution": {
    "baseChance": 0.95
  },

  "effects": [
    {
      "id":         "dmg",
      "when":       { "event": "onCast" },
      "type":       "damage",
      "amount":     { "stat": "strength", "percent": 80 },
      "damageType": "physical"
    },
    {
      "id":        "stagger",
      "when":      { "event": "onHit" },
      "condition": { "chance": 0.6 },
      "type":      "applyStatus",
      "status":    "stagger",
      "duration":  4
    },
    {
      "id":        "lifesteal",
      "when":      { "event": "onAfterHit" },
      "condition": { "targetHpBelow": 0.5 },
      "target":    "self",
      "type":      "heal",
      "amount":    { "stat": "strength", "percent": 30 }
    }
  ],

  "levelUpgrades": [
    {
      "level": 2,
      "patch": {
        "apCost": 10,
        "effects.dmg.amount.percent": 90
      }
    },
    {
      "level": 3,
      "patch": {
        "effects.stagger.condition.chance": 0.8
      }
    },
    {
      "level": 4,
      "patch": {
        "effects.dmg.amount.percent": 105,
        "effects.lifesteal.amount.percent": 40
      }
    },
    {
      "level": 5,
      "patch": {
        "effects.dmg.amount.percent": 120,
        "effects.stagger.duration": 6
      }
    }
  ]
}
```

---

## Content file schema

### Skill

| Field | Type | Required | Description |
|---|---|---|---|
| `type` | `"skill"` | yes | Discriminator |
| `id` | `string` | yes | Globally unique id (file name convention: `<name>_<3digit>`) |
| `name` | `string` | yes | Display name |
| `description` | `string` | no | Flavour text for UI |
| `tuCost` | `integer ≥ 0` | yes | Ticks the caster's marker advances after use |
| `apCost` | `integer ≥ 0` | yes | AP spent on cast |
| `tags` | `Tag[]` | yes | 1–4 tags; see `Tag` vocabulary |
| `maxLevel` | `integer ≥ 1` | yes | Highest level reachable during a run |
| `targeting` | `Targeting` | yes | Default target selector for the skill (see §Targeting) |
| `resolution` | `Resolution` | no | Dice resolution config: base chance, dice modifiers |
| `effects` | `Effect[]` | yes | Flat effect list — see §Effect |
| `levelUpgrades` | `LevelUpgrade[]` | no | Named-key patches applied at each level ≥ 2 |

### Status

| Field | Type | Required | Description |
|---|---|---|---|
| `type` | `"status"` | yes | Discriminator |
| `id` | `string` | yes | Globally unique id |
| `name` | `string` | yes | Display name |
| `stacking` | `"refresh" \| "extend" \| "stack" \| "independent"` | yes | How repeated applications combine (§Stacking) |
| `maxStacks` | `integer ≥ 1` | conditional | Required if `stacking: "stack"` |
| `duration` | `integer ≥ 1` | yes | Base duration in ticks (may be overridden by the applying skill) |
| `tags` | `string[]` | no | Tags for `hasTag` conditions |
| `effects` | `Effect[]` | yes | Flat effect list — same shape as skill effects |

### Passive

| Field | Type | Required | Description |
|---|---|---|---|
| `type` | `"passive"` | yes | Discriminator |
| `id` | `string` | yes | Globally unique id |
| `name` | `string` | yes | Display name |
| `description` | `string` | no | Flavour text |
| `effects` | `Effect[]` | yes | Flat effect list — runs for the whole battle |

### Item (Equipment / Relic / Campaign)

| Field | Type | Required | Description |
|---|---|---|---|
| `type` | `"equipment" \| "relic" \| "campaignItem"` | yes | Item tier |
| `id` | `string` | yes | Globally unique id |
| `name` | `string` | yes | Display name |
| `slot` | `string` | conditional | Required for equipment; references a unit-defined slot |
| `effects` | `Effect[]` | yes | Flat effect list — same shape as everywhere else |

---

## `Effect` — the universal shape

Every script's `effects` entry has the same structure, regardless of which
engine runs it:

```ts
interface Effect {
  id?:        string       // required when this effect is patched by levelUpgrades
  when:       WhenClause   // trigger event + params
  condition?: Condition    // optional first-class gate
  target?:    TargetSelector  // optional override of the script's default target
  type:       string       // primitive name — looks up in the effect registry
  // …type-specific fields (amount, status, delta, duration, …)
}
```

The `type` field determines which handler in the effect registry runs the
effect, and which extra fields are expected. The full list of primitives is
in §Effect Primitives.

---

## `WhenClause` — trigger events

A `when` clause is always an object keyed on `event`, with optional
parameters specific to that event.

```ts
type DiceOutcome = 'Boosted' | 'Hit' | 'Evade' | 'Fail'

type WhenClause =
  | { event: "onCast" }
  | { event: "onDiceRoll"; outcome?: DiceOutcome }
  | { event: "onHit" }
  | { event: "onMiss" }
  | { event: "onAfterHit" }
  | { event: "onEvade" }
  | { event: "onApply" }
  | { event: "onExpire" }
  | { event: "onRemoved" }
  | { event: "onTickInterval"; interval: number }
  | { event: "onUnitTurnStart" }
  | { event: "onTakeDamage" }
  | { event: "onHpThreshold"; below?: number; above?: number }
  | { event: "onApChange" }
  | { event: "onBattleStart" }
  | { event: "onBattleEnd" }
```

### Which events each engine listens to

| Engine | Events |
|---|---|
| **Skill Engine** | `onCast`, `onDiceRoll`, `onHit`, `onMiss`, `onEvade`, `onAfterHit` |
| **Status Engine** | `onApply`, `onExpire`, `onRemoved`, `onTickInterval`, plus any unit-level event while the status is active (subscribed/unsubscribed on lifecycle) |
| **Passive Engine** | Any unit-level event for the unit owning the passive — typically `onTakeDamage`, `onUnitTurnStart`, `onHpThreshold`, `onDiceRoll`, `onBattleStart`, `onBattleEnd` |

A script that declares a `when.event` its engine does not listen to is a
content error — the Zod schema should reject it at load time.

---

## `Condition` — first-class effect gating

Conditions are evaluated against the `EffectContext` at the moment the event
fires. If the condition is absent or evaluates `true`, the effect runs. If
it evaluates `false`, the effect is skipped silently.

```ts
type Condition =
  | { chance: number }                       // random roll in [0,1)
  | { selfHpBelow: number }                  // caster.hp / caster.maxHp < n
  | { selfHpAbove: number }
  | { targetHpBelow: number }
  | { targetHpAbove: number }
  | { selfApBelow: number }
  | { selfApAbove: number }
  | { hasStatus: string }                    // target has this status id
  | { hasTag: string }                       // target has any status carrying this tag
  | { diceOutcome: DiceOutcome }             // current resolution result matches
  | { not: Condition }
  | { all: Condition[] }
  | { any: Condition[] }
```

The condition vocabulary is a registry — new atoms are added as the design
demands them. `not`, `all`, `any` provide boolean composition.

---

## `TargetSelector` — who an effect hits

A skill declares a default `targeting` block for UI and resolution. Individual
effects may override it with their own `target` field.

```ts
type TargetSelector =
  | "self"
  | "enemy"              // the player-chosen enemy target
  | "ally"               // the player-chosen ally target
  | "all-enemies"
  | "all-allies"
  | "lowest-hp-ally"
  | "lowest-hp-enemy"
  | "random-enemy"
  | "random-ally"
  | "caster-and-target"
  | { tag: string }      // all units with any status carrying this tag
```

A skill's top-level `targeting` block:

```ts
interface Targeting {
  selector: TargetSelector
  range:    "melee" | "ranged" | "global"
}
```

The `range` field exists for UI affordances (melee indicator, range preview)
and for future positional systems. It never gates resolution in the current
contract.

---

## `ValueExpr` — referencing stats in amounts

Any numeric field in an effect that can reference a character stat uses
`ValueExpr`:

```ts
type ValueExpr =
  | number
  | { stat: StatKey; percent: number; of?: "caster" | "target" }
  | { sum: ValueExpr[] }

type StatKey = "strength" | "endurance" | "power" | "resistance" | "speed" | "precision"
```

- A plain number is a flat value
- `{ stat, percent }` reads the relevant stat (default `caster`) and scales by `percent / 100`
- `{ sum: [...] }` lets you compose multiple components (e.g. flat + stat-scaled)

`ValueExpr` resolution is the only mini-syntax the contract contains. There
is no DSL, no expression parser, no runtime eval.

---

## Effect primitives (initial registry)

Every primitive is a typed handler in `core/effects/builtins/`. Content
references them via the `type` field on an effect entry. This list starts
small and grows as the design demands.

| `type` | Purpose | Additional fields |
|---|---|---|
| `damage` | Reduce target HP | `amount: ValueExpr`, `damageType?: string` |
| `heal` | Increase target HP | `amount: ValueExpr` |
| `tickShove` | Delay (+) or haste (−) a marker | `amount: number` |
| `gainAp` | Add AP to target | `amount: number` |
| `spendAp` | Subtract AP from target | `amount: number` |
| `modifyStat` | Temporary stat delta | `stat: StatKey`, `delta: number`, `duration: number \| "battle" \| "untilStatusGone"` |
| `applyStatus` | Attach a status | `status: string`, `duration?: number`, `chance?: number` |
| `removeStatus` | Cleanse | `status?: string`, `tag?: string` |
| `shiftProbability` | Bias the dice table | `outcome: DiceOutcome`, `delta: number` |
| `rerollDice` | Reroll on a dice result | `outcome?: DiceOutcome`, `uses: number`, `perBattle?: boolean` |
| `forceOutcome` | Override the dice roll | `outcome: DiceOutcome` |
| `triggerSkill` | Cast another skill | `skillId: string`, `ignoreCost?: boolean` |
| `secondaryResource` | Mutate a unit's optional third resource | `delta: number` |

Adding a new primitive is a four-step change:
1. Add the handler to `core/effects/builtins/<name>.ts`
2. Call `registerEffect('<type>', handle)` from `core/effects/builtins/index.ts` (`registerBuiltins()`)
3. Add its Zod schema variant to the effect union in `services/DataService.ts`
4. Document it in this file

---

## `LevelUpgrade` — named-key patch syntax

`levelUpgrades` is an ordered list of patches applied on top of the level-1
base form when a skill reaches each level during a run. Patches reference
effects by their `id`, not by array index — reordering effects in the base
definition never breaks an upgrade.

```ts
interface LevelUpgrade {
  level: number                 // ≥ 2, strictly increasing
  patch: Record<string, unknown>
}
```

### Patch key grammar

A patch key is a dot-delimited path. Segments are either field names or
`effects.<effectId>` for addressing an effect by its declared `id`.

```
<field>
<field>.<subfield>
effects.<effectId>.<field>[.<subfield>…]
```

Legal examples:
- `apCost`
- `tuCost`
- `resolution.baseChance`
- `effects.dmg.amount.percent`
- `effects.stagger.condition.chance`
- `effects.lifesteal.duration`

Illegal:
- `effects[0].amount.percent` (indexed — breaks on reorder)
- Any path whose target is not already present in the base (patches are
  strictly *updates*, not inserts; use the base definition for new effects)

Patches are cumulative: level 4 is computed as `apply(base, level2) → apply(…, level3) → apply(…, level4)`.

---

## Runtime: `SkillInstance`

Every equipped skill held by a unit at runtime is a `SkillInstance`:

```ts
interface SkillInstance {
  defId:         string      // references the JSON definition
  baseDef:       Readonly<SkillDef>  // immutable level-1 baseline
  currentLevel:  number      // 1 .. maxLevel
  cachedEffects: Effect[]    // patched effect list at currentLevel
  cachedCosts:   { tuCost: number; apCost: number }
  cacheVersion:  number      // bumped on level-up or external re-patch
}
```

### Lifecycle rules

- **Instantiation**: `new SkillInstance(def)` → level 1, cache = base
- **Level up**: `levelUp()` → bumps `currentLevel`, applies the matching
  `levelUpgrades[level]` patch onto the base, writes new `cachedEffects`
  and `cachedCosts`, bumps `cacheVersion`
- **Cast path**: cast resolution reads from `cachedEffects` / `cachedCosts`.
  No per-cast patch math
- **External re-patch**: if a passive needs to mid-battle re-patch a skill,
  it bumps `cacheVersion`; the next cast rebuilds the cache lazily
- **Reset**: `resetToDefault()` rebuilds the cache from `baseDef` at
  level 1, clears `cacheVersion`. **Called by the mode / run lifecycle
  only**, never by the battle engine

### Who calls `resetToDefault()`

- Story / Campaign run ends (complete or abandoned): **yes**
- Single mission inside a campaign ends: **no**
- Roguelite run ends: **yes**
- Individual PvP match ends: **yes** (one match = one run)
- Individual battle ends: **never**

---

## Runtime: `EffectContext`

Every effect handler receives exactly one argument: an `EffectContext`. This
is the only channel through which effects read or mutate battle state.

```ts
interface EffectContext {
  caster:   Unit
  target?:  Unit
  targets?: Unit[]         // present when a selector resolves to multiple units
  battle:   BattleState    // read/mutate through typed methods only
  source:   "skill" | "status" | "passive" | "item"
  event:    WhenClause     // the event that triggered this effect
  dice?:    DiceOutcome    // present during onDiceRoll / onHit / onAfterHit
}
```

Effect handlers never import `core/state` directly, never mutate `Unit`
properties directly, and never reach into the battle store. All mutation
goes through `battle` methods. This is what keeps the engines composable.

---

## `core/` module layout this contract implies

```
src/core/
├── battleHistory.ts          # HistoryEntry type + makeHistoryEntry factory
├── effects/
│   ├── types.ts              # Effect, EffectContext, ValueExpr, WhenClause, Condition, TargetSelector
│   ├── applyEffect.ts        # condition → target rescope → handler dispatch
│   ├── resolveValue.ts       # ValueExpr → number
│   ├── conditions.ts         # evaluateCondition
│   ├── patch.ts              # named-key patch engine
│   └── builtins/
│       ├── index.ts          # registerBuiltins() — called once in main.tsx
│       ├── damage.ts         ✅ registered
│       ├── heal.ts           ✅ registered
│       ├── gainAp.ts         ✅ registered
│       ├── spendAp.ts        ✅ registered
│       ├── tickShove.ts      ✅ registered
│       ├── modifyStat.ts     ✅ registered
│       ├── applyStatus.ts    (planned)
│       ├── shiftProbability.ts (planned)
│       ├── rerollDice.ts     (planned)
│       ├── forceOutcome.ts   (planned)
│       └── triggerSkill.ts   (planned)
└── engines/
    ├── skill/
    │   └── SkillInstance.ts  ✅ implemented (createSkillInstance, getCachedSkill, levelUpSkill)
    ├── status/               (planned)
    └── passive/              (planned)
```

Corresponding content layout:

```
public/data/
├── characters/
│   ├── index.json               # ["warrior_001", "hunter_001", …] — discovery list
│   ├── {id}/                    # one subfolder per character
│   │   ├── main.json            # CharacterDef — stats, class, rarity, passive ref
│   │   ├── skills.json          # SkillDef[] — full definitions, character-owned (decision #6)
│   │   └── growth/              # progression/XP curves (TBD — placeholder only)
├── statuses/
├── passives/
├── items/
│   ├── campaign/
│   └── genesis/
│       ├── equipment/
│       └── relics/
└── modes/
```

---

## What this contract deliberately does NOT include

- **Expression language / scripting** — `ValueExpr` is the only mini-syntax.
  Anything more complex becomes a new primitive or a new condition.
- **Grid / position targeting** — `range` is informational only; no tile or
  distance math.
- **Area shapes** — AoE is expressed through selectors (`all-enemies`,
  `random-enemy × N`), not through geometric shapes.
- **Absolute durations or wall-clock time** — everything is ticks.
- **Cross-run persistence** — all mods are temporary to the run. Permanent
  progression is a separate system outside this contract.

If the design needs any of these, it's a **contract revision**. Bump the
contract version, update this document first, then update `core/` to match.

---

## Contract version

**v0.3.0** — 6-outcome dice system live.

`core/effects/` and `core/engines/skill/` are implemented. Six primitives are
registered (`damage`, `heal`, `gainAp`, `spendAp`, `tickShove`, `modifyStat`).
`DataService` loads and caches characters and skills. `BattleContext` wires the
full execution pipeline (dice → `applyEffect` → state sync). `DiceOutcome` has
4 members: `Boosted`, `Hit`, `Evade`, `Fail`.
Remaining primitives (`applyStatus`, `shiftProbability`, `rerollDice`,
`forceOutcome`, `triggerSkill`) and the status / passive engines are still planned.
