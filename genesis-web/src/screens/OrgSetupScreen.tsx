// OrgSetupScreen — KALI requests re-confirmation of the Commander's
// organisation name. Her records for it were corrupted during the
// 01:23:07 log gap. She does not speculate about what caused the gap.

import { useCallback, useEffect, useRef, useState } from 'react'
import { useScreen }    from '../navigation/useScreen'
import { SCREEN_IDS }  from '../navigation/screenRegistry'
import { useGameStore } from '../core/GameContext'
import styles from './OrgSetupScreen.module.css'

// ── Script ────────────────────────────────────────────────────────────────────

type Speaker = 'kali' | 'commander'
interface OrgLine { who: Speaker; text: string }

// [NAME] → commanderName, [ORG] → organisationName
const LINES_BEFORE: OrgLine[] = [
  { who: 'kali',      text: 'One more thing before I log the deployment order.' },
  { who: 'kali',      text: 'My records for your organisation designation were corrupted during the 01:23:07 gap.' },
  { who: 'kali',      text: 'I need you to re-enter it.' },
  { who: 'commander', text: 'The gap corrupted records.' },
  { who: 'kali',      text: 'Yes.' },
  { who: 'kali',      text: 'Several fields. This one is required for the deployment log.' },
]

const LINES_AFTER: OrgLine[] = [
  { who: 'kali', text: 'Confirmed. [ORG] — logged.' },
  { who: 'kali', text: 'Deployment order is live, [NAME].' },
]

const MS_PER_CHAR: Record<Speaker, number> = { kali: 22, commander: 30 }
const CHIP:        Record<Speaker, string>  = { kali: 'K A L I', commander: '>' }

// ── Component ─────────────────────────────────────────────────────────────────

export function OrgSetupScreen() {
  const { navigateTo }      = useScreen()
  const commanderName       = useGameStore((s) => s.commanderName)
  const setOrganisationName = useGameStore((s) => s.setOrganisationName)
  const orgNameRef          = useRef('')

  type Phase = 'before' | 'input' | 'after'
  const [phase,      setPhase]      = useState<Phase>('before')
  const [lineIdx,    setLineIdx]    = useState(0)
  const [charCount,  setCharCount]  = useState(0)
  const [isComplete, setIsComplete] = useState(false)
  const [orgInput,   setOrgInput]   = useState('')

  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const inputRef    = useRef<HTMLInputElement | null>(null)

  const lines   = phase === 'after' ? LINES_AFTER : LINES_BEFORE
  const line    = lines[lineIdx]
  const isLast  = phase === 'after' && lineIdx === LINES_AFTER.length - 1
  const fullText = (line?.text ?? '')
    .replace(/\[NAME\]/g, commanderName || 'Commander')
    .replace(/\[ORG\]/g,  orgNameRef.current)

  function clearTimer() {
    if (intervalRef.current) { clearInterval(intervalRef.current); intervalRef.current = null }
  }

  function nextLine() {
    const list = phase === 'after' ? LINES_AFTER : LINES_BEFORE
    if (lineIdx < list.length - 1) {
      setLineIdx((i) => i + 1)
      return
    }
    if (phase === 'before') {
      setPhase('input')
      setTimeout(() => inputRef.current?.focus(), 80)
      return
    }
    // after phase complete — go to main menu
    navigateTo(SCREEN_IDS.MAIN_MENU)
  }

  // Typewriter for non-input lines.
  useEffect(() => {
    if (phase === 'input') return
    clearTimer()
    setCharCount(0)
    setIsComplete(false)
    if (!line) return

    const speed = MS_PER_CHAR[line.who]
    intervalRef.current = setInterval(() => {
      setCharCount((prev) => {
        const next = prev + 1
        if (next >= fullText.length) {
          clearInterval(intervalRef.current!)
          intervalRef.current = null
          setIsComplete(true)
        }
        return next
      })
    }, speed)

    return clearTimer
  }, [lineIdx, phase]) // eslint-disable-line react-hooks/exhaustive-deps

  const advance = useCallback(() => {
    if (phase === 'input') return
    if (!isComplete) {
      clearTimer()
      setCharCount(fullText.length)
      setIsComplete(true)
      return
    }
    nextLine()
  }, [phase, isComplete, fullText.length]) // eslint-disable-line react-hooks/exhaustive-deps

  const confirmOrg = useCallback(() => {
    const name = orgInput.trim()
    if (!name) return
    orgNameRef.current = name
    setOrganisationName(name)
    setPhase('after')
    setLineIdx(0)
  }, [orgInput, setOrganisationName])

  if (phase === 'input') {
    return (
      <div className={styles.screen}>
        <div className={styles.dialogue}>
          <div className={`${styles.chip} ${styles.kali}`}>K A L I</div>
          <div className={styles.nameRow} onPointerDown={(e) => e.stopPropagation()}>
            <input
              ref={inputRef}
              className={styles.nameInput}
              value={orgInput}
              onChange={(e) => setOrgInput(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') confirmOrg() }}
              placeholder="organisation name..."
              maxLength={32}
              autoComplete="off"
              spellCheck={false}
            />
            {orgInput.trim() && (
              <button className={styles.confirmBtn} onPointerDown={confirmOrg}>↵</button>
            )}
          </div>
          <div className={styles.hint}> </div>
        </div>
      </div>
    )
  }

  return (
    <div className={styles.screen} onPointerDown={advance}>
      <div className={styles.dialogue}>
        <div className={`${styles.chip} ${styles[line.who]}`}>{CHIP[line.who]}</div>
        <p className={`${styles.text} ${styles[line.who]}`}>
          {fullText.slice(0, charCount)}
          {!isComplete && <span className={styles.cursor} aria-hidden />}
        </p>
        <div className={styles.hint}>
          {isComplete && !isLast ? 'tap to continue' : ' '}
        </div>
      </div>
    </div>
  )
}
