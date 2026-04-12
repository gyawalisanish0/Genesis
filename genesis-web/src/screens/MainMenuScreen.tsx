// Main Menu hub — entry point for all game modes and navigation.

import { useState } from 'react'
import { App as CapApp } from '@capacitor/app'
import { ScreenShell } from '../navigation/ScreenShell'
import { useScreen } from '../navigation/useScreen'
import { SCREEN_IDS } from '../navigation/screenRegistry'
import { useBackButton } from '../input/useBackButton'
import styles from './MainMenuScreen.module.css'

export function MainMenuScreen() {
  const { navigateTo } = useScreen()
  const [showQuitConfirm, setShowQuitConfirm] = useState(false)
  useBackButton(() => setShowQuitConfirm(true))

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
              onPointerDown={() => navigateTo(SCREEN_IDS.SETTINGS)}
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
            onPointerDown={() => navigateTo(SCREEN_IDS.PRE_BATTLE)}
          >
            ▶  PLAY
          </button>

          <button
            className={`${styles.navBtn} ${styles.navBtnSecondary}`}
            onPointerDown={() => navigateTo(SCREEN_IDS.ROSTER)}
          >
            ROSTER
          </button>

          <button
            className={`${styles.navBtn} ${styles.navBtnSecondary}`}
            onPointerDown={() => {}}
          >
            MASTERY ROAD
          </button>

          <div className={styles.navRow}>
            <button
              className={`${styles.navBtn} ${styles.navBtnCard}`}
              onPointerDown={() => navigateTo(SCREEN_IDS.SETTINGS)}
            >
              SETTINGS
            </button>
            <button
              className={`${styles.navBtn} ${styles.navBtnCard}`}
              onPointerDown={() => {}}
            >
              💎 SHOP
            </button>
          </div>
        </nav>

      </div>
      {showQuitConfirm && (
        <div className={styles.overlay}>
          <div className={styles.dialog}>
            <span className={styles.dialogTitle}>Quit Game?</span>
            <div className={styles.dialogActions}>
              <button className={styles.dialogBtn} onPointerDown={() => setShowQuitConfirm(false)}>CANCEL</button>
              <button className={`${styles.dialogBtn} ${styles.dialogBtnQuit}`} onPointerDown={() => CapApp.exitApp()}>QUIT</button>
            </div>
          </div>
        </div>
      )}
    </ScreenShell>
  )
}
