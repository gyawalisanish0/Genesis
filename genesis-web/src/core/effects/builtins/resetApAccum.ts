import { registerEffect } from '../registry'
import { clearApSpent }   from '../../unit'
import type { Effect, EffectHandler } from '../types'

type ResetApAccumEffect = Extract<Effect, { type: 'resetApAccum' }>

const handle: EffectHandler<ResetApAccumEffect> = (_effect, ctx) => {
  const current = ctx.battle.getUnit(ctx.caster.id) ?? ctx.caster
  ctx.battle.setUnit(clearApSpent(current))
}

export function register(): void {
  registerEffect('resetApAccum', handle)
}
