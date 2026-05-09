// ─────────────────────────────────────────────────────────────────────────────
// gainAp — restores AP to target(s)
// ─────────────────────────────────────────────────────────────────────────────

import { gainAp as gainApUnit }  from '../../unit'
import { registerEffect }        from '../registry'
import { resolveValueExpr }      from '../resolveValue'
import type { Effect, EffectContext, EffectHandler } from '../types'
import type { Unit } from '../../types'

type GainApEffect = Extract<Effect, { type: 'gainAp' }>

const handle: EffectHandler<GainApEffect> = (effect, ctx) => {
  const amount = Math.floor(resolveValueExpr(effect.amount, ctx))
  for (const target of resolveRecipients(ctx)) {
    ctx.battle.setUnit(gainApUnit(target, amount))
  }
}

function resolveRecipients(ctx: EffectContext): readonly Unit[] {
  if (ctx.targets && ctx.targets.length > 0) return ctx.targets
  return ctx.target ? [ctx.target] : []
}

export function register(): void {
  registerEffect('gainAp', handle)
}
