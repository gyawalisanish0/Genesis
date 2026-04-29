# Campaign Mode — Dungeon Exploration

Campaign mode is the primary story progression system. Players explore procedurally-generated dungeon maps, encounter enemies in waves, and engage in tactical battles to progress through stages.

---

## System Overview

```
Campaign Screen
  ↓ (select stage and difficulty)
Dungeon Screen (turn-based map exploration)
  ├─ Player movement on grid
  ├─ Enemy patrols (fixed routes)
  ├─ Wave encounters (group of enemies)
  └─ On enemy contact → Battle
        ↓ (victory)
        Dungeon Screen (restore state, continue)
        ↓ (defeat)
        Battle Result Screen (allow retry or abandon)
```

---

## Data Structure

### Stage definition — `public/data/campaign/index.json`

Master list of available campaign stages.

```json
{
  "stages": [
    { "id": "stage_001", "name": "The Outpost", "difficulty": 1 },
    { "id": "stage_002", "name": "Ruined Fort", "difficulty": 2 }
  ]
}
```

### Stage config — `public/data/campaign/{stageId}/stage.json`

Describes one stage's battle properties, player team, and initial setup.

```json
{
  "type": "stage",
  "id": "stage_001",
  "name": "The Outpost",
  "description": "A ruined outpost at the edge of the frontier.",
  "playerUnits": {
    "mode": "fixed",
    "units": ["warrior_001", "hunter_001"],
    "leader": "warrior_001"
  },
  "moveRange": 1,
  "settings": {
    "enemyAi": "patrol",
    "respawn": false,
    "timeLimitTicks": null,
    "playerControl": "single"
  }
}
```

**Fields**:
- `playerUnits.mode`: `"fixed"` (team set by stage) or `"player"` (player selects)
- `playerUnits.units`: Array of character `defId` values
- `playerUnits.leader` (optional): `defId` of the controlled party leader.
  When absent, the leader defaults to the **first entry** of `units`. The leader
  is the only unit the player can issue commands to; the rest fight as **AI
  allies** alongside the leader. See `docs/mechanics/party-leader.md`.
- `moveRange`: Grid squares per turn (typically 1 for single-hex movement)
- `settings.enemyAi`: `"patrol"` (fixed routes) or future `"hunt"` (pursue player)
- `settings.playerControl`: `"single"` (one controlled unit + AI allies — the
  default and currently the only supported mode) or future `"squad"`

### Map definition — `public/data/campaign/{stageId}/map.json`

Describes the dungeon layout, enemy waves, and environmental features.

```json
{
  "type": "map",
  "stageId": "stage_001",
  "width": 12,
  "height": 8,
  "terrain": [
    ["grass", "grass", "wall", …],
    …
  ],
  "playerStart": { "x": 0, "y": 0 },
  "waves": [
    {
      "id": "wave_1",
      "enemies": ["hunter_001"],
      "patrol": { "x": 6, "y": 4 },
      "range": 2
    },
    {
      "id": "wave_2",
      "enemies": ["warrior_001"],
      "patrol": { "x": 10, "y": 3 },
      "range": 2
    }
  ]
}
```

### Level-scoped narrative — `public/data/campaign/{stageId}/narrative.json`

Story beats, introductions, and cutscenes for this stage.

```json
{
  "type": "narrative",
  "levelId": "stage_001",
  "entries": [
    {
      "narrativeId": "stage_001_intro",
      "trigger": { "event": "battle_start" },
      "once": true,
      "sequence": true,
      "lines": [
        { "speakerId": "warrior_001", "text": "The outpost is silent. Too silent." },
        { "speakerId": "hunter_001", "text": "Something's coming." }
      ]
    }
  ]
}
```

---

## Campaign Flow

### 1. Campaign Screen

Player selects a stage to enter. Displays stage name, difficulty rating, and
description. Loads stage config via `DataService.loadStage(stageId)`.

If `stage.playerUnits.mode === "player"`, navigates to Pre-Battle (team
selection). Otherwise, sets `selectedTeam` from `stage.playerUnits.units` and
proceeds to Dungeon Screen.

### 2. Dungeon Screen (Exploration)

The dungeon is a **single-token overworld**. Even when the party contains
multiple units, only one token — the **party leader** — is rendered on the
grid. AI allies are implicit (alive in the roster, but not visible on the
map) and only materialize when battle is engaged.

#### State shape

```ts
interface DungeonState {
  stageId: string
  leaderId: string                // defId of the controlled leader; drives the token
  mapState: {
    partyPos: { x: number; y: number }   // single token position
    waves: WaveState[]                   // current positions of enemy patrols
    defeated: Set<string>                // defeated wave IDs
  }
  units: {
    party: Unit[]                              // full team — leader + AI allies
    encounters: Map<string, Unit[]>            // pre-loaded enemy units per wave
  }
}
```

#### Player movement

- The party occupies **one grid cell** (single-token model)
- Each turn, the leader moves up to `stage.moveRange` cells (Manhattan distance)
- AI allies always travel with the leader — no separate movement for them
- Movement cost: 1 action point per cell (simplified for Phase 1)
- No blocking by terrain (simplified; water/walls handled in Phase 2)
- Out-of-bounds movement is rejected

#### Enemy patrols

Each wave follows a fixed `patrol` point ± `range` cells (e.g. patrol at (6, 4)
with range 2 means wave patrols in a 5×5 region).

Wave position updates every 3 turns (configurable `patrolTurnInterval`).

#### Engagement trigger

When the party token and an enemy wave occupy adjacent cells (or same cell in
Phase 1), **combat is initiated**:

1. DungeonContext calls `launchBattle()`
2. Creates a temporary `ModeDef` from stage settings
3. Sets `currentEncounterEnemies` to enemy `defId` list from wave
4. Sets `currentLeaderId` to the dungeon's `leaderId` (so BattleContext knows
   which unit gets the player HUD)
5. Sets `returnScreen` to `SCREEN_IDS.DUNGEON`
6. Navigates to `BATTLE` screen

Inside battle, the **leader** receives the action grid HUD; all other party
members enter as `team: 'ally'` AI units that target enemies on their own
ticks. See `docs/mechanics/party-leader.md`.

#### During battle

- Dungeon state is **persisted in Zustand store** (`useGameStore.dungeonState`)
- Battle is isolated session (BattleContext manages ephemeral state)
- No dungeon time passes during battle

#### After battle — victory

- `BattleResultScreen` detects `returnScreen === DUNGEON`
- Marks wave as defeated: `dungeonState.mapState.defeated.add(waveId)`
- Navigates back to Dungeon Screen
- Dungeon Screen resumes from player's last position with wave gone

#### After battle — defeat

- `BattleResultScreen` displays defeat options:
  - [RETRY] → re-enters same battle (enemies reset, player HP unchanged)
  - [ABANDON] → returns to Campaign Screen (all progress lost)
- Battle result is **not** committed to store (no return to Dungeon)

### 3. Stage complete

Player defeats all waves → Dungeon Screen displays victory overlay →
navigates to Battle Result Screen with `outcome: 'victory'` and `xpGained` from all encounters summed.

---

## Zustand Store Integration

### `GameContext` campaign fields

| Field | Type | Set by | Cleared by |
|---|---|---|---|
| `dungeonState` | `DungeonState \| null` | CampaignScreen / DungeonScreen | CampaignScreen (restart) or abandon |
| `currentEncounterEnemies` | `string[]` | DungeonContext.launchBattle() | BattleContext on end |
| `returnScreen` | `ScreenId \| null` | DungeonContext.launchBattle() | BattleResultScreen after navigation |

### `setDungeonState(state)` / `setCurrentEncounterEnemies(ids)` / `setReturnScreen(screen)`

All three are setters exposed by `useGameStore`. Called from:
- **CampaignScreen**: initializes dungeon state with map and wave data
- **DungeonContext**: updates player position and defeated waves
- **BattleContext**: clears fields post-battle

---

## Enemy Loading

When dungeon initializes, all enemy units for all waves are **pre-loaded and cached**:

```ts
const allEnemyDefIds = map.waves.flatMap(w => w.enemies)
const enemyUnits = await Promise.all(
  allEnemyDefIds.map(defId => loadCharacterWithSkills(defId))
)
```

This avoids async loading during combat and allows the UI to display enemy
health/status even while out of direct view (future: fog-of-war reveals).

---

## Phase 1 Simplifications

- **No pathfinding**: movement is Manhattan distance; immediate jump to target
- **No terrain blocking**: all cells are passable
- **No visible fog-of-war**: all enemies visible at start
- **No turn cost precision**: 1 AP per move (not per-distance-unit)
- **Single player control**: only one unit is controllable (fixed; no squad mode)
- **No wave composition variation**: fixed enemy lists per wave

---

## Extension Points (Phase 2+)

- **Fog-of-war**: reveal grid based on LOS from player position
- **Pathfinding**: A* with terrain costs (water slower, wall blocks)
- **Terrain effects**: mud (slow), lava (damage), ice (slip)
- **Boss encounters**: narrative flags, multi-phase HP bars, special dialogue
- **Procedural generation**: rng-seeded map and wave spawning
- **Persistent dungeon state**: save game checkpoints mid-stage
- **Permadeath mode**: defeated allies gone for good (roguelike variant)
- **Loot drops**: enemies drop gear, consumables, XP tokens
- **Ally recruitment**: rescue NPCs, add to roster

---

## Debugging

### Load test stage

```ts
const stage = await loadStage('stage_001')
const map = await loadMap('stage_001')
console.log(stage, map)
```

### Simulate victory

In Dungeon Screen console:

```ts
useGameStore.getState().dungeonState.mapState.defeated.add('wave_1')
// Wave 1 no longer appears; re-render
```

### Force navigate to result

```ts
useGameStore.getState().setBattleResult({ outcome: 'victory', turns: 12, xpGained: 100 })
navigate(SCREEN_REGISTRY[SCREEN_IDS.BATTLE_RESULT].path)
```
