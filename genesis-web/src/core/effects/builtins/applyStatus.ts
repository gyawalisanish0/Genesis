// applyStatus — adds or refreshes a status on target unit(s).
// Looks up the StatusDef from the status registry (pre-populated at battle load).
// Silently no-ops when the status def is not registered.

import { registerEffect }  from '../registry'
import { getStatusDef }    from '../statusRegistry'
import { applyEffect }     from '../applyEffect'
import type { Effect, EffectContext, EffectHandler } from '../types'
import type { StatusEffect, Unit }                   from '../../types'

type ApplyStatusEffect = Extract<Effect, { type: 'applyStatus' }>

const handle: EffectHandler<ApplyStatusEffect> = (effect, ctx) => {
  const def = getStatusDef(effect.status)
  if (!def) return

  const duration     = effect.duration ?? def.duration
  const durationUnit = def.tags?.includes('turn-based') ? 'turns' : 'ticks'

  const firstInterval = findIntervalValue(def)

  for (const target of resolveRecipients(ctx)) {
    const payload: Record<string, unknown> = {}

    // Shield initialisation — flat value or % of recipient's current HP.
    if (effect.shieldFlat !== undefined) {
      payload.shieldHp = effect.shieldFlat
    } else if (effect.shieldPercent !== undefined) {
      payload.shieldHp = Math.floor(target.hp * effect.shieldPercent / 100)
    }

    // Copy blocked skill tags so executeSkill can check without registry access.
    if (def.blockedTags && def.blockedTags.length > 0) {
      payload.blockedTags = def.blockedTags
    }

    const incoming: StatusEffect = {
      id:           def.id,
      name:         def.name,
      duration,
      durationUnit,
      source:       ctx.caster.id,
      stacks:       def.maxStacks ?? 1,
      payload,
      // nextIntervalFireTick = 0 when no interval effect exists (never fires).
      nextIntervalFireTick: firstInterval > 0 ? (ctx.currentTick ?? 0) + firstInterval : 0,
    }

    ctx.battle.setUnit(mergeStatus(target, incoming, def.stacking, def.maxStacks))

    // Fire onApply effects in the status def.
    const applyEffects = def.effects.filter(e => e.when.event === 'onApply')
    if (applyEffects.length > 0) {
      const recipient = ctx.battle.getUnit(target.id) ?? target
      const applyCtx: EffectContext = { ...ctx, target: recipient, event: { event: 'onApply' } }
      for (const eff of applyEffects) applyEffect(eff, applyCtx)
    }

    // Apply the penalty window status alongside the shield.
    if (effect.penaltyWindowTurns !== undefined) {
      const penaltyDef = getStatusDef('hugo_001_shelling_point_penalty_window')
      if (penaltyDef) {
        const penaltySlot: StatusEffect = {
          id:                   penaltyDef.id,
          name:                 penaltyDef.name,
          duration:             effect.penaltyWindowTurns,
          durationUnit:         'turns',
          source:               ctx.caster.id,
          stacks:               1,
          payload:              {},
          nextIntervalFireTick: 0,
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

/** Returns the interval value from the first onTickInterval effect in a StatusDef, or 0. */
function findIntervalValue(def: { effects: Array<{ when: { event: string; interval?: number } }> }): number {
  const found = def.effects.find(e => e.when.event === 'onTickInterval')
  return found?.when.interval ?? 0
}

export function register(): void {
  registerEffect('applyStatus', handle)
}
