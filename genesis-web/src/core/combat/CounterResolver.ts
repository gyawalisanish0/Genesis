// Pure helpers for evaluating counter eligibility.
// Called by BattleContext when an Evade outcome is detected.

import type { Unit } from '../types'
import type { SkillDef, SkillInstance } from '../effects/types'

/** Returns the first counter- or uniqueCounter-tagged skill from a list, or undefined. */
export function findCounterSkill(skills: SkillInstance[]): SkillInstance | undefined {
  return skills.find(
    (s) => s.baseDef.tags.includes('counter') || s.baseDef.tags.includes('uniqueCounter'),
  )
}

/** True if the unit has enough AP to pay the counter skill's cost. */
export function canCounter(unit: Unit, counterSkill: SkillInstance): boolean {
  return unit.ap >= counterSkill.cachedCosts.apCost
}

/** True when the skill targets a single enemy (selector === 'enemy'). */
export function isSingleTarget(skillDef: SkillDef): boolean {
  return skillDef.targeting.selector === 'enemy'
}
