// The lit panel at the bottom of the dream.
//
// Presentation only — nameplate, text, caret, advance hint. The player owns
// timing and taps; this owns nothing. A box with children is a question (the
// name fields mount inside it), which is why the advance hint hides there: the
// player answers to move on, they do not tap past it.

import type { ReactNode } from 'react'
import styles from './ScriptPlayer.module.css'

interface Props {
  /** Speaker id — selects the colour class. */
  who:    string
  /** Resolved display name for the nameplate. */
  name:   string
  /** Text to show; already sliced by the typewriter. */
  text:   string
  /** Mid-line: caret on, advance hint off. */
  typing: boolean
  children?: ReactNode
}

export function ScriptBox({ who, name, text, typing, children }: Props) {
  return (
    <div className={styles.box}>
      <span className={`${styles.name} ${styles[who] ?? ''}`}>{name}</span>
      <p className={styles.text}>
        {text}
        {typing && <span className={styles.caret} aria-hidden />}
      </p>
      {children}
      {!typing && !children && <span className={styles.more} aria-hidden>▼</span>}
    </div>
  )
}
