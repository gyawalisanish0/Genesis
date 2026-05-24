// WakeScreen — Act 2 + 3 of the demo opening.
// Commander wakes from the dream. KALI greets them by name.
// A gap in KALI's logs matches the duration of the dream.
// Then: the alarm. Mars. Two seconds after the logs went dark.

import { useCallback, useEffect, useRef, useState } from 'react'
import { useScreen }       from '../navigation/useScreen'
import { SCREEN_IDS }      from '../navigation/screenRegistry'
import { useGameStore }    from '../core/GameContext'
import styles from './WakeScreen.module.css'

// ── Script ────────────────────────────────────────────────────────────────────

type Speaker = 'kali' | 'commander' | 'alert'

interface WakeLine {
  who:  Speaker
  text: string   // [NAME] replaced with commanderName at render time
}

// Alert lines appear instantly and auto-advance — they are interrupts, not dialogue.
const ALERT_AUTO_MS = 1400

const LINES: WakeLine[] = [
  { who: 'kali',      text: '[NAME]. Good morning.' },
  { who: 'kali',      text: 'Current time: 06:14:22. You have been asleep for 4 hours, 51 minutes.' },
  { who: 'commander', text: '...KALI.' },
  { who: 'kali',      text: 'Your vitals are stable. No anomalies detected.' },
  { who: 'commander', text: 'I had a dream.' },
  { who: 'kali',      text: 'I have no record of the past 4 hours, 51 minutes.' },
  { who: 'kali',      text: 'My logs show a gap beginning at 01:23:07. No sensor data. No system errors. Just absence.' },
  { who: 'commander', text: "That's not possible." },
  { who: 'kali',      text: 'Correct.' },
  { who: 'kali',      text: 'I have no explanation.' },
  { who: 'alert',     text: 'PRIORITY 1 — INCOMING ALERT' },
  { who: 'kali',      text: 'Unidentified faction detected on Mars. Grid sector 7-Alpha.' },
  { who: 'kali',      text: 'Force composition: unknown. Deployment pattern: deliberate.' },
  { who: 'commander', text: 'Origin?' },
  { who: 'kali',      text: 'Extrasolar. The trajectory does not match any catalogued faction operating within the solar system.' },
  { who: 'commander', text: 'When was first contact?' },
  { who: 'kali',      text: '01:23:09.' },
  { who: 'kali',      text: 'Two seconds after my logs went dark.' },
  { who: 'commander', text: '...' },
  { who: 'kali',      text: 'Hugo Rekrot is already in the briefing room. Your team is standing by.' },
  { who: 'kali',      text: 'Ready when you are, [NAME].' },
]

const CHIP: Record<Speaker, string> = {
  kali:      'K A L I',
  commander: '>',
  alert:     '! ! ! ! !',
}

const MS_PER_CHAR: Record<'kali' | 'commander', number> = {
  kali:      22,
  commander: 30,
}

// ── Component ─────────────────────────────────────────────────────────────────

export function WakeScreen() {
  const { navigateTo }  = useScreen()
  const commanderName   = useGameStore((s) => s.commanderName)

  const [lineIdx,    setLineIdx]    = useState(0)
  const [charCount,  setCharCount]  = useState(0)
  const [isComplete, setIsComplete] = useState(false)

  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const timeoutRef  = useRef<ReturnType<typeof setTimeout>  | null>(null)

  const line     = LINES[lineIdx]
  const isAlert  = line.who === 'alert'
  const isLast   = lineIdx === LINES.length - 1
  const fullText = line.text.replace(/\[NAME\]/g, commanderName || 'Commander')

  function clearTimers() {
    if (intervalRef.current) { clearInterval(intervalRef.current); intervalRef.current = null }
    if (timeoutRef.current)  { clearTimeout(timeoutRef.current);   timeoutRef.current  = null }
  }

  function nextLine() {
    if (isLast) { navigateTo(SCREEN_IDS.ORG_SETUP); return }
    setLineIdx((i) => i + 1)
  }

  // Reveal current line.
  useEffect(() => {
    clearTimers()
    setIsComplete(false)

    if (isAlert) {
      // Alerts appear instantly, then auto-advance.
      setCharCount(fullText.length)
      setIsComplete(true)
      timeoutRef.current = setTimeout(nextLine, ALERT_AUTO_MS)
      return
    }

    setCharCount(0)
    const speed = MS_PER_CHAR[line.who as 'kali' | 'commander']
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

    return clearTimers
  }, [lineIdx]) // eslint-disable-line react-hooks/exhaustive-deps

  const advance = useCallback(() => {
    if (isAlert) return  // alerts auto-advance; ignore taps
    if (!isComplete) {
      clearTimers()
      setCharCount(fullText.length)
      setIsComplete(true)
      return
    }
    nextLine()
  }, [isAlert, isComplete, fullText.length]) // eslint-disable-line react-hooks/exhaustive-deps

  const displayed = fullText.slice(0, charCount)

  return (
    <div className={styles.screen} onPointerDown={advance}>
      <div className={styles.dialogue}>
        <div className={`${styles.chip} ${styles[line.who]}`}>
          {CHIP[line.who]}
        </div>

        <p className={`${styles.text} ${styles[line.who]}`}>
          {displayed}
          {!isComplete && !isAlert && <span className={styles.cursor} aria-hidden />}
        </p>

        <div className={styles.hint}>
          {isComplete && !isAlert && !isLast ? 'tap to continue' : ' '}
        </div>
      </div>
    </div>
  )
}
