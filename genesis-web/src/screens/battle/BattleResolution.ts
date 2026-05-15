// Target resolution, AI skill selection, and outcome display helpers.
// All pure functions; no React.

import type { Unit, AnimationManifest }         from '../../core/types'
import type { SkillInstance, TargetSelector }   from '../../core/effects/types'
import type { DiceOutcome }                     from '../../core/combat/DiceResolver'
import { getCachedSkill }                       from '../../core/engines/skill/SkillInstance'

/**
 * Resolves the full list of targets for a skill cast.
 * Selector semantics are caster-relative: 'enemy' = opposite faction of caster,
 * 'ally' = same faction. Works identically for player and AI casters.
 *
 * @param preferred Pre-selected target — used only for the single 'enemy' selector.
 */
export function resolveSkillTargets(
  caster:    Unit,
  selector:  TargetSelector,
  snap:      Map<string, Unit>,
  preferred: Unit | null = null,
): Unit[] {
  if (typeof selector === 'object') return []  // tag selectors unsupported in v0.1
  const alive   = [...snap.values()].filter(u => u.hp > 0)
  const foes    = alive.filter(u => u.isAlly !== caster.isAlly)
  const friends = alive.filter(u => u.isAlly === caster.isAlly && u.id !== caster.id)
  switch (selector) {
    case 'enemy': {
      const pref = preferred && foes.find(u => u.id === preferred.id)
      return pref ? [pref] : foes.slice(0, 1)
    }
    case 'all-enemies':     return foes
    case 'lowest-hp-enemy': return foes.length    ? [[...foes].sort((a, b)    => a.hp - b.hp)[0]] : []
    case 'random-enemy':    return foes.length    ? [foes[Math.floor(Math.random() * foes.length)]]    : []
    case 'self':            return [snap.get(caster.id) ?? caster]
    case 'ally':            return friends.slice(0, 1)
    case 'all-allies':      return friends
    case 'lowest-hp-ally':  return friends.length ? [[...friends].sort((a, b) => a.hp - b.hp)[0]] : []
    case 'random-ally':     return friends.length ? [friends[Math.floor(Math.random() * friends.length)]] : []
    case 'caster-and-target': return [caster, ...foes.slice(0, 1)]
    default:                return foes.slice(0, 1)
  }
}

/** Prefers AoE skills when multiple foes are present; falls back to first available. */
export function pickAiSkill(
  availableSkills: SkillInstance[],
  foeCount:        number,
): SkillInstance {
  const preferAoe = foeCount > 1
  const preferred = availableSkills.find(s => {
    const sel = getCachedSkill(s).targeting.selector
    return preferAoe ? sel === 'all-enemies' : sel === 'enemy'
  })
  return preferred ?? availableSkills[0]
}

/** True when the unit's HP has dropped below the manifest's damaged-sprite threshold. */
export function unitIsDamaged(unit: Unit, manifest: AnimationManifest | null): boolean {
  return manifest ? unit.hp / unit.maxHp < manifest.idleSwapBelowHpPercent : false
}

export function outcomeColour(outcome: DiceOutcome): string {
  switch (outcome) {
    case 'Boosted': return 'var(--accent-gold)'
    case 'Evade':   return 'var(--accent-evasion)'
    case 'Fail':    return 'var(--text-muted)'
    default:        return 'var(--text-primary)'
  }
}

export function buildOutcomeMessage(
  outcome:    DiceOutcome,
  actorName:  string,
  targetName: string,
): string {
  switch (outcome) {
    case 'Boosted': return `${actorName} lands a boosted hit`
    case 'Hit':     return `${actorName} hits`
    case 'Evade':   return `${targetName} evades`
    case 'Fail':    return `${actorName} misses`
  }
}

export function buildFeedbackText(outcome: DiceOutcome, damage: number): string {
  if (outcome === 'Evade') return 'EVADED!'
  if (outcome === 'Fail')  return 'MISS!'
  if (damage <= 0)         return outcome.toUpperCase()
  return `${outcome === 'Boosted' ? '★ ' : ''}−${damage} HP`
}

/** Short outcome label shown by the canvas `feedback` sequence phase. */
export function buildOutcomeLabel(outcome: DiceOutcome): string {
  switch (outcome) {
    case 'Boosted': return 'BOOSTED!'
    case 'Hit':     return 'HIT!'
    case 'Evade':   return 'EVADED!'
    case 'Fail':    return 'MISS!'
  }
}
