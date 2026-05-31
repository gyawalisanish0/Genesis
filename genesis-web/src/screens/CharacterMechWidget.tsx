// Character-specific mechanic widget — sits below the portrait panel in the battle HUD.
// Each character's unique resource/mechanic is rendered here based on unit.defId.
// Only the player's party leader is ever shown.

import { useBattleScreen } from './BattleContext'
import type { Unit }       from '../core/types'
import styles              from './CharacterMechWidget.module.css'

export function CharacterMechWidget() {
  const { leader, hyperSenseModeActive } = useBattleScreen()
  if (!leader) return null

  if (leader.defId === 'hugo_001') {
    return <HugoMechWidget unit={leader} hyperSenseModeActive={hyperSenseModeActive} />
  }

  return null
}

// ── Hugo — Primal Awareness pips + Hyper state badge + Shield HP ─────────────

const PRIMAL_MAX = 5

function HugoMechWidget({
  unit,
  hyperSenseModeActive,
}: {
  unit:                 Unit
  hyperSenseModeActive: boolean
}) {
  const primalSlot   = unit.statusSlots.find(s => s.id === 'hugo_001_primal_awareness_dodge')
  const primalStacks = primalSlot?.stacks ?? 0

  const hyperActive = unit.statusSlots.some(s => s.id === 'hugo_001_hyper_sense_hyper_active')
  const hyperReady  = hyperSenseModeActive && !hyperActive

  const shieldHp = unit.statusSlots.reduce((sum, s) => {
    const hp = s.payload?.shieldHp
    return typeof hp === 'number' ? sum + hp : sum
  }, 0)

  if (!primalSlot && shieldHp === 0) return null

  return (
    <div className={styles.widget}>
      {primalSlot && (
        <div className={`${styles.mechRow} ${hyperActive ? styles.mechRowHyper : ''}`}>
          <span className={styles.mechLabel}>PRIMAL</span>
          <PipRow stacks={primalStacks} max={PRIMAL_MAX} hyper={hyperActive} />
          <span className={styles.mechCount}>{primalStacks}/{PRIMAL_MAX}</span>
        </div>
      )}

      {hyperActive && (
        <div className={`${styles.hyperBadge} ${styles.hyperBadgeActive}`}>
          ⚡ HYPER ACTIVE
        </div>
      )}
      {hyperReady && !hyperActive && (
        <div className={`${styles.hyperBadge} ${styles.hyperBadgeReady}`}>
          ⚡ HYPER READY
        </div>
      )}

      {shieldHp > 0 && (
        <div className={styles.mechRow}>
          <span className={styles.mechLabel}>SHELL</span>
          <span className={styles.shieldBar}>
            <span
              className={styles.shieldFill}
              style={{ width: `${Math.min(1, shieldHp / unit.maxHp) * 100}%` }}
            />
          </span>
          <span className={styles.shieldHp}>{shieldHp}</span>
        </div>
      )}
    </div>
  )
}

function PipRow({ stacks, max, hyper }: { stacks: number; max: number; hyper: boolean }) {
  return (
    <div className={styles.pipRow}>
      {Array.from({ length: max }, (_, i) => (
        <div
          key={i}
          className={[
            styles.pip,
            i < stacks
              ? (hyper ? styles.pipHyper : styles.pipFilled)
              : styles.pipEmpty,
          ].join(' ')}
        />
      ))}
    </div>
  )
}
