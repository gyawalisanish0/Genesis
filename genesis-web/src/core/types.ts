// ── Static definitions — loaded from JSON via DataService ─────────────────────

export interface StatBlockDef {
  strength:   number  // Physical damage output
  endurance:  number  // Max HP and physical defence
  power:      number  // Magical / ability damage output
  resistance: number  // Magical / ability defence
  speed:      number  // Starting tick position bias (0–100)
  precision:  number  // Hit chance multiplier
}

export interface CharacterClashDef {
  speedModifier?: number   // added to this unit's effective speed for clash resolution
  uniqueClash?:   boolean  // true → activates QTE path instead of speed/dice (unique abilities)
}

export interface DungeonGimmick {
  type:      'extendedMove'
  moveRange: number
}

export interface CharacterDef {
  type:          'character'
  id:            string
  name:          string
  className:     string
  rarity:        number
  stats:         StatBlockDef
  maxHp:         number
  maxAp:         number
  apRegenRate:   number
  passive:       string | null
  skillPath:     string
  clash?:        CharacterClashDef
  dungeonGimmick?: DungeonGimmick
}

export interface LevelUpgrade {
  level:     number
  baseValue: number
}

export interface SkillDef {
  type:          'skill'
  id:            string
  name:          string
  description?:  string
  tuCost:        number
  apCost:        number
  baseChance:    number
  baseValue:     number
  statKey:       keyof StatBlockDef
  maxLevel:      number
  tags:          string[]
  levelUpgrades: LevelUpgrade[]
}

export interface ModeDef {
  type:        'mode'
  id:          string
  name:        string
  description: string
  settings: {
    enemyAi:        string
    respawn:        boolean
    timeLimitTicks: number | null
    // 'single' (default): only the first team unit is player-controlled; rest are AI allies.
    // 'all': every team unit is player-controlled, acting sequentially on their own ticks.
    playerControl?: 'single' | 'all'
    // IDs of characters to spawn as the opposing team. Falls back to ['hunter_001'] when absent.
    enemies?: string[]
  }
}

// ── Runtime unit state ─────────────────────────────────────────────────────────
// Units are immutable value objects — mutation functions return a new Unit.

export interface SkillInstance {
  defId:      string             // SkillDef.id this was created from
  name:       string
  tuCost:     number
  apCost:     number
  baseChance: number
  baseValue:  number
  statKey:    keyof StatBlockDef
  level:      number
  charge:     number
}

export interface StatusEffect {
  id:       string
  name:     string
  duration: number
  source:   string
}

export interface Unit {
  id:           string   // unique runtime id (crypto.randomUUID())
  defId:        string   // CharacterDef.id this was created from
  name:         string
  className:    string
  rarity:       number
  stats:        StatBlockDef
  maxHp:        number
  hp:           number
  maxAp:        number
  ap:           number
  apRegenRate:  number
  tickPosition:        number
  actionCount:         number   // runtime metric: how many actions this unit has taken
  clashSpeedModifier:  number   // flat bonus to effective speed during clash resolution (from CharacterDef.clash)
  clashUniqueEnabled:  boolean  // true → activates QTE path when this unit is in a clash
  skills:              SkillInstance[]
  statusSlots:         StatusEffect[]
  isAlly:              boolean
}

// ── Battle result ──────────────────────────────────────────────────────────────

export interface BattleResult {
  outcome:   'victory' | 'defeat'
  // Total individual character actions taken during the battle.
  // Per-character action counter for runtime tracking — NOT a global
  // round counter. The Tick stream remains the source of action ordering.
  turns:     number
  xpGained:  number
}

// ── Resolution quality ─────────────────────────────────────────────────────────

export type QualityTier = 'High' | 'Medium' | 'Low'

// ── Campaign / dungeon definitions ─────────────────────────────────────────────

export interface TileTypeDef {
  passable: boolean
  id:       string
}

export interface WavePhaseConfig {
  mode: 'player-select' | 'sequential' | 'simultaneous'
  order?: string[]  // entityIds for sequential mode
}

// Entity discriminated union — all map entities share x/y and narrativeId
interface EntityBase {
  entityId:    string
  x:           number
  y:           number
  narrativeId?: string
}

export interface EnemyEntityDef extends EntityBase {
  type:        'enemy'
  defId:       string
  patrol:      { x: number; y: number }[]
  visualRange?: number
}

export interface NpcEntityDef extends EntityBase {
  type:           'npc'
  defId:          string
  destination?:   { x: number; y: number } | null
  visualRange?:   number
  blocksMovement?: boolean
}

export interface InteractableEntityDef extends EntityBase {
  type:     'interactable'
  subtype?: string   // 'chest' | 'switch' | etc.
}

export interface ExitEntityDef extends EntityBase {
  type:     'exit'
  leadsTo?: string   // stageId of next stage
}

export interface TriggerEntityDef extends EntityBase {
  type: 'trigger'
  once?: boolean
}

export type EntityDef =
  | EnemyEntityDef
  | NpcEntityDef
  | InteractableEntityDef
  | ExitEntityDef
  | TriggerEntityDef

export interface MapDef {
  type:         'map'
  stageId:      string
  grid:         { cols: number; rows: number }
  // tileSize is computed at runtime from canvas dimensions ÷ grid size — not
  // stored in JSON. DungeonScene derives it on loadMap so any device fits.
  tiles:        number[][]
  tileTypes:    Record<string, TileTypeDef>
  playerStart:  { x: number; y: number }
  fogOfWar:     boolean
  revealRadius: number
  entities:     EntityDef[]
  wavePhase:    WavePhaseConfig
  // Optional tileset key — when present, tiles render as sprites instead of colored rects.
  // Points to public/data/tilesets/{tilesetKey}/tileset.json
  tilesetKey?:  string
}

// ── Tileset ────────────────────────────────────────────────────────────────────

export interface TilesetDef {
  type:  'tileset'
  key:   string
  // Maps TileTypeDef.id → PNG filename under public/images/tilesets/{key}/
  tiles: Record<string, string>
}

export interface PlayerUnitsDef {
  mode:  'fixed' | 'selectable'
  units: string[]   // CharacterDef.id[]
}

export interface StageDef {
  type:        'stage'
  id:          string
  name:        string
  description: string
  playerUnits: PlayerUnitsDef
  moveRange:   number
  settings: {
    enemyAi:        string
    respawn:        boolean
    timeLimitTicks: number | null
    playerControl?: 'single' | 'all'
  }
}

// Runtime dungeon state — persisted in GameContext across dungeon↔battle navigation
export interface DungeonState {
  stageId:           string
  partyTile:         { x: number; y: number }
  entityPositions:   Record<string, { x: number; y: number }>
  defeatedEntityIds: string[]
  revealedTiles:     string[]          // "x,y" encoded keys
  lastSeenPositions: Record<string, { x: number; y: number }>
}

// ── App settings ───────────────────────────────────────────────────────────────

export interface AppSettings {
  musicVolume:        number
  sfxVolume:          number
  muteAll:            boolean
  reduceAnimations:   boolean
  showDamageNumbers:  boolean
  timelineZoom:       number
  battleReminders:    boolean
  newContentAlerts:   boolean
}
