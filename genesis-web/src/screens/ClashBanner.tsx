// ClashBanner — who won the tick, and what winning actually means.
//
// The engine already logs the winner and both faction average speeds, but only
// as a log line shown for CLASH_ANNOUNCE_MS behind the BATTLE LOG button — a
// panel nobody opens mid-clash. This surfaces the line the engine already
// wrote, and adds the rule that is easiest to get wrong.

import { useBattleScreen } from './BattleContext'
import styles from './ClashBanner.module.css'

export function ClashBanner() {
  const { battleStep, log } = useBattleScreen()
  if (battleStep !== 'clash_announcing') return null

  // The clash line is whatever the engine appended immediately before entering
  // this step, so the banner never restates the maths and cannot drift from it.
  const entry = [...log].reverse().find(e => e.text.startsWith('CLASH'))
  if (!entry) return null

  return (
    <div className={styles.banner} role="status">
      <span className={styles.title}>CLASH</span>
      <span className={styles.detail} style={{ color: entry.colour }}>
        {entry.text.replace(/^CLASH — /, '')}
      </span>
      {/* The rule players consistently misread: losing the clash costs order,
          not the turn. docs/mechanics/timeline-collisions.md § Loser placement. */}
      <span className={styles.rule}>Both sides still act this tick</span>
    </div>
  )
}
