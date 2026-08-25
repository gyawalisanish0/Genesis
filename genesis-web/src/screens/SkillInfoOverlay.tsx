// SkillInfoOverlay — long-press a skill button to see its full description,
// costs, tags, effects, and cooldown. Chrome (backdrop, dismissal, animation)
// is the shared Sheet; this file owns the skill-specific content.
//
// While open, the battle is silently frozen via BattleContext.inspectingSkill
// (set/cleared by the caller, same gate as narrativePaused).

import { getCachedSkill } from '../core/engines/skill/SkillInstance'
import type { SkillInstance } from '../core/effects/types'
import { effectLine } from './skillEffectText'
import { Sheet } from '../components/Sheet'
import styles from './SkillInfoOverlay.module.css'

interface Props {
  skill:    SkillInstance
  onClose:  () => void
}

// Render a ValueExpr as concise human-readable text.

export function SkillInfoOverlay({ skill, onClose }: Props) {
  const def = getCachedSkill(skill)

  return (
    <Sheet placement="centre" onClose={onClose} accent="var(--accent-genesis)">
      <div className={styles.body}>
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
    </Sheet>
  )
}
