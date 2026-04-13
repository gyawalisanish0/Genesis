# Battle Runtime — BattleContext

This document describes the ephemeral battle-session state managed by
`src/screens/BattleContext.tsx` and the supporting module
`src/core/battleHistory.ts`.

The runtime holds only within-session state. Nothing here is written to the
global Zustand store (`GameContext`) until the battle ends.

---

## State shape (`BattleState`)

### Global battle clock

| Field | Type | Description |
|---|---|---|
| `tickValue` | `number` | The current global battle tick — stored state, auto-advances (see §Tick advancement) |
| `activeUnitIds` | `Set<string>` | IDs of units whose `tickPosition === tickValue` — their `activeTurn` is `true` |

### Units

| Field | Type | Description |
|---|---|---|
| `playerUnit` | `Unit \| null` | The player's active unit |
| `enemies` | `Unit[]` | All enemy units in the battle |

Both are mutable in the context. `registerTick` keeps `unit.tickPosition` in
sync automatically (see §Tick registration).

### Timeline registration

| Field | Type | Description |
|---|---|---|
| `registeredTicks` | `Map<string, number>` | Maps entity ID → tick position. Drives `tickValue`, `scrollBounds`, and `activeUnitIds`. |
| `scrollBounds` | `{ min: number; max: number }` | Derived tick range the timeline track covers |

Any entity — unit, event, effect — can register a tick position. The timeline
expands to cover all registered positions plus buffer and future range
(see constants in `src/core/constants.ts`).

### Action history

| Field | Type | Description |
|---|---|---|
| `historyEntries` | `HistoryEntry[]` | Ordered list of past tick positions; rendered as grayscale ghost markers on the strip |

### Ephemeral UI state

| Field | Type | Description |
|---|---|---|
| `phase` | `TurnPhase` | `'player' \| 'enemy' \| 'resolving'` |
| `turnNumber` | `number` | Incrementing action counter (per-session metric, not a round system) |
| `log` | `LogEntry[]` | Combat event log entries |
| `selectedSkill` | `SkillInstance \| null` | Currently highlighted skill |
| `gridCollapsed` | `boolean` | Action grid collapse state |
| `isPaused` | `boolean` | Pause overlay visible |

---

## Tick advancement

`tickValue` is **stored state**, not derived. It is initialised to the minimum
`tickPosition` across all registered units at battle start.

### Auto-advance rule

After every `registerTick` call, a `useEffect` checks:

```
if every registered tick > tickValue → setTickValue(min(registeredTicks))
```

This means: once every unit that was at the current tick has taken their
action (advancing their tick past `tickValue`), the clock automatically
advances to the next unit's tick position. The now-line CSS transition
(`--motion-timeline`, 200 ms ease-in-out) animates the movement.

### Example

```
Initial:  tickValue=5  registeredTicks={player:8, enemy-1:5, enemy-2:18}
          activeUnitIds={'enemy-1'}

enemy-1 acts (TU 10):
          registerTick('enemy-1', 15)
          registeredTicks={player:8, enemy-1:15, enemy-2:18}
          all > 5? yes (8,15,18) → tickValue advances to 8
          activeUnitIds={'player'}
          now-line slides from tick 5 → 8
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
registerTick(unit.id, unit.tickPosition + tuCost)
```

History entries are rendered as grayscale ghost markers on the timeline strip
behind live markers. They are never persisted — lost when the battle session ends.

---

## `activeTurn` per unit

`activeTurn` is not stored on `Unit` (which is a pure value object). Consumers
derive it from context:

```ts
const { activeUnitIds } = useBattleScreen()
const isActive = activeUnitIds.has(unit.id)
```

At any given `tickValue`, zero or more units may be active simultaneously
(if multiple units share the same tick position).

---

## Module layout

```
src/
├── core/
│   └── battleHistory.ts       # HistoryEntry type + makeHistoryEntry factory
└── screens/
    ├── BattleContext.tsx       # BattleState interface + BattleProvider
    └── BattleScreen.tsx        # UI consumers — BattleTimeline, ActionGrid, etc.
```

`core/battleHistory.ts` has zero UI imports. `BattleContext.tsx` has zero
game-logic imports beyond types and constants — it only holds state.
