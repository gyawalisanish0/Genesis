// Splash / loading screen.
// Loads game data in the background, shows progress, then auto-navigates.

import { useEffect, useState } from 'react'
import { ScreenShell } from '../navigation/ScreenShell'
import { useScreen } from '../navigation/useScreen'
import { SCREEN_IDS } from '../navigation/screenRegistry'
import styles from './SplashScreen.module.css'

const APP_VERSION = '0.1.0'

// Simulates DataService.loadAll() — replace with real implementation when ready.
async function simulateLoad(onProgress: (pct: number) => void): Promise<void> {
  const steps = [20, 45, 65, 80, 95, 100]
  for (const pct of steps) {
    await new Promise<void>((res) => setTimeout(res, 250))
    onProgress(pct)
  }
}

export function SplashScreen() {
  const { navigateTo } = useScreen()
  const [progress, setProgress] = useState(0)
  const [error, setError] = useState<string | null>(null)
  const [done, setDone] = useState(false)

  useEffect(() => {
    simulateLoad(setProgress)
      .then(() => {
        setDone(true)
        setTimeout(() => navigateTo(SCREEN_IDS.MAIN_MENU), 400)
      })
      .catch((err: unknown) => {
        setError(err instanceof Error ? err.message : 'Load failed')
      })
  }, [navigateTo])

  return (
    <ScreenShell>
      <div className={styles.root}>
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

        <footer className={styles.footer}>
          v{APP_VERSION} · © Genesis
        </footer>
      </div>
    </ScreenShell>
  )
}
