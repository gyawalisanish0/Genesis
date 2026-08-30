// Step: enemy_telegraph — picks the next active AI unit, previews its action,
// then resolves the attack and hands off to enemy_applying.

import type { BattleEngine } from './BattleEngine'
import {
  DICE_RESULT_DISMISS_MS, ANIM_TIMEOUT_MS, BETWEEN_TURN_PAUSE_MS,
  AI_THINKING_MIN_MS, AI_THINKING_MAX_MS, AI_INPUT_MIN_MS, AI_INPUT_MAX_MS,
} from '../constants'
import { isAlive }                   from '../unit'
import { applyCooldown }             from '../combat/CooldownResolver'
import { getCachedSkill }            from '../engines/skill/SkillInstance'
import { makeSnapshot }              from './BattleSnapshot'
import { getEffectiveTuCost }        from './BattleDamage'
import { unitIsDamaged, outcomeColour, buildOutcomeLabel } from './BattleResolution'
import { computeAITurn }             from './BattleAIRunner'
import { runAttack }                 from './BattleAttackResolver'
import { fireAITurnStart, handleAISkip } from './BattleAITurnHelpers'

const randomMs = (min: number, max: number): number =>
  min + Math.floor(Math.random() * (max - min + 1))

export function runEnemyTelegraph(engine: BattleEngine): void {
  const current    = engine.tickValue
  const ticks      = engine.registeredTicks
  const controlled = engine.controlledIds
  const players    = engine.playerUnits
  const foes       = engine.enemies

  const activeIds = new Set<string>()
  for (const [id, tick] of ticks) {
    if (tick === current) activeIds.add(id)
  }

  const activeAIAllies = players.filter(u => activeIds.has(u.id) && !controlled.has(u.id) && isAlive(u))
  const activeEnemies  = foes.filter(e => activeIds.has(e.id) && isAlive(e))
  const allAIUnits     = [...activeAIAllies, ...activeEnemies].sort((a, b) => b.stats.speed - a.stats.speed)

  if (!allAIUnits.length) {
    for (const id of activeIds) {
      const deadInPlayers = players.find(u => u.id === id && !isAlive(u))
      const deadInFoes    = foes.find(e => e.id === id && !isAlive(e))
      if (deadInPlayers ?? deadInFoes) engine.unregisterTickInternal(id)
    }
    engine.setStep('advance_tick')
    engine.notify()
    engine.drive()
    return
  }

  // Fire onUnitTurnStart effects — may kill units before they act.
  if (fireAITurnStart(engine, allAIUnits, players, foes, current) !== 'ok') return

  const firstAIUnit = allAIUnits[0]
  const remainingDice = engine.diceActive
    ? Math.max(0, DICE_RESULT_DISMISS_MS - (Date.now() - engine.diceShowTime))
    : 0

  // Pre-check to use short delay for skip/no_targets.
  const preCheckUnit   = (firstAIUnit.isAlly ? engine.playerUnits : engine.enemies)
    .find(u => u.id === firstAIUnit.id) ?? firstAIUnit
  const preCheckSkills = engine.unitSkillsMap.get(firstAIUnit.id) ?? []
  const preCheckResult = computeAITurn(preCheckUnit, preCheckSkills, engine.playerUnits, engine.enemies)
  const thinkDelay     = preCheckResult.type === 'attack'
    ? randomMs(AI_THINKING_MIN_MS, AI_THINKING_MAX_MS)
    : BETWEEN_TURN_PAUSE_MS

  engine.setStep('enemy_acting')
  engine.notify()

  engine.telegraphTimer = engine.safeTimeout(() => {
    if (engine.step !== 'enemy_acting') return
    const thinkPlayers = engine.playerUnits
    const thinkEnemies = engine.enemies

    const freshAIUnit = (firstAIUnit.isAlly ? thinkPlayers : thinkEnemies)
      .find(u => u.id === firstAIUnit.id) ?? firstAIUnit
    const freshSkills = engine.unitSkillsMap.get(firstAIUnit.id) ?? []
    const result      = computeAITurn(freshAIUnit, freshSkills, thinkPlayers, thinkEnemies)

    if (result.type === 'skip') {
      handleAISkip(engine, firstAIUnit, freshAIUnit, thinkPlayers, thinkEnemies, 'gathering strength')
      return
    }

    if (result.type === 'no_targets') {
      handleAISkip(engine, firstAIUnit, freshAIUnit, thinkPlayers, thinkEnemies, 'no valid targets')
      return
    }

    const { skillInst, target, allTargets } = result
    const skill    = getCachedSkill(skillInst)
    const actingMf = engine.manifests.get(firstAIUnit.defId) ?? null
    const targetMf = engine.manifests.get(target.defId) ?? null

    engine.cb.onSetTurnState(freshAIUnit.defId, target.defId, actingMf, targetMf, {
      acting: unitIsDamaged(freshAIUnit, actingMf),
      target: unitIsDamaged(target, targetMf),
    })

    const inputMs = randomMs(AI_INPUT_MIN_MS, AI_INPUT_MAX_MS)

    engine.showTurnDisplay(
      {
        actor: {
          name:              freshAIUnit.name,
          className:         freshAIUnit.className,
          rarity:            freshAIUnit.rarity,
          hp:                freshAIUnit.hp,
          maxHp:             freshAIUnit.maxHp,
          ap:                freshAIUnit.ap,
          maxAp:             freshAIUnit.maxAp,
          secondaryResource: freshAIUnit.secondaryResource,
          statusSlots:       freshAIUnit.statusSlots.map(s => ({ id: s.id, name: s.name, stacks: s.stacks, duration: s.duration })),
          shieldHp:          engine.sumShieldHp(freshAIUnit.statusSlots),
        },
        skillName:  skill.name,
        tuCost:     skill.tuCost,
        apCost:     skill.apCost,
        skillLevel: skillInst.currentLevel,
        target: {
          name:              target.name,
          className:         target.className,
          rarity:            target.rarity,
          hp:                target.hp,
          maxHp:             target.maxHp,
          ap:                target.ap,
          maxAp:             target.maxAp,
          secondaryResource: target.secondaryResource,
          statusSlots:       target.statusSlots.map(s => ({ id: s.id, name: s.name, stacks: s.stacks, duration: s.duration })),
          shieldHp:          engine.sumShieldHp(target.statusSlots),
        },
        isAlly: freshAIUnit.isAlly,
      },
      inputMs + DICE_RESULT_DISMISS_MS + ANIM_TIMEOUT_MS,
    )

    if (engine.applyTimer) clearTimeout(engine.applyTimer)
    engine.applyTimer = engine.safeTimeout(() => {
      if (engine.step !== 'enemy_acting') return
      const execPlayers = engine.playerUnits
      const execEnemies = engine.enemies
      const snap               = makeSnapshot(execPlayers, execEnemies)
      const preStatusSnapshot  = new Map(
        [...snap].map(([uid, u]) => [uid, new Set(u.statusSlots.map(s => s.id))])
      )
      const thisTick = engine.tickValue

      engine.applySkillAPCost(firstAIUnit.id, skill.apCost, snap, thisTick)

      const { outcome, damage: primaryDamage } = runAttack(engine, freshAIUnit, target, skillInst, snap)

      if (allTargets.length > 1) {
        engine.applySplashEffects(freshAIUnit, skillInst, allTargets.slice(1), snap, outcome, thisTick)
      }

      const withCooldown = applyCooldown(freshAIUnit, skillInst, skill)
      const updatedMap = new Map(engine.unitSkillsMap)
      const aiSkills = updatedMap.get(firstAIUnit.id) ?? []
      updatedMap.set(firstAIUnit.id, aiSkills.map(s => s.defId === skillInst.defId ? withCooldown : s))
      engine.unitSkillsMap = updatedMap

      const aiEffectiveTu = getEffectiveTuCost(skill.tuCost, snap.get(firstAIUnit.id) ?? freshAIUnit)

      engine.pendingAITurn = {
        aiUnit:            freshAIUnit,
        snap,
        effectiveTu:       aiEffectiveTu,
        primaryTarget:     target,
        primaryDamage,
        outcome,
        isAlly:            freshAIUnit.isAlly,
        preStatusSnapshot,
      }
      engine.notify()

      const aiManifest = engine.manifests.get(firstAIUnit.defId) ?? null
      const aiDamaged  = unitIsDamaged(freshAIUnit, aiManifest)
      const { isMelee: aiIsMelee, dashDx: aiDashDx, projectile: aiProjectile, customSequence: aiSequence } =
        engine.buildAttackAnimConfig(firstAIUnit.defId, skill.id, skill.tags, aiDamaged)

      engine.cb.onPlayDice(outcome)
      if (engine.attackTimer) clearTimeout(engine.attackTimer)
      engine.pendingAttackCb = () => {
        engine.pendingAttackCb = null
        engine.cb.onPlayAttack(
          freshAIUnit.defId, target.defId, outcome, primaryDamage, aiIsMelee, aiDashDx,
          aiProjectile, buildOutcomeLabel(outcome), outcomeColour(outcome),
          aiSequence,
        )
        if (engine.applyTimer) clearTimeout(engine.applyTimer)
        engine.applyTimer = engine.safeTimeout(() => {
          if (engine.step === 'enemy_acting') {
            engine.setStep('enemy_applying')
            engine.notify()
            engine.drive()
          }
        }, ANIM_TIMEOUT_MS)
      }
      engine.attackTimer = engine.safeTimeout(engine.pendingAttackCb, DICE_RESULT_DISMISS_MS)
    }, inputMs)

  }, remainingDice + thinkDelay)
}
