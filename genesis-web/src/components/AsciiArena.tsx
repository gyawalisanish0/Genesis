// AsciiArena — React wrapper for the ASCII animation engine.
// Exposes identical BattleArenaHandle interface as the old BattleArena (Phaser),
// so BattleContext and BattleEngine require zero changes.

import { forwardRef, useEffect, useImperativeHandle, useRef, useState, useCallback } from 'react'
import type { AnimationManifest, AnimationProjectileDef, AnimPhase } from '../core/types'
import type { TurnDisplayData } from '../core/battle/EngineTypes'
import { AsciiAnimEngine } from '../ascii/AsciiAnimEngine'
import type { AsciiArenaFrame } from '../ascii/types'
import { SymbolFigure } from './SymbolFigure'
import styles from './AsciiArena.module.css'

// ── Re-export handle types so BattleContext imports stay unchanged ─────────────

export type { TurnDisplayData }

export interface TurnDisplayUnitData {
  name:        string
  className:   string
  rarity:      number
  hp:          number
  maxHp:       number
  ap:          number
  maxAp:       number
  statusSlots: Array<{ id: string; name: string }>
}

export interface BattleArenaHandle {
  setTurnState(
    actingDefId:    string,
    targetDefId:    string,
    actingManifest?: AnimationManifest | null,
    targetManifest?: AnimationManifest | null,
    isDamaged?:      { acting: boolean; target: boolean },
  ): void
  clearTurn(): void
  playDice(outcome: string): void
  skipActiveDice(): void
  playAttack(
    actingDefId:     string,
    targetDefId:     string,
    outcome:         string,
    damage:          number,
    isMelee:         boolean,
    dashDx:          number,
    projectile:      AnimationProjectileDef | null,
    feedbackText:    string,
    feedbackColour:  string,
    customSequence?: AnimPhase[],
  ): void
  playDeath(defId: string): void
  showTurnDisplay(data: TurnDisplayData): void
  hideTurnDisplay(): void
}

// ── Outcome → symbol mapping ─────────────────────────────────────────────────

const OUTCOME_SYMBOL: Record<string, string> = {
  hit:     '⚔',
  boosted: '★',
  evade:   '◎',
  miss:    '✕',
  fail:    '✕',
}

const OUTCOME_COLOR: Record<string, string> = {
  hit:     '--accent-heal',
  boosted: '--accent-gold',
  evade:   '--accent-evasion',
  miss:    '--text-muted',
  fail:    '--text-muted',
}

// ── Generic palette (used when no AsciiManifest loaded) ──────────────────────

const GENERIC_PALETTE: Record<string, string> = {
  box:      '--text-secondary',
  block:    '--text-secondary',
  identity: 'rarity',
  weapon:   '--accent-heal',
  particle: '--text-muted',
  impact:   '--accent-danger',
  base:     '--text-primary',
}

// ── Dice animation state ─────────────────────────────────────────────────────

interface DiceState {
  outcome: string
  key:     number
}

// ── Feedback / outcome burst ─────────────────────────────────────────────────

interface BurstState {
  symbol:  string
  colour:  string
  key:     number
}

interface FeedbackState {
  text:    string
  colour:  string
  key:     number
}

// ── HP bar helper ─────────────────────────────────────────────────────────────

function HpBar({ hp, maxHp }: { hp: number; maxHp: number }) {
  const pct = maxHp > 0 ? Math.max(0, Math.min(1, hp / maxHp)) : 0
  const filled = Math.round(pct * 10)
  const empty  = 10 - filled
  return (
    <span className={styles.hpBar}>
      {'█'.repeat(filled)}{'░'.repeat(empty)}
      <span className={styles.hpNum}> {hp}/{maxHp}</span>
    </span>
  )
}

// ── Main component ────────────────────────────────────────────────────────────

export const AsciiArena = forwardRef<BattleArenaHandle>(
  function AsciiArena(_props, ref) {
    const engineRef = useRef<AsciiAnimEngine | null>(null)

    const [frame,       setFrame]       = useState<AsciiArenaFrame | null>(null)
    const [turnDisplay, setTurnDisplay] = useState<TurnDisplayData | null>(null)
    const [dice,        setDice]        = useState<DiceState | null>(null)
    const [burst,       setBurst]       = useState<BurstState | null>(null)
    const [feedback,    setFeedback]    = useState<FeedbackState | null>(null)

    // Manifests loaded by engine; store palette per defId for SymbolFigure
    const palettesRef = useRef<Map<string, Record<string, string>>>(new Map())

    const clearBurstTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
    const clearFbTimer    = useRef<ReturnType<typeof setTimeout> | null>(null)

    useEffect(() => {
      const engine = new AsciiAnimEngine()
      engineRef.current = engine
      engine.onFrame((f) => setFrame(f))
      engine.start()
      return () => {
        engine.stop()
        engineRef.current = null
      }
    }, [])

    // Clear burst overlay after display
    const showBurst = useCallback((symbol: string, colour: string) => {
      if (clearBurstTimer.current) clearTimeout(clearBurstTimer.current)
      setBurst({ symbol, colour, key: Date.now() })
      clearBurstTimer.current = setTimeout(() => setBurst(null), 900)
    }, [])

    const showFeedback = useCallback((text: string, colour: string) => {
      if (clearFbTimer.current) clearTimeout(clearFbTimer.current)
      setFeedback({ text, colour, key: Date.now() })
      clearFbTimer.current = setTimeout(() => setFeedback(null), 1200)
    }, [])

    useImperativeHandle(ref, () => ({
      setTurnState(actingDefId, targetDefId, _am?, _tm?, _isDamaged?) {
        engineRef.current?.setTurnState(actingDefId, targetDefId)
        setBurst(null)
        setFeedback(null)
      },

      clearTurn() {
        engineRef.current?.clearTurn()
        setTurnDisplay(null)
      },

      playDice(outcome) {
        setDice({ outcome, key: Date.now() })
      },

      skipActiveDice() {
        setDice(null)
      },

      playAttack(actingDefId, targetDefId, outcome, _damage, isMelee, _dashDx, _proj, feedbackText, feedbackColour) {
        engineRef.current?.playAttack(actingDefId, targetDefId, outcome, isMelee)
        const sym = OUTCOME_SYMBOL[outcome.toLowerCase()] ?? '•'
        const col = OUTCOME_COLOR[outcome.toLowerCase()]  ?? '--text-muted'
        showBurst(sym, col)
        showFeedback(feedbackText, feedbackColour)
        setDice(null)
      },

      playDeath(defId) {
        engineRef.current?.playDeath(defId)
      },

      showTurnDisplay(data) {
        setTurnDisplay(data)
      },

      hideTurnDisplay() {
        setTurnDisplay(null)
      },
    }), [showBurst, showFeedback])

    // ── Render ──────────────────────────────────────────────────────────────────

    const actingPalette = palettesRef.current.get(frame?.acting?.defId ?? '') ?? GENERIC_PALETTE
    const targetPalette = palettesRef.current.get(frame?.target?.defId ?? '') ?? GENERIC_PALETTE

    const actingRarity = turnDisplay?.actor?.rarity ?? turnDisplay?.target?.rarity ?? 1
    const targetRarity = turnDisplay?.target?.rarity ?? 1

    return (
      <div className={styles.arena}>

        {/* Turn display strip */}
        {turnDisplay && (
          <div className={styles.turnStrip}>
            {turnDisplay.actor && (
              <span className={styles.turnActor}>{turnDisplay.actor.name}</span>
            )}
            <span className={styles.turnSkill}>{turnDisplay.skillName}</span>
            {turnDisplay.actor && (
              <span className={styles.turnArrow}>→</span>
            )}
            <span className={styles.turnTarget}>{turnDisplay.target.name}</span>
          </div>
        )}

        {/* Stage */}
        <div className={styles.stage}>

          {/* Acting figure */}
          <div className={styles.figureWrap}>
            {frame?.acting ? (
              <SymbolFigure
                frame={frame.acting.frame}
                palette={actingPalette}
                rarity={actingRarity}
                flipped={false}
              />
            ) : (
              <div className={styles.figureEmpty}>?</div>
            )}
            {turnDisplay?.actor && (
              <div className={styles.figureInfo}>
                <span className={styles.figureName}>{turnDisplay.actor.name}</span>
                <HpBar hp={turnDisplay.actor.hp} maxHp={turnDisplay.actor.maxHp} />
              </div>
            )}
          </div>

          {/* Projectile */}
          {frame?.projectile?.visible && (
            <div
              className={styles.projectile}
              style={{ left: `${frame.projectile.progressX * 100}%` }}
            >
              {frame.projectile.symbol}
            </div>
          )}

          {/* Target figure */}
          <div className={styles.figureWrap}>
            {frame?.target ? (
              <SymbolFigure
                frame={frame.target.frame}
                palette={targetPalette}
                rarity={targetRarity}
                flipped={true}
              />
            ) : (
              <div className={styles.figureEmpty}>?</div>
            )}
            {turnDisplay?.target && (
              <div className={styles.figureInfo}>
                <span className={styles.figureName}>{turnDisplay.target.name}</span>
                <HpBar hp={turnDisplay.target.hp} maxHp={turnDisplay.target.maxHp} />
              </div>
            )}
          </div>
        </div>

        {/* Outcome burst overlay */}
        {burst && (
          <div
            key={burst.key}
            className={styles.burst}
            style={{ color: `var(${burst.colour})` }}
          >
            {burst.symbol}
          </div>
        )}

        {/* Feedback text */}
        {feedback && (
          <div
            key={feedback.key}
            className={styles.feedback}
            style={{ color: feedback.colour }}
          >
            {feedback.text}
          </div>
        )}

        {/* Dice overlay */}
        {dice && (
          <div key={dice.key} className={styles.diceOverlay}>
            <span className={styles.diceFace}>
              {OUTCOME_SYMBOL[dice.outcome.toLowerCase()] ?? '◈'}
            </span>
            <span className={styles.diceLabel}>{dice.outcome.toUpperCase()}</span>
          </div>
        )}
      </div>
    )
  }
)
