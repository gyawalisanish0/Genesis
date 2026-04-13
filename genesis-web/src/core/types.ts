// ── Static definitions — loaded from JSON via DataService ─────────────────────

export interface StatBlockDef {
  strength:   number  // Physical damage output
  endurance:  number  // Max HP and physical defence
  power:      number  // Magical / ability damage output
  resistance: number  // Magical / ability defence
  speed:      number  // Starting tick position bias (0–100)
  precision:  number  // Hit chance multiplier
}

export interface CharacterDef {
  type:        'character'
  id:          string
  name:        string
  className:   string
  rarity:      number
  stats:       StatBlockDef
  maxHp:       number
  maxAp:       number
  apRegenRate: number
  passive:     string | null
  skillPath:   string
  /** IDs of skills this character equips at the start of a battle. */
  skills?:     string[]
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
  tickPosition: number
  skills:       SkillInstance[]
  statusSlots:  StatusEffect[]
  isAlly:       boolean
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
