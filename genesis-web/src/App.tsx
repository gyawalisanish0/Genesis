import { useEffect }                                        from 'react'
import { suppressWebGestures } from './input/suppressWebGestures'
import { HashRouter, Routes, Route, Navigate }             from 'react-router-dom'
import { ScreenProvider }                                  from './navigation/ScreenContext'
import { useViewportScale }                                from './utils/useViewportScale'
import { initFullScreen }                                  from './services/DisplayService'
import { SoundService }                                    from './services/SoundService'
import { useGameStore }                                    from './core/GameContext'

import { SplashScreen }       from './screens/SplashScreen'
import { MainMenuScreen }     from './screens/MainMenuScreen'
import { RosterScreen }       from './screens/RosterScreen'
import { PreBattleScreen }    from './screens/PreBattleScreen'
import { BattleScreen }       from './screens/BattleScreen'
import { BattleResultScreen } from './screens/BattleResultScreen'
import { SettingsScreen }     from './screens/SettingsScreen'
import { CampaignScreen }     from './screens/CampaignScreen'
import { DreamScreen } from './screens/DreamScreen'
import { UnlockScreen } from './screens/UnlockScreen'
import { ComingSoonScreen } from './screens/ComingSoonScreen'
import { DungeonScreen }      from './screens/DungeonScreen'
import styles from './App.module.css'

export default function App() {
  const { scale, innerHeight } = useViewportScale()
  const reduceAnimations = useGameStore((s) => s.settings.reduceAnimations)
  const sfxVolume        = useGameStore((s) => s.settings.sfxVolume)
  const musicVolume      = useGameStore((s) => s.settings.musicVolume)
  const muteAll          = useGameStore((s) => s.settings.muteAll)

  useEffect(() => {
    // Turn off the browser gestures that read as "web page" — context menu,
    // drag, marquee selection, clipboard. CSS covers the rest in base.css.
    const restoreGestures = suppressWebGestures()
    initFullScreen().catch(() => {})
    // Boots the audio engine and preloads every registered SFX key. Phaser is
    // dynamically imported inside init(), so it stays out of the initial bundle
    // until this fires. Audio is best-effort and never blocks the app.
    SoundService.init().catch(() => {})
    return restoreGestures
  }, [])

  // Expose scale to CSS so safe-area vars can self-correct (tokens.css divides env() by --app-scale).
  useEffect(() => {
    document.documentElement.style.setProperty('--app-scale', String(scale))
  }, [scale])

  // Push the audio settings into the service. Without this the Settings sliders
  // write to the store and stop there.
  useEffect(() => {
    SoundService.setSfxVolume(muteAll ? 0 : sfxVolume)
    SoundService.setMusicVolume(muteAll ? 0 : musicVolume)
  }, [sfxVolume, musicVolume, muteAll])

  // Mirror the accessibility setting onto the root so tokens.css can collapse
  // every stepped duration to 0ms. docs/ui/00-design-system.md § 7.
  useEffect(() => {
    document.documentElement.dataset.reduceAnimations = String(reduceAnimations)
  }, [reduceAnimations])

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
            <Routes>
              <Route path="/"              element={<Navigate to="/splash" replace />} />
              <Route path="/splash"        element={<SplashScreen />} />
              <Route path="/main-menu"     element={<MainMenuScreen />} />
              <Route path="/roster"        element={<RosterScreen />} />
              <Route path="/pre-battle"    element={<PreBattleScreen />} />
              <Route path="/battle"        element={<BattleScreen />} />
              <Route path="/battle-result" element={<BattleResultScreen />} />
              <Route path="/settings"      element={<SettingsScreen />} />
              <Route path="/campaign"      element={<CampaignScreen />} />
              <Route path="/dungeon"       element={<DungeonScreen />} />
              <Route path="/dream"         element={<DreamScreen />} />
              <Route path="/unlock"        element={<UnlockScreen />} />
              <Route path="/coming-soon"   element={<ComingSoonScreen />} />
              <Route path="*"              element={<Navigate to="/splash" replace />} />
            </Routes>
          </ScreenProvider>
        </HashRouter>
      </div>
    </div>
  )
}
