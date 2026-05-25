// DreamScreen — the entire opening sequence: Dream → Wake → Alarm → Org Setup.
// Dream act plays on black; act_break triggers a white flash; Wake act stays white.

import { useCallback, useEffect, useRef, useState } from 'react'
import { useScreen }    from '../navigation/useScreen'
import { SCREEN_IDS }  from '../navigation/screenRegistry'
import { useGameStore } from '../core/GameContext'
import { LINES, CHIP, MS_PER_CHAR, ALERT_AUTO_MS } from './openingScript'
import type { Speaker } from './openingScript'
import styles from './DreamScreen.module.css'

const WAKE_FLASH_IN_MS = 350  // time until screen switches white under the overlay
const WAKE_TOTAL_MS    = 950  // total flash duration before dialogue resumes

export function DreamScreen() {
  const { navigateTo }      = useScreen()
  const setCommanderName    = useGameStore((s) => s.setCommanderName)
  const setOrganisationName = useGameStore((s) => s.setOrganisationName)

  const [lineIdx,      setLineIdx]      = useState(0)
  const [charCount,    setCharCount]    = useState(0)
  const [isComplete,   setIsComplete]   = useState(false)
  const [nameInput,    setNameInput]    = useState('')
  const [orgInput,     setOrgInput]     = useState('')
  const [enteredName,  setEnteredName]  = useState('')
  const [enteredOrg,   setEnteredOrg]   = useState('')
  const [actPhase,     setActPhase]     = useState<'dream' | 'wake'>('dream')
  const [transitioning, setTransitioning] = useState(false)

  const intervalRef  = useRef<ReturnType<typeof setInterval> | null>(null)
  const timeoutRef   = useRef<ReturnType<typeof setTimeout>  | null>(null)
  const nameInputRef = useRef<HTMLInputElement | null>(null)
  const orgInputRef  = useRef<HTMLInputElement | null>(null)

  const line       = LINES[lineIdx]
  const isInput    = line.who === 'input'
  const isInputOrg = line.who === 'input_org'
  const isAlert    = line.who === 'alert'
  const isActBreak = line.who === 'act_break'
  const isLast     = lineIdx === LINES.length - 1

  const chipWho  = (isInput ? 'player' : line.who) as Speaker
  const fullText = line.text
    .replace(/\[NAME\]/g, enteredName)
    .replace(/\[ORG\]/g,  enteredOrg)

  function clearTimers() {
    if (intervalRef.current) { clearInterval(intervalRef.current); intervalRef.current = null }
    if (timeoutRef.current)  { clearTimeout(timeoutRef.current);   timeoutRef.current  = null }
  }

  function nextLine() {
    if (isLast) { navigateTo(SCREEN_IDS.MAIN_MENU); return }
    setLineIdx((i) => i + 1)
  }

  useEffect(() => {
    clearTimers()
    setIsComplete(false)

    if (isActBreak) {
      setTransitioning(true)
      timeoutRef.current = setTimeout(() => setActPhase('wake'), WAKE_FLASH_IN_MS)
      timeoutRef.current = setTimeout(() => {
        setTransitioning(false)
        setLineIdx((i) => i + 1)
      }, WAKE_TOTAL_MS)
      return clearTimers
    }

    if (isInput)    { setTimeout(() => nameInputRef.current?.focus(), 80); return }
    if (isInputOrg) { setTimeout(() => orgInputRef.current?.focus(),  80); return }

    if (isAlert) {
      setCharCount(fullText.length)
      setIsComplete(true)
      timeoutRef.current = setTimeout(nextLine, ALERT_AUTO_MS)
      return clearTimers
    }

    setCharCount(0)
    const speed = MS_PER_CHAR[line.who] ?? 30
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
    if (isInput || isInputOrg || isAlert || isActBreak) return
    if (!isComplete) {
      clearTimers()
      setCharCount(fullText.length)
      setIsComplete(true)
      return
    }
    nextLine()
  }, [isInput, isInputOrg, isAlert, isActBreak, isComplete, fullText.length]) // eslint-disable-line react-hooks/exhaustive-deps

  const confirmName = useCallback(() => {
    const name = nameInput.trim()
    if (!name) return
    setEnteredName(name)
    setCommanderName(name)
    setLineIdx((i) => i + 1)
  }, [nameInput, setCommanderName])

  const confirmOrg = useCallback(() => {
    const name = orgInput.trim()
    if (!name) return
    setEnteredOrg(name)
    setOrganisationName(name)
    setLineIdx((i) => i + 1)
  }, [orgInput, setOrganisationName])

  return (
    <div
      className={`${styles.screen} ${actPhase === 'wake' ? styles.wake : ''}`}
      onPointerDown={advance}
    >
      {transitioning && <div className={styles.wakeFlash} aria-hidden />}

      {!isActBreak && (
        <div className={styles.dialogue}>
          <div className={`${styles.chip} ${styles[chipWho]}`}>
            {CHIP[chipWho]}
          </div>

          {isInput ? (
            <div className={styles.nameRow} onPointerDown={(e) => e.stopPropagation()}>
              <input ref={nameInputRef} className={styles.nameInput}
                value={nameInput} onChange={(e) => setNameInput(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') confirmName() }}
                placeholder="your name..." maxLength={24} autoComplete="off" spellCheck={false}
              />
              {nameInput.trim() && (
                <button className={styles.confirmBtn} onPointerDown={confirmName}>↵</button>
              )}
            </div>
          ) : isInputOrg ? (
            <div className={styles.nameRow} onPointerDown={(e) => e.stopPropagation()}>
              <input ref={orgInputRef} className={styles.nameInput}
                value={orgInput} onChange={(e) => setOrgInput(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') confirmOrg() }}
                placeholder="organisation name..." maxLength={32} autoComplete="off" spellCheck={false}
              />
              {orgInput.trim() && (
                <button className={styles.confirmBtn} onPointerDown={confirmOrg}>↵</button>
              )}
            </div>
          ) : (
            <p className={`${styles.text} ${styles[line.who]}`}>
              {fullText.slice(0, charCount)}
              {!isComplete && !isAlert && <span className={styles.cursor} aria-hidden />}
            </p>
          )}

          <div className={styles.hint}>
            {isComplete && !isInput && !isInputOrg && !isAlert && !isLast ? 'tap to continue' : ' '}
          </div>
        </div>
      )}
    </div>
  )
}
