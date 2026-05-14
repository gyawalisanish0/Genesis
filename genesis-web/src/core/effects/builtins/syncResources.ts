// syncResources — syncs caster AP% and secondaryResource%.
// Whichever percentage is lower gets raised to match the higher.
// AP% = ap/maxAp×100. secondaryResource is already 0–100.

import { registerEffect }              from '../registry'
import type { Effect, EffectHandler } from '../types'

type SyncResourcesEffect = Extract<Effect, { type: 'syncResources' }>

const handle: EffectHandler<SyncResourcesEffect> = (_effect, ctx) => {
  const unit      = ctx.battle.getUnit(ctx.caster.id) ?? ctx.caster
  const apPercent = unit.maxAp > 0 ? (unit.ap / unit.maxAp) * 100 : 0
  const cbPercent = unit.secondaryResource

  if (apPercent > cbPercent) {
    ctx.battle.setUnit({ ...unit, secondaryResource: Math.min(100, Math.round(apPercent)) })
  } else if (cbPercent > apPercent) {
    const newAp = Math.round((cbPercent / 100) * unit.maxAp)
    ctx.battle.setUnit({ ...unit, ap: Math.min(newAp, unit.maxAp) })
  }
}

export function register(): void {
  registerEffect('syncResources', handle)
}
