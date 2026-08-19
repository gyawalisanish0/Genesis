// PromptOverlay — a blocking decision the battle engine waits on.
// Never dismissible; the player must choose. Spec: docs/ui/01-components.md.

import type { ReactNode } from 'react'
import { useScrollAwarePointer } from '../utils/useScrollAwarePointer'
import { panelClass } from './Panel'
import { PixelButton, type PixelButtonVariant } from './PixelButton'
import styles from './PromptOverlay.module.css'

export interface PromptAction {
  label:    string
  variant?: PixelButtonVariant
  onPress:  () => void
}

interface Props {
  title:          string
  subtitle?:      string
  children?:      ReactNode
  actions?:       PromptAction[]
  /** For prompts whose *surface* is the input (clash QTE: tap to stop the needle). */
  onBackdropTap?: () => void
}

export function PromptOverlay({ title, subtitle, children, actions, onBackdropTap }: Props) {
  const createHandler = useScrollAwarePointer()

  return (
    <div
      className={styles.backdrop}
      onPointerDown={onBackdropTap ? createHandler({ onTap: onBackdropTap }) : undefined}
      role="dialog"
      aria-modal="true"
      aria-label={title}
    >
      <div className={`${panelClass('default')} ${styles.card}`}>
        <span className={styles.title}>{title}</span>
        {subtitle && <span className={styles.subtitle}>{subtitle}</span>}
        {children && <div className={styles.body}>{children}</div>}
        {actions && actions.length > 0 && (
          <div className={styles.actions}>
            {actions.map((a) => (
              <PixelButton key={a.label} variant={a.variant ?? 'primary'} onPress={a.onPress}>
                {a.label}
              </PixelButton>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
