// Fleet Update — the moment units join the Commander's fleet.
//
// This screen is the SYSTEMS half of the demo's ending. The narrative half —
// the tutorial beats, the dialogue, and how Tara's departure is handled — is an
// authored ending scene that plays before this. So there is deliberately no
// character voice, no farewell, and no commentary here: this screen reports a
// roster change, and anything that needs saying has already been said.
//
// Units arrive one at a time rather than as a list. A list is a receipt; an
// arrival is an event, and this is the event the demo exists to deliver.

import { useEffect, useState } from 'react'
import { ScreenShell }  from '../navigation/ScreenShell'
import { useScreen }    from '../navigation/useScreen'
import { SCREEN_IDS }   from '../navigation/screenRegistry'
import { useGameStore } from '../core/GameContext'
import { useRosterData } from '../hooks/useRosterData'
import { UnitPortrait } from '../components/UnitPortrait'
import { PixelButton }  from '../components/PixelButton'
import { UNLOCK_ARRIVAL_STAGGER_MS } from '../core/constants'
import styles from './UnlockScreen.module.css'

export function UnlockScreen() {
  const { navigateTo } = useScreen()
  const fleet     = useGameStore((s) => s.fleet)
  const orgName   = useGameStore((s) => s.organisationName)
  const { characters } = useRosterData()

  // Reveal one recruit per tick. The count drives CSS, so a recruit that has
  // not "arrived" is absent rather than hidden — no layout shift on arrival.
  const [arrived, setArrived] = useState(0)

  const recruits = fleet.recruitedIds
    .map((id) => characters.find((c) => c.id === id))
    .filter((c): c is NonNullable<typeof c> => !!c)

  useEffect(() => {
    if (arrived >= recruits.length) return
    const t = setTimeout(() => setArrived((n) => n + 1), UNLOCK_ARRIVAL_STAGGER_MS)
    return () => clearTimeout(t)
  }, [arrived, recruits.length])

  const allArrived = recruits.length > 0 && arrived >= recruits.length

  return (
    <ScreenShell>
      <div className={styles.root}>
        <header className={styles.header}>
          <p className={styles.eyebrow}>FLEET UPDATE</p>
          <h1 className={styles.title}>PERSONNEL ASSIGNED</h1>
          {orgName && <p className={styles.org}>{orgName}</p>}
        </header>

        <div className={styles.roster}>
          {recruits.slice(0, arrived).map((c) => (
            <div key={c.id} className={styles.recruit}>
              <UnitPortrait name={c.name} rarity={c.rarity} defId={c.id} size="md" />
              <div className={styles.recruitInfo}>
                <span className={styles.recruitName}>{c.name}</span>
                <span className={styles.recruitClass}>{c.className}</span>
              </div>
              <span className={styles.recruitStatus}>ASSIGNED</span>
            </div>
          ))}
        </div>

        {/* Held back until every arrival has landed, so the beat cannot be
            skipped past before it has happened. */}
        <div className={styles.actions}>
          {allArrived && (
            <PixelButton onPress={() => navigateTo(SCREEN_IDS.COMING_SOON)}>
              ACKNOWLEDGE
            </PixelButton>
          )}
        </div>
      </div>
    </ScreenShell>
  )
}
