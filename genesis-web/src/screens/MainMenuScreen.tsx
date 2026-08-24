// Main Menu hub — entry point for all game modes and navigation.

import { useState } from 'react'
import { App as CapApp } from '@capacitor/app'
import { ScreenShell } from '../navigation/ScreenShell'
import { useScreen } from '../navigation/useScreen'
import { SCREEN_IDS } from '../navigation/screenRegistry'
import { useBackButton } from '../input/useBackButton'
import { useScrollAwarePointer } from '../utils/useScrollAwarePointer'
import { PromptOverlay } from '../components/PromptOverlay'
import { Toaster } from '../components/Toaster'
import styles from './MainMenuScreen.module.css'

export function MainMenuScreen() {
  const { navigateTo } = useScreen()
  const [showQuitConfirm, setShowQuitConfirm] = useState(false)
  // Mastery Road and the Shop are designed but unbuilt (docs/ui/02-screens.md
  // lists neither as having a route). Saying so beats a button that silently
  // does nothing, which reads as the game being broken.
  const [notYet, setNotYet] = useState<string | null>(null)
  useBackButton(() => setShowQuitConfirm(true))
  const createHandler = useScrollAwarePointer()

  return (
    <ScreenShell>
      <div className={styles.root}>

        {/* Header bar */}
        <header className={styles.header}>
          <span className={styles.levelBadge}>Lv 1</span>
          <span className={styles.wordmark}>GENESIS</span>
          <div className={styles.headerRight}>
            <span className={styles.currencyChip}>💎 0</span>
            <button
              className={styles.iconBtn}
              onPointerDown={createHandler({ onTap: () => navigateTo(SCREEN_IDS.SETTINGS) })}
              aria-label="Settings"
            >⚙</button>
          </div>
        </header>

        {/* Hero zone */}
        <div className={styles.heroZone}>
          <div className={styles.heroGlow} aria-hidden />
          <div className={styles.heroArt}>
            <span className={styles.heroInitial}>G</span>
          </div>
          <span className={styles.universeBadge}>Genesis Universe</span>
        </div>

        {/* Navigation buttons */}
        <nav className={styles.nav}>
          <button
            className={`${styles.navBtn} ${styles.navBtnPlay}`}
            onPointerDown={createHandler({ onTap: () => navigateTo(SCREEN_IDS.CAMPAIGN) })}
          >
            ▶  PLAY
          </button>

          <button
            className={`${styles.navBtn} ${styles.navBtnSecondary}`}
            onPointerDown={createHandler({ onTap: () => navigateTo(SCREEN_IDS.ROSTER) })}
          >
            ROSTER
          </button>

          <button
            className={`${styles.navBtn} ${styles.navBtnSecondary} ${styles.navBtnLocked}`}
            onPointerDown={createHandler({ onTap: () => setNotYet('Mastery Road') })}
          >
            MASTERY ROAD
          </button>

          <div className={styles.navRow}>
            <button
              className={`${styles.navBtn} ${styles.navBtnCard}`}
              onPointerDown={createHandler({ onTap: () => navigateTo(SCREEN_IDS.SETTINGS) })}
            >
              SETTINGS
            </button>
            <button
              className={`${styles.navBtn} ${styles.navBtnCard} ${styles.navBtnLocked}`}
              onPointerDown={createHandler({ onTap: () => setNotYet('The Shop') })}
            >
              💎 SHOP
            </button>
          </div>
        </nav>

      </div>
      {showQuitConfirm && (
        <PromptOverlay
          title="QUIT GAME?"
          actions={[
            { label: 'CANCEL', variant: 'secondary', onPress: () => setShowQuitConfirm(false) },
            { label: 'QUIT',   variant: 'danger',    onPress: () => CapApp.exitApp() },
          ]}
        />
      )}
      <Toaster
        key={notYet}
        message={notYet ? `${notYet} is not in this build yet.` : null}
        onDismiss={() => setNotYet(null)}
      />
    </ScreenShell>
  )
}
