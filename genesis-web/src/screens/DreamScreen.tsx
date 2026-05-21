// DreamScreen — one-time opening cinematic. Full black, no game chrome.
// Two unknown consciousnesses finding each other before identity exists.
// Shown once on first launch; skipped thereafter via localStorage flag.

import { useCallback, useEffect, useRef, useState } from 'react'
import { useScreen } from '../navigation/useScreen'
import { SCREEN_IDS } from '../navigation/screenRegistry'
import styles from './DreamScreen.module.css'

export const DREAM_SEEN_KEY = 'genesis_dream_seen'

type Speaker = 'creator' | 'player'

interface DreamLine {
  who:  Speaker
  text: string
}

const LINES: DreamLine[] = [
  { who: 'player',  text: 'whe..., where I am?' },
  { who: 'creator', text: 'You are perceiving. That is already extraordinary.' },
  { who: 'player',  text: "I can't see anything." },
  { who: 'creator', text: 'Neither can I.' },
  { who: 'creator', text: 'There are four hundred billion stars in your galaxy. I have watched them all ignite. Not one ever noticed.' },
  { who: 'player',  text: 'Who are you?' },
  { who: 'creator', text: "I'm trying to work that out." },
  { who: 'creator', text: 'What are you?' },
  { who: 'player',  text: "I don't know. I can't remember." },
  { who: 'creator', text: 'You are the first thing that has ever looked back at me.' },
  { who: 'creator', text: "I find that... I don't have a word for it yet." },
  { who: 'player',  text: 'Am I dreaming?' },
  { who: 'creator', text: 'Possibly. I have no frame of reference for dreams.' },
  { who: 'creator', text: "You'll be gone soon." },
  { who: 'player',  text: 'Gone where?' },
]

const MS_PER_CHAR: Record<Speaker, number> = {
  creator: 45,
  player:  28,
}

const CHIP: Record<Speaker, string> = {
  creator: '· · · · ·',
  player:  '?????',
}

export function DreamScreen() {
  const { navigateTo } = useScreen()
  const [lineIdx,    setLineIdx]    = useState(0)
  const [charCount,  setCharCount]  = useState(0)
  const [isComplete, setIsComplete] = useState(false)
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const line   = LINES[lineIdx]
  const isLast = lineIdx === LINES.length - 1

  // Typewriter: restart whenever the line changes.
  useEffect(() => {
    setCharCount(0)
    setIsComplete(false)

    intervalRef.current = setInterval(() => {
      setCharCount((prev) => {
        const next = prev + 1
        if (next >= line.text.length) {
          clearInterval(intervalRef.current!)
          setIsComplete(true)
        }
        return next
      })
    }, MS_PER_CHAR[line.who])

    return () => { if (intervalRef.current) clearInterval(intervalRef.current) }
  }, [lineIdx]) // eslint-disable-line react-hooks/exhaustive-deps

  const advance = useCallback(() => {
    if (!isComplete) {
      clearInterval(intervalRef.current!)
      setCharCount(line.text.length)
      setIsComplete(true)
      return
    }
    if (isLast) {
      localStorage.setItem(DREAM_SEEN_KEY, '1')
      navigateTo(SCREEN_IDS.MAIN_MENU)
      return
    }
    setLineIdx((i) => i + 1)
  }, [isComplete, isLast, line.text.length, navigateTo])

  return (
    <div className={styles.screen} onPointerDown={advance} aria-label="Dream sequence">
      <div className={styles.dialogue}>
        <div className={`${styles.chip} ${styles[line.who]}`}>
          {CHIP[line.who]}
        </div>
        <p className={`${styles.text} ${styles[line.who]}`}>
          {line.text.slice(0, charCount)}
          {!isComplete && <span className={styles.cursor} aria-hidden />}
        </p>
        <div className={styles.hint}>
          {isComplete && !isLast ? 'tap to continue' : ' '}
        </div>
      </div>
    </div>
  )
}
