// applyStatus — adds or refreshes a status on target unit(s).
// Looks up the StatusDef from the status registry (pre-populated at battle load).
// Silently no-ops when the status def is not registered.

import { registerEffect }    from '../registry'
import { getStatusDef }      from '../statusRegistry'
import { applyEffect }       from '../applyEffect'
import { resolveValueExpr }  from '../resolveValue'
import type { Effect, EffectContext, EffectHandler, StatusDef } from '../types'
import type { StatusEffect, Unit }                              from '../../types'

type ApplyStatusEffect = Extract<Effect, { type: 'applyStatus' }>

const handle: EffectHandler<ApplyStatusEffect> = (effect, ctx) => {
  const def = getStatusDef(effect.status)
  if (!def) return

  const duration     = effect.duration ?? def.duration ?? Infinity
  const durationUnit = def.tags?.includes('turn-based') ? 'turns' : 'ticks'

  const firstInterval = findIntervalValue(def)

  for (const target of resolveRecipients(ctx)) {
    const payload: Record<string, unknown> = {}

    // Shield initialisation — ValueExpr (e.g. % of caster maxHp), flat, or % of target HP.
    if (effect.shieldValue !== undefined) {
      payload.shieldHp = Math.floor(resolveValueExpr(effect.shieldValue, { ...ctx, target }))
    } else if (effect.shieldFlat !== undefined) {
      payload.shieldHp = effect.shieldFlat
    } else if (effect.shieldPercent !== undefined) {
      payload.shieldHp = Math.floor(target.hp * effect.shieldPercent / 100)
    }

    if (effect.rangedBaseChanceBonus !== undefined) {
      payload.rangedBaseChanceBonus = effect.rangedBaseChanceBonus
    }

    // Copy blocked skill tags so executeSkill can check without registry access.
    if (def.blockedTags && def.blockedTags.length > 0) {
      payload.blockedTags = def.blockedTags
    }

    // Dodge config — copied from StatusDef so BattleContext never needs ID checks.
    if (def.dodgeConfig) {
      payload.dodgeConfig = def.dodgeConfig
    }

    // Tag-driven payload flags — BattleContext reads these; no ID checks needed.
    if (def.tags?.includes('ap-regen-freeze'))     payload.freezesApRegen       = true
    if (def.tags?.includes('shield-penalty-window')) payload.doublesShieldOverflow = true
    if (def.tags?.includes('hp-ap-swap'))           payload.hpApSwapped          = true

    // Shield break metadata — stored so BattleContext can act after the slot is removed.
    if (effect.onBreakTickCooldown) {
      payload.onBreakTickCooldown = effect.onBreakTickCooldown
    }

    // Recast guard — checked by BattleContext before allowing the named skill to fire.
    if (effect.blocksRecastOfSkill) {
      payload.blocksRecastOfSkill = effect.blocksRecastOfSkill
    }

    // TU cost modifier config — read by BattleContext to compute effective TU costs.
    if (def.tuCostConfig) payload.tuCostConfig = def.tuCostConfig

    // Crit config — read by BattleContext in runAttack to roll and apply bonus crit damage.
    if (def.critConfig) payload.critConfig = def.critConfig

    // Hyper mode marker — read by BattleContext to detect hyper mode without ID checks.
    if (def.hyperModeTrigger) payload.hyperModeTrigger = true
    if (def.hyperModeConfig)  payload.hyperModeConfig  = def.hyperModeConfig

    // Stun flag — BattleContext prevents all skill execution when true.
    if (def.tags?.includes('stun')) payload.stunned = true

    // Passthrough payload from the applying effect — merged last so it can override defaults.
    if (effect.payload) Object.assign(payload, effect.payload)

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

    // Apply companion status alongside the primary one (e.g. penalty window with a shield).
    if (effect.companionStatus) {
      const companionDef = getStatusDef(effect.companionStatus)
      if (companionDef) {
        const companionDuration  = effect.companionDuration ?? companionDef.duration
        const companionSlot: StatusEffect = {
          id:                   companionDef.id,
          name:                 companionDef.name,
          duration:             companionDuration,
          durationUnit:         companionDef.tags?.includes('turn-based') ? 'turns' : 'ticks',
          source:               ctx.caster.id,
          stacks:               companionDef.maxStacks ?? 1,
          payload:              buildCompanionPayload(companionDef),
          nextIntervalFireTick: 0,
        }
        const afterPrimary = ctx.battle.getUnit(target.id) ?? target
        ctx.battle.setUnit(mergeStatus(afterPrimary, companionSlot, companionDef.stacking, companionDef.maxStacks))
      }
    }
  }
}

/** Mirrors the tag-driven flag logic for companion statuses. */
function buildCompanionPayload(def: StatusDef): Record<string, unknown> {
  const payload: Record<string, unknown> = {}
  if (def.dodgeConfig)                              payload.dodgeConfig           = def.dodgeConfig
  if (def.tags?.includes('ap-regen-freeze'))        payload.freezesApRegen        = true
  if (def.tags?.includes('shield-penalty-window'))  payload.doublesShieldOverflow = true
  if (def.tags?.includes('hp-ap-swap'))             payload.hpApSwapped           = true
  if (def.blockedTags && def.blockedTags.length > 0) payload.blockedTags          = def.blockedTags
  return payload
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
