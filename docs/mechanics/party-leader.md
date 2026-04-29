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

```ts
type UnitTeam = 'player' | 'ally' | 'enemy'

interface Unit {
  // existing fields …
  team:         UnitTeam   // 'player' = leader; 'ally' = AI ally; 'enemy' = hostile
  isControlled: boolean    // true ONLY for the leader
  isAlly?:      boolean    // legacy field retained for history rendering
}
```

| `team`     | `isControlled` | HUD | Targeted by enemies | Targets enemies |
|---|---|---|---|---|
| `player`   | `true`         | Yes — action grid bound here | Yes | Yes |
| `ally`     | `false`        | No — appears on timeline + arena only | Yes | Yes |
| `enemy`    | `false`        | No | No | Yes (vs `player`/`ally`) |

The combat engine treats `player` and `ally` units as the same faction for
targeting and victory checks (battle ends when **all** non-enemy units die,
or all enemies die).

---

## Leader selection

Leader selection depends on the **mode** and **stage**:

### Pre-Battle modes (Story / Ranked / Draft)

The user picks the team in `PreBattleStepTeam`. The **first slot** of
`selectedTeamIds` is treated as the leader by default. The user can reorder the
team to promote a different unit. No JSON override applies.

```
selectedTeamIds: ['hunter_001', 'warrior_001']
                    ↑ leader
```

### Campaign mode (stage-driven)

`stage.json` may declare `playerUnits.leader`:

```json
{
  "playerUnits": {
    "mode":   "fixed",
    "units":  ["warrior_001", "hunter_001"],
    "leader": "warrior_001"
  }
}
```

| Stage field present? | Leader source |
|---|---|
| `playerUnits.leader` set | That `defId` is the leader (story-driven; e.g. Iron Warden is the protagonist of stage_001) |
| `playerUnits.leader` absent | First entry of `playerUnits.units` is the leader |
| `playerUnits.mode === "player"` (rare in campaign) | Falls back to the user's pre-battle reorder rule |

A stage-defined leader **must** appear in `playerUnits.units`. If the leader
`defId` is not in the unit list, `DataService` throws a validation error during
load.

### Dungeon → Battle handoff

`DungeonContext.launchBattle()` reads `dungeonState.leaderId` and writes it to
the global Zustand store as `currentLeaderId`. `BattleContext` reads this on
mount when constructing the party:

```ts
const leaderId = useGameStore.getState().currentLeaderId
                 ?? selectedTeamIds[0]    // fallback for non-campaign modes

const party = await Promise.all(selectedTeamIds.map(loadCharacterWithSkills))
const partyUnits = party.map(p => createUnit({
  ...p,
  team:         p.defId === leaderId ? 'player' : 'ally',
  isControlled: p.defId === leaderId,
}))
```

---

## HUD binding

`BattleScreen` filters its action HUD bindings by `isControlled`:

| HUD element | Bound to |
|---|---|
| `UnitPortrait` (centre, large) | The leader |
| `ActionGrid` (skill buttons) | Leader's skills via `getUnitSkills(leader.id)` |
| `ROLL` button | Leader only |
| `END/SKIP` button | Leader only |
| `ResourceBar` (HP/AP) — main panel | Leader |
| Timeline strip | All units (`player`, `ally`, `enemy`) — full roster visible |
| Arena (Phaser canvas) | All units rendered as figures — leader does not visually dominate |

Allies appear as smaller portraits **above** or **beside** the leader's main
portrait (TBD layout; see `docs/ui/06_battle.md`). They show HP bars but no AP
gauges, since the player cannot spend their AP.

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
