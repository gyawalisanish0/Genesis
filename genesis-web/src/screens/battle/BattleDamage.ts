// Damage resolution pipeline — dodge checks, shield routing, TU cost modifiers,
// crit config reading, and hyper mode detection. All pure functions; no React.

import type { Unit }                                     from '../../core/types'
import type { BattleState as EngineBattleState, DodgeConfig } from '../../core/effects/types'
import { consumeStatusStack }                            from '../../core/unit'

/**
 * Checks dodge statuses on the target before applying damage.
 * Iterates slots in apply-order (first match wins); payload.dodgeConfig drives
 * the chance and stack-consumption rules.
 */
export function resolveIncomingDodge(
  target:     Unit,
  skillRange: 'melee' | 'ranged' | 'global',
  snap:       Map<string, Unit>,
): { dodged: boolean; consumed: boolean; expiredStatusIds: string[] } {
  const targetSnap     = snap.get(target.id) ?? target
  const expiredStatusIds: string[] = []

  for (const slot of targetSnap.statusSlots) {
    if (slot.stacks <= 0) continue
    const cfg = slot.payload?.dodgeConfig as DodgeConfig | undefined
    if (!cfg) continue

    const chance = cfg.allChance ?? (skillRange === 'ranged' ? cfg.rangedChance : cfg.meleeChance)
    if (chance === undefined) continue

    const dodged   = Math.random() < chance
    let   consumed = false

    if (cfg.consumeOnAttempt) {
      const result = consumeStatusStack(snap.get(target.id) ?? targetSnap, slot.id)
      snap.set(target.id, result.unit)
      consumed = true
      if (result.expired) expiredStatusIds.push(slot.id)
    } else if (cfg.consumeOnSuccess && dodged) {
      const result = consumeStatusStack(snap.get(target.id) ?? targetSnap, slot.id)
      snap.set(target.id, result.unit)
      consumed = true
      if (result.expired) expiredStatusIds.push(slot.id)
    }

    if (dodged) return { dodged: true, consumed, expiredStatusIds }
  }

  return { dodged: false, consumed: false, expiredStatusIds }
}

/**
 * Builds a BattleState that intercepts HP reductions and routes them through
 * any active shield or HP/AP swap. Populates shieldBrokeIds with break metadata
 * for any unit whose shield breaks during this resolution pass.
 */
export function makeShieldedBattleState(
  snap:           Map<string, Unit>,
  shieldBrokeIds: Map<string, { skillId: string; ticks: number } | undefined>,
): EngineBattleState {
  return {
    getUnit:     (id) => snap.get(id),
    getAllUnits: ()   => [...snap.values()],
    setUnit:     (unit) => {
      const prev = snap.get(unit.id)
      if (!prev || unit.hp >= prev.hp) { snap.set(unit.id, unit); return }

      // HP/AP swap: damage hits AP pool instead of HP.
      if (prev.statusSlots.some(s => s.payload?.hpApSwapped === true)) {
        const damage = prev.hp - unit.hp
        snap.set(unit.id, { ...prev, ap: Math.max(0, prev.ap - damage) })
        return
      }

      const shieldSlot = prev.statusSlots.find(
        s => typeof s.payload?.shieldHp === 'number' && (s.payload.shieldHp as number) > 0,
      )
      const shieldHp = typeof shieldSlot?.payload?.shieldHp === 'number' ? shieldSlot.payload.shieldHp : 0
      if (!shieldSlot || shieldHp <= 0) { snap.set(unit.id, unit); return }

      const damage      = prev.hp - unit.hp
      const absorbed    = Math.min(damage, shieldHp)
      const overflow    = damage - absorbed
      const newShieldHp = shieldHp - absorbed

      if (newShieldHp <= 0) {
        const breakCd       = shieldSlot.payload?.onBreakTickCooldown as { skillId: string; ticks: number } | undefined
        const penaltyActive = prev.statusSlots.some(s => s.payload?.doublesShieldOverflow === true)
        const withoutShield: Unit = {
          ...prev,
          hp:          Math.max(0, prev.hp - overflow),
          statusSlots: prev.statusSlots.filter(
            s => s.id !== shieldSlot.id && !s.payload?.doublesShieldOverflow,
          ),
        }
        if (penaltyActive && overflow > 0) {
          snap.set(unit.id, { ...withoutShield, hp: Math.max(0, withoutShield.hp - overflow) })
        } else {
          snap.set(unit.id, withoutShield)
        }
        shieldBrokeIds.set(unit.id, breakCd)
      } else {
        const updatedSlot = { ...shieldSlot, payload: { ...shieldSlot.payload, shieldHp: newShieldHp } }
        snap.set(unit.id, {
          ...prev,
          statusSlots: prev.statusSlots.map(s => s.id === shieldSlot.id ? updatedSlot : s),
        })
      }
    },
  }
}

/**
 * Returns true when a unit is in hyper mode — detected purely from slot payloads,
 * no hardcoded status IDs. Both conditions must hold:
 *   1. A slot carries payload.hyperModeTrigger === true
 *   2. A slot carries payload.hyperModeConfig and its stacks are below activeBelowStacks
 */
export function isHyperModeActive(unit: Unit): boolean {
  return unit.statusSlots.some(s => {
    const cfg = s.payload?.hyperModeConfig as { activeBelowStacks: number } | undefined
    return s.payload?.hyperModeTrigger === true && cfg !== undefined && s.stacks < cfg.activeBelowStacks
  })
}

/**
 * Computes the effective TU cost of a skill for a unit by applying all active
 * tuCostConfig status payloads. Accounts for own secondaryResource and any
 * resourceOverlay values from broadcast statuses. Minimum result is always 1.
 */
export function getEffectiveTuCost(baseTu: number, unit: Unit): number {
  const ownFrequency     = unit.secondaryResource
  const overlayFrequency = unit.statusSlots.reduce(
    (sum, s) => sum + (((s.payload?.resourceOverlay) as number | undefined) ?? 0),
    0,
  )
  const totalFrequency = ownFrequency + overlayFrequency

  let effective = baseTu
  for (const slot of unit.statusSlots) {
    const config = slot.payload?.tuCostConfig as {
      delta?: number; percentOfBase?: number; percentPerSecondary?: number
    } | undefined
    if (!config) continue
    if (config.percentPerSecondary !== undefined) {
      effective = Math.round(effective * (1 - totalFrequency * config.percentPerSecondary / 100))
    } else if (config.percentOfBase !== undefined) {
      effective = Math.round(baseTu * (1 - config.percentOfBase / 100))
    } else if (config.delta !== undefined) {
      effective = effective + config.delta
    }
  }
  return Math.max(1, effective)
}

/** Returns the first active critConfig from any of the unit's status slot payloads. */
export function readCritConfig(unit: Unit): { chance: number; attackerStrPercent: number } | undefined {
  for (const slot of unit.statusSlots) {
    const cfg = slot.payload?.critConfig as { chance: number; attackerStrPercent: number } | undefined
    if (cfg) return cfg
  }
  return undefined
}
