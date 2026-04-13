// ─────────────────────────────────────────────────────────────────────────────
// tickShove — shifts target(s) forward (+) or backward (−) on the timeline
// ─────────────────────────────────────────────────────────────────────────────

import { setTickPosition }  from '../../unit'
import { registerEffect }   from '../registry'
import type { Effect, EffectContext, EffectHandler } from '../types'
import type { Unit } from '../../types'

type TickShoveEffect = Extract<Effect, { type: 'tickShove' }>

const handle: EffectHandler<TickShoveEffect> = (effect, ctx) => {
  for (const target of resolveRecipients(ctx)) {
    const next = Math.max(0, target.tickPosition + effect.amount)
    ctx.battle.setUnit(setTickPosition(target, next))
  }
}

function resolveRecipients(ctx: EffectContext): readonly Unit[] {
  if (ctx.targets && ctx.targets.length > 0) return ctx.targets
  return ctx.target ? [ctx.target] : []
}

export function register(): void {
  registerEffect('tickShove', handle)
}
