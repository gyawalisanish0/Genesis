// BattleStepMachine — step enum and pending-turn data types for the sequential
// battle driver. No React, no side-effects — pure type definitions.

import type { Unit } from '../../core/types'
import type { SkillInstance } from '../../core/effects/types'
import type { DiceOutcome } from '../../core/combat/DiceResolver'

// One atomic step at a time. The driver useEffect advances battleStep
// sequentially; locked steps yield to animation callbacks.
export type BattleStep =
  | 'init'              // loading; no transitions until isLoading = false
  | 'advance_tick'      // read registeredTicks → set tickValue → clash_check
  | 'clash_check'       // route: clash_qte | clash_announcing | team_collision | enemy_telegraph | player_turn
  | 'clash_announcing'  // [step-locked] brief log display before advancing to winner's phase
  | 'clash_qte'         // [user-locked] QTE overlay; resolveClash() advances
  | 'team_collision'    // [user-locked] Now/Later prompt; resolveTeamCollision() advances
  | 'enemy_telegraph'   // compute AI turn + show preview; immediately locks to enemy_acting
  | 'enemy_acting'      // [step-locked] delay timer + dice+attack animation in flight
  | 'enemy_applying'    // apply AI snap, check win/loss, → advance_tick
  | 'player_turn'       // [user-locked] waiting for player input
  | 'player_acting'     // [step-locked] player dice+attack animation in flight
  | 'player_applying'   // apply player snap, check win/loss, → advance_tick
  | 'battle_over'       // terminal; navigate handled by endBattle

// Steps where the driver should not auto-advance (user input or animation owns control).
export const YIELDED_STEPS = new Set<BattleStep>([
  'init',
  'battle_over',
  'clash_announcing',
  'clash_qte',
  'team_collision',
  'player_turn',
  'player_acting',
  'enemy_acting',
])

// Data computed before an AI unit's attack animation starts, carried through to
// enemy_applying where it is committed to React state.
export interface PendingAITurn {
  aiUnit:      Unit
  skillInst:   SkillInstance
  target:      Unit
  allTargets:  Unit[]
  snap:        Map<string, Unit>  // fully mutated by runAttack + counter chain
  outcome:     DiceOutcome
  damage:      number
  effectiveTu: number
}

// Data computed by executeSkill, carried through player_acting → player_applying.
export interface PendingPlayerTurn {
  caster:      Unit
  skillInst:   SkillInstance
  target:      Unit
  allTargets:  Unit[]
  snap:        Map<string, Unit>  // fully mutated by runAttack + counter chain
  outcome:     DiceOutcome
  damage:      number
  effectiveTu: number
}

// Units active at the current tick, bucketed by control type.
export interface ActiveStepUnits {
  controlled: Unit[]   // player-controlled
  aiAllies:   Unit[]   // non-controlled player faction (AI-driven)
  enemies:    Unit[]   // enemy faction
}
