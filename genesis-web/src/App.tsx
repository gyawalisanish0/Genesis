import { useEffect }                                        from 'react'
import { HashRouter, Routes, Route, Navigate }             from 'react-router-dom'
import { ScreenProvider }                                  from './navigation/ScreenContext'
import { useViewportScale }                                from './utils/useViewportScale'
import { initFullScreen }                                  from './services/DisplayService'

import { NarrativeLayer }     from './components/NarrativeLayer'
import { SplashScreen }       from './screens/SplashScreen'
import { MainMenuScreen }     from './screens/MainMenuScreen'
import { RosterScreen }       from './screens/RosterScreen'
import { PreBattleScreen }    from './screens/PreBattleScreen'
import { BattleScreen }       from './screens/BattleScreen'
import { BattleResultScreen } from './screens/BattleResultScreen'
import { SettingsScreen }     from './screens/SettingsScreen'
import styles from './App.module.css'

export default function App() {
  const { scale, innerHeight } = useViewportScale()

  useEffect(() => {
    initFullScreen().catch(() => {})
  }, [])

  // Expose scale to CSS so safe-area vars can self-correct (tokens.css divides env() by --app-scale).
  useEffect(() => {
    document.documentElement.style.setProperty('--app-scale', String(scale))
  }, [scale])

  return (
    <div className={styles.viewport}>
      <div
        className={styles.viewportInner}
        style={{
          width:     '360px',
          height:    `${innerHeight}px`,
          transform: `scale(${scale})`,
        } as React.CSSProperties}
      >
        <HashRouter>
          <ScreenProvider>
            <NarrativeLayer />
            <Routes>
              <Route path="/"              element={<Navigate to="/splash" replace />} />
              <Route path="/splash"        element={<SplashScreen />} />
              <Route path="/main-menu"     element={<MainMenuScreen />} />
              <Route path="/roster"        element={<RosterScreen />} />
              <Route path="/pre-battle"    element={<PreBattleScreen />} />
              <Route path="/battle"        element={<BattleScreen />} />
              <Route path="/battle-result" element={<BattleResultScreen />} />
              <Route path="/settings"      element={<SettingsScreen />} />
              <Route path="*"              element={<Navigate to="/splash" replace />} />
            </Routes>
          </ScreenProvider>
        </HashRouter>
      </div>
    </div>
  )
}
