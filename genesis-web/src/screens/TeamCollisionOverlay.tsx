// Same-team collision prompt: Now/Later choice for speed-tied allied units.
// Rendered when pendingTeamCollision is set in BattleContext.
// Player chooses for each unit sequentially. "Later" units advance +1 tick
// (displacement check applied via registerTick in resolveTeamCollision).
//
// Chrome (backdrop, card, title, actions) is the shared PromptOverlay.

import { useState } from 'react'
import { useBattleScreen } from './BattleContext'
import { PromptOverlay } from '../components/PromptOverlay'
import styles from './TeamCollisionOverlay.module.css'

export function TeamCollisionOverlay() {
  const { pendingTeamCollision, resolveTeamCollision } = useBattleScreen()

  // Index of the unit currently being decided (0 = first, 1 = second, …).
  const [decisionIndex, setDecisionIndex] = useState(0)
  const [choices, setChoices] = useState<Map<string, 'now' | 'later'>>(new Map())

  if (!pendingTeamCollision) return null

  const { units } = pendingTeamCollision
  const currentUnit = units[decisionIndex]

  function handleChoice(choice: 'now' | 'later') {
    if (!currentUnit) return
    const updated = new Map(choices).set(currentUnit.id, choice)
    setChoices(updated)

    if (decisionIndex + 1 >= units.length) {
      // All decisions collected — resolve.
      resolveTeamCollision(updated)
      setDecisionIndex(0)
      setChoices(new Map())
    } else {
      setDecisionIndex((i) => i + 1)
    }
  }

  return (
    <PromptOverlay
      title="SIMULTANEOUS TURN"
      subtitle={`${decisionIndex + 1} of ${units.length}`}
      actions={[
        { label: 'NOW',   variant: 'primary',   onPress: () => handleChoice('now') },
        { label: 'LATER', variant: 'secondary', onPress: () => handleChoice('later') },
      ]}
    >
      <div className={styles.portrait}>
        {currentUnit.name.charAt(0).toUpperCase()}
      </div>
      <span className={styles.unitName}>{currentUnit.name}</span>
      <span className={styles.unitMeta}>
        {currentUnit.className} · {'★'.repeat(currentUnit.rarity)}
      </span>
      <p className={styles.prompt}>Act now or wait one tick?</p>
    </PromptOverlay>
  )
}
