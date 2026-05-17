// SkillInfoOverlay — long-press a skill button to open a centered modal with
// the skill's full description, costs, tags, effects, and cooldown.
//
// Open: tap-out backdrop OR top-right ✕ button to close. While open, the
// battle is silently frozen via BattleContext.inspectingSkill (same gate as
// narrativePaused) so the player can read at leisure.

import { useEffect } from 'react'
import { useScrollAwarePointer } from '../utils/useScrollAwarePointer'
import { getCachedSkill } from '../core/engines/skill/SkillInstance'
import type { SkillInstance, Effect, ValueExpr } from '../core/effects/types'
import styles from './SkillInfoOverlay.module.css'

interface Props {
  skill:    SkillInstance
  onClose:  () => void
}

// Render a ValueExpr as concise human-readable text.
function valueText(v: ValueExpr): string {
  if (typeof v === 'number')            return String(v)
  if ('sum'                in v)        return v.sum.map(valueText).join(' + ')
  if ('secondary'          in v)        return `${v.secondary * 100}% surge`
  if ('globalApSpentPercent' in v)      return `${v.globalApSpentPercent}% AP pool`
  const of = v.of ?? 'caster'
  return `${v.percent}% ${of} ${v.stat}`
}

// One human-readable line per effect. Skips effects with non-onCast triggers
// only when the trigger is the default — otherwise prefix with the trigger.
function effectLine(e: Effect): string {
  const trigger = e.when.event === 'onCast' ? '' : `[${e.when.event}] `
  switch (e.type) {
    case 'damage':            return `${trigger}Damage: ${valueText(e.amount)}${e.damageType ? ` (${e.damageType})` : ''}`
    case 'heal':              return `${trigger}Heal: ${valueText(e.amount)}`
    case 'tickShove':         return `${trigger}Shove tick: ${e.amount > 0 ? '+' : ''}${e.amount}`
    case 'gainAp':            return `${trigger}Gain AP: ${e.amount}`
    case 'spendAp':           return `${trigger}Spend AP: ${e.amount}`
    case 'modifyStat': {
      if (e.deltaPercent !== undefined) return `${trigger}${e.stat} ${e.deltaPercent > 0 ? '+' : ''}${e.deltaPercent}% for ${e.duration} ticks`
      const d = e.delta ?? 0
      return `${trigger}${e.stat} ${d > 0 ? '+' : ''}${d} for ${e.duration} ticks`
    }
    case 'applyStatus':       return `${trigger}Apply ${e.status}${e.duration ? ` (${e.duration}t)` : ''}${e.chance != null ? ` @ ${Math.round(e.chance * 100)}%` : ''}`
    case 'removeStatus':      return `${trigger}Remove ${e.status ?? `status[tag=${e.tag}]`}`
    case 'shiftProbability':  return `${trigger}Shift ${e.outcome} probability ${e.delta > 0 ? '+' : ''}${e.delta}`
    case 'rerollDice':        return `${trigger}Reroll ${e.outcome ?? 'any'} (${e.uses} use${e.uses === 1 ? '' : 's'}${e.perBattle ? ', per battle' : ''})`
    case 'forceOutcome':      return `${trigger}Force outcome: ${e.outcome}`
    case 'triggerSkill':      return `${trigger}Trigger skill: ${e.skillId}${e.ignoreCost ? ' (free)' : ''}`
    case 'secondaryResource': {
      if (e.set !== undefined) return `${trigger}Reset surge to ${e.set}`
      if (Array.isArray(e.delta)) return `${trigger}Surge +${e.delta[0]}–${e.delta[1]}`
      return `${trigger}Surge ${(e.delta ?? 0) >= 0 ? '+' : ''}${e.delta ?? 0}`
    }
    case 'resetApAccum':     return `${trigger}Reset AP accumulator`
    default:                 return ''
  }
}

export function SkillInfoOverlay({ skill, onClose }: Props) {
  const createHandler = useScrollAwarePointer()
  const def = getCachedSkill(skill)

  // Esc closes the overlay (desktop affordance — mobile uses tap-out / ✕).
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  return (
    <div
      className={styles.backdrop}
      onPointerDown={createHandler({ onTap: onClose })}
    >
      <div
        className={styles.card}
        // Stop propagation on the card so taps inside don't dismiss.
        onPointerDown={(e) => e.stopPropagation()}
      >
        <button
          className={styles.closeBtn}
          onPointerDown={createHandler({ onTap: onClose })}
          aria-label="Close skill info"
        >
          ✕
        </button>

        <header className={styles.header}>
          <span className={styles.name}>{def.name}</span>
          <span className={styles.level}>Lv {skill.currentLevel} / {def.maxLevel}</span>
        </header>

        {def.description && (
          <p className={styles.description}>{def.description}</p>
        )}

        <div className={styles.statRow}>
          <span className={styles.statChip}>
            <span className={styles.statLabel}>TU</span>
            <span className={styles.statValue}>{skill.cachedCosts.tuCost}</span>
          </span>
          <span className={styles.statChip}>
            <span className={styles.statLabel}>AP</span>
            <span className={styles.statValue}>{skill.cachedCosts.apCost}</span>
          </span>
          <span className={styles.statChip}>
            <span className={styles.statLabel}>Range</span>
            <span className={styles.statValue}>{def.targeting.range}</span>
          </span>
          <span className={styles.statChip}>
            <span className={styles.statLabel}>Target</span>
            <span className={styles.statValue}>
              {typeof def.targeting.selector === 'string' ? def.targeting.selector : `tag:${def.targeting.selector.tag}`}
            </span>
          </span>
        </div>

        {def.tags.length > 0 && (
          <div className={styles.tagRow}>
            {def.tags.map((t) => (
              <span key={t} className={styles.tag}>{t}</span>
            ))}
          </div>
        )}

        {(def.tickCooldown != null || def.turnCooldown != null) && (
          <div className={styles.cooldownRow}>
            {def.tickCooldown != null && (
              <span className={styles.cooldownChip}>⏳ {def.tickCooldown} tick{def.tickCooldown === 1 ? '' : 's'}</span>
            )}
            {def.turnCooldown != null && (
              <span className={`${styles.cooldownChip} ${styles.cooldownChipTurn}`}>↻ {def.turnCooldown} turn{def.turnCooldown === 1 ? '' : 's'}</span>
            )}
          </div>
        )}

        {def.resolution && (
          <div className={styles.section}>
            <span className={styles.sectionTitle}>Resolution</span>
            <span className={styles.sectionLine}>
              Base chance: {Math.round(def.resolution.baseChance * 100)}%
            </span>
          </div>
        )}

        {skill.cachedEffects.length > 0 && (
          <div className={styles.section}>
            <span className={styles.sectionTitle}>Effects</span>
            <ul className={styles.effectList}>
              {skill.cachedEffects.map((e, i) => (
                <li key={i} className={styles.effectLine}>{effectLine(e)}</li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </div>
  )
}
