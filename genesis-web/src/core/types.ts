// ── Static definitions — loaded from JSON via DataService ─────────────────────

export type ClassName =
  | 'Warrior'
  | 'Caster'
  | 'Hunter'
  | 'Guardian'
  | 'Ranger'
  | 'Enchanter'

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
  /** Combat role — also the display class name shown in the UI. */
  className:     ClassName
  rarity:        number
  stats:         StatBlockDef
  maxHp:         number
  maxAp:         number
  apRegenRate:   number
  startingAp?:   number
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
  id:           string
  name:         string
  /** Remaining duration. Unit depends on durationUnit. */
  duration:     number
  /** 'turns' = owner's own action count; 'ticks' = tick-interval (v0.1: treated as turns). */
  durationUnit: 'turns' | 'ticks'
  source:       string
  /** Current stack count (1 for non-stackable statuses). */
  stacks:       number
  /** Custom per-status payload (shield HP, dodge config, etc.). */
  payload:      Record<string, unknown>
  /** Absolute battle tick at which the next onTickInterval fires. 0 = no interval effect. */
  nextIntervalFireTick: number
}

export interface Unit {
  id:           string   // unique runtime id (crypto.randomUUID())
  defId:        string   // CharacterDef.id this was created from
  name:         string
  className:    ClassName
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
  /** Per-character accumulator for mechanics like Power Surge. Starts at 0; bounded by the skill/passive max. */
  secondaryResource:   number
  /** Tracks cumulative AP spent this session for passive procs like Precise Calibration. Resets on proc. */
  apSpentAccum:        number
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
  passable:      boolean
  id:            string
  // Clockwise rotation in degrees (0/90/180/270). Covers all orientations of a
  // directional tile (edge, corner) from a single source PNG.
  rotation?:     number
  // Fraction of tileSize to shift the entity visual toward the surface side.
  // Absent on floor/wall/rift/hill/crater — entity stays centred on those.
  entityOffset?: { x: number; y: number }
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

export interface ChestReward {
  gold?:          number
  xp?:            number
  items?:         string[]   // item defIds — future use
  narrativeText?: string
}

export interface InteractableEntityDef extends EntityBase {
  type:     'interactable'
  subtype?: string   // 'chest' | 'switch' | etc.
  reward?:  ChestReward
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
  type:       'tileset'
  key:        string
  sourceSize: number    // native resolution of each PNG (e.g. 1024 for 1024×1024)
  bgColor?:   string    // CSS hex color for the Phaser canvas + container background
  // Maps TileTypeDef.id → PNG filename under public/images/tilesets/{key}/
  tiles:      Record<string, string>
  // Tile type ids planned but not yet asset-ready. Listed here for documentation;
  // the engine never tries to load these — they fall back to colored rects silently.
  pending?:   string[]
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

// ── Animation manifest ────────────────────────────────────────────────────────

export interface AuraDef {
  /** CSS hex or token, e.g. 'var(--accent-danger)'. Tints the white radial gradient. */
  colour:    string
  /** Phaser blend mode. ADD is the standard glow look. */
  blendMode: 'ADD' | 'SCREEN' | 'MULTIPLY' | 'NORMAL'
  /** Glow radius in canvas pixels. */
  radius:    number
  /** Peak opacity 0–1. */
  alpha:     number
  /** Optional breathing pulse. Omit for a steady glow. */
  pulse?:    { period: number; minAlpha: number }
  /** ms to reach peak alpha on show (default 200). */
  fadeIn?:   number
  /** ms to reach 0 alpha on hide (default 400). */
  fadeOut?:  number
}

export interface AnimationStateDef {
  frames:    number   // frame count — files 0.png … (frames-1).png in the state folder
  frameRate: number   // playback speed in frames per second
  repeat:    number   // -1 = loop forever, 0 = play once and hold last frame
  aura?:     AuraDef | null  // optional glow tied to this state; null explicitly disables
}

export interface AnimationProjectileDef {
  frames:    number
  frameRate: number
  speed:     number   // pixels per second across the canvas
  scale:     number   // display scale multiplier
}

export interface AnimationManifest {
  type:    'animations'
  defId:   string
  display: {
    sourceWidth:  number   // source PNG width in pixels — for art reference only, not used by renderer
    sourceHeight: number   // source PNG height in pixels — for art reference only, not used by renderer
    scale:        number   // uniform scale applied to the source PNG for canvas rendering
    anchorX:      number   // 0–1; 0.5 = horizontal centre
    anchorY:      number   // 0–1; 1.0 = bottom edge (character stands on floor line)
  }
  /** Below this HP fraction the damaged idle variant activates. */
  idleSwapBelowHpPercent: number
  /** How far the container shoves toward the target on a melee attack (canvas px). */
  meleeDashDx: number
  /** Maps skill tags to base animation state names. */
  tagMap: Partial<Record<string, string>>
  animations: {
    [stateName: string]: AnimationStateDef
  } & {
    skills?: Record<string, AnimationStateDef>
  }
  /** Null = use runtime-generated orb fallback. */
  projectile: AnimationProjectileDef | null
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

// ── Status chip UI ────────────────────────────────────────────────────────────

/** Visual config for a status chip shown in the battle UI. Defined on StatusDef.ui.chip. */
export interface StatusChipDef {
  label:           string
  colour:          string
  durationDisplay: 'ticks' | 'turns' | 'fade' | 'none'
  icon?:           string   // reserved — logo asset key, not yet wired
}

// ── Animation sequence phases ─────────────────────────────────────────────────
//
// Pure JSON-serializable types so sequences can live in anim_sequence.json.
// No Phaser imports — execution lives in scenes/battle/SequenceRunner.ts.

import type { DiceOutcome } from './combat/DiceResolver'

/**
 * Discriminated union of all animation phases.
 * Sequential phases run one after another; use `parallel` for simultaneous execution
 * and `branch` for outcome-conditional sub-sequences.
 */
export type AnimPhase =
  | { type: 'wait';         ms: number }
  | { type: 'playAnim';     figure: 'acting' | 'target'; stateKey: string }
  | { type: 'shove' }
  | { type: 'evasionDodge' }
  | { type: 'projectile' }
  | { type: 'impact' }
  | { type: 'flash';        figure: 'acting' | 'target'; colour?: number }
  | { type: 'particles';    figure: 'acting' | 'target' }
  | { type: 'damageNumber' }
  | { type: 'statusText';   text: string; colour: string }
  | { type: 'feedback' }
  | { type: 'cameraShake';  duration: number; intensity: number }
  | { type: 'aura';         figure: 'acting' | 'target'; show: boolean }
  | { type: 'parallel';     phases: AnimPhase[] }
  | { type: 'branch';       cases: Partial<Record<DiceOutcome | 'default', AnimPhase[]>> }

/**
 * Per-character animation sequence manifest.
 * Keyed by skill ID (matches SkillDef.id); value overrides the default sequence
 * for that skill. Loaded from `characters/{defId}/anim_sequence.json`.
 */
export type AnimSequenceManifest = Record<string, AnimPhase[]>
