// applyStatus — adds or refreshes a status on target unit(s).
// Looks up the StatusDef from the status registry (pre-populated at battle load).
// Silently no-ops when the status def is not registered.

import { registerEffect }  from '../registry'
import { getStatusDef }    from '../statusRegistry'
import type { Effect, EffectContext, EffectHandler } from '../types'
import type { StatusEffect, Unit }                   from '../../types'

type ApplyStatusEffect = Extract<Effect, { type: 'applyStatus' }>

const handle: EffectHandler<ApplyStatusEffect> = (effect, ctx) => {
  const def = getStatusDef(effect.status)
  if (!def) return

  const duration     = effect.duration ?? def.duration
  const durationUnit = def.tags?.includes('turn-based') ? 'turns' : 'ticks'

  for (const target of resolveRecipients(ctx)) {
    const payload: Record<string, unknown> = {}

    // Shield initialisation — calculate HP from caster's current HP at cast time.
    if (effect.shieldPercent !== undefined) {
      payload.shieldHp = Math.floor(target.hp * effect.shieldPercent / 100)
    }

    const incoming: StatusEffect = {
      id:                 def.id,
      name:               def.name,
      duration,
      durationUnit,
      source:             ctx.caster.id,
      stacks:             def.maxStacks ?? 1,
      payload,
      ticksSinceInterval: 0,
    }

    ctx.battle.setUnit(mergeStatus(target, incoming, def.stacking, def.maxStacks))

    // Apply the penalty window status alongside the shield.
    if (effect.penaltyWindowTurns !== undefined) {
      const penaltyDef = getStatusDef('hugo_001_shelling_point_penalty_window')
      if (penaltyDef) {
        const penaltySlot: StatusEffect = {
          id:                 penaltyDef.id,
          name:               penaltyDef.name,
          duration:           effect.penaltyWindowTurns,
          durationUnit:       'turns',
          source:             ctx.caster.id,
          stacks:             1,
          payload:            {},
          ticksSinceInterval: 0,
        }
        const afterShield = ctx.battle.getUnit(target.id) ?? target
        ctx.battle.setUnit(mergeStatus(afterShield, penaltySlot, penaltyDef.stacking, undefined))
      }
    }
  }
}

function resolveRecipients(ctx: EffectContext): readonly Unit[] {
  if (ctx.targets && ctx.targets.length > 0) return ctx.targets
  return ctx.target ? [ctx.target] : [ctx.caster]
}

function mergeStatus(
  unit:      Unit,
  incoming:  StatusEffect,
  stacking:  string,
  maxStacks: number | undefined,
): Unit {
  const existing = unit.statusSlots.find(s => s.id === incoming.id)

  if (!existing) {
    return { ...unit, statusSlots: [...unit.statusSlots, incoming] }
  }

  switch (stacking) {
    case 'refresh':
      return replaceSlot(unit, { ...existing, duration: incoming.duration })
    case 'extend':
      return replaceSlot(unit, { ...existing, duration: existing.duration + incoming.duration })
    case 'stack': {
      const nextStacks = Math.min(existing.stacks + 1, maxStacks ?? Infinity)
      return replaceSlot(unit, { ...existing, stacks: nextStacks, duration: incoming.duration })
    }
    case 'independent':
      return { ...unit, statusSlots: [...unit.statusSlots, incoming] }
    default:
      return replaceSlot(unit, { ...existing, duration: incoming.duration })
  }
}

function replaceSlot(unit: Unit, updated: StatusEffect): Unit {
  return {
    ...unit,
    statusSlots: unit.statusSlots.map(s => s.id === updated.id ? updated : s),
  }
}

export function register(): void {
  registerEffect('applyStatus', handle)
}
