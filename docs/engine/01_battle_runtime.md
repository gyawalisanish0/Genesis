# Battle Runtime — BattleContext

This document describes the ephemeral battle-session state managed by
`src/screens/BattleContext.tsx` and the supporting modules in `src/core/`.

The runtime holds only within-session state. Nothing here is written to the
global Zustand store (`GameContext`) until the battle ends.

---

## Data loading

On mount, `BattleProvider` reads the team and leader id from the global Zustand
store (`GameContext.selectedTeamIds` + `GameContext.currentLeaderId`) and loads
characters from `DataService`. If `selectedTeamIds` is empty (direct URL access
with no team selected), `isLoading` is set to `false` immediately and `leader`
remains `null` — `BattleScreen` detects this and redirects to the Pre-Battle
screen.

```ts
const { selectedTeamIds, currentLeaderId } = useGameStore.getState()
if (!selectedTeamIds.length) { setIsLoading(false); return }

// Load all party members in parallel
const partyData = await Promise.all(
  selectedTeamIds.map(loadCharacterWithSkills)
)

// Load enemies (campaign mode reads currentEncounterEnemies; story mode hardcodes)
const enemyDefIds = useGameStore.getState().currentEncounterEnemies.length
  ? useGameStore.getState().currentEncounterEnemies
  : ['hunter_001']  // story mode placeholder
const enemyData = await Promise.all(enemyDefIds.map(loadCharacterWithSkills))
```

### Party leader vs AI allies

The **first slot** of `selectedTeamIds` is the leader. Campaign mode controls
which unit is first by ordering `stage.playerUnits.units` accordingly. The
default control mode is `'single'`: only the leader is in `controlledIds` and
only the leader receives the action grid HUD. The rest are **AI allies** that
fight alongside but never accept player input. Modes can opt-in to multi-unit
control via `settings.playerControl: 'all'`.

See `docs/mechanics/party-leader.md` for the full leader/ally model.

`loadCharacterWithSkills(id)` fires two parallel requests per character:

| Request | Path | Returns |
|---|---|---|
| 1 | `data/characters/{id}/main.json` | `CharacterDef` |
| 2 | `data/characters/{id}/skills.json` | `SkillDef[]` |

After all units are built, `BattleProvider.load()` fetches animation manifests
in parallel for every distinct `defId` via `DataService.loadAnimationManifest(defId)`.
Results are stored in `manifestsRef` (a `Map<string, AnimationManifest | null>`)
and passed through `setTurnState` and `playAttack` so the arena can drive sprite
animations and aura glows. A `null` result means no manifest exists for that
character — the unit placeholder rectangle renders silently with no art.

Skills are **character-exclusive**: `SkillDef` objects live inside the character's
own subfolder and are not shared across characters (see content contract decision #6).

Each character is built into a runtime `Unit` via `createUnit()`, and its
starting tick position is assigned by `calculateStartingTick(stats.speed, className)`.
Skills are wrapped into `SkillInstance` objects via `createSkillInstance(skillDef)`.

### Strict unique starting ticks

**Critical to prevent AI loop freeze**: After building all player and enemy units,
a strict-uniqueness pass assigns every unit its own tick position. The general
`resolveTickDisplacement` only displaces when `TICK_MAX_OCCUPANCY` (currently 4)
is reached — fine mid-battle for clash mechanics, but at battle start a 2- or
3-unit collision must be eliminated outright:

```ts
const ticks = new Map<string, number>()
const used  = new Set<number>()
for (const u of [...loadedPlayers, ...loadedEnemies]) {
  let tick = u.tickPosition
  while (used.has(tick)) tick += 1   // bump until vacant
  ticks.set(u.id, tick)
  used.add(tick)
}
```

Without strict uniqueness at battle open, the synchronous AI for-loop calls
`arena.playDice()` once per active AI unit on the same tick. The second call's
`DicePanel.spin()` calls `this.destroy()` on the panel — wiping the **first**
unit's `onDone` callback chain. The first unit's `applyAIState` never fires;
its tick never advances; the AI loop re-triggers on the next render and the
battle freezes.

Mid-battle, `resolveTickDisplacement` (called via `registerTick`) keeps the
existing TICK_MAX_OCCUPANCY=4 threshold so clash mechanics still trigger when
a player and enemy land on the same tick. The strict-uniqueness rule applies
**only** to the initial seed.

See `src/core/combat/TickDisplacer.ts` for mid-battle displacement.

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
| `playerUnits` | `Unit[]` | All player-side units (leader + AI allies); empty while loading |
| `leader` | `Unit \| null` | Derived: `playerUnits.find(u => controlledIds.has(u.id))` — the unit bound to the portrait HUD |
| `activePlayerUnit` | `Unit \| null` | Whichever controlled unit is currently at the now-line during the `'player'` phase; `null` outside that phase |
| `enemies` | `Unit[]` | All enemy units in the battle |
| `isLoading` | `boolean` | `true` while `DataService` is fetching; `false` once the battle is ready |

The HUD `PortraitPanel` binds to `leader` only. The `ActionGrid` (skill buttons,
ROLL, End/Skip) binds to `activePlayerUnit`. With the default `'single'` mode
they are the same unit. With `playerControl: 'all'`, `activePlayerUnit` rotates
through controlled units while the portrait stays anchored on `leader`. See
`docs/mechanics/party-leader.md` for the full leader/ally model.

### Control mode (`controlledIds`)

`controlledIds: Set<string>` is derived from the active mode:

```ts
const controlledIds = useMemo(() => {
  if (selectedMode?.settings.playerControl === 'all') {
    return new Set(playerUnits.map((u) => u.id))
  }
  const primaryId = playerUnits[0]?.id   // leader = first slot
  return primaryId ? new Set([primaryId]) : new Set<string>()
}, [selectedMode, playerUnits])
```

| Mode setting | `controlledIds` | Effect |
|---|---|---|
| `playerControl: 'single'` (or absent) | `{ playerUnits[0].id }` | Only the leader takes player turns; the rest fight as AI allies |
| `playerControl: 'all'` | All player IDs | Every player unit takes its own player-driven turn when active on the tick stream |

`Unit.actionCount` (declared in `core/types.ts`) tracks how many actions each unit has taken during the session. It is incremented by `incrementActionCount()` (`core/unit.ts`) inside the deferred apply for rolls and immediately inside `skipTurn()`. Enemy action counts are incremented in `applyTimerRef` after their dice animations. The field is intentionally on `Unit` rather than stored separately so any future system (XP scaling, passive triggers, telemetry) can read it without additional context lookups.

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
| `phase` | `TurnPhase` | `'player' \| 'ally' \| 'enemy' \| 'resolving'` — **auto-derived** from `activeUnitIds` (see §Phase auto-derivation) |
| `turnNumber` | `number` | **Derived** from `leader.actionCount + 1`; updates automatically whenever `leader` state changes (i.e. after dice animation ends) |
| `log` | `LogEntry[]` | Combat event log entries |
| `selectedSkill` | `SkillInstance \| null` | Skill tapped by the player (highlighted); `null` if none selected |
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
if (leader && activeUnitIds.has(leader.id))     → setPhase('player')
else if (any ally id is in activeUnitIds)       → setPhase('ally')
else if (any enemy id is in activeUnitIds)      → setPhase('enemy')
else                                             → setPhase('resolving')
```

The `'ally'` phase fires the same telegraph → action → apply pipeline as
`'enemy'` (see §Enemy AI), but the active unit is `team: 'ally'` and targets
enemies. The player HUD remains disabled during `'ally'` phase — only the
leader can be issued commands.

No code outside `BattleProvider` calls `setPhase()` manually — phase always
reflects which unit is at the now-line.

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

Player acts (TU 8):
  registerTick('player-id', 16)
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

### Roll button UX

The player's action grid uses a two-step select → roll flow:

1. **Tap a skill** → `selectSkill(skillInst)` — the skill button gains an accent border; the ROLL button appears above the player portrait. Tapping the same skill again deselects it.
2. **Tap ROLL** → 250 ms "Rolling…" pulse animation → `executeSkill(selectedSkill)` fires → `selectSkill(null)` clears selection.
3. **Tapping End/Skip** → `skipTurn()` fires immediately (no dice, no deferred wait).

Selection is auto-cleared after each roll and at the start of every enemy turn.

### `executeSkill(skillInstance: SkillInstance)`

Called after the player taps ROLL with a skill selected. Resolves the full
combat pipeline for a single player action:

```
1. Guard: phase === 'player', playerUnit alive, at least one living enemy
2. Build a mutable unit snapshot (Map<id, Unit>) — the engine's BattleState
3. Roll dice:
     finalChance = calculateFinalChance(caster.stats.precision, skill.resolution?.baseChance ?? 1.0)
     diceOutcome = roll(shiftProbabilities(finalChance))
4. Compute AP regen: calculateApGained(skill.tuCost, caster.apRegenRate) → add to caster
5. Build EffectContext; set ctx.target = undefined on Evasion or Fail (no damage dealt)
6. Apply each effect where effect.when.event === 'onCast' via applyEffect()
7. pushHistory(…) — ghost appears at old position immediately
8. showTurnDisplay(…) — confirmation panel shows immediately using snap values
9. Defer via playerApplyTimerRef (DICE_RESULT_DISMISS_MS = 4s):
   a. setPlayerUnit with incrementActionCount(snap player)
   b. setEnemies from snap
   c. registerTick(player.id, fromTick + skill.tuCost + tumbleDelay)
   d. victory check → log if all enemies dead
```

HP bars, tick numerals, turn counter, and timeline marker all update together
once the dice burst fades — never before.

### `skipTurn()`

Called when the player taps End/Skip. No dice animation; all state updates
are immediate:

```
1. Guard: phase === 'player', playerUnit not null
2. selectSkill(null)
3. pushHistory(…)
4. setPlayerUnit with incrementActionCount(playerUnit) — turn counter increments now
5. registerTick(player.id, fromTick + 10) — timeline updates immediately
6. appendLog('You skipped your turn.')
```

**Dice outcomes** — four outcomes, always summing to 1.0 after `shiftProbabilities`:

| Outcome | Base % | Log colour | Notes |
|---|---|---|---|
| Boosted | 10% | `accent-gold`    | 1.5× damage |
| Hit     | 40% | `text-primary`   | Normal hit |
| Evade   | 20% | `accent-evasion` | Target evaded; counter-eligible; no damage |
| Fail    | 30% | `text-muted`     | Caster misses; no counter trigger; no damage |

`DiceResult` carries three fields: `outcome`, `message` (flavour text built by
`buildOutcomeMessage(outcome, actorName, targetName)`), and
`animKey` (React key for animation retrigger). The message is displayed in the
`DiceResultOverlay` below the outcome name.

---

## Enemy AI — sequential timing

When `phase` changes to `'enemy'`, a `useEffect` runs a strict four-stage
sequential chain so the player can read the incoming action before it lands:

```
T + 0 ms                   phase → 'enemy'; remainingDice computed
T + remainingDice          telegraphTimer fires → showTurnDisplay (telegraph)
T + remainingDice + 2000   actionTimer fires → runAttack → showDiceResult (enemy dice)
T + remainingDice + 6000   applyTimerRef fires → setPlayerUnit / setEnemies / registerTick
                           telegraph also auto-dismisses at this point
```

`remainingDice` — if a player dice animation is still running when the enemy
phase starts, the chain is delayed by the time remaining on that animation
(`DICE_RESULT_DISMISS_MS − (Date.now() − diceShowTimeRef.current)`); otherwise `0`.

**Stage 1 — telegraph** (`telegraphTimer`, fires after `remainingDice`)

`showTurnDisplay` is called with `dismissAfter = ENEMY_AI_DELAY_MS +
DICE_RESULT_DISMISS_MS` (6000 ms total), so the panel stays visible through
both the AI delay and the full enemy dice animation. Displays the enemy name,
class, skill name, TU cost, and target.

**Stage 2 — fire attack** (`actionTimer`, fires after `remainingDice + ENEMY_AI_DELAY_MS`)

For each active enemy:
1. Look up skills via `unitSkillsMapRef` (live ref — always current, no stale closure)
2. **No skills**: advance tick by 10 immediately; log "is gathering strength…"
3. **Has skills**: pick slot `[0]`, target `playerUnit`, call `runAttack()` (which
   fires `showDiceResult` internally — enemy dice animation starts now)
4. Schedule `applyTimerRef` to fire `DICE_RESULT_DISMISS_MS` (4000 ms) later

**Stage 3 — apply state** (`applyTimerRef`, fires after dice animation ends)

`setPlayerUnit` and `setEnemies` are committed here — HP bars and tick markers
update only after the enemy dice burst finishes. Then `registerTick` advances the
enemy's marker. If the player's HP reaches 0, a defeat log entry is appended.

**Why `diceResult` is NOT in the effect's deps array**: `diceResultRef` keeps the
current dice result current via a sync `useEffect`, so the enemy AI effect reads
it without listing `diceResult` as a dependency — which would restart the whole
timing chain whenever the enemy's own dice fires mid-turn.

**Constants** (all in `src/core/constants.ts`):

| Constant | Value | Purpose |
|---|---|---|
| `ENEMY_AI_DELAY_MS` | 2000 ms | Delay between telegraph and enemy action |
| `DICE_RESULT_DISMISS_MS` | 4000 ms | Dice burst duration; also defers state apply |
| `TURN_DISPLAY_DISMISS_MS` | 2000 ms | Auto-dismiss for player-action turn panel |

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

## Battle end conditions and navigation

### Victory and defeat detection

After every state update (any unit dies, action resolves, etc.), `BattleContext`
checks for a terminal condition. With the leader/ally model, the rule is:

```ts
// Victory: all enemies defeated
if (enemies.every(e => e.hp <= 0)) {
  endBattle('victory')
}

// Defeat: ALL party units (leader + allies) defeated
if (partyUnits.every(u => u.hp <= 0)) {
  endBattle('defeat')
}
```

Important: **defeat fires only when every party unit has fallen**. If the leader
dies but an ally survives, the battle continues — the ally fights on AI-driven.
The `leader` field becomes `null` (no controllable unit), the player HUD is
disabled, and the surviving ally(ies) auto-resolve their turns until either all
enemies fall (victory) or all allies die (defeat).

### `endBattle(outcome: 'victory' | 'defeat')`

Called when battle reaches a terminal condition. Prevents double-fire (multi-kill
scenarios) via `battleEndedRef` guard. Flow:

```ts
1. Guard: if (battleEndedRef.current) return; battleEndedRef.current = true
2. Calculate result:
   - turns = partyUnits.reduce((sum, u) => sum + u.actionCount, 0)
     (sums leader + ally action counts; story-mode parties of one collapse to leader.actionCount)
   - xpGained = (outcome === 'victory') ? 100 * enemyCount : 0
3. Emit narrative event: NarrativeService.emit({ type: 'battle_victory' or 'battle_defeat' })
4. Commit to store: useGameStore.getState().setBattleResult({ outcome, turns, xpGained })
5. Schedule navigation (2.5s delay): navigate to BATTLE_RESULT screen
```

The 2.5s delay allows narrative animations and defeat log entries to display
before the result screen transitions in.

### Campaign integration

When battle is launched from **campaign mode**, the global Zustand store carries
two additional fields. The leader is implied by the order of `selectedTeamIds`
(its first entry), which `DungeonContext` sets directly from
`stage.playerUnits.units`:

| Field | Set by | Used for |
|---|---|---|
| `returnScreen` | DungeonContext before launching battle | Post-battle navigation destination after victory |
| `currentEncounterEnemies` | DungeonContext before launching battle | Enemy `defId` list for current encounter |

`selectedMode` is set to a stage-derived `ModeDef` carrying
`settings.playerControl`, which BattleContext consults to derive `controlledIds`.

After victory, `BattleResultScreen` checks `returnScreen`:

```ts
if (returnScreen) {
  // Campaign mode: return to dungeon exploration
  navigateTo(returnScreen)
} else {
  // Story/ranked mode: return to pre-battle or main menu
  if (victory) navigateTo(MAIN_MENU)
  else navigateTo(PRE_BATTLE)
}
```

See `docs/mechanics/campaign.md` for full campaign flow.

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
│       └── DiceResolver.ts        # roll, applyOutcome, resolveCounterRoll
├── services/
│   └── DataService.ts             # loadCharacterIndex, loadCharacter, loadCharacterSkillDefs,
│                                  #   loadCharacterWithSkills, loadMode (+ per-type cache)
├── scenes/
│   ├── BattleScene.ts              # Orchestrator; re-exports tokenToHex
│   └── battle/
│       ├── tokens.ts               # tokenToHex + tokenToInt (CSS token → Phaser values)
│       ├── UnitStage.ts            # Unit figures + AnimationPlayer + AuraPanel lifecycle
│       ├── AnimationPlayer.ts      # Per-figure sprite frame loop
│       ├── AnimationResolver.ts    # Attack animation fallback chain
│       ├── AuraPanel.ts            # Scene-root radial glow with update-listener position sync
│       ├── ProjectilePanel.ts      # Ranged projectile tween
│       ├── AttackPanel.ts          # Melee/ranged attack dispatch + impact fx
│       ├── DicePanel.ts            # Die spin animation
│       ├── FeedbackPanel.ts        # Rising damage text
│       ├── ParticleEmitter.ts      # Burst effects
│       └── TurnDisplayPanel.ts     # Turn info overlay
└── screens/
    ├── BattleContext.tsx           # BattleContextValue + BattleProvider; loads AnimationManifests; wires manifests through arena handle
    └── BattleScreen.tsx            # UI consumers — BattleTimeline, ActionGrid, etc.
```

`DataService` is the only module that performs `fetch()` calls. `BattleProvider`
calls it once on mount and never fetches again within a session.

Effect handlers are registered once at app startup (`registerBuiltins()` in
`main.tsx`) before `ReactDOM.createRoot` renders. Tests call `registerBuiltins()`
after `__resetRegistry()` between cases.
