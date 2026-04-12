// Battle tick advancement and state management.
// Handles tick progression as actions are taken during battle.

import type { Unit } from '../core/types'
import { setTickPosition } from '../core/unit'

/**
 * Advances battle tick after a unit takes an action.
 * Called after skill/attack resolution, before next unit's turn.
 *
 * @param currentTick Current battle tick
 * @param unit Unit that just acted
 * @param actionCost TU (Tick Unit) cost of the action (e.g., skill.tuCost)
 * @returns New tick value for the battle
 *
 * @example
 * // Player uses skill with 12 TU cost
 * const newTick = advanceBattleTick(50, playerUnit, 12)
 * // Returns 62 (50 + 12)
 * setTickValue(newTick)
 */
export function advanceBattleTick(
  currentTick: number,
  unit: Unit,
  actionCost: number
): number {
  // Unit's next tick = current tick + action cost
  const nextUnitTick = currentTick + actionCost
  return nextUnitTick
}

/**
 * Updates a unit's tick position after they take an action.
 * Use this BEFORE advancing the battle tick.
 *
 * @param unit Unit that took the action
 * @param actionCost TU cost of their action
 * @returns Updated unit with new tickPosition
 *
 * @example
 * const playerAfterAction = updateUnitTick(playerUnit, skillCost)
 * // playerAfterAction.tickPosition = playerUnit.tickPosition + skillCost
 */
export function updateUnitTick(unit: Unit, actionCost: number): Unit {
  const newTick = unit.tickPosition + actionCost
  return setTickPosition(unit, newTick)
}

/**
 * Identifies the next acting unit based on lowest tickPosition.
 *
 * @param allUnits Array of all units in battle (allies + enemies)
 * @param currentTick Current battle tick (for reference)
 * @returns Unit that should act next, or null if battle is over
 *
 * @example
 * const nextUnit = getNextActor(allUnits, battleTick)
 * if (nextUnit.isAlly) {
 *   setPhase('player')
 * } else {
 *   setPhase('enemy')
 * }
 */
export function getNextActor(allUnits: Unit[], currentTick: number): Unit | null {
  if (allUnits.length === 0) return null

  // Find unit with lowest tick position (acts soonest)
  const nextUnit = allUnits.reduce((earliest, unit) =>
    unit.tickPosition < earliest.tickPosition ? unit : earliest
  )

  return nextUnit
}

/**
 * Determines whose turn it is based on tick positions.
 *
 * @param playerUnit The player's unit
 * @param enemies Array of enemy units
 * @param currentTick Current battle tick
 * @returns 'player' | 'enemy' | null (if battle should end)
 *
 * @example
 * const nextPhase = determinePhase(player, enemies, 75)
 * // Returns 'player' if player.tickPosition is lowest
 * // Returns 'enemy' if any enemy.tickPosition is lower
 */
export function determinePhase(
  playerUnit: Unit | null,
  enemies: Unit[],
  currentTick: number
): 'player' | 'enemy' | null {
  if (!playerUnit || enemies.length === 0) return null

  const allUnits = [playerUnit, ...enemies]
  const nextUnit = getNextActor(allUnits, currentTick)

  if (!nextUnit) return null
  return nextUnit.isAlly ? 'player' : 'enemy'
}

/**
 * Calculates remaining ticks until a unit acts.
 * Useful for UI feedback: "Enemy acts in 23 ticks"
 *
 * @param unit The unit to check
 * @param currentTick Current battle tick
 * @returns Ticks until this unit acts (0 if it's their turn now)
 *
 * @example
 * const enemyWait = getTicksUntilAct(enemy, currentTick)
 * appendLog(`Enemy acts in ${enemyWait} ticks`)
 */
export function getTicksUntilAct(unit: Unit, currentTick: number): number {
  return Math.max(0, unit.tickPosition - currentTick)
}
