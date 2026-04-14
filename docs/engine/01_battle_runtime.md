# Battle Runtime — BattleContext

This document describes the ephemeral battle-session state managed by
`src/screens/BattleContext.tsx` and the supporting modules in `src/core/`.

The runtime holds only within-session state. Nothing here is written to the
global Zustand store (`GameContext`) until the battle ends.

---

## Data loading

On mount, `BattleProvider` loads two characters plus their skills from `DataService`:

```ts
const [playerData, enemyData] = await Promise.all([
  loadCharacterWithSkills('warrior_001'),   // Iron Warden — player
  loadCharacterWithSkills('hunter_001'),    // Swift Veil — enemy
])
```

`loadCharacterWithSkills(id)` fires two parallel requests per character:

| Request | Path | Returns |
|---|---|---|
| 1 | `data/characters/{id}/main.json` | `CharacterDef` |
| 2 | `data/characters/{id}/skills.json` | `SkillDef[]` |

Skills are **character-exclusive**: `SkillDef` objects live inside the character's
own subfolder and are not shared across characters (see content contract decision #6).

Each character is built into a runtime `Unit` via `createUnit()`, and its
starting tick position is assigned by `calculateStartingTick(stats.speed, className)`.
Skills are wrapped into `SkillInstance` objects via `createSkillInstance(skillDef)`.

`isLoading` is `true` during this async phase. The UI renders a loading message
and does not render the timeline or action grid.

---

## State shape (`BattleContextValue`)

### Global battle clock

| Field | Type | Description |
|---|---|---|
| `tickValue` | `number` | The current global battle tick — stored state, starts at `0`, auto-advances (see §Tick advancement) |
| `activeUnitIds` | `Set<string>` | IDs of units whose registered tick equals `tickValue` |

### Units

| Field | Type | Description |
|---|---|---|
| `playerUnit` | `Unit \| null` | The player's active unit (`null` while loading) |
| `enemies` | `Unit[]` | All enemy units in the battle |
| `isLoading` | `boolean` | `true` while `DataService` is fetching; `false` once the battle is ready |

`registerTick` keeps `unit.tickPosition` in sync with the tick map automatically
(see §Tick registration API).

### Skill management

| Field | Type | Description |
|---|---|---|
| `getUnitSkills(id)` | `(id: string) => SkillInstance[]` | Returns the `SkillInstance[]` equipped by a unit |

Skills are stored in a per-unit `Map<unitId, SkillInstance[]>` inside the
provider. This is separate from `Unit.skills` (the legacy field in `core/types.ts`)
to avoid a circular type dependency between `core/types.ts` → `core/effects/types.ts`.

`SkillInstance` is the new engine type from `core/effects/types.ts` — it carries
the immutable `baseDef`, `cachedEffects`, `cachedCosts`, `currentLevel`, and
`cacheVersion`. Casts always read from the cache; patch math never runs on the
hot path.

### Timeline registration

| Field | Type | Description |
|---|---|---|
| `registeredTicks` | `Map<string, number>` | Maps entity ID → tick position. Drives `tickValue`, `scrollBounds`, and `activeUnitIds` |
| `scrollBounds` | `{ min: number; max: number }` | Derived tick range the timeline track covers |

Any entity — unit, event, effect — can register a tick position. The timeline
expands to cover all registered positions plus a 15-tick buffer at each end and
300 ticks of future range ahead of the now-line (see constants in
`src/core/constants.ts`).

### Action history

| Field | Type | Description |
|---|---|---|
| `historyEntries` | `HistoryEntry[]` | Ordered list of past tick positions; rendered as grayscale ghost markers on the strip |

### Ephemeral UI state

| Field | Type | Description |
|---|---|---|
| `phase` | `TurnPhase` | `'player' \| 'enemy' \| 'resolving'` — **auto-derived** from `activeUnitIds` (see §Phase auto-derivation) |
| `turnNumber` | `number` | Incrementing session counter (per-session metric, not a round system) |
| `log` | `LogEntry[]` | Combat event log entries |
| `selectedSkill` | `SkillInstance \| null` | Currently highlighted skill |
| `gridCollapsed` | `boolean` | Action grid collapse state |
| `isPaused` | `boolean` | Pause overlay visible |

---

## Tick advancement

`tickValue` is **stored state**, not derived. It initialises to `0` on mount.
When data loads, the resulting `setRegisteredTicks` call triggers the
auto-advance check, which moves the clock to the minimum starting tick across
all units (typically 1–18 ticks, depending on class and speed stat).

### Auto-advance rule

After every `registerTick` call, a `useEffect` checks:

```
if every registered tick > tickValue → setTickValue(min(registeredTicks))
```

This means: once every unit at the current clock position has acted, the clock
automatically advances to the next unit's tick.

### Phase auto-derivation

A separate `useEffect` watches `activeUnitIds` and updates `phase`:

```ts
if (playerUnit && activeUnitIds.has(playerUnit.id)) → setPhase('player')
else if (any enemy id is in activeUnitIds)          → setPhase('enemy')
```

No code outside `BattleProvider` calls `setPhase('player')` or `setPhase('enemy')`
manually — phase always reflects which unit is at the now-line.

### Example

```
After data loads:
  tickValue=0   registeredTicks={player:8, enemy:2}
  auto-advance: all ticks (8,2) > 0 → tickValue=2
  activeUnitIds={'enemy-id'}  → phase='enemy'

Enemy acts (TU 8):
  registerTick('enemy-id', 10)
  registeredTicks={player:8, enemy:10}
  all > 2? yes → tickValue=8
  activeUnitIds={'player-id'}  → phase='player'

Player acts (TU 8, Tumbling +2 delay):
  registerTick('player-id', 18)
  registeredTicks={player:18, enemy:10}
  all > 8? yes → tickValue=10
  activeUnitIds={'enemy-id'}  → phase='enemy'
```

---

## Tick registration API

```ts
registerTick(id: string, tick: number)
```

- Updates `registeredTicks` map
- Syncs `playerUnit.tickPosition` or `enemies[n].tickPosition` if the ID matches
- Triggers the auto-advance check via `useEffect`

```ts
unregisterTick(id: string)
```

- Removes the entity from `registeredTicks` (unit defeated, effect expired, etc.)

---

## Skill execution

### `executeSkill(skillInstance: SkillInstance)`

Called by the player's action grid. Resolves the full combat pipeline for a
single player action:

```
1. Guard: phase === 'player', playerUnit alive, at least one living enemy
2. Build a mutable unit snapshot (Map<id, Unit>) — the engine's BattleState
3. Roll dice:
     finalChance = calculateFinalChance(caster.stats.precision, skill.resolution?.baseChance ?? 1.0)
     diceOutcome = roll(shiftProbabilities(finalChance))
4. Compute AP regen: calculateApGained(skill.tuCost, caster.apRegenRate) → add to caster
5. Build EffectContext; set ctx.target = undefined on Evasion (no recipients)
6. Apply each effect where effect.when.event === 'onCast' via applyEffect()
7. Sync snapshot back to React state: setPlayerUnit, setEnemies
8. Append outcome log entry (coloured by dice result)
9. pushHistory(…) → registerTick(player.id, fromTick + skill.tuCost + tumbleDelay)
10. If all enemies hp === 0: append victory message
```

**Dice outcomes** affect tick advancement and log colour only — damage is
always the resolved `ValueExpr` amount (dice multipliers are a Wave C addition):

| Outcome | Tick advance modifier | Log colour |
|---|---|---|
| Boosted | +0 | `accent-gold` |
| Success | +0 | `text-primary` |
| Tumbling | +`calculateTumblingDelay()` (1–5) | `accent-danger` |
| GuardUp | +0 | `text-primary` |
| Evasion | +0 (no damage dealt) | `text-muted` |

---

## Enemy AI

When `phase` changes to `'enemy'`, a `useEffect` schedules a 700 ms timer
(for pacing) that runs each active enemy through the same execution path:

1. Find active enemies: `enemies.filter(e => activeUnitIds.has(e.id) && isAlive(e))`
2. Look up the enemy's skills via the `unitSkillsMapRef` (live ref — always current)
3. **No skills**: register a 10-tick wait; log "is gathering strength…"
4. **Has skills**: pick slot `[0]`, target `playerUnit`, run `runAttack()`
5. Sync updated state back to React; check for defeat (`playerUnit.hp === 0`)

The timer callback reads from **live refs** (`playerUnitRef`, `enemiesRef`,
`unitSkillsMapRef`) to avoid stale closure values during the 700 ms window.

---

## Action history (`core/battleHistory.ts`)

```ts
interface HistoryEntry {
  id:     string    // unique key: `${unitId}-${tick}-${timestamp}`
  unitId: string
  name:   string    // unit display name — first char used as portrait initial
  tick:   number    // tick position at the moment the action was taken
  isAlly: boolean
}

function makeHistoryEntry(unitId, name, tick, isAlly): HistoryEntry
```

**Usage pattern** — call before advancing the unit's tick:

```ts
pushHistory(makeHistoryEntry(unit.id, unit.name, unit.tickPosition, unit.isAlly))
registerTick(unit.id, advanceTick(unit.tickPosition, skill.tuCost + tumbleDelay))
```

History entries render as grayscale ghost markers behind live markers on the
timeline strip. They are never persisted — lost when the battle session ends.

---

## `activeTurn` per unit

Not stored on `Unit`. Consumers derive it from context:

```ts
const { activeUnitIds } = useBattleScreen()
const isActive = activeUnitIds.has(unit.id)
```

At any given `tickValue`, zero or more units may be active simultaneously
(if multiple units share the same starting tick position).

---

## Module layout

```
src/
├── core/
│   ├── battleHistory.ts           # HistoryEntry type + makeHistoryEntry factory
│   ├── unit.ts                    # createUnit, takeDamage, healUnit, gainAp, spendAp, setTickPosition
│   ├── effects/
│   │   ├── types.ts               # SkillDef, SkillInstance, BattleState, EffectContext
│   │   ├── applyEffect.ts         # condition → target rescope → handler dispatch
│   │   ├── resolveValue.ts        # ValueExpr → number
│   │   ├── conditions.ts          # evaluateCondition
│   │   ├── patch.ts               # named-key level upgrade patch engine
│   │   └── builtins/
│   │       ├── index.ts           # registerBuiltins() — called once in main.tsx
│   │       ├── damage.ts          # ✅ registered
│   │       ├── heal.ts            # ✅ registered
│   │       ├── gainAp.ts          # ✅ registered
│   │       ├── spendAp.ts         # ✅ registered
│   │       ├── tickShove.ts       # ✅ registered
│   │       └── modifyStat.ts      # ✅ registered
│   ├── engines/skill/
│   │   └── SkillInstance.ts       # createSkillInstance, getCachedSkill, levelUpSkill
│   └── combat/
│       ├── TickCalculator.ts      # calculateStartingTick, advanceTick, calculateApGained
│       ├── HitChanceEvaluator.ts  # calculateFinalChance, shiftProbabilities
│       └── DiceResolver.ts        # roll, applyOutcome, calculateTumblingDelay
├── services/
│   └── DataService.ts             # loadCharacterIndex, loadCharacter, loadCharacterSkillDefs,
│                                  #   loadCharacterWithSkills, loadMode (+ per-type cache)
└── screens/
    ├── BattleContext.tsx           # BattleContextValue + BattleProvider
    └── BattleScreen.tsx            # UI consumers — BattleTimeline, ActionGrid, etc.
```

`DataService` is the only module that performs `fetch()` calls. `BattleProvider`
calls it once on mount and never fetches again within a session.

Effect handlers are registered once at app startup (`registerBuiltins()` in
`main.tsx`) before `ReactDOM.createRoot` renders. Tests call `registerBuiltins()`
after `__resetRegistry()` between cases.
