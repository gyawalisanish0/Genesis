// Dialogue box overlay — slides up from the bottom of the screen.
// Shows the current speaker's portrait, name, and animated typewriter text.
// Tap skips the typewriter; second tap advances to next line or dismisses.

import { useEffect, useRef, useState } from 'react'
import { UnitPortrait } from './UnitPortrait'
import { NARRATIVE_DISMISS_MS, NARRATIVE_TYPEWRITER_MS } from '../core/constants'
import type { NarrativeEntry, DialogueLine } from '../core/narrative'
import type { Unit } from '../core/types'
import styles from './NarrativeDialogueOverlay.module.css'

const RARITY_VARS: Record<number, string> = {
  1: 'var(--rarity-1)', 2: 'var(--rarity-2)', 3: 'var(--rarity-3)',
  4: 'var(--rarity-4)', 5: 'var(--rarity-5)', 6: 'var(--rarity-6)',
  7: 'var(--rarity-4)',
}

interface Props {
  entry:    NarrativeEntry
  units:    Unit[]
  onDismiss: () => void
}

function findSpeaker(speakerId: string, units: Unit[]): Unit | undefined {
  return units.find((u) => u.defId === speakerId)
}

export function NarrativeDialogueOverlay({ entry, units, onDismiss }: Props) {
  const isSequential = entry.sequence === true
  const lines        = entry.lines ?? []

  const [lineIndex,     setLineIndex]     = useState(0)
  const [displayedText, setDisplayedText] = useState('')
  const [isComplete,    setIsComplete]    = useState(false)

  const timerRef   = useRef<ReturnType<typeof setInterval> | null>(null)
  const dismissRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Stable random line for non-sequential entries — picked once on mount.
  const randomLineRef = useRef<DialogueLine | null>(
    !isSequential && lines.length > 0
      ? lines[Math.floor(Math.random() * lines.length)]
      : null,
  )
  const activeLine = isSequential ? (lines[lineIndex] ?? null) : randomLineRef.current

  // Clear timers on unmount.
  useEffect(() => () => {
    if (timerRef.current)   clearInterval(timerRef.current)
    if (dismissRef.current) clearTimeout(dismissRef.current)
  }, [])

  // Typewriter effect — resets when lineIndex changes.
  useEffect(() => {
    if (!activeLine) { onDismiss(); return }
    if (timerRef.current) clearInterval(timerRef.current)
    if (dismissRef.current) clearTimeout(dismissRef.current)

    setDisplayedText('')
    setIsComplete(false)

    const fullText = activeLine.text
    let idx = 0
    timerRef.current = setInterval(() => {
      idx += 1
      setDisplayedText(fullText.slice(0, idx))
      if (idx >= fullText.length) {
        clearInterval(timerRef.current!)
        setIsComplete(true)
        dismissRef.current = setTimeout(() => advance(), NARRATIVE_DISMISS_MS)
      }
    }, NARRATIVE_TYPEWRITER_MS)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lineIndex])

  function advance() {
    if (dismissRef.current) clearTimeout(dismissRef.current)
    if (!isSequential || lineIndex >= lines.length - 1) {
      onDismiss()
    } else {
      setLineIndex((i) => i + 1)
    }
  }

  function handleTap() {
    if (!isComplete) {
      // Skip typewriter — show full text immediately.
      if (timerRef.current) clearInterval(timerRef.current)
      if (dismissRef.current) clearTimeout(dismissRef.current)
      setDisplayedText(activeLine?.text ?? '')
      setIsComplete(true)
      dismissRef.current = setTimeout(() => advance(), NARRATIVE_DISMISS_MS)
    } else {
      advance()
    }
  }

  if (!activeLine) return null

  const speaker     = findSpeaker(activeLine.speakerId, units)
  const speakerName = speaker?.name ?? activeLine.speakerId
  const rarity      = speaker?.rarity ?? 1
  const nameColor   = RARITY_VARS[rarity] ?? 'var(--rarity-1)'

  return (
    <div className={styles.overlay} onPointerDown={handleTap} role="dialog" aria-live="polite">
      <div className={styles.box}>
        <div className={styles.portrait}>
          <UnitPortrait name={speakerName} rarity={rarity} size="lg" />
        </div>
        <div className={styles.content}>
          <div className={styles.nameplate} style={{ color: nameColor }}>
            {speakerName.toUpperCase()}
          </div>
          <div className={styles.divider} />
          <p className={styles.text}>{displayedText}<span className={styles.cursor} /></p>
        </div>
      </div>
      {isComplete && isSequential && lineIndex < lines.length - 1 && (
        <div className={styles.nextHint}>▶</div>
      )}
    </div>
  )
}
