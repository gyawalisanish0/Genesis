// Pure helpers for evaluating and applying skill cooldowns.
// Two independent cooldown types:
//   tickCooldown  — unit.tickPosition must reach cooldownReadyAtTick
//   turnCooldown  — unit.actionCount  must reach cooldownReadyAtAction
// Both must clear before a skill is usable.

import type { Unit } from '../types'
import type { SkillDef, SkillInstance } from '../effects/types'

export function isOnTickCooldown(unit: Unit, inst: SkillInstance): boolean {
  return inst.cooldownReadyAtTick > unit.tickPosition
}

export function isOnTurnCooldown(unit: Unit, inst: SkillInstance): boolean {
  return inst.cooldownReadyAtAction > unit.actionCount
}

export function isOnCooldown(unit: Unit, inst: SkillInstance): boolean {
  return isOnTickCooldown(unit, inst) || isOnTurnCooldown(unit, inst)
}

/** Ticks remaining on tick cooldown (0 if not on tick cooldown). */
export function ticksRemaining(unit: Unit, inst: SkillInstance): number {
  return Math.max(0, inst.cooldownReadyAtTick - unit.tickPosition)
}

/** Own-turns remaining on turn cooldown (0 if not on turn cooldown). */
export function turnsRemaining(unit: Unit, inst: SkillInstance): number {
  return Math.max(0, inst.cooldownReadyAtAction - unit.actionCount)
}

/**
 * Returns a new SkillInstance with cooldown thresholds applied after a use.
 * Pass the patched SkillDef (via getCachedSkill) so level-upgraded cooldown
 * values — e.g. a level-3 upgrade reducing turnCooldown from 2 to 1 — are
 * respected. Fields absent or 0 in patchedDef reset the threshold to 0 (ready).
 */
export function applyCooldown(
  unit:       Unit,
  inst:       SkillInstance,
  patchedDef: SkillDef,
): SkillInstance {
  return {
    ...inst,
    cooldownReadyAtTick:   patchedDef.tickCooldown
      ? unit.tickPosition + patchedDef.tickCooldown
      : 0,
    cooldownReadyAtAction: patchedDef.turnCooldown
      ? unit.actionCount + patchedDef.turnCooldown
      : 0,
  }
}
