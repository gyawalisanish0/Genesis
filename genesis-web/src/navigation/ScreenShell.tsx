// Wrapper applied inside every screen component.
// Reads the current screen's safeAreaMode and applies the matching padding class.
// Every screen must render ScreenShell as its outermost element.

import type { ReactNode } from 'react'
import type { SafeAreaMode } from '../core/screen-types'
import { useScreenContext } from './ScreenContext'
import styles from './ScreenShell.module.css'

interface Props { children: ReactNode }

// Maps SafeAreaMode to the corresponding CSS module class.
const MODE_CLASS: Record<SafeAreaMode, string> = {
  full:       styles.full,
  'top-only': styles.topOnly,  // CSS modules convert .top-only → styles.topOnly
  none:       styles.none,
}

export function ScreenShell({ children }: Props) {
  const { screen } = useScreenContext()
  const modeClass = MODE_CLASS[screen?.safeAreaMode ?? 'full']

  return (
    <div className={`${styles.shell} ${modeClass}`}>
      {children}
    </div>
  )
}
