import { HashRouter, Routes, Route, Navigate } from 'react-router-dom'
import { ScreenProvider } from './navigation/ScreenContext'

import { SplashScreen }       from './screens/SplashScreen'
import { MainMenuScreen }     from './screens/MainMenuScreen'
import { RosterScreen }       from './screens/RosterScreen'
import { PreBattleScreen }    from './screens/PreBattleScreen'
import { BattleScreen }       from './screens/BattleScreen'
import { BattleResultScreen } from './screens/BattleResultScreen'
import { SettingsScreen }     from './screens/SettingsScreen'
import styles from './App.module.css'

// Back-button handling, document title, and safe-area insets all live
// in ScreenProvider. It must be a direct child of HashRouter (uses useLocation).
export default function App() {
  return (
    <div className={styles.viewport}>
      <div className={styles.viewportInner}>
        <HashRouter>
          <ScreenProvider>
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
