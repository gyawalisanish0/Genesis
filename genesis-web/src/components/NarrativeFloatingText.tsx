// Floating text burst — rises and fades from the centre of the screen.
// Used for impact callouts: "CRITICAL!", "CRUSHING BLOW!", "Evade!"

import { useEffect, useRef } from 'react'
import { NARRATIVE_FLOAT_MS } from '../core/constants'
import styles from './NarrativeFloatingText.module.css'

interface Props {
  text:    string
  colour?: string
  onDone:  () => void
}

export function NarrativeFloatingText({ text, colour = 'var(--text-primary)', onDone }: Props) {
  const ref = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    ref.current = setTimeout(onDone, NARRATIVE_FLOAT_MS)
    return () => { if (ref.current) clearTimeout(ref.current) }
  }, [onDone])

  return (
    <div
      className={styles.floatText}
      style={{ color: colour }}
      aria-hidden
    >
      {text}
    </div>
  )
}
