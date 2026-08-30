// ScreenBoundary — the per-screen half of the error handling.
//
// The root boundary in main.tsx can only offer a reload: at that level the
// router itself may be what failed. Inside the router there is a better answer
// — one broken screen does not have to cost the session. The Zustand store is
// in memory and survives, so returning to the menu keeps the fleet, the
// progress and the settings intact.
//
// Keyed on the pathname so the caught error is dropped on navigation. Without
// the key, recovering to the menu would re-render the same failed boundary and
// the player would be stuck looking at the fault panel forever.

import { useLocation, useNavigate } from 'react-router-dom'
import type { ReactNode } from 'react'
import { ErrorBoundary } from '../components/ErrorBoundary'
import { SCREEN_IDS, SCREEN_REGISTRY } from './screenRegistry'

export function ScreenBoundary({ children }: { children: ReactNode }) {
  const { pathname } = useLocation()
  const navigate     = useNavigate()

  return (
    <ErrorBoundary
      key={pathname}
      area={pathname}
      onRecover={() => navigate(SCREEN_REGISTRY[SCREEN_IDS.MAIN_MENU].path, { replace: true })}
    >
      {children}
    </ErrorBoundary>
  )
}
