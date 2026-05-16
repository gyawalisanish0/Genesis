// Passive and status event dispatchers — fire* helpers that push effects into
// the engine at the right moment in the battle loop. All pure functions; no React.

import type { Unit }                                        from '../../core/types'
import type { PassiveDef, StatusDef, EffectContext, SkillInstance } from '../../core/effects/types'
import { isAlive }                                          from '../../core/unit'
import { applyEffect }                                      from '../../core/effects/applyEffect'
import { snapshotToBattleState }                            from './BattleSnapshot'

/** After a skill resolves, fire passive onHpThreshold effects whose threshold was crossed. */
export function fireHpThresholdPassives(
  unitId:      string,
  hpBefore:    number,
  passive:     PassiveDef | null,
  snap:        Map<string, Unit>,
  currentTick: number,
): void {
  if (!passive) return
  const unit = snap.get(unitId)
  if (!unit) return

  const fractionBefore = hpBefore    / unit.maxHp
  const fractionAfter  = unit.hp     / unit.maxHp

  for (const effect of passive.effects) {
    if (effect.when.event !== 'onHpThreshold') continue
    const threshold = (effect.when as { event: 'onHpThreshold'; below?: number }).below
    if (threshold === undefined) continue
    if (fractionBefore < threshold) continue   // already below — don't re-fire
    if (fractionAfter  >= threshold) continue  // didn't cross this threshold

    const ctx: EffectContext = {
      caster: unit, target: unit,
      battle: snapshotToBattleState(snap),
      source: 'passive', event: effect.when, currentTick,
    }
    applyEffect(effect, ctx)
  }
}

/** Fire onExpire effects for a StatusDef using the owning unit as caster.
 *  Returns the total damage dealt to all units (for animation display). */
export function fireStatusExpiry(
  owner: Unit,
  def:   StatusDef,
  snap:  Map<string, Unit>,
): number {
  const expireEffects = def.effects.filter(e => e.when.event === 'onExpire')
  if (!expireEffects.length) return 0
  const hpBefore = new Map([...snap.values()].map(u => [u.id, u.hp] as [string, number]))
  const ctx: EffectContext = {
    caster: snap.get(owner.id) ?? owner,
    battle: snapshotToBattleState(snap),
    source: 'status',
    event:  { event: 'onExpire' },
  }
  for (const effect of expireEffects) applyEffect(effect, ctx)
  let totalDamage = 0
  for (const [id, unit] of snap) {
    totalDamage += Math.max(0, (hpBefore.get(id) ?? unit.hp) - unit.hp)
  }
  return totalDamage
}

/** Fires onOpponentAction passive effects for all units opposing the actor. */
export function fireOpponentActionEffects(
  actor:       Unit,
  snap:        Map<string, Unit>,
  passiveDefs: Map<string, PassiveDef | null>,
  tick:        number,
): void {
  const observers = [...snap.values()].filter(u => u.isAlly !== actor.isAlly && u.hp > 0)
  for (const obs of observers) {
    const passive = passiveDefs.get(obs.id)
    if (!passive) continue
    const ctx: EffectContext = {
      caster:      snap.get(obs.id) ?? obs,
      battle:      snapshotToBattleState(snap),
      source:      'passive',
      event:       { event: 'onOpponentAction' },
      currentTick: tick,
    }
    for (const effect of passive.effects) {
      if (effect.when.event === 'onOpponentAction') applyEffect(effect, ctx)
    }
  }
}

/** Fires onCounterTrigger passive effects for the unit whose counter just fired. */
export function fireCounterTriggerEffects(
  counterUnit: Unit,
  snap:        Map<string, Unit>,
  passiveDefs: Map<string, PassiveDef | null>,
  tick:        number,
): void {
  const passive = passiveDefs.get(counterUnit.id)
  if (!passive) return
  const ctx: EffectContext = {
    caster:      snap.get(counterUnit.id) ?? counterUnit,
    battle:      snapshotToBattleState(snap),
    source:      'passive',
    event:       { event: 'onCounterTrigger' },
    currentTick: tick,
  }
  for (const effect of passive.effects) {
    if (effect.when.event === 'onCounterTrigger') applyEffect(effect, ctx)
  }
}

/**
 * Fires onCounterCast skill effects when a skill is used reactively.
 * `attacker` is the unit whose attack triggered the counter.
 */
export function fireCounterCastEffects(
  counterUnit:  Unit,
  attacker:     Unit,
  counterSkill: SkillInstance,
  snap:         Map<string, Unit>,
  tick:         number,
): void {
  const ctx: EffectContext = {
    caster:      snap.get(counterUnit.id) ?? counterUnit,
    target:      snap.get(attacker.id)   ?? attacker,
    battle:      snapshotToBattleState(snap),
    source:      'skill',
    event:       { event: 'onCounterCast' },
    currentTick: tick,
  }
  for (const effect of counterSkill.cachedEffects) {
    if (effect.when.event === 'onCounterCast') applyEffect(effect, ctx)
  }
}

/** Fires onApSpent passive effects after a unit spends AP on a skill. */
export function fireOnApSpent(
  unit:    Unit,
  passive: PassiveDef | null,
  snap:    Map<string, Unit>,
  tick:    number,
): void {
  if (!passive) return
  const ctx: EffectContext = {
    caster:      snap.get(unit.id) ?? unit,
    battle:      snapshotToBattleState(snap),
    source:      'passive',
    event:       { event: 'onApSpent' },
    currentTick: tick,
  }
  for (const effect of passive.effects) {
    if (effect.when.event === 'onApSpent') applyEffect(effect, ctx)
  }
}

/**
 * Fires onBattleTickInterval passive effects for units whose interval has elapsed.
 * Called after each unit action; globalTick is cumulative TU spent since battle start.
 */
export function fireBattleTickIntervalPassives(
  globalTick:    number,
  snap:          Map<string, Unit>,
  passiveDefs:   Map<string, PassiveDef | null>,
  lastFireMap:   Map<string, number>,
  lastApBaseMap: Map<string, number>,
  globalApAccum: number,
): void {
  for (const [unitId, passive] of passiveDefs) {
    if (!passive) continue
    for (const effect of passive.effects) {
      if (effect.when.event !== 'onBattleTickInterval') continue
      const interval = effect.when.interval
      const lastFire = lastFireMap.get(unitId) ?? 0
      if (globalTick - lastFire < interval) continue
      const unit = snap.get(unitId)
      if (!unit || !isAlive(unit)) continue
      const ctx: EffectContext = {
        caster:            unit,
        battle:            snapshotToBattleState(snap),
        source:            'passive',
        event:             { event: 'onBattleTickInterval', interval },
        currentTick:       globalTick,
        globalApSpentPool: globalApAccum - (lastApBaseMap.get(unitId) ?? 0),
      }
      applyEffect(effect, ctx)
      lastFireMap.set(unitId, globalTick)
      lastApBaseMap.set(unitId, globalApAccum)
    }
  }
}

/** Fires onUnitTurnStart status effects for a unit at the start of its turn. */
export function fireTurnStartEffects(
  unit:       Unit,
  statusDefs: Map<string, StatusDef>,
  snap:       Map<string, Unit>,
  tick:       number,
): void {
  const current = snap.get(unit.id) ?? unit
  for (const slot of current.statusSlots) {
    const def = statusDefs.get(slot.id)
    if (!def) continue
    for (const effect of def.effects) {
      if (effect.when.event !== 'onUnitTurnStart') continue
      const ctx: EffectContext = {
        caster: snap.get(unit.id) ?? current,
        target: snap.get(unit.id) ?? current,
        battle: snapshotToBattleState(snap),
        source: 'status',
        event:  { event: 'onUnitTurnStart' },
        currentTick: tick,
      }
      applyEffect(effect, ctx)
    }
  }
}
