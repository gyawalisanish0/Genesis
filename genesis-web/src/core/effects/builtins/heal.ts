// ─────────────────────────────────────────────────────────────────────────────
// heal — restores target HP by a resolved ValueExpr (capped at maxHp)
//
// Primitive from the v0.1.0 contract registry. Mirrors the damage
// primitive's shape — resolves amount, iterates the context's recipient
// list, mutates through BattleState.
// ─────────────────────────────────────────────────────────────────────────────

import { resolveValueExpr }    from '../resolveValue'
import { registerEffect }      from '../registry'
import { healUnit }            from '../../unit'
import type { Effect, EffectContext, EffectHandler } from '../types'
import type { Unit } from '../../types'

type HealEffect = Extract<Effect, { type: 'heal' }>

const handle: EffectHandler<HealEffect> = (effect, ctx) => {
  const amount = Math.round(resolveValueExpr(effect.amount, ctx))
  for (const target of resolveRecipients(ctx)) {
    ctx.battle.setUnit(healUnit(target, amount))
  }
}

function resolveRecipients(ctx: EffectContext): readonly Unit[] {
  if (ctx.targets && ctx.targets.length > 0) return ctx.targets
  return ctx.target ? [ctx.target] : []
}

export function register(): void {
  registerEffect('heal', handle)
}
