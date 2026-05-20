// Shared types for the BattleEngine — no logic, no React, no service imports.

import type { Unit, AnimationManifest, AnimationProjectileDef, AnimPhase, AnimSequenceManifest } from '../types'
import type { SkillInstance, PassiveDef, StatusDef } from '../effects/types'
import type { DiceOutcome } from '../combat/DiceResolver'
import type { HistoryEntry } from '../battleHistory'
import type { BattleStep } from './BattleStepMachine'

// ── Overlay / display types ────────────────────────────────────────────────────

export interface TurnDisplayUnitData {
  name:        string
  className:   string
  rarity:      number
  hp:          number
  maxHp:       number
  ap:          number
  maxAp:       number
  statusSlots: Array<{ id: string; name: string }>
  /** Sum of all active shield HP values on this unit. 0 when no shield is active. */
  shieldHp:    number
}

export interface TurnDisplayData {
  actor:      TurnDisplayUnitData | null  // null = player turn (actor row hidden)
  skillName:  string
  tuCost:     number
  apCost:     number
  skillLevel: number
  target:     TurnDisplayUnitData
  isAlly:     boolean  // true = player attacking; drives accent colour
}

// ── Log + history ──────────────────────────────────────────────────────────────

export interface LogEntry {
  id:      string
  text:    string
  colour?: string
}

// ── UI / decision state ────────────────────────────────────────────────────────

export interface DiceResult {
  outcome: DiceOutcome
  message: string
  animKey: number
}

export interface CounterDecision {
  defender:       Unit
  originalCaster: Unit
  counterSkill:   SkillInstance
  snap:           Map<string, Unit>
  depth:          number
}

export interface ClashState {
  playerUnits: Unit[]
  enemyUnits:  Unit[]
}

export interface TeamCollisionState {
  units:   Unit[]
  choices: Map<string, 'now' | 'later' | null>
}

// ── Turn phase ─────────────────────────────────────────────────────────────────

export type TurnPhase = 'player' | 'enemy' | 'resolving'

// ── Pending turn data (carried between steps) ──────────────────────────────────

export interface PendingPlayerTurnData {
  snap:              Map<string, Unit>
  actor:             Unit
  effectiveTu:       number
  primaryTarget:     Unit
  primaryDamage:     number
  outcome:           DiceOutcome
  preStatusSnapshot: Map<string, Set<string>>
}

export interface PendingAITurnData {
  aiUnit:             Unit
  snap:               Map<string, Unit>
  effectiveTu:        number
  primaryTarget:      Unit
  primaryDamage:      number
  outcome:            DiceOutcome
  isAlly:             boolean
  preStatusSnapshot:  Map<string, Set<string>>
}

// ── Engine configuration ───────────────────────────────────────────────────────

export interface BattleEngineConfig {
  playerUnits:     Unit[]
  enemies:         Unit[]
  unitSkillsMap:   Map<string, SkillInstance[]>
  registeredTicks: Map<string, number>
  passiveDefs:     Map<string, PassiveDef | null>
  statusDefs:      Map<string, StatusDef>
  manifests:       Map<string, AnimationManifest | null>
  animSequences:   Map<string, AnimSequenceManifest | null>
  controlledIds:   Set<string>
}

// ── Engine callbacks ───────────────────────────────────────────────────────────

export interface BattleEngineCallbacks {
  // Phaser / arena
  onSetTurnState(
    actingDefId: string,
    targetDefId: string,
    actingMf:    AnimationManifest | null,
    targetMf:    AnimationManifest | null,
    isDamaged:   { acting: boolean; target: boolean },
  ): void
  onClearTurn(): void
  onPlayDice(outcome: DiceOutcome): void
  onPlayAttack(
    actingDefId:    string,
    targetDefId:    string,
    outcome:        DiceOutcome,
    damage:         number,
    isMelee:        boolean,
    dashDx:         number,
    projectile:     AnimationProjectileDef | null,
    label:          string,
    colour:         string,
    seq?:           AnimPhase[],
  ): void
  onPlayDeath(defId: string): void
  onShowTurnDisplay(data: TurnDisplayData, dismissAfter?: number): void
  onHideTurnDisplay(): void
  // Dice overlay
  onShowDiceResult(outcome: DiceOutcome, message: string): void
  onClearDiceResult(): void
  // Narrative
  onNarrativeEmit(event: { type: string; actorId?: string; targetId?: string }): void
  // State
  onStateChanged(s: Readonly<BattleEngineSnapshot>): void
  // Battle end
  onBattleEnd(outcome: 'victory' | 'defeat', turns: number, xpGained: number): void
  // Log / history
  onLog(entry: Omit<LogEntry, 'id'>): void
  onHistory(entry: HistoryEntry): void
}

// ── Engine snapshot (React observes this) ──────────────────────────────────────

export interface BattleEngineSnapshot {
  battleStep:             BattleStep
  playerUnits:            Unit[]
  enemies:                Unit[]
  unitSkillsMap:          Map<string, SkillInstance[]>
  registeredTicks:        Map<string, number>
  tickValue:              number
  suppressedChipIds:      ReadonlySet<string>
  pendingCounterDecision: CounterDecision | null
  pendingClash:           ClashState | null
  pendingTeamCollision:   TeamCollisionState | null
}
