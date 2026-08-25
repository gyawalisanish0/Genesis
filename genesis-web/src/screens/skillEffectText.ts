// Human-readable text for a skill's effects.
//
// Pure formatting, split out of SkillInfoOverlay so the overlay stays a
// component and this stays testable without a DOM. Every branch of the Effect
// and Condition unions is covered here — an unrendered condition made a
// conditional effect read as guaranteed.

import type { Effect, ValueExpr, Condition } from '../core/effects/types'


export function valueText(v: ValueExpr): string {
  if (typeof v === 'number')            return String(v)
  if ('sum'                in v)        return v.sum.map(valueText).join(' + ')
  if ('secondary'          in v)        return `${v.secondary * 100}% surge`
  if ('globalApSpentPercent' in v)      return `${v.globalApSpentPercent}% AP pool`
  const of = v.of ?? 'caster'
  return `${v.percent}% ${of} ${v.stat}`
}

/**
 * A condition rendered as a short qualifier.
 *
 * The overlay used to print only `when.event`, so any effect carrying a
 * `condition` read as unconditional — a Boosted-only tick shove looked
 * guaranteed. Every branch of the union is covered, and anything unrecognised
 * still says "conditional" rather than silently claiming certainty.
 */
export function conditionText(c: Condition): string {
  if ('chance'      in c) return `${Math.round(c.chance * 100)}% chance`
  if ('diceOutcome' in c) return `on ${c.diceOutcome}`
  if ('selfHpBelow'   in c) return `self HP < ${Math.round(c.selfHpBelow * 100)}%`
  if ('selfHpAbove'   in c) return `self HP > ${Math.round(c.selfHpAbove * 100)}%`
  if ('targetHpBelow' in c) return `target HP < ${Math.round(c.targetHpBelow * 100)}%`
  if ('targetHpAbove' in c) return `target HP > ${Math.round(c.targetHpAbove * 100)}%`
  if ('selfApBelow'   in c) return `self AP < ${c.selfApBelow}`
  if ('selfApAbove'   in c) return `self AP > ${c.selfApAbove}`
  if ('hasStatus'     in c) return `target has ${c.hasStatus}`
  if ('selfHasStatus' in c) return `self has ${c.selfHasStatus}`
  if ('hasTag'        in c) return `target tagged ${c.hasTag}`
  if ('apAccumGte'    in c) return `AP pool ≥ ${c.apAccumGte}`
  if ('selfSecondaryAbove' in c) return `surge > ${c.selfSecondaryAbove}`
  if ('selfSecondaryBelow' in c) return `surge < ${c.selfSecondaryBelow}`
  if ('selfStatusStacksBelow' in c)
    return `${c.selfStatusStacksBelow.id} < ${c.selfStatusStacksBelow.stacks} stacks`
  if ('not' in c) return `not ${conditionText(c.not)}`
  if ('all' in c) return c.all.map(conditionText).join(' and ')
  if ('any' in c) return c.any.map(conditionText).join(' or ')
  return 'conditional'
}

// One human-readable line per effect. Skips effects with non-onCast triggers
// only when the trigger is the default — otherwise prefix with the trigger.
export function effectLine(e: Effect): string {
  return `${effectBody(e)}${e.condition ? ` — ${conditionText(e.condition)}` : ''}`
}

export function effectBody(e: Effect): string {
  const trigger = e.when.event === 'onCast' ? '' : `[${e.when.event}] `
  switch (e.type) {
    case 'damage':            return `${trigger}Damage: ${valueText(e.amount)}${e.damageType ? ` (${e.damageType})` : ''}`
    case 'heal':              return `${trigger}Heal: ${valueText(e.amount)}`
    case 'tickShove':         return `${trigger}Shove tick: ${e.amount > 0 ? '+' : ''}${e.amount}`
    case 'gainAp':            return `${trigger}Gain AP: ${e.amount}`
    case 'spendAp':           return `${trigger}Spend AP: ${e.amount}`
    case 'modifyStat': {
      if (e.deltaPercent !== undefined) return `${trigger}${e.stat} ${e.deltaPercent > 0 ? '+' : ''}${e.deltaPercent}% for ${e.duration} ticks`
      const d = e.delta ?? 0
      return `${trigger}${e.stat} ${d > 0 ? '+' : ''}${d} for ${e.duration} ticks`
    }
    case 'applyStatus':       return `${trigger}Apply ${e.status}${e.duration ? ` (${e.duration}t)` : ''}${e.chance != null ? ` @ ${Math.round(e.chance * 100)}%` : ''}`
    case 'removeStatus':      return `${trigger}Remove ${e.status ?? `status[tag=${e.tag}]`}`
    case 'shiftProbability':  return `${trigger}Shift ${e.outcome} probability ${e.delta > 0 ? '+' : ''}${e.delta}`
    case 'rerollDice':        return `${trigger}Reroll ${e.outcome ?? 'any'} (${e.uses} use${e.uses === 1 ? '' : 's'}${e.perBattle ? ', per battle' : ''})`
    case 'forceOutcome':      return `${trigger}Force outcome: ${e.outcome}`
    case 'triggerSkill':      return `${trigger}Trigger skill: ${e.skillId}${e.ignoreCost ? ' (free)' : ''}`
    case 'secondaryResource': {
      if (e.set !== undefined) return `${trigger}Reset surge to ${e.set}`
      if (Array.isArray(e.delta)) return `${trigger}Surge +${e.delta[0]}–${e.delta[1]}`
      return `${trigger}Surge ${(e.delta ?? 0) >= 0 ? '+' : ''}${e.delta ?? 0}`
    }
    case 'resetApAccum':     return `${trigger}Reset AP accumulator`
    default:                 return ''
  }
}
