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
    tickPosition: 0,
    actionCount:  0,
    skills:       [],
    statusSlots:  [],
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
