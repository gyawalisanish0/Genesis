// AI turn-start and skip helpers — fires onUnitTurnStart effects (which may kill
// units before they act) and handles the "gathering strength / no valid targets"
// skip path for enemy_telegraph.

import type { Unit }         from '../types'
import type { BattleEngine } from './BattleEngine'
import { SKIP_TU_COST }                          from '../constants'
import { isAlive, tickStatusDurations }          from '../unit'
import { advanceTick, calculateApGained }        from '../combat/TickCalculator'
import { makeHistoryEntry }                      from '../battleHistory'
import { makeSnapshot }                          from './BattleSnapshot'
import { fireTurnStartEffects, fireBattleTickIntervalPassives } from './BattlePassive'

/**
 * Fires onUnitTurnStart effects for all active AI units (once per unit per tick).
 * Returns 'ended' if the battle ended as a result, 'purged' if dead units were
 * removed and the step machine was advanced, or 'ok' to continue the telegraph.
 */
export function fireAITurnStart(
  engine:     BattleEngine,
  allAIUnits: Unit[],
  players:    Unit[],
  foes:       Unit[],
  current:    number,
): 'ended' | 'purged' | 'ok' {
  const snap = makeSnapshot(players, foes)
  for (const aiUnit of allAIUnits) {
    const key = `${aiUnit.id}:${current}`
    if (!engine.turnStartFired.has(key)) {
      engine.turnStartFired.add(key)
      fireTurnStartEffects(aiUnit, engine.statusDefs, snap, current)
    }
  }
  engine.playerUnits = engine.playerUnits.map(u => snap.get(u.id) ?? u)
  engine.enemies     = engine.enemies.map(e => snap.get(e.id) ?? e)

  const postPlayers = players.map(u => snap.get(u.id) ?? u)
  const postEnemies = foes.map(e => snap.get(e.id) ?? e)

  if (postPlayers.every(u => !isAlive(u))) {
    engine.appendLog({ text: 'Defeat! All allies have been slain.', colour: 'var(--accent-danger)' })
    engine.cb.onNarrativeEmit({ type: 'battle_defeat' })
    engine.endBattle('defeat')
    engine.setStep('battle_over')
    engine.notify()
    return 'ended'
  }
  if (postEnemies.every(e => !isAlive(e))) {
    engine.appendLog({ text: 'Victory! All enemies defeated.', colour: 'var(--accent-genesis)' })
    engine.cb.onNarrativeEmit({ type: 'battle_victory' })
    engine.endBattle('victory')
    engine.setStep('battle_over')
    engine.notify()
    return 'ended'
  }

  let purgedAny = false
  for (const aiUnit of allAIUnits) {
    const post = snap.get(aiUnit.id) ?? aiUnit
    if (!isAlive(post)) {
      engine.cb.onNarrativeEmit({ type: 'unit_death', actorId: post.defId })
      engine.unregisterTickInternal(aiUnit.id)
      purgedAny = true
    }
  }
  if (purgedAny) {
    engine.setStep('advance_tick')
    engine.notify()
    engine.drive()
    return 'purged'
  }

  return 'ok'
}

/** Handles an AI unit skipping its turn (gathering strength / no valid targets). */
export function handleAISkip(
  engine:       BattleEngine,
  firstAIUnit:  Unit,
  freshAIUnit:  Unit,
  thinkPlayers: Unit[],
  thinkEnemies: Unit[],
  reason:       string,
): void {
  const fromTick  = firstAIUnit.tickPosition
  const apFrozen  = freshAIUnit.statusSlots.some(s => s.payload?.freezesApRegen === true)
  const apGained  = apFrozen ? 0 : calculateApGained(SKIP_TU_COST, freshAIUnit.apRegenRate)
  engine.cb.onHistory(makeHistoryEntry(firstAIUnit.id, firstAIUnit.defId, firstAIUnit.name, fromTick, firstAIUnit.isAlly))
  engine.globalBattleTick += SKIP_TU_COST
  const skipSnap  = makeSnapshot(thinkPlayers, thinkEnemies)
  const skipEntry = skipSnap.get(freshAIUnit.id) ?? freshAIUnit
  skipSnap.set(freshAIUnit.id, { ...skipEntry, ap: Math.min(skipEntry.maxAp, skipEntry.ap + apGained) })
  const { unit: skipTicked, expired: skipExpired } = tickStatusDurations(skipSnap.get(freshAIUnit.id)!)
  skipSnap.set(freshAIUnit.id, skipTicked)
  for (const slot of skipExpired) engine.fireExpiryChain(freshAIUnit.defId, slot.id, skipSnap)
  engine.playPendingExpiryAnims(skipSnap)
  fireBattleTickIntervalPassives(
    engine.globalBattleTick, skipSnap,
    engine.passiveDefs,
    engine.lastIntervalFire,
    engine.lastIntervalApAccum,
    engine.globalApAccum,
  )
  engine.playerUnits = engine.playerUnits.map(u => skipSnap.get(u.id) ?? u)
  engine.enemies     = engine.enemies.map(e => skipSnap.get(e.id) ?? e)
  engine.registerTickInternal(firstAIUnit.id, advanceTick(fromTick, SKIP_TU_COST))

  const skipDeadPlayers = thinkPlayers.map(u => skipSnap.get(u.id) ?? u).filter(u => !isAlive(u))
  const skipDeadEnemies = thinkEnemies.map(e => skipSnap.get(e.id) ?? e).filter(e => !isAlive(e))
  for (const u of [...skipDeadPlayers, ...skipDeadEnemies]) {
    engine.cb.onNarrativeEmit({ type: 'unit_death', actorId: u.defId })
    engine.unregisterTickInternal(u.id)
  }

  if (thinkPlayers.map(u => skipSnap.get(u.id) ?? u).every(u => !isAlive(u))) {
    engine.appendLog({ text: 'Defeat! All allies have been slain.', colour: 'var(--accent-danger)' })
    engine.cb.onNarrativeEmit({ type: 'battle_defeat' })
    engine.endBattle('defeat')
    engine.setStep('battle_over')
    engine.notify()
    return
  }
  if (thinkEnemies.map(e => skipSnap.get(e.id) ?? e).every(e => !isAlive(e))) {
    engine.appendLog({ text: 'Victory! All enemies defeated.', colour: 'var(--accent-genesis)' })
    engine.cb.onNarrativeEmit({ type: 'battle_victory' })
    engine.endBattle('victory')
    engine.setStep('battle_over')
    engine.notify()
    return
  }

  const msg = reason === 'gathering strength'
    ? `${firstAIUnit.name} is gathering strength…`
    : `${firstAIUnit.name} has no valid targets.`
  engine.appendLog({ text: msg, colour: 'var(--text-muted)' })
  engine.cb.onClearTurn()
  engine.setStep('advance_tick')
  engine.notify()
  engine.drive()
}
