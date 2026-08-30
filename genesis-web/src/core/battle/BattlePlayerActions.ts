// Public player action handlers — execute a skill (player_turn → player_acting)
// or skip the turn entirely (player_turn → advance_tick).

import type { Unit }          from '../types'
import type { SkillInstance } from '../effects/types'
import type { BattleEngine }  from './BattleEngine'
import { DICE_RESULT_DISMISS_MS, ANIM_TIMEOUT_MS, SKIP_TU_COST } from '../constants'
import { isAlive, incrementActionCount, tickStatusDurations, isSkillTagBlocked } from '../unit'
import { calculateApGained } from '../combat/TickCalculator'
import { isOnCooldown, applyCooldown, applyTurnCooldown, isBeforeMinTurns } from '../combat/CooldownResolver'
import { getCachedSkill }    from '../engines/skill/SkillInstance'
import { makeHistoryEntry }  from '../battleHistory'
import { makeSnapshot }      from './BattleSnapshot'
import { isHyperModeActive, getEffectiveTuCost } from './BattleDamage'
import { fireBattleTickIntervalPassives }        from './BattlePassive'
import { resolveSkillTargets, unitIsDamaged, outcomeColour, buildOutcomeLabel } from './BattleResolution'
import { runAttack } from './BattleAttackResolver'

export function executeSkill(engine: BattleEngine, skillInst: SkillInstance, selectedTarget: Unit | null): void {
  if (engine.step !== 'player_turn') return
  const actor = engine.getActivePlayerUnit()
  if (!actor) return
  if (!isAlive(actor)) return
  if (engine.narrativePaused || engine.inspectingSkill) return
  if (isOnCooldown(actor, skillInst)) return

  const skill = getCachedSkill(skillInst)
  if (isBeforeMinTurns(actor, skill.minTurns)) return
  if (actor.statusSlots.some(s => s.payload?.blocksRecastOfSkill === skill.id)) return
  if (actor.statusSlots.some(s => s.payload?.stunned === true)) return
  if (isSkillTagBlocked(actor, skill.tags)) return

  const snap = makeSnapshot(engine.playerUnits, engine.enemies)
  const preStatusSnapshot = new Map(
    [...snap].map(([uid, u]) => [uid, new Set(u.statusSlots.map(s => s.id))])
  )

  const allTargets = resolveSkillTargets(actor, skill.targeting.selector, snap, selectedTarget)
  if (!allTargets.length) return

  const currentTick = engine.tickValue

  engine.applySkillAPCost(actor.id, skill.apCost, snap, currentTick)

  const primaryTarget = allTargets[0]
  const { outcome, damage: primaryDamage } = runAttack(engine, actor, primaryTarget, skillInst, snap)

  if (allTargets.length > 1) {
    engine.applySplashEffects(actor, skillInst, allTargets.slice(1), snap, outcome, currentTick)
  }

  const isHyperCast = skill.tags.includes('hyper') && skill.hyperCooldown !== undefined
    && isHyperModeActive(snap.get(actor.id) ?? actor)
  const withCooldown = isHyperCast
    ? applyTurnCooldown(actor, skillInst, skill.hyperCooldown!)
    : applyCooldown(actor, skillInst, skill)

  const updatedMap = new Map(engine.unitSkillsMap)
  const actorSkills = updatedMap.get(actor.id) ?? []
  updatedMap.set(actor.id, actorSkills.map(s => s.defId === skillInst.defId ? withCooldown : s))
  engine.unitSkillsMap = updatedMap

  const fromTick    = actor.tickPosition
  const effectiveTu = getEffectiveTuCost(skill.tuCost, snap.get(actor.id) ?? actor)

  engine.cb.onHistory(makeHistoryEntry(actor.id, actor.defId, actor.name, fromTick, actor.isAlly))

  const postTarget = snap.get(primaryTarget.id) ?? primaryTarget
  engine.showTurnDisplay({
    actor:      null,
    skillName:  skill.name,
    tuCost:     skill.tuCost,
    apCost:     skill.apCost,
    skillLevel: skillInst.currentLevel,
    target: {
      name:              postTarget.name,
      className:         postTarget.className,
      rarity:            postTarget.rarity,
      hp:                postTarget.hp,
      maxHp:             postTarget.maxHp,
      ap:                postTarget.ap,
      maxAp:             postTarget.maxAp,
      secondaryResource: postTarget.secondaryResource,
      statusSlots:       postTarget.statusSlots.map(s => ({ id: s.id, name: s.name, stacks: s.stacks, duration: s.duration })),
      shieldHp:          engine.sumShieldHp(postTarget.statusSlots),
    },
    isAlly: true,
  }, DICE_RESULT_DISMISS_MS + ANIM_TIMEOUT_MS)

  engine.pendingPlayerTurn = {
    snap,
    actor,
    effectiveTu,
    primaryTarget,
    primaryDamage,
    outcome,
    preStatusSnapshot,
  }

  engine.setStep('player_acting')

  const actorManifest = engine.manifests.get(actor.defId) ?? null
  const actorDamaged  = unitIsDamaged(actor, actorManifest)
  const { isMelee, dashDx, projectile, customSequence } =
    engine.buildAttackAnimConfig(actor.defId, skill.id, skill.tags, actorDamaged)

  engine.cb.onPlayDice(outcome)
  if (engine.attackTimer) clearTimeout(engine.attackTimer)
  engine.pendingAttackCb = () => {
    engine.pendingAttackCb = null
    engine.cb.onPlayAttack(
      actor.defId, primaryTarget.defId, outcome, primaryDamage, isMelee, dashDx,
      projectile, buildOutcomeLabel(outcome), outcomeColour(outcome),
      customSequence,
    )
    if (engine.playerApplyTimer) clearTimeout(engine.playerApplyTimer)
    engine.playerApplyTimer = engine.safeTimeout(() => {
      engine.setStep('player_applying')
      engine.drive()
    }, ANIM_TIMEOUT_MS)
  }
  engine.attackTimer = engine.safeTimeout(engine.pendingAttackCb, DICE_RESULT_DISMISS_MS)
}

export function skipTurn(engine: BattleEngine): void {
  if (engine.step !== 'player_turn') return
  const actor = engine.getActivePlayerUnit()
  if (!actor) return
  if (!isAlive(actor)) {
    engine.unregisterTickInternal(actor.id)
    engine.setStep('advance_tick')
    engine.drive()
    return
  }
  if (engine.narrativePaused || engine.inspectingSkill) return

  const fromTick = actor.tickPosition
  const apFrozen = actor.statusSlots.some(s => s.payload?.freezesApRegen === true)
  const apGained = apFrozen ? 0 : calculateApGained(SKIP_TU_COST, actor.apRegenRate)
  engine.cb.onHistory(makeHistoryEntry(actor.id, actor.defId, actor.name, fromTick, actor.isAlly))
  engine.globalBattleTick += SKIP_TU_COST

  const skipSnap  = makeSnapshot(engine.playerUnits, engine.enemies)
  const skipEntry = skipSnap.get(actor.id) ?? actor
  skipSnap.set(actor.id, incrementActionCount({ ...skipEntry, ap: Math.min(skipEntry.maxAp, skipEntry.ap + apGained) }))
  const { unit: skipTicked, expired: skipExpired } = tickStatusDurations(skipSnap.get(actor.id)!)
  skipSnap.set(actor.id, skipTicked)
  for (const slot of skipExpired) engine.fireExpiryChain(actor.defId, slot.id, skipSnap)
  fireBattleTickIntervalPassives(
    engine.globalBattleTick, skipSnap,
    engine.passiveDefs,
    engine.lastIntervalFire,
    engine.lastIntervalApAccum,
    engine.globalApAccum,
  )

  const snapPlayers = engine.playerUnits
  const snapEnemies = engine.enemies
  engine.playerUnits = engine.playerUnits.map(u => skipSnap.get(u.id) ?? u)
  engine.enemies     = engine.enemies.map(e => skipSnap.get(e.id) ?? e)
  engine.registerTickInternal(actor.id, fromTick + SKIP_TU_COST)

  const skipDeadPlayers = snapPlayers.map(u => skipSnap.get(u.id) ?? u).filter(u => !isAlive(u))
  const skipDeadEnemies = snapEnemies.map(e => skipSnap.get(e.id) ?? e).filter(e => !isAlive(e))
  for (const u of [...skipDeadPlayers, ...skipDeadEnemies]) {
    engine.cb.onNarrativeEmit({ type: 'unit_death', actorId: u.defId })
    engine.unregisterTickInternal(u.id)
  }

  if (snapPlayers.map(u => skipSnap.get(u.id) ?? u).every(u => !isAlive(u))) {
    engine.appendLog({ text: 'Defeat! All allies have been slain.', colour: 'var(--accent-danger)' })
    engine.cb.onNarrativeEmit({ type: 'battle_defeat' })
    engine.endBattle('defeat')
    engine.setStep('battle_over')
    engine.notify()
    return
  }
  if (snapEnemies.map(e => skipSnap.get(e.id) ?? e).every(e => !isAlive(e))) {
    engine.appendLog({ text: 'Victory! All enemies defeated.', colour: 'var(--accent-genesis)' })
    engine.cb.onNarrativeEmit({ type: 'battle_victory' })
    engine.endBattle('victory')
    engine.setStep('battle_over')
    engine.notify()
    return
  }

  engine.appendLog({ text: 'You skipped your turn.' })
  engine.cb.onClearTurn()
  engine.setStep('advance_tick')
  engine.notify()
  engine.drive()
}
