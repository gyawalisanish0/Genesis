// Unit factory and pure mutation helpers.
// Units are immutable value objects — every "mutation" returns a new Unit.

import type { CharacterDef, Unit } from './types'

export function createUnit(def: CharacterDef, isAlly: boolean): Unit {
  return {
    id:           crypto.randomUUID(),
    defId:        def.id,
    name:         def.name,
    className:    def.className,
    rarity:       def.rarity,
    stats:        { ...def.stats },
    maxHp:        def.maxHp,
    hp:           def.maxHp,   // starts at full HP
    maxAp:        def.maxAp,
    ap:           0,           // AP starts empty each battle
    apRegenRate:  def.apRegenRate,
    tickPosition:       0,
    actionCount:        0,
    clashSpeedModifier: def.clash?.speedModifier ?? 0,
    clashUniqueEnabled: def.clash?.uniqueClash   ?? false,
    skills:             [],
    statusSlots:        [],
    isAlly,
  }
}

export function incrementActionCount(unit: Unit): Unit {
  return { ...unit, actionCount: unit.actionCount + 1 }
}

export function takeDamage(unit: Unit, amount: number): Unit {
  return { ...unit, hp: Math.max(0, unit.hp - amount) }
}

export function healUnit(unit: Unit, amount: number): Unit {
  return { ...unit, hp: Math.min(unit.maxHp, unit.hp + amount) }
}

export function gainAp(unit: Unit, amount: number): Unit {
  return { ...unit, ap: Math.min(unit.maxAp, unit.ap + amount) }
}

// Returns the updated unit and whether the spend succeeded.
export function spendAp(unit: Unit, amount: number): { unit: Unit; success: boolean } {
  if (unit.ap < amount) return { unit, success: false }
  return { unit: { ...unit, ap: unit.ap - amount }, success: true }
}

export function isAlive(unit: Unit): boolean {
  return unit.hp > 0
}

export function setTickPosition(unit: Unit, tick: number): Unit {
  return { ...unit, tickPosition: tick }
}

/**
 * Ticks all status slots down by 1 turn.
 * Returns the updated unit and any statuses that expired (duration reached 0).
 * Expired slots are removed. BattleContext compares nextIntervalFireTick against
 * the current battle tick to decide whether to fire interval effects.
 */
export function tickStatusDurations(unit: Unit): { unit: Unit; expired: typeof unit.statusSlots } {
  const expired:   typeof unit.statusSlots = []
  const remaining: typeof unit.statusSlots = []

  for (const slot of unit.statusSlots) {
    const next = { ...slot, duration: slot.duration - 1 }
    if (next.duration <= 0) {
      expired.push(slot)
    } else {
      remaining.push(next)
    }
  }

  return { unit: { ...unit, statusSlots: remaining }, expired }
}

/**
 * Advances the nextIntervalFireTick on a named status slot to the given absolute tick.
 * Called by BattleContext after firing onTickInterval effects.
 */
export function updateStatusIntervalTick(unit: Unit, statusId: string, nextTick: number): Unit {
  return {
    ...unit,
    statusSlots: unit.statusSlots.map(s =>
      s.id === statusId ? { ...s, nextIntervalFireTick: nextTick } : s,
    ),
  }
}

/** Decrements stacks on a named status by 1. Removes it when stacks reach 0. */
export function consumeStatusStack(unit: Unit, statusId: string): Unit {
  const slot = unit.statusSlots.find(s => s.id === statusId)
  if (!slot) return unit

  if (slot.stacks <= 1) {
    return { ...unit, statusSlots: unit.statusSlots.filter(s => s.id !== statusId) }
  }
  return {
    ...unit,
    statusSlots: unit.statusSlots.map(s =>
      s.id === statusId ? { ...s, stacks: s.stacks - 1 } : s,
    ),
  }
}

/** Removes a status slot by ID. No-op if not present. */
export function removeStatus(unit: Unit, statusId: string): Unit {
  return { ...unit, statusSlots: unit.statusSlots.filter(s => s.id !== statusId) }
}
