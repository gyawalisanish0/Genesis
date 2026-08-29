// Steps: advance_tick / clash_check — advances the shared tick stream to the
// next active position and routes control to clash, team-collision, AI, or
// player-turn handling.

import type { Unit }         from '../types'
import type { BattleEngine } from './BattleEngine'
import { CLASH_ANNOUNCE_MS }                from '../constants'
import { isAlive }                          from '../unit'
import { resolveClashWinner, factionAvgSpeed } from '../combat/ClashResolver'
import { makeSnapshot }                     from './BattleSnapshot'
import { fireTurnStartEffects }             from './BattlePassive'

export function runAdvanceTick(engine: BattleEngine): void {
  const ticks = [...engine.registeredTicks.values()]
  if (!ticks.length) {
    const alivePlayers = engine.playerUnits.filter(isAlive)
    const aliveEnemies = engine.enemies.filter(isAlive)
    if (!alivePlayers.length) {
      engine.appendLog({ text: 'Defeat! All allies have been slain.', colour: 'var(--accent-danger)' })
      engine.endBattle('defeat')
      engine.setStep('battle_over')
      engine.notify()
    } else if (!aliveEnemies.length) {
      engine.appendLog({ text: 'Victory! All enemies defeated.', colour: 'var(--accent-genesis)' })
      engine.endBattle('victory')
      engine.setStep('battle_over')
      engine.notify()
    }
    return
  }

  const hasActiveNow = ticks.some(t => t === engine.tickValue)
  if (!hasActiveNow) {
    const next = Math.min(...ticks)
    engine.tickValue = next
  }
  engine.setStep('clash_check')
  engine.notify()
  engine.drive()
}

export function runClashCheck(engine: BattleEngine): void {
  const current    = engine.tickValue
  const ticks      = engine.registeredTicks
  const controlled = engine.controlledIds
  const players    = engine.playerUnits
  const foes       = engine.enemies

  const activeIds = new Set<string>()
  for (const [id, tick] of ticks) {
    if (tick === current) activeIds.add(id)
  }

  const activeControlled = players.filter(u => activeIds.has(u.id) && controlled.has(u.id) && isAlive(u))
  const activeAIAllies   = players.filter(u => activeIds.has(u.id) && !controlled.has(u.id) && isAlive(u))
  const activeEnemies    = foes.filter(e => activeIds.has(e.id) && isAlive(e))
  const hasClash         = activeControlled.length > 0 && activeEnemies.length > 0

  if (hasClash) {
    const allActive    = [...activeControlled, ...activeEnemies]
    const hasUniqueClash = allActive.some(u => u.clashUniqueEnabled)

    if (hasUniqueClash) {
      engine.pendingClash = { playerUnits: activeControlled, enemyUnits: activeEnemies }
      engine.setStep('clash_qte')
      engine.notify()
      return
    }

    const winner    = resolveClashWinner(activeControlled, activeEnemies)
    const winnerUs  = winner === 'player' ? activeControlled : activeEnemies
    const loserUs   = winner === 'player' ? activeEnemies    : activeControlled
    const winnerAvg = Math.round(factionAvgSpeed(winnerUs))
    const loserAvg  = Math.round(factionAvgSpeed(loserUs))
    engine.appendLog({
      text:   `CLASH — ${winnerUs.map(u => u.name).join(' & ')} acts first (avg. speed ${winnerAvg} vs ${loserAvg})`,
      colour: winner === 'player' ? 'var(--accent-info)' : 'var(--accent-danger)',
    })
    winnerUs.forEach(u => engine.cb.onNarrativeEmit({ type: 'clash_resolved', actorId: u.defId }))
    engine.clashAnnounceWinner = winner
    const clashWinActor = winner === 'player' ? (activeControlled[0] ?? null) : null
    engine.setStep('clash_announcing')
    engine.notify()
    engine.clashAnnounceTimer = engine.safeTimeout(() => {
      const w = engine.clashAnnounceWinner
      if (w === 'player' && clashWinActor) engine.showPlayerTurnUnits(clashWinActor)
      engine.setStep(w === 'player' ? 'player_turn' : 'enemy_telegraph')
      engine.notify()
      engine.drive()
    }, CLASH_ANNOUNCE_MS)
    return
  }

  if (activeControlled.length > 1) {
    const bySpeed = [...activeControlled].sort((a, b) => b.stats.speed - a.stats.speed)
    if (bySpeed[0].stats.speed !== bySpeed[1].stats.speed) {
      engine.showPlayerTurnUnits(bySpeed[0])
      engine.setStep('player_turn')
      engine.notify()
    } else {
      const choices = new Map(activeControlled.map(u => [u.id, null as 'now' | 'later' | null]))
      engine.pendingTeamCollision = { units: activeControlled, choices }
      engine.setStep('team_collision')
      engine.notify()
    }
    return
  }

  const allActiveAI = [...activeAIAllies, ...activeEnemies]
  if (allActiveAI.length > 0) {
    engine.setStep('enemy_telegraph')
    engine.notify()
    engine.drive()
    return
  }

  if (activeControlled.length === 1) {
    const activeUnit = activeControlled[0]
    const turnKey    = `${activeUnit.id}:${current}`
    let postTurnStart: Unit = activeUnit
    if (!engine.turnStartFired.has(turnKey)) {
      engine.turnStartFired.add(turnKey)
      const snap = makeSnapshot(players, foes)
      fireTurnStartEffects(activeUnit, engine.statusDefs, snap, current)
      const updated = snap.get(activeUnit.id)
      if (updated) {
        postTurnStart = updated
        engine.playerUnits = engine.playerUnits.map(u => u.id === updated.id ? updated : u)
        engine.enemies     = engine.enemies.map(e => snap.get(e.id) ?? e)
      }
    }
    if (!isAlive(postTurnStart)) {
      engine.cb.onNarrativeEmit({ type: 'unit_death', actorId: postTurnStart.defId })
      engine.unregisterTickInternal(activeUnit.id)
      const allDead = players.every(u => u.id === activeUnit.id ? !isAlive(postTurnStart) : !isAlive(u))
      if (allDead) {
        engine.appendLog({ text: 'Defeat! All allies have been slain.', colour: 'var(--accent-danger)' })
        engine.cb.onNarrativeEmit({ type: 'battle_defeat' })
        engine.endBattle('defeat')
        engine.setStep('battle_over')
        engine.notify()
        return
      }
      engine.setStep('advance_tick')
      engine.notify()
      engine.drive()
      return
    }
    engine.showPlayerTurnUnits(postTurnStart)
    engine.setStep('player_turn')
    engine.notify()
    return
  }

  // No active units — purge dead stale registrations.
  for (const id of activeIds) {
    const deadInPlayers = players.find(u => u.id === id && !isAlive(u))
    const deadInFoes    = foes.find(e => e.id === id && !isAlive(e))
    if (deadInPlayers ?? deadInFoes) engine.unregisterTickInternal(id)
  }
  engine.setStep('advance_tick')
  engine.notify()
  engine.drive()
}
