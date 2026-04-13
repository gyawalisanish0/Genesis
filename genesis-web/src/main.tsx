import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import './styles/tokens.css'
import './styles/base.css'
import { registerBuiltins } from './core/effects/builtins'

// Populate the effect handler registry before the app mounts.
registerBuiltins()

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)
