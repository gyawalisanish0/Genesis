// Shared types for the BattleEngine — no logic, no React, no service imports.

import type { Unit, AnimationManifest, AnimationProjectileDef, AnimPhase, AnimSequenceManifest } from '../types'
import type { SkillInstance, PassiveDef, StatusDef } from '../effects/types'
import type { DiceProbabilities } from '../combat/HitChanceEvaluator'
import type { DiceOutcome } from '../combat/DiceResolver'
import type { StrikeBand, ReactionBand, StrikeProbabilities, ReactionProbabilities } from '../combat/PhaseResolver'
import type { HistoryEntry } from '../battleHistory'
import type { BattleStep } from './BattleStepMachine'

// ── Overlay / display types ────────────────────────────────────────────────────

export interface TurnDisplayUnitData {
  name:              string
  className:         string
  rarity:            number
  hp:                number
  maxHp:             number
  ap:                number
  maxAp:             number
  /** 0–100; drives secondary resource bar in arena figure info panel. */
  secondaryResource: number
  statusSlots:       Array<{ id: string; name: string; stacks: number; duration: number }>
  /** Sum of all active shield HP values on this unit. 0 when no shield is active. */
  shieldHp:          number
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

/**
 * The two rolled phases behind a combined outcome, so the UI can give the
 * reaction its own beat instead of folding both rolls under one settle.
 *
 * Absent for a self-cast (no opposed party to react) and for the counter
 * chain's plain success/fail roll, which was never phase-based — see
 * `selfCastOutcome` and `resolveCounterRoll`.
 */
export interface DicePhaseData {
  strike:                StrikeBand
  strikeProbabilities:   StrikeProbabilities
  reaction:              ReactionBand
  reactionProbabilities: ReactionProbabilities
}

export interface DiceResult {
  outcome: DiceOutcome
  message: string
  animKey: number
  phases?: DicePhaseData
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
  /**
   * `probabilities` is the exact table this roll was resolved against. It is
   * per-roll because the roller changes: the UI used to draw the band from a
   * forecast the player set when picking a skill, so an enemy roll had no band
   * at all until the player had acted once, and the player's stale odds after.
   */
  onShowDiceResult(
    outcome: DiceOutcome, message: string,
    probabilities?: DiceProbabilities, phases?: DicePhaseData,
  ): void
  /** A unit's requested tick was taken, so D8 displacement moved it elsewhere.
   *  Optional: absent implementations simply do not visualise displacement. */
  onTickDisplaced?(unitId: string, fromTick: number, toTick: number): void
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
  /**
   * A throw that escaped one of the engine's own timers.
   *
   * Distinct from every other callback here: it reports a failure rather than
   * an event. The engine has already stopped itself by the time this fires, so
   * the handler's job is to tell the player and leave the battle.
   */
  onEngineError(err: unknown): void
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
