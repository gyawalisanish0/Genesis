// Plays a VN script line by line.
//
// Deliberately small. The deleted narrative system was a scene engine; this is
// a typewriter, a tap target, and two text fields — the exact surface
// opening.json needs and nothing beyond it.
//
// Tap behaviour is the one thing worth getting right: a tap mid-line completes
// the line rather than skipping it, and only a tap on a finished line advances.
// Without that split, an impatient player loses text they never saw.

import { useEffect, useRef, useState } from 'react'
import type { ScriptLine, InputKey } from '../core/script/types'
import { SCRIPT_TYPE_MS, SCRIPT_TRANSITION_MS } from '../core/constants'
import { ScriptBox } from './ScriptBox'
import styles from './ScriptPlayer.module.css'

interface Props {
  lines:      readonly ScriptLine[]
  /** Resolves a speaker id to the name shown on the nameplate. */
  speakerName: (who: string) => string
  /** Substitutes the player's own answers into authored text. */
  resolveText: (text: string) => string
  onInput:    (key: InputKey, value: string) => void
  onComplete: () => void
}

/**
 * The line an input answers.
 *
 * The Creator asks "What is it?" and the field appears; without the question
 * still on screen the player is looking at a bare text box with no idea what it
 * wants. So an input line borrows the last thing that was said.
 */
function precedingDialogue(lines: readonly ScriptLine[], index: number) {
  for (let i = index - 1; i >= 0; i--) {
    const line = lines[i]
    if (line.kind === 'dialogue') return line
  }
  return null
}

export function ScriptPlayer({ lines, speakerName, resolveText, onInput, onComplete }: Props) {
  const [index, setIndex] = useState(0)
  const [shown, setShown] = useState(0)
  const [draft, setDraft] = useState('')
  const inputRef          = useRef<HTMLInputElement>(null)

  const line = lines[index]
  // Resolve before slicing — a typewriter running over the raw text would spell
  // out "[NA", "[NAM", "[NAME" before the substitution ever happened.
  const full = line?.kind === 'dialogue' ? resolveText(line.text) : ''
  const done = shown >= full.length

  // Reset the typewriter whenever the line changes.
  useEffect(() => { setShown(0); setDraft('') }, [index])

  // Type one character at a time.
  useEffect(() => {
    if (line?.kind !== 'dialogue' || done) return
    const t = setTimeout(() => setShown((n) => n + 1), SCRIPT_TYPE_MS)
    return () => clearTimeout(t)
  }, [line, shown, done])

  // A transition is a beat, not a prompt — it advances itself.
  useEffect(() => {
    if (line?.kind !== 'transition') return
    const t = setTimeout(() => advance(), SCRIPT_TRANSITION_MS)
    return () => clearTimeout(t)
  }, [line])

  // Focus the field the moment an input line arrives, so the keyboard is up
  // without the player having to find a target.
  useEffect(() => {
    if (line?.kind === 'input') inputRef.current?.focus()
  }, [line])

  function advance() {
    if (index + 1 >= lines.length) { onComplete(); return }
    setIndex((n) => n + 1)
  }

  function handleTap() {
    if (line?.kind !== 'dialogue') return
    if (!done) { setShown(full.length); return }   // complete, do not skip
    advance()
  }

  function submitInput() {
    if (line?.kind !== 'input') return
    const value = draft.trim()
    if (!value) return
    onInput(line.inputKey, value)
    advance()
  }

  if (!line) return null

  const question = line.kind === 'input' ? precedingDialogue(lines, index) : null

  return (
    <div
      className={`${styles.root} ${line.kind === 'transition' ? styles.flashing : ''}`}
      onPointerDown={handleTap}
    >
      {line.kind === 'dialogue' && (
        <ScriptBox
          who={line.who}
          name={speakerName(line.who)}
          text={full.slice(0, shown)}
          typing={!done}
        />
      )}

      {line.kind === 'input' && (
        <ScriptBox
          who={question?.who ?? 'narration'}
          name={speakerName(question?.who ?? 'narration')}
          text={question ? resolveText(question.text) : ''}
          typing={false}
        >
          <form
            className={styles.inputRow}
            onSubmit={(e) => { e.preventDefault(); submitInput() }}
          >
            <input
              ref={inputRef}
              className={styles.input}
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              placeholder={line.placeholder ?? ''}
              maxLength={24}
              autoComplete="off"
              spellCheck={false}
              aria-label={line.placeholder ?? line.inputKey}
            />
            <button
              type="submit"
              className={styles.confirm}
              disabled={!draft.trim()}
            >
              OK
            </button>
          </form>
        </ScriptBox>
      )}
    </div>
  )
}
