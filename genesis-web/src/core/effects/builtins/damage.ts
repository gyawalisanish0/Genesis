// ─────────────────────────────────────────────────────────────────────────────
// damage — reduces target HP by a resolved ValueExpr
//
// Primitive from the v0.1.0 contract registry. Reads the target list from
// the context (either ctx.target for single-target or ctx.targets for
// multi-target selectors), resolves the amount against caster stats, and
// applies the damage to each target via BattleState mutation.
// ─────────────────────────────────────────────────────────────────────────────

import { resolveValueExpr }    from '../resolveValue'
import { registerEffect }      from '../registry'
import { takeDamage }          from '../../unit'
import type { Effect, EffectContext, EffectHandler } from '../types'
import type { Unit } from '../../types'

type DamageEffect = Extract<Effect, { type: 'damage' }>

const handle: EffectHandler<DamageEffect> = (effect, ctx) => {
  // Dice magnitude is applied here rather than at the call site so every
  // source of output — skill, status tick, counter — scales identically.
  const amount = Math.round(resolveValueExpr(effect.amount, ctx) * (ctx.outcomeScale ?? 1))
  for (const target of resolveRecipients(ctx)) {
    ctx.battle.setUnit(takeDamage(target, amount))
  }
}

function resolveRecipients(ctx: EffectContext): readonly Unit[] {
  if (ctx.targets && ctx.targets.length > 0) return ctx.targets
  return ctx.target ? [ctx.target] : []
}

export function register(): void {
  registerEffect('damage', handle)
}
