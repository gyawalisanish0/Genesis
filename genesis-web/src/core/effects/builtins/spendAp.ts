// ─────────────────────────────────────────────────────────────────────────────
// spendAp — deducts AP from target(s); silently no-ops if AP is insufficient
// ─────────────────────────────────────────────────────────────────────────────

import { spendAp as spendApUnit } from '../../unit'
import { registerEffect }         from '../registry'
import type { Effect, EffectContext, EffectHandler } from '../types'
import type { Unit } from '../../types'

type SpendApEffect = Extract<Effect, { type: 'spendAp' }>

const handle: EffectHandler<SpendApEffect> = (effect, ctx) => {
  for (const target of resolveRecipients(ctx)) {
    const { unit } = spendApUnit(target, effect.amount)
    ctx.battle.setUnit(unit)
  }
}

function resolveRecipients(ctx: EffectContext): readonly Unit[] {
  if (ctx.targets && ctx.targets.length > 0) return ctx.targets
  return ctx.target ? [ctx.target] : []
}

export function register(): void {
  registerEffect('spendAp', handle)
}
