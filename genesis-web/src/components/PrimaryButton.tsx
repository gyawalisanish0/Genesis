// Primary action button — four variants matching the design system.

import type { ReactNode } from 'react'
import styles from './PrimaryButton.module.css'

type ButtonVariant = 'primary' | 'secondary' | 'danger' | 'ghost'

interface Props {
  children: ReactNode
  variant?: ButtonVariant
  disabled?: boolean
  fullWidth?: boolean
  onPress?: () => void
}

export function PrimaryButton({
  children,
  variant = 'primary',
  disabled = false,
  fullWidth = true,
  onPress,
}: Props) {
  return (
    <button
      className={`${styles.btn} ${styles[variant]} ${fullWidth ? styles.fullWidth : ''}`}
      disabled={disabled}
      onPointerDown={onPress}
    >
      {children}
    </button>
  )
}
