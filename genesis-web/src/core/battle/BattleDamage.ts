// Damage resolution pipeline — dodge checks, shield routing, TU cost modifiers,
// crit config reading, and hyper mode detection. All pure functions; no React.

import type { Unit }                                                          from '../types'
import type { BattleState as EngineBattleState, DodgeConfig, SecondaryThresholdLevel } from '../effects/types'
import { consumeStatusStack }                                                 from '../unit'

/**
 * Scans all status slot payloads on a unit for secondaryThresholdConfig arrays
 * and returns the highest-matching threshold level (highest `above` value that is
 * still ≤ the unit's current secondaryResource). Returns null if none match.
 */
export function resolveActiveThreshold(unit: Unit): SecondaryThresholdLevel | null {
  let best: SecondaryThresholdLevel | null = null
  for (const slot of unit.statusSlots) {
    const levels = slot.payload?.secondaryThresholdConfig as SecondaryThresholdLevel[] | undefined
    if (!levels) continue
    for (const level of levels) {
      if (unit.secondaryResource >= level.above) {
        if (!best || level.above > best.above) best = level
      }
    }
  }
  return best
}

/**
 * Checks dodge statuses on the target before applying damage.
 * First iterates slots for explicit dodgeConfig payloads (first match wins),
 * then checks the active secondaryThresholdConfig level for a dodge bonus.
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

  // Check threshold-based dodge from secondaryThresholdConfig.
  const activeLevel = resolveActiveThreshold(targetSnap)
  if (activeLevel?.dodgeConfig) {
    const cfg    = activeLevel.dodgeConfig
    const chance = cfg.allChance ?? (skillRange === 'ranged' ? cfg.rangedChance : cfg.meleeChance)
    if (chance !== undefined && Math.random() < chance) {
      return { dodged: true, consumed: false, expiredStatusIds }
    }
  }

  return { dodged: false, consumed: false, expiredStatusIds }
}

/**
 * After damage is resolved, checks whether the target's active secondary
 * threshold level has a deflectConfig, rolls against its chance, and returns
 * the amount of HP to restore. Returns 0 when deflect does not trigger.
 */
export function resolveIncomingDeflect(
  target:         Unit,
  targetHpBefore: number,
  snap:           Map<string, Unit>,
): number {
  const targetCurrent = snap.get(target.id) ?? target
  const activeLevel   = resolveActiveThreshold(targetCurrent)
  if (!activeLevel?.deflectConfig) return 0
  const cfg = activeLevel.deflectConfig
  if (Math.random() >= cfg.allChance) return 0
  const damageDealt = Math.max(0, targetHpBefore - targetCurrent.hp)
  return Math.round(damageDealt * cfg.damageReduction)
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

/**
 * Returns the active critConfig for a unit — checks explicit status slot payloads
 * first, then falls back to the active secondaryThresholdConfig level's critConfig.
 */
export function readCritConfig(unit: Unit): { chance: number; attackerStrPercent: number } | undefined {
  for (const slot of unit.statusSlots) {
    const cfg = slot.payload?.critConfig as { chance: number; attackerStrPercent: number } | undefined
    if (cfg) return cfg
  }
  return resolveActiveThreshold(unit)?.critConfig
}
