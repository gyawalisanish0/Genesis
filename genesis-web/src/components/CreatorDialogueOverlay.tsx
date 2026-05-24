// CreatorDialogueOverlay — full-screen dot-field dialogue for Creator speech.
// The background is filled with · characters. Creator text coalesces letter by
// letter from the dot field (dot → noise → real char). Player responses appear
// at the bottom as plain typewriter text with no dot involvement.

import { useEffect, useRef, useState } from 'react'
import {
  NARRATIVE_DISMISS_MS,
  NARRATIVE_TYPEWRITER_MS,
  CREATOR_DOT_TICK_MS,
  CREATOR_DOT_FLICKER,
  CREATOR_DOT_CHARS_PER_TICK,
} from '../core/constants'
import type { NarrativeEntry, DialogueLine } from '../core/narrative'
import styles from './CreatorDialogueOverlay.module.css'

// ── Constants ─────────────────────────────────────────────────────────────────

const NOISE         = ['░', '▒', '▓', '▪', '·', '▫']
const DOT           = '·'
const PLAYER_ID     = 'player'
const CREATOR_LABEL = '· T H E   C R E A T O R ·'

const DOT_COLS      = 34
const DOT_ROW_STR   = Array(DOT_COLS).fill(DOT).join(' ')
const DOT_FIELD     = Array(48).fill(DOT_ROW_STR).join('\n')

// ── Types ─────────────────────────────────────────────────────────────────────

type CharPhase = 'dot' | 'flicker' | 'done'

interface CharDisplay {
  ch:    string
  phase: CharPhase
}

// ── Pure helpers ──────────────────────────────────────────────────────────────

function computeChars(
  text: string,
  tick: number,
): { chars: CharDisplay[]; allDone: boolean } {
  let allDone = true
  const chars = text.split('').map((ch, i): CharDisplay => {
    if (ch === ' ' || ch === '\n') return { ch, phase: 'done' }
    const startAt = Math.floor(i / CREATOR_DOT_CHARS_PER_TICK)
    if (tick < startAt) { allDone = false; return { ch: DOT, phase: 'dot' } }
    const elapsed = tick - startAt
    if (elapsed < CREATOR_DOT_FLICKER) {
      allDone = false
      return { ch: NOISE[elapsed % NOISE.length], phase: 'flicker' }
    }
    return { ch, phase: 'done' }
  })
  return { chars, allDone }
}

function pickActiveLine(entry: NarrativeEntry, index: number): DialogueLine | null {
  const lines = entry.lines ?? []
  if (lines.length === 0) return null
  if (entry.sequence) return lines[index] ?? null
  return lines[Math.floor(Math.random() * lines.length)]
}

const phaseClass: Record<CharPhase, string> = {
  dot:     styles.charDot,
  flicker: styles.charFlicker,
  done:    styles.charDone,
}

// ── Component ─────────────────────────────────────────────────────────────────

interface Props {
  entry:     NarrativeEntry
  onDismiss: () => void
}

export function CreatorDialogueOverlay({ entry, onDismiss }: Props) {
  const lines      = entry.lines ?? []
  const sequential = entry.sequence === true

  const [lineIndex,  setLineIndex]  = useState(0)
  const [tick,       setTick]       = useState(-1)
  const [playerText, setPlayerText] = useState('')
  const [complete,   setComplete]   = useState(false)

  const tickRef      = useRef(-1)
  const intervalRef  = useRef<ReturnType<typeof setInterval> | null>(null)
  const dismissRef   = useRef<ReturnType<typeof setTimeout> | null>(null)
  const typeRef      = useRef<ReturnType<typeof setInterval> | null>(null)
  const advanceRef   = useRef<() => void>(() => {})

  const activeLine = pickActiveLine(entry, lineIndex)
  const isPlayer   = activeLine?.speakerId === PLAYER_ID
  const creatorText = !isPlayer ? (activeLine?.text ?? '') : ''
  const { chars } = computeChars(creatorText, tick)

  // Keep advanceRef current so timer callbacks never see stale lineIndex.
  advanceRef.current = () => {
    clearTimers()
    if (!sequential || lineIndex >= lines.length - 1) onDismiss()
    else setLineIndex(i => i + 1)
  }

  function clearTimers() {
    if (intervalRef.current) { clearInterval(intervalRef.current);  intervalRef.current = null }
    if (dismissRef.current)  { clearTimeout(dismissRef.current);    dismissRef.current  = null }
    if (typeRef.current)     { clearInterval(typeRef.current);       typeRef.current     = null }
  }

  function handleTap() {
    if (complete) { advanceRef.current(); return }
    // Skip to end of current reveal.
    clearTimers()
    if (isPlayer) setPlayerText(activeLine?.text ?? '')
    else setTick(9999)
    setComplete(true)
    dismissRef.current = setTimeout(() => advanceRef.current(), NARRATIVE_DISMISS_MS)
  }

  // Start reveal when line changes.
  useEffect(() => {
    if (!activeLine) { onDismiss(); return }
    clearTimers()
    tickRef.current = -1
    setTick(-1)
    setPlayerText('')
    setComplete(false)

    if (isPlayer) {
      let idx = 0
      const text = activeLine.text
      typeRef.current = setInterval(() => {
        idx += 1
        setPlayerText(text.slice(0, idx))
        if (idx >= text.length) {
          clearInterval(typeRef.current!)
          typeRef.current = null
          setComplete(true)
          dismissRef.current = setTimeout(() => advanceRef.current(), NARRATIVE_DISMISS_MS)
        }
      }, NARRATIVE_TYPEWRITER_MS)
    } else {
      const text = activeLine.text
      intervalRef.current = setInterval(() => {
        const next = ++tickRef.current
        setTick(next)
        const { allDone: done } = computeChars(text, next)
        if (done) {
          clearInterval(intervalRef.current!)
          intervalRef.current = null
          setComplete(true)
          dismissRef.current = setTimeout(() => advanceRef.current(), NARRATIVE_DISMISS_MS)
        }
      }, CREATOR_DOT_TICK_MS)
    }

    return clearTimers
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lineIndex])

  if (!activeLine) return null

  return (
    <div className={styles.overlay} onPointerDown={handleTap} role="dialog" aria-live="polite">
      <pre className={styles.dotField} aria-hidden="true">{DOT_FIELD}</pre>

      {!isPlayer && (
        <div className={styles.creatorBlock}>
          <div className={styles.creatorLabel}>{CREATOR_LABEL}</div>
          <p className={styles.creatorText} aria-label={creatorText}>
            {chars.map((c, i) =>
              c.ch === '\n'
                ? <br key={i} />
                : <span key={i} className={phaseClass[c.phase]}>{c.ch}</span>
            )}
          </p>
        </div>
      )}

      {isPlayer && (
        <p className={styles.playerBlock}>
          {playerText}
          <span className={styles.cursor} />
        </p>
      )}
    </div>
  )
}
