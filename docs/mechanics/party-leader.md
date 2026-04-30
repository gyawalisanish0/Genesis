# Party Leader System

Genesis is built around the principle that **the player controls exactly one
unit per battle** — the **party leader**. Other party members fight as
AI-controlled allies. The dungeon overworld renders the party as a single
token. This document specifies the leader system end-to-end.

---

## Why a single controlled unit

- **Mobile-first focus**: a vertical action HUD with multiple unit selectors
  is too cluttered on a 360 dp screen
- **Decision tempo**: one tap-to-roll loop per turn keeps battles fast
- **Narrative anchoring**: the leader is the player's avatar — the unit whose
  perspective drives dialogue, mission framing, and consequence
- **AI allies surface character building**: ally behaviour is driven by their
  skills, stats, and class; the player's choices in roster and skill upgrades
  shape the supporting cast without micromanagement

---

## Unit roles

The implementation keeps `Unit.isAlly` (boolean: friendly or hostile) as the
faction tag and derives **controlled-vs-AI** at the screen layer, not on `Unit`.
This avoids per-unit mutation when the control mode changes and keeps `core/`
free of UI concerns.

```ts
// On Unit (core/types.ts) — unchanged from before:
interface Unit {
  // …
  isAlly: boolean   // true = player-side (leader OR AI ally); false = enemy
}
```

```ts
// In BattleContext (screens/BattleContext.tsx):
const controlledIds = useMemo<Set<string>>(() => {
  if (selectedMode?.settings.playerControl === 'all') {
    return new Set(playerUnits.map((u) => u.id))   // every party unit is controlled
  }
  const primaryId = playerUnits[0]?.id
  return primaryId ? new Set([primaryId]) : new Set<string>()
}, [selectedMode, playerUnits])

const leader = playerUnits.find((u) => controlledIds.has(u.id)) ?? null
```

| Unit | `isAlly` | In `controlledIds`? | HUD | Targeted by enemies | Targets enemies |
|---|---|---|---|---|---|
| Leader     | `true`  | yes  | Yes — action grid bound here | Yes | Yes |
| AI ally    | `true`  | no   | No — appears on timeline + arena only | Yes | Yes |
| Enemy      | `false` | no   | No | No | Yes (vs ally side) |

The combat engine treats all `isAlly === true` units as the same faction for
targeting and victory checks (battle ends when **all** ally-side units die,
or all enemies die).

---

## Leader selection — driven by `ModeDef.settings.playerControl`

Leader selection is **mode-dependent**. The `playerControl` field on a mode
definition decides whether the player controls one unit or all of them:

| `playerControl` | Behaviour |
|---|---|
| `'single'` (default; absent value) | Only `playerUnits[0]` is controlled — that unit is the leader. Everyone else fights as AI. |
| `'all'` | Every party unit is controlled — each takes its own player-driven turn when active on the tick stream. The HUD still anchors on the first unit but the action grid binds to whichever controlled unit is currently active. |

`controlledIds` is the source of truth: a `Set<string>` of unit IDs the player
can issue commands to. It is recomputed whenever `selectedMode` or `playerUnits`
change.

### Story / Ranked (Pre-Battle wizard)

The user picks the team in `PreBattleStepTeam`. The **first slot** of
`selectedTeamIds` becomes the leader by default. Modes can declare
`playerControl: 'all'` to let the player drive every unit individually
(currently no story mode opts in — single is the default).

### Campaign (stage-driven)

`stage.json` carries the same `settings.playerControl` field:

```json
{
  "playerUnits": { "mode": "fixed", "units": ["warrior_001", "hunter_001"] },
  "settings": {
    "enemyAi":       "patrol",
    "playerControl": "single"
  }
}
```

`DungeonContext.launchBattle()` builds a `ModeDef` from `stage.settings` and
calls `setSelectedMode(modeDef)` + `setSelectedTeamIds(stage.playerUnits.units)`.
BattleContext reads `selectedMode.settings.playerControl` to derive
`controlledIds`. The first entry of `selectedTeamIds` is the leader.

For story-critical missions where the protagonist must be a specific character,
order `units` so the protagonist comes first:

```json
"units": ["warrior_001", "hunter_001"]   // Iron Warden leads
```

---

## HUD binding

`BattleScreen.PortraitPanel` reads the `leader` field from `BattleContext` and
renders **a single entry** — the leader's portrait, HP bar, AP bar, and class
badge. AI allies are not displayed in the portrait panel.

| HUD element | Bound to |
|---|---|
| `PortraitPanel` (portrait + HP/AP) | `leader` only |
| `ActionGrid` (skill buttons) | `activePlayerUnit`'s skills (which is always the leader unless `playerControl: 'all'`) |
| `ROLL` button | `activePlayerUnit` (leader by default) |
| `END/SKIP` button | `activePlayerUnit` (leader by default) |
| Turn counter ("Turn N") | `leader.actionCount + 1` |
| Timeline strip | All units (leader, allies, enemies) — full roster visible |
| Arena (Phaser canvas) | All units rendered as figures — leader does not visually dominate |

Allies' health and AP can still be inspected on the timeline (and inside the
Phaser arena via their figures), but the player cannot directly issue commands
to them — they auto-fight via the AI loop.

---

## AI ally behaviour

Allies use the **same enemy-AI sequencing pipeline** in `BattleContext`:

```
phase: 'ally'   (new phase, sibling to 'player' and 'enemy')
  ↓
telegraphTimer  → showTurnDisplay
  ↓ (ENEMY_AI_DELAY_MS)
actionTimer     → runAttack with team-aware target selection
  ↓ (DICE_RESULT_DISMISS_MS)
applyTimerRef   → setEnemies / setPartyUnits / registerTick
```

### Phase derivation

`phase` is auto-derived from `activeUnitIds`:

```ts
if (leader && activeUnitIds.has(leader.id))             → 'player'
else if (any allyId is in activeUnitIds)                → 'ally'
else if (any enemyId is in activeUnitIds)               → 'enemy'
else                                                    → 'resolving'
```

Allies do **not** present a player choice — they always pick their first
available skill (Phase 1) or use a target-priority scoring function (Phase 2).
Their dice rolls are still random; outcomes resolve through the same
`shiftProbabilities` pipeline.

### Target selection for allies

```ts
// Phase 1 (current): always target the lowest-HP enemy
const target = enemies
  .filter(e => e.hp > 0)
  .sort((a, b) => a.hp - b.hp)[0]
```

Future: skill metadata (e.g. `targetPriority: 'low-hp' | 'high-threat'`) drives
ally targeting per-skill, mirroring how counter dice are tagged today.

---

## Dungeon — single party token

The dungeon overworld renders **one token** for the entire party — anchored to
the leader. AI allies are not visible on the map.

| Visible on map | Tracked in state |
|---|---|
| Leader portrait + position | All party members (HP, AP, status carry between battles) |

When battle is engaged, the leader's `defId` becomes the controllable unit and
all `dungeonState.units.party` members enter the encounter.

If the **leader dies in battle**, the battle does not immediately end — surviving
allies fight on. Battle ends when:

- **Defeat**: all non-enemy units (leader + allies) have `hp <= 0`
- **Victory**: all enemy units have `hp <= 0`

If the leader is among the defeated allies but at least one ally survived in a
**victory**, the surviving ally does **not** automatically become the new leader
mid-mission. The next dungeon turn shows the surviving ally as the new token,
because the leader is dead. (Phase 2: revival via consumable or stage end-screen.)

---

## Migration of existing code

The current `BattleContext` uses `playerUnit: Unit | null` (single unit) and
`enemies: Unit[]`. The new model uses:

```ts
partyUnits: Unit[]      // includes leader + allies
enemies:    Unit[]
leader:     Unit | null  // derived: partyUnits.find(u => u.isControlled)
```

All call sites that read `playerUnit` should switch to `leader`. Iteration over
"the player's units" (e.g. for HP totals, action count summing in `endBattle`)
should iterate `partyUnits`.

The unit-team field replaces ad-hoc `isAlly` checks scattered across the codebase
with a single discriminator. `isAlly` is retained on `HistoryEntry` for grayscale
rendering — it stays `true` for both leader and ally history entries.

---

## Open questions (Phase 2)

- **Leader swap mid-battle**: should the player be able to swap leader mid-
  battle (sacrifice action point to issue commands to a different unit)? Out of
  scope for Phase 1.
- **Ally skill upgrades**: do allies use the same `currentLevel` cache as the
  leader, or do they have their own progression curve? Currently shared.
- **Co-op / multiplayer**: for future multiplayer modes, each player would
  control one leader; their parties would have separate AI ally pools. Schema
  already accommodates this — `team: 'player'` is per-client.
- **Leader-centric narrative**: dialogue triggers can already match `actorId`
  on the leader's `defId`. No code change needed.
