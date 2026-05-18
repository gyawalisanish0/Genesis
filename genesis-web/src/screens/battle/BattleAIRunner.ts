// Pure AI turn computation — no React, no side effects.
// Returns what the AI unit WILL do this tick; the caller handles state + animations.

import type { Unit } from '../../core/types'
import type { SkillInstance } from '../../core/effects/types'
import { getCachedSkill } from '../../core/engines/skill/SkillInstance'
import { isAlive, isSkillTagBlocked } from '../../core/unit'
import { isOnCooldown, isBeforeMinTurns } from '../../core/combat/CooldownResolver'
import { resolveSkillTargets, pickAiSkill } from './BattleResolution'
import { makeSnapshot } from './BattleSnapshot'

export type AITurnResult =
  | { type: 'skip' }           // no available skills (stunned / all on cooldown)
  | { type: 'no_targets' }     // skills available but no valid targets
  | { type: 'attack'; skillInst: SkillInstance; target: Unit; allTargets: Unit[] }

/** Compute what an AI unit will do this tick — pure, no side effects. */
export function computeAITurn(
  aiUnit:         Unit,
  skills:         SkillInstance[],
  currentPlayers: Unit[],
  currentEnemies: Unit[],
): AITurnResult {
  const availableSkills = skills.filter((s) => {
    if (isOnCooldown(aiUnit, s)) return false
    const def = getCachedSkill(s)
    if (isBeforeMinTurns(aiUnit, def.minTurns)) return false
    if (aiUnit.statusSlots.some((st) => st.payload?.blocksRecastOfSkill === def.id)) return false
    if (aiUnit.statusSlots.some((st) => st.payload?.stunned === true)) return false
    if (isSkillTagBlocked(aiUnit, def.tags)) return false
    return true
  })

  if (!availableSkills.length) return { type: 'skip' }

  const aliveFoes = aiUnit.isAlly
    ? currentEnemies.filter(isAlive)
    : currentPlayers.filter(isAlive)

  const skillInst  = pickAiSkill(availableSkills, aliveFoes.length)
  const skill      = getCachedSkill(skillInst)
  const snap       = makeSnapshot(currentPlayers, currentEnemies)
  const allTargets = resolveSkillTargets(aiUnit, skill.targeting.selector, snap)

  if (!allTargets.length) return { type: 'no_targets' }

  return { type: 'attack', skillInst, target: allTargets[0], allTargets }
}
