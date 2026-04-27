// Splash / loading screen.
// Loads real game data via DataService, shows progress, then navigates.
// In a plain browser tab: holds navigation until user taps (fires fullscreen gate).
// In Capacitor / PWA standalone: auto-navigates after 400ms as before.

import { useEffect, useState } from 'react'
import { Capacitor } from '@capacitor/core'
import { ScreenShell } from '../navigation/ScreenShell'
import { useScreen } from '../navigation/useScreen'
import { SCREEN_IDS } from '../navigation/screenRegistry'
import {
  loadCharacterIndex, loadCharacter, loadMode,
  loadCharacterDialogue, loadLevelNarrative,
} from '../services/DataService'
import { NarrativeService }  from '../services/NarrativeService'
import { ResolutionService } from '../services/ResolutionService'
import styles from './SplashScreen.module.css'

const APP_VERSION = '0.1.0'

async function loadAllGameData(onProgress: (pct: number) => void): Promise<void> {
  onProgress(10)
  const ids = await loadCharacterIndex()
  onProgress(30)
  await Promise.all(ids.map(loadCharacter))
  onProgress(60)
  await Promise.all([loadMode('story'), loadMode('ranked')])
  onProgress(80)

  // Load all character dialogue and known level narratives; register globally.
  const [dialogueDefs, storyNarrative] = await Promise.all([
    Promise.all(ids.map(loadCharacterDialogue)),
    loadLevelNarrative('story_001'),
  ])
  const characterEntries = dialogueDefs.flatMap((d) => d?.entries ?? [])
  NarrativeService.registerEntries('characters', characterEntries)
  if (storyNarrative) NarrativeService.registerEntries('story_001', storyNarrative.entries)

  onProgress(100)
}

// Returns true only when running as a plain browser tab (not Capacitor, not PWA standalone).
// These contexts already provide fullscreen-like environments so no tap gate is needed.
function isBrowserTab(): boolean {
  if (Capacitor.isNativePlatform()) return false
  if (window.matchMedia('(display-mode: standalone)').matches) return false
  if (window.matchMedia('(display-mode: fullscreen)').matches) return false
  return true
}

export function SplashScreen() {
  const { navigateTo } = useScreen()
  const [progress, setProgress] = useState(0)
  const [error, setError] = useState<string | null>(null)
  const [done, setDone] = useState(false)
  const [readyToEnter, setReadyToEnter] = useState(false)

  useEffect(() => {
    Promise.all([
      loadAllGameData(setProgress),
      ResolutionService.detectTier(),
    ])
      .then(() => {
        setDone(true)
        if (isBrowserTab()) {
          // Hold navigation — first tap fires requestFullscreen (via DisplayService listener)
          // then navigates to main menu on the same gesture.
          setReadyToEnter(true)
        } else {
          setTimeout(() => navigateTo(SCREEN_IDS.MAIN_MENU), 400)
        }
      })
      .catch((err: unknown) => {
        setError(err instanceof Error ? err.message : 'Load failed')
        // Still apply a tier in case the benchmark completed before the data error.
      })
  }, [navigateTo])

  return (
    <ScreenShell>
      <div
        className={styles.root}
        onPointerDown={readyToEnter ? () => navigateTo(SCREEN_IDS.MAIN_MENU) : undefined}
      >
        <div className={styles.stars} aria-hidden />

        <div className={styles.logoZone}>
          <div className={`${styles.logoMark} ${done ? styles.logoDone : ''}`}>G</div>
          <h1 className={styles.title}>G E N E S I S</h1>
          <p className={styles.tagline}>
            {error
              ? <span className={styles.errorText}>{error} — tap to retry</span>
              : 'Turn-based tactical combat'
            }
          </p>
        </div>

        <div className={styles.progressZone}>
          <div className={styles.barTrack}>
            <div className={styles.barFill} style={{ width: `${progress}%` }} />
          </div>
          <span className={styles.progressLabel}>{progress}%</span>
        </div>

        {readyToEnter && (
          <p className={styles.tapPrompt}>TAP ANYWHERE TO ENTER</p>
        )}

        <footer className={styles.footer}>
          v{APP_VERSION} · © Genesis
        </footer>
      </div>
    </ScreenShell>
  )
}
