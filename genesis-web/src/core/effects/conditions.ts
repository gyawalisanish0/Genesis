// ─────────────────────────────────────────────────────────────────────────────
// Condition evaluator
//
// Evaluates a first-class Condition against an EffectContext at the moment
// an event fires. Returns `true` when the effect should run, `false` when
// it should be skipped silently. Boolean composition via `not` / `all`
// / `any` is recursive.
//
// Conditions that reference the target (targetHpBelow / hasStatus / …)
// treat an absent target as "condition fails" rather than throwing — an
// effect gated on a target it was never given simply does nothing.
// ─────────────────────────────────────────────────────────────────────────────

import type { Condition, EffectContext } from './types'
import type { Unit } from '../types'

export function evaluateCondition(cond: Condition, ctx: EffectContext): boolean {
  if ('chance'        in cond) return Math.random() < cond.chance
  if ('selfHpBelow'   in cond) return hpFraction(ctx.caster) <  cond.selfHpBelow
  if ('selfHpAbove'   in cond) return hpFraction(ctx.caster) >  cond.selfHpAbove
  if ('targetHpBelow' in cond) return ctx.target !== undefined && hpFraction(ctx.target) <  cond.targetHpBelow
  if ('targetHpAbove' in cond) return ctx.target !== undefined && hpFraction(ctx.target) >  cond.targetHpAbove
  if ('selfApBelow'   in cond) return apFraction(ctx.caster) <  cond.selfApBelow
  if ('selfApAbove'   in cond) return apFraction(ctx.caster) >  cond.selfApAbove
  if ('apAccumGte'    in cond) return ctx.caster.apSpentAccum >= cond.apAccumGte
  if ('hasStatus'     in cond) return targetHasStatus(ctx.target, cond.hasStatus)
  if ('selfHasStatus' in cond) return unitHasStatus(ctx.caster, cond.selfHasStatus)
  if ('hasTag'        in cond) return targetHasTag(ctx.target, cond.hasTag)
  if ('diceOutcome'   in cond) return ctx.dice === cond.diceOutcome
  if ('selfSecondaryAbove'    in cond) return ctx.caster.secondaryResource > cond.selfSecondaryAbove
  if ('selfSecondaryBelow'    in cond) return ctx.caster.secondaryResource < cond.selfSecondaryBelow
  if ('selfStatusStacksBelow' in cond) {
    const slot = ctx.caster.statusSlots.find(s => s.id === cond.selfStatusStacksBelow.id)
    return slot !== undefined && slot.stacks < cond.selfStatusStacksBelow.stacks
  }
  if ('not'           in cond) return !evaluateCondition(cond.not, ctx)
  if ('all'           in cond) return cond.all.every(c => evaluateCondition(c, ctx))
  if ('any'           in cond) return cond.any.some( c => evaluateCondition(c, ctx))
  // The Condition union is exhaustive — unreachable in valid content.
  throw new Error(`Unknown condition kind: ${JSON.stringify(cond)}`)
}

function hpFraction(unit: Unit): number {
  return unit.maxHp > 0 ? unit.hp / unit.maxHp : 0
}

function apFraction(unit: Unit): number {
  return unit.maxAp > 0 ? unit.ap / unit.maxAp : 0
}

function unitHasStatus(unit: Unit, statusId: string): boolean {
  return unit.statusSlots.some(s => s.id === statusId)
}

function targetHasStatus(target: Unit | undefined, statusId: string): boolean {
  if (!target) return false
  return unitHasStatus(target, statusId)
}

// Tag lookup currently resolves against the status slot id because the
// legacy StatusEffect shape does not carry a tag list. Wave C will extend
// StatusEffect with tags; until then `hasTag: "x"` is equivalent to
// `hasStatus: "x"`. Intentional v0.1.0 limitation.
function targetHasTag(target: Unit | undefined, tag: string): boolean {
  if (!target) return false
  return target.statusSlots.some(s => s.id === tag)
}
