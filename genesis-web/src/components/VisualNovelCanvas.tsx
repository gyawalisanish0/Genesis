import { useEffect, useRef, useState } from 'react'
import { loadVNScript }  from '../services/DataService'
import { useGameStore }  from '../core/GameContext'
import { useVNPlayer }   from '../hooks/useVNPlayer'
import type { VNScriptDef } from '../core/types'
import styles from './VisualNovelCanvas.module.css'

const CHIP: Partial<Record<string, string>> = {
  creator:   '· · · · ·',
  player:    '?????',
  kali:      'K A L I',
  commander: '>',
  celan:     'C E L A N',
  alert:     '! ! ! ! !',
}

interface Props {
  scriptId:   string
  onComplete: () => void
}

export function VisualNovelCanvas({ scriptId, onComplete }: Props) {
  const [script, setScript] = useState<VNScriptDef | null>(null)

  const setCommanderName    = useGameStore(s => s.setCommanderName)
  const setOrganisationName = useGameStore(s => s.setOrganisationName)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => { loadVNScript(scriptId).then(setScript) }, [scriptId])

  function onInputConfirmed(key: string, value: string) {
    if (key === 'commanderName')    setCommanderName(value)
    if (key === 'organisationName') setOrganisationName(value)
  }

  const {
    line, fullText, canvasPhase, transitioning,
    charCount, isComplete, inputDraft, setInputDraft,
    advance, confirmInput,
  } = useVNPlayer(script, onComplete, onInputConfirmed)

  useEffect(() => {
    if (line?.kind === 'input') setTimeout(() => inputRef.current?.focus(), 80)
  }, [line])

  const isInput = line?.kind === 'input'
  const isDlg   = line?.kind === 'dialogue'
  const who     = isDlg ? line.who : ''
  const chip    = CHIP[who]
  const effect  = isDlg ? line.effect : undefined
  const showHint = isDlg && isComplete && line.autoAdvance === undefined

  return (
    <div
      className={`${styles.canvas} ${canvasPhase === 'light' ? styles.light : ''}`}
      onPointerDown={advance}
    >
      {transitioning && <div className={styles.flash} aria-hidden />}

      <div className={styles.content}>
        {chip && <div className={`${styles.chip} ${styles[who]}`}>{chip}</div>}

        {isInput ? (
          <div className={styles.inputRow} onPointerDown={e => e.stopPropagation()}>
            <input
              ref={inputRef}
              className={styles.nameInput}
              value={inputDraft}
              onChange={e => setInputDraft(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') confirmInput() }}
              placeholder={line.placeholder ?? '...'}
              maxLength={32}
              autoComplete="off"
              spellCheck={false}
            />
            {inputDraft.trim() && (
              <button className={styles.confirmBtn} onPointerDown={confirmInput}>↵</button>
            )}
          </div>
        ) : isDlg ? (
          <p className={`${styles.text} ${styles[who]} ${effect ? styles[effect] : ''}`}>
            {fullText.slice(0, charCount)}
            {!isComplete && <span className={styles.cursor} aria-hidden />}
          </p>
        ) : null}

        <div className={styles.hint}>
          {showHint ? 'tap to continue' : ' '}
        </div>
      </div>
    </div>
  )
}
