// ─────────────────────────────────────────────────────────────────────────────
// modifyStat — applies a flat delta to one stat on target(s)
//
// Duration tracking (battle-scoped, status-scoped, tick-count) lives above
// this layer in the status engine. This primitive applies the immediate
// numeric change only.
// ─────────────────────────────────────────────────────────────────────────────

import { registerEffect } from '../registry'
import type { Effect, EffectContext, EffectHandler } from '../types'
import type { Unit } from '../../types'

type ModifyStatEffect = Extract<Effect, { type: 'modifyStat' }>

const handle: EffectHandler<ModifyStatEffect> = (effect, ctx) => {
  for (const target of resolveRecipients(ctx)) {
    const flat = effect.deltaPercent !== undefined
      ? Math.floor(target.stats[effect.stat] * effect.deltaPercent / 100)
      : (effect.delta ?? 0)
    const updated: Unit = {
      ...target,
      stats: { ...target.stats, [effect.stat]: target.stats[effect.stat] + flat },
    }
    ctx.battle.setUnit(updated)
  }
}

function resolveRecipients(ctx: EffectContext): readonly Unit[] {
  if (ctx.targets && ctx.targets.length > 0) return ctx.targets
  return ctx.target ? [ctx.target] : []
}

export function register(): void {
  registerEffect('modifyStat', handle)
}
