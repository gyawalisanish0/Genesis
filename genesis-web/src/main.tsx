import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import './styles/fonts.css'
import './styles/tokens.css'
import './styles/base.css'
import { ErrorBoundary } from './components/ErrorBoundary'
import { registerBuiltins } from './core/effects/builtins'

// Populate the effect handler registry before the app mounts.
registerBuiltins()

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    {/* Outermost, so it survives a failure in the router or the providers that
        the per-screen boundary sits inside. Reload is the only recovery it can
        honestly offer: at this level there is no route left to trust. */}
    <ErrorBoundary area="APP">
      <App />
    </ErrorBoundary>
  </React.StrictMode>,
)
