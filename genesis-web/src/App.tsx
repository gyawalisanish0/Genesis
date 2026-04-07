import { HashRouter, Routes, Route, Navigate } from 'react-router-dom'
import { ScreenProvider } from './navigation/ScreenContext'
import { ScreenShell } from './navigation/ScreenShell'

// Screen stubs — replaced screen-by-screen each session.
// Each stub is wrapped in ScreenShell so safe-area padding is exercised immediately.
const Stub = ({ name }: { name: string }) => (
  <ScreenShell>
    <div style={{ color: 'var(--text-primary)', padding: '2rem', fontFamily: 'system-ui' }}>
      {name}
    </div>
  </ScreenShell>
)

export default function App() {
  // Back-button handling and document title management live in ScreenProvider.
  // ScreenProvider must be inside HashRouter because it calls useLocation().
  return (
    <HashRouter>
      <ScreenProvider>
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
      </ScreenProvider>
    </HashRouter>
  )
}
