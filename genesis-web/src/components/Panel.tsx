// Panel — the nine-slice box, and the only container style in the system.
// Anatomy, variants, and usage: docs/ui/00-design-system.md § 6.

import type { ReactNode } from 'react'
import styles from './Panel.module.css'

export type PanelVariant = 'default' | 'raised' | 'sunken' | 'active' | 'danger'

interface Props {
  variant?:   PanelVariant
  children?:  ReactNode
  /** Layout (size, padding, flex) belongs to the consumer, not the panel. */
  className?: string
}

/** Class pair for consumers that need the surface without the wrapper element. */
export function panelClass(variant: PanelVariant = 'default'): string {
  return `${styles.surface} ${styles[variant]}`
}

export function Panel({ variant = 'default', children, className }: Props) {
  return (
    <div className={`${panelClass(variant)} ${className ?? ''}`}>
      {children}
    </div>
  )
}
