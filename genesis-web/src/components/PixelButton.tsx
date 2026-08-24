// PixelButton — primary action button. Replaces PrimaryButton.
// Variants, sizes, and states: docs/ui/01-components.md § PixelButton.

import type { ReactNode } from 'react'
import styles from './PixelButton.module.css'

export type PixelButtonVariant = 'primary' | 'secondary' | 'danger' | 'ghost'

interface Props {
  children:   ReactNode
  variant?:   PixelButtonVariant
  disabled?:  boolean
  fullWidth?: boolean
  onPress?:   () => void
  /** Accessible name when `children` is a glyph rather than readable text. */
  label?:     string
}

export function PixelButton({
  children,
  variant = 'primary',
  disabled = false,
  fullWidth = true,
  onPress,
  label,
}: Props) {
  return (
    <button
      type="button"
      className={`${styles.btn} ${styles[variant]} ${fullWidth ? styles.fullWidth : ''}`}
      disabled={disabled}
      aria-label={label}
      onPointerDown={disabled ? undefined : onPress}
    >
      {children}
    </button>
  )
}
