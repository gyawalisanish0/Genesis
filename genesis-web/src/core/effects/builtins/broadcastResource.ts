// broadcastResource — propagates caster.secondaryResource to target units as a status overlay.
// Applies (or refreshes) statusId on each target with payload.resourceOverlay = caster.secondaryResource.
// Intended for mechanics where one unit amplifies others via a shared resource pool.

import { registerEffect }    from '../registry'
import { getStatusDef }      from '../statusRegistry'
import type { Effect, EffectHandler } from '../types'
import type { StatusEffect, Unit }                   from '../../types'

type BroadcastResourceEffect = Extract<Effect, { type: 'broadcastResource' }>

const handle: EffectHandler<BroadcastResourceEffect> = (effect, ctx) => {
  const caster = ctx.battle.getUnit(ctx.caster.id) ?? ctx.caster
  const def    = getStatusDef(effect.statusId)
  if (!def) return

  const targets = resolveTargets(caster, ctx)

  for (const t of targets) {
    const current = ctx.battle.getUnit(t.id) ?? t
    const slot: StatusEffect = {
      id:                   def.id,
      name:                 def.name,
      duration:             9999,
      durationUnit:         'ticks',
      source:               caster.id,
      stacks:               1,
      payload:              { resourceOverlay: caster.secondaryResource },
      nextIntervalFireTick: 0,
    }
    const existing = current.statusSlots.find(s => s.id === def.id)
    if (existing) {
      ctx.battle.setUnit({
        ...current,
        statusSlots: current.statusSlots.map(s => s.id === def.id ? slot : s),
      })
    } else {
      ctx.battle.setUnit({ ...current, statusSlots: [...current.statusSlots, slot] })
    }
  }
}

function resolveTargets(caster: Unit, ctx: { targets?: readonly Unit[]; target?: Unit; battle: { getAllUnits(): readonly Unit[] } }): readonly Unit[] {
  if (ctx.targets && ctx.targets.length > 0) return ctx.targets
  if (ctx.target) return [ctx.target]
  return ctx.battle.getAllUnits().filter(u => u.isAlly === caster.isAlly && u.id !== caster.id && u.hp > 0)
}

export function register(): void {
  registerEffect('broadcastResource', handle)
}
