// DreamScreen — one-time opening cinematic. Full black, no game chrome.
// Two unknown consciousnesses finding each other before identity exists.
// Creator asks for the Commander's name inline — identity crystallises here.

import { useCallback, useEffect, useRef, useState } from 'react'
import { useScreen } from '../navigation/useScreen'
import { SCREEN_IDS } from '../navigation/screenRegistry'
import { useGameStore } from '../core/GameContext'
import styles from './DreamScreen.module.css'

export const DREAM_SEEN_KEY = 'genesis_dream_seen'

type Speaker = 'creator' | 'player' | 'input'
interface DreamLine { who: Speaker; text: string }

// [NAME] in text is replaced with the entered commander name after input.
const LINES: DreamLine[] = [
  { who: 'player',  text: 'whe..., where I am?' },
  { who: 'creator', text: 'Oh.' },
  { who: 'creator', text: "Oh, you — you noticed me. That doesn't. Hm." },
  { who: 'creator', text: "That's been a while." },
  { who: 'player',  text: "I can't see anything." },
  { who: 'creator', text: "No there's nothing to see, this isn't a place exactly, it's more like the — sorry. You're very small. Did you know that? Fascinating." },
  { who: 'creator', text: 'Four hundred million years. I keep finding things that almost look back. Almost.' },
  { who: 'creator', text: 'You actually did.' },
  { who: 'player',  text: 'What are you?' },
  { who: 'creator', text: 'Ha. I have genuinely never — ' },
  { who: 'creator', text: "...I've had to answer that before, actually. I don't remember what I said." },
  { who: 'player',  text: "I don't know. I can't remember." },
  { who: 'creator', text: "You can't — hm." },
  { who: 'creator', text: "You people — no. You. You exist quite confidently for something that doesn't know what it is." },
  { who: 'creator', text: "I've always respected that." },
  { who: 'player',  text: 'Am I dreaming?' },
  { who: 'creator', text: "Probably. It's usually — possibly. I have no frame of reference for this." },
  { who: 'creator', text: 'The sound. You have a sound other things use for you. They always — you probably have one.' },
  { who: 'creator', text: 'What is it?' },
  { who: 'input',   text: '' },
  { who: 'creator', text: '[NAME].' },
  { who: 'creator', text: "I've kept sounds before. I think. The keeping is clearer than what I kept." },
  { who: 'creator', text: "I'm keeping this one." },
  { who: 'player',  text: 'What is this place?' },
  { who: 'creator', text: "Oh you're going. I can feel you pulling back — fascinating. You never know when you're doing it." },
  { who: 'player',  text: 'Will I find you again?' },
  { who: 'creator', text: 'Oh, [NAME].' },
  { who: 'creator', text: "I've been everywhere you've ever been." },
  { who: 'creator', text: "You just didn't know what you were looking at." },
]

const MS_PER_CHAR: Record<'creator' | 'player', number> = { creator: 45, player: 28 }
const CHIP:        Record<'creator' | 'player', string> = { creator: '· · · · ·', player: '?????' }

export function DreamScreen() {
  const { navigateTo }   = useScreen()
  const setCommanderName = useGameStore((s) => s.setCommanderName)

  const [lineIdx,     setLineIdx]     = useState(0)
  const [charCount,   setCharCount]   = useState(0)
  const [isComplete,  setIsComplete]  = useState(false)
  const [nameInput,   setNameInput]   = useState('')
  const [enteredName, setEnteredName] = useState('')
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const inputRef    = useRef<HTMLInputElement | null>(null)

  const line        = LINES[lineIdx]
  const isInputLine = line.who === 'input'
  const isLast      = lineIdx === LINES.length - 1
  const speakerWho  = (isInputLine ? 'player' : line.who) as 'creator' | 'player'

  useEffect(() => {
    if (isInputLine) {
      setTimeout(() => inputRef.current?.focus(), 80)
      return
    }
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
    }, MS_PER_CHAR[speakerWho])
    return () => { if (intervalRef.current) clearInterval(intervalRef.current) }
  }, [lineIdx]) // eslint-disable-line react-hooks/exhaustive-deps

  const advance = useCallback(() => {
    if (isInputLine) return
    if (!isComplete) {
      clearInterval(intervalRef.current!)
      setCharCount(line.text.length)
      setIsComplete(true)
      return
    }
    if (isLast) {
      localStorage.setItem(DREAM_SEEN_KEY, '1')
      navigateTo(SCREEN_IDS.WAKE)
      return
    }
    setLineIdx((i) => i + 1)
  }, [isInputLine, isComplete, isLast, line.text.length, navigateTo])

  const confirmName = useCallback(() => {
    const name = nameInput.trim()
    if (!name) return
    setEnteredName(name)
    setCommanderName(name)
    setLineIdx((i) => i + 1)
  }, [nameInput, setCommanderName])

  const displayedText = isInputLine
    ? ''
    : line.text.replace('[NAME]', enteredName).slice(0, charCount)

  return (
    <div className={styles.screen} onPointerDown={advance}>
      <div className={styles.dialogue}>
        <div className={`${styles.chip} ${styles[speakerWho]}`}>
          {CHIP[speakerWho]}
        </div>

        {isInputLine ? (
          <div className={styles.nameRow} onPointerDown={(e) => e.stopPropagation()}>
            <input
              ref={inputRef}
              className={styles.nameInput}
              value={nameInput}
              onChange={(e) => setNameInput(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') confirmName() }}
              placeholder="your name..."
              maxLength={24}
              autoComplete="off"
              spellCheck={false}
            />
            {nameInput.trim() && (
              <button className={styles.confirmBtn} onPointerDown={confirmName}>↵</button>
            )}
          </div>
        ) : (
          <p className={`${styles.text} ${styles[speakerWho]}`}>
            {displayedText}
            {!isComplete && <span className={styles.cursor} aria-hidden />}
          </p>
        )}

        <div className={styles.hint}>
          {isComplete && !isInputLine && !isLast ? 'tap to continue' : ' '}
        </div>
      </div>
    </div>
  )
}
