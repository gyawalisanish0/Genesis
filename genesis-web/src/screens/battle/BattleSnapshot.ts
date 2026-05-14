// Snapshot utilities — create mutable unit maps for the effects engine and
// collect status IDs referenced by a set of effects.

import type { Unit }                           from '../../core/types'
import type { BattleState as EngineBattleState, Effect } from '../../core/effects/types'

/** Creates a shallow-copy snapshot so effect handlers can mutate safely. */
export function makeSnapshot(playerUnits: Unit[], enemies: Unit[]): Map<string, Unit> {
  const snap = new Map<string, Unit>()
  playerUnits.forEach((u) => snap.set(u.id, { ...u }))
  enemies.forEach((e)     => snap.set(e.id, { ...e }))
  return snap
}

/** Wraps a snapshot map in the EngineBattleState interface. */
export function snapshotToBattleState(snap: Map<string, Unit>): EngineBattleState {
  return {
    getUnit:     (id)   => snap.get(id),
    setUnit:     (unit) => snap.set(unit.id, unit),
    getAllUnits: ()     => [...snap.values()],
  }
}

/** Collects all status IDs referenced by applyStatus effects in an effect list. */
export function collectStatusIds(effects: readonly Effect[]): string[] {
  return effects
    .filter((e): e is Extract<Effect, { type: 'applyStatus' }> => e.type === 'applyStatus')
    .map(e => e.status)
}
