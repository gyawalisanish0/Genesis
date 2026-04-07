import { useEffect } from 'react'
import { HashRouter, Routes, Route, Navigate } from 'react-router-dom'
import { App as CapApp } from '@capacitor/app'

// Screens — imported as stubs for now; replaced screen-by-screen each session
const Stub = ({ name }: { name: string }) => (
  <div style={{ color: '#f1f0ff', padding: '2rem', fontFamily: 'system-ui' }}>
    {name}
  </div>
)

export default function App() {
  // Single global Android back-button handler — Capacitor App plugin
  useEffect(() => {
    const listenerPromise = CapApp.addListener('backButton', ({ canGoBack }) => {
      if (canGoBack) window.history.back()
      else CapApp.exitApp()
    })
    return () => {
      listenerPromise.then((handle) => handle.remove())
    }
  }, [])

  return (
    <HashRouter>
      <Routes>
        <Route path="/"              element={<Navigate to="/splash" replace />} />
        <Route path="/splash"        element={<Stub name="Splash" />} />
        <Route path="/main-menu"     element={<Stub name="Main Menu" />} />
        <Route path="/pre-battle"    element={<Stub name="Pre-Battle" />} />
        <Route path="/battle"        element={<Stub name="Battle" />} />
        <Route path="/battle-result" element={<Stub name="Battle Result" />} />
        <Route path="/roster"        element={<Stub name="Roster" />} />
        <Route path="/settings"      element={<Stub name="Settings" />} />
        <Route path="*"              element={<Navigate to="/splash" replace />} />
      </Routes>
    </HashRouter>
  )
}
