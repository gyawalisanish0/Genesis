// Steps: enemy_applying / player_applying — commit a resolved attack snapshot
// back to engine state, fire tick-interval passives, check win/loss, and play
// any death animation before returning to advance_tick.

import type { BattleEngine } from './BattleEngine'
import type { Unit }                      from '../types'
import { ANIM_TIMEOUT_MS }                from '../constants'
import { isAlive, incrementActionCount }  from '../unit'
import { advanceTick }                    from '../combat/TickCalculator'
import { makeHistoryEntry }               from '../battleHistory'
import { fireBattleTickIntervalPassives } from './BattlePassive'

/**
 * Re-register anyone the effects moved on the timeline.
 *
 * A unit's tick lives in two places: `registeredTicks`, which the engine
 * schedules from, and `unit.tickPosition`, which the timeline draws from.
 * Effects write through `battle.setUnit`, and that only reaches the snapshot's
 * Unit objects — so a `tickShove` landing on anyone but the actor moved the
 * marker and nothing else. Tara's Chaotic Vortex drew every enemy sliding four
 * ticks forward and then acted them all exactly on time.
 *
 * The actor is excluded because their tick is set from `advanceTick` just
 * above, which already reads the shoved position back off the snapshot — the
 * same bug, caught earlier for the caster alone.
 *
 * Goes through `registerTickInternal` rather than writing the map directly, so
 * a shove into an occupied tick still gets displaced and still announces it.
 */
function reRegisterMovedUnits(
  engine: BattleEngine, snap: ReadonlyMap<string, Unit>, actorId: string,
): void {
  for (const [id, unit] of snap) {
    if (id === actorId) continue
    const registered = engine.registeredTicks.get(id)
    // Absent = not on the timeline: already dead, or never registered.
    if (registered === undefined || registered === unit.tickPosition) continue
    engine.registerTickInternal(id, unit.tickPosition)
  }
}

export function runEnemyApplying(engine: BattleEngine): void {
  const pending = engine.pendingAITurn
  if (!pending) return
  engine.pendingAITurn = null

  const { aiUnit, snap, effectiveTu, primaryTarget, isAlly: aiIsAlly, preStatusSnapshot } = pending
  const currentPlayers = engine.playerUnits
  const currentEnemies = engine.enemies

  engine.detectNewActivations(snap, preStatusSnapshot)
  engine.playerUnits = engine.playerUnits.map(u => snap.get(u.id) ?? u)
  engine.enemies     = engine.enemies.map(e => snap.get(e.id) ?? e)

  // Read the position back off the snapshot, not the pre-action unit: an effect
  // that shoves the CASTER (a self-haste, a recoil, a passive) writes to the
  // snapshot, and advancing from the stale reference silently discarded it.
  const fromTick = snap.get(aiUnit.id)?.tickPosition ?? aiUnit.tickPosition
  engine.cb.onHistory(makeHistoryEntry(aiUnit.id, aiUnit.defId, aiUnit.name, fromTick, aiUnit.isAlly))
  engine.registerTickInternal(aiUnit.id, advanceTick(fromTick, effectiveTu))
  reRegisterMovedUnits(engine, snap, aiUnit.id)
  engine.globalBattleTick += effectiveTu
  fireBattleTickIntervalPassives(
    engine.globalBattleTick, snap,
    engine.passiveDefs,
    engine.lastIntervalFire,
    engine.lastIntervalApAccum,
    engine.globalApAccum,
  )

  engine.cb.onHideTurnDisplay()

  const updatedPlayers = currentPlayers.map(u => snap.get(u.id) ?? u)
  const updatedEnemies = currentEnemies.map(e => snap.get(e.id) ?? e)
  const deadPlayers    = updatedPlayers.filter(u => !isAlive(u))
  const deadEnemies    = updatedEnemies.filter(e => !isAlive(e))
  deadPlayers.forEach(u => { engine.cb.onNarrativeEmit({ type: 'unit_death', actorId: u.defId }); engine.unregisterTickInternal(u.id) })
  deadEnemies.forEach(e => { engine.cb.onNarrativeEmit({ type: 'unit_death', actorId: e.defId }); engine.unregisterTickInternal(e.id) })

  if (updatedPlayers.every(u => !isAlive(u))) {
    engine.appendLog({ text: 'Defeat! All allies have been slain.', colour: 'var(--accent-danger)' })
    engine.cb.onNarrativeEmit({ type: 'battle_defeat' })
    engine.endBattle('defeat')
    engine.setStep('battle_over')
    engine.notify()
    return
  }
  if (updatedEnemies.every(e => !isAlive(e))) {
    engine.appendLog({ text: 'Victory! All enemies defeated.', colour: 'var(--accent-genesis)' })
    engine.cb.onNarrativeEmit({ type: 'battle_victory' })
    engine.endBattle('victory')
    engine.setStep('battle_over')
    engine.notify()
    return
  }

  void primaryTarget

  const primaryVictim = !aiIsAlly ? deadPlayers[0] : deadEnemies[0]
  if (primaryVictim) {
    engine.notify()
    engine.cb.onPlayDeath(primaryVictim.defId)
    engine.safeTimeout(() => {
      engine.cb.onClearTurn()
      engine.playPendingExpiryAnims(snap)
      engine.playPendingActivationAnims()
      if (engine.step === 'enemy_applying') {
        engine.setStep('advance_tick')
        engine.notify()
        engine.drive()
      }
    }, ANIM_TIMEOUT_MS)
    return
  }
  engine.notify()
  engine.cb.onClearTurn()
  engine.playPendingExpiryAnims(snap)
  engine.playPendingActivationAnims()
  engine.setStep('advance_tick')
  engine.notify()
  engine.drive()
}

export function runPlayerApplying(engine: BattleEngine): void {
  const pending = engine.pendingPlayerTurn
  if (!pending) return
  engine.pendingPlayerTurn = null

  const { snap, actor, effectiveTu, primaryTarget, preStatusSnapshot } = pending
  const currentPlayers = engine.playerUnits
  const currentEnemies = engine.enemies

  engine.detectNewActivations(snap, preStatusSnapshot)

  engine.playerUnits = engine.playerUnits.map(u => {
    const updated = snap.get(u.id) ?? u
    return u.id === actor.id ? incrementActionCount(updated) : updated
  })
  engine.enemies = engine.enemies.map(e => snap.get(e.id) ?? e)

  // Same as the AI path: a shove applied to the caster lives in the snapshot,
  // so advancing from actor.tickPosition would throw it away.
  const nextTick = advanceTick(snap.get(actor.id)?.tickPosition ?? actor.tickPosition, effectiveTu)
  engine.registerTickInternal(actor.id, nextTick)
  reRegisterMovedUnits(engine, snap, actor.id)
  engine.globalBattleTick += effectiveTu
  fireBattleTickIntervalPassives(
    engine.globalBattleTick, snap,
    engine.passiveDefs,
    engine.lastIntervalFire,
    engine.lastIntervalApAccum,
    engine.globalApAccum,
  )

  const snapEnemies = currentEnemies.map(e => snap.get(e.id) ?? e)
  const snapPlayers = currentPlayers.map(u => snap.get(u.id) ?? u)
  const deadEnemies = snapEnemies.filter(e => !isAlive(e))
  const deadPlayers = snapPlayers.filter(u => !isAlive(u))
  deadEnemies.forEach(e => { engine.cb.onNarrativeEmit({ type: 'unit_death', actorId: e.defId }); engine.unregisterTickInternal(e.id) })
  deadPlayers.forEach(u => { engine.cb.onNarrativeEmit({ type: 'unit_death', actorId: u.defId }); engine.unregisterTickInternal(u.id) })

  engine.cb.onHideTurnDisplay()

  if (snapPlayers.every(u => !isAlive(u))) {
    engine.appendLog({ text: 'Defeat! All allies have been slain.', colour: 'var(--accent-danger)' })
    engine.cb.onNarrativeEmit({ type: 'battle_defeat' })
    engine.endBattle('defeat')
    engine.setStep('battle_over')
    engine.notify()
    return
  }
  if (snapEnemies.every(e => !isAlive(e))) {
    engine.appendLog({ text: 'Victory! All enemies defeated.', colour: 'var(--accent-genesis)' })
    engine.cb.onNarrativeEmit({ type: 'battle_victory' })
    engine.endBattle('victory')
    engine.setStep('battle_over')
    engine.notify()
    return
  }

  void primaryTarget

  const firstDead = deadEnemies[0]
  if (firstDead) {
    engine.notify()
    engine.cb.onPlayDeath(firstDead.defId)
    engine.safeTimeout(() => {
      engine.cb.onClearTurn()
      engine.playPendingExpiryAnims(snap)
      engine.playPendingActivationAnims()
      if (engine.step === 'player_applying') {
        engine.setStep('advance_tick')
        engine.notify()
        engine.drive()
      }
    }, ANIM_TIMEOUT_MS)
  } else {
    engine.notify()
    engine.cb.onClearTurn()
    engine.playPendingExpiryAnims(snap)
    engine.playPendingActivationAnims()
    engine.setStep('advance_tick')
    engine.notify()
    engine.drive()
  }
}
