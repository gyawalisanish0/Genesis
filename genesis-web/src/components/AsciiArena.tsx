// AsciiArena — pure React renderer for the ASCII animation engine.
//
// Architecture:
//   AsciiAnimEngine fires AnimSignals → this component subscribes → renders.
//   No logic lives here. All display decisions (what to show, when to show it)
//   are made by AsciiAnimEngine. React receives signals and renders them.
//   Auto-dismiss timers for burst/feedback are the only exception — they are
//   a display-layer concern (how long to show something on screen).
//
// The forwardRef exposes BattleArenaHandle by delegating every method directly
// to the engine. BattleContext and BattleEngine require zero changes.

import { forwardRef, useEffect, useImperativeHandle, useRef, useState, useCallback } from 'react'
import type { AnimationManifest, AnimationProjectileDef, AnimPhase } from '../core/types'
import type { TurnDisplayData } from '../ascii/types'
import { AsciiAnimEngine } from '../ascii/AsciiAnimEngine'
import type { AsciiArenaFrame, AnimSignal } from '../ascii/types'
import { SymbolFigure } from './SymbolFigure'
import styles from './AsciiArena.module.css'

// ── Re-export handle types so BattleContext import path stays unchanged ────────

export type { TurnDisplayData }

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

// ── Generic palette (used until character-specific AsciiManifest loads) ───────

const GENERIC_PALETTE: Record<string, string> = {
  box:      '--text-secondary',
  block:    '--text-secondary',
  identity: 'rarity',
  weapon:   '--accent-heal',
  particle: '--text-muted',
  impact:   '--accent-danger',
  base:     '--text-primary',
}

const BURST_DISMISS_MS    = 900
const FEEDBACK_DISMISS_MS = 1200

// ── Dice roll animation ───────────────────────────────────────────────────────
// The outcome is known immediately but hidden during a 1200ms flicker phase.
// Interval starts at 60ms and slows (quadratic ease) to ~220ms as it approaches
// DICE_ROLL_DURATION_MS, simulating a die losing momentum before stopping.
const DICE_ROLL_DURATION_MS = 1200
const DICE_ROLL_OUTCOMES    = ['Hit', 'Evade', 'Boosted', 'Fail', 'Miss'] as const
const DICE_SYMBOL: Record<string, string> = {
  hit: '⚔', boosted: '★', evade: '◎', miss: '✕', fail: '✕',
}

// Natural figure block size at 0.5rem font / line-height 1:
//   32 chars × ~4.8px = 153.6px wide, 16 rows × 8px = 128px tall
const FIGURE_W_PX = 153.6
const FIGURE_H_PX = 128

// ── State shapes ──────────────────────────────────────────────────────────────

interface DiceState    { outcome: string; key: number }
interface BurstState   { symbol: string;  colour: string; key: number }
interface FeedbackState{ text: string;    colour: string; key: number }

// ── HP + shield bar ──────────────────────────────────────────────────────────
//
// The bar renders HP as a CSS fill. When shieldHp > 0, a semi-transparent
// white overlay sits on top of the left portion, showing how much of the
// unit's max HP is currently shielded. Width = shieldHp / maxHp clamped 0..1.
// A pulse animation keeps the overlay visually alive without distracting.

interface HpBarProps {
  hp:       number
  maxHp:    number
  shieldHp: number
}

function HpBar({ hp, maxHp, shieldHp }: HpBarProps) {
  const hpPct     = maxHp > 0 ? Math.max(0, Math.min(1, hp / maxHp))       : 0
  const shieldPct = maxHp > 0 ? Math.max(0, Math.min(1, shieldHp / maxHp)) : 0

  return (
    <div className={styles.barOuter}>
      <div className={styles.barTrack}>
        {/* HP fill */}
        <div className={styles.hpFill} style={{ width: `${hpPct * 100}%` }} />
        {/* Shield overlay — semi-transparent white, pulsing, core-driven */}
        {shieldPct > 0 && (
          <div
            className={styles.shieldOverlay}
            style={{ width: `${shieldPct * 100}%` }}
          />
        )}
      </div>
      <span className={styles.barLabel}>{hp}<span className={styles.barMax}>/{maxHp}</span></span>
      {shieldHp > 0 && (
        <span className={styles.shieldLabel}>🛡 {shieldHp}</span>
      )}
    </div>
  )
}

// ── Main component ────────────────────────────────────────────────────────────

export const AsciiArena = forwardRef<BattleArenaHandle>(
  function AsciiArena(_props, ref) {
    const engineRef = useRef<AsciiAnimEngine | null>(null)
    const stageRef  = useRef<HTMLDivElement>(null)

    // ── Figure scale — fit 153.6×128 block into available stage space ───────
    const [figureScale, setFigureScale] = useState(1)

    const updateScale = useCallback((width: number, height: number) => {
      const availW = Math.max(1, (width  - 24) / 2)  // 2 figures, 0.5rem padding+gap
      const availH = Math.max(1,  height - 72)        // 1rem*2 padding + ~40px info
      setFigureScale(Math.min(availW / FIGURE_W_PX, availH / FIGURE_H_PX, 2))
    }, [])

    useEffect(() => {
      const el = stageRef.current
      if (!el) return
      const obs = new ResizeObserver(([entry]) => {
        const { width, height } = entry.contentRect
        updateScale(width, height)
      })
      obs.observe(el)
      return () => obs.disconnect()
    }, [updateScale])

    // ── Signal-driven display state (pure output, no logic) ─────────────────
    const [frame,       setFrame]       = useState<AsciiArenaFrame | null>(null)
    const [turnDisplay, setTurnDisplay] = useState<TurnDisplayData | null>(null)
    const [dice,        setDice]        = useState<DiceState | null>(null)
    const [burst,       setBurst]       = useState<BurstState | null>(null)
    const [feedback,    setFeedback]    = useState<FeedbackState | null>(null)

    // Dice roll — display label cycles randomly until roll completes, then snaps to real outcome
    const [diceDisplay, setDiceDisplay] = useState<string | null>(null)
    const rollTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

    useEffect(() => {
      if (rollTimerRef.current) clearTimeout(rollTimerRef.current)
      if (!dice) { setDiceDisplay(null); return }

      const startTime = Date.now()
      setDiceDisplay(DICE_ROLL_OUTCOMES[Math.floor(Math.random() * DICE_ROLL_OUTCOMES.length)])

      const tick = () => {
        const elapsed = Date.now() - startTime
        if (elapsed >= DICE_ROLL_DURATION_MS) { setDiceDisplay(dice.outcome); return }
        setDiceDisplay(DICE_ROLL_OUTCOMES[Math.floor(Math.random() * DICE_ROLL_OUTCOMES.length)])
        const progress = elapsed / DICE_ROLL_DURATION_MS
        const delay = Math.round(60 + progress * progress * 160)
        rollTimerRef.current = setTimeout(tick, delay)
      }

      rollTimerRef.current = setTimeout(tick, 60)
      return () => { if (rollTimerRef.current) clearTimeout(rollTimerRef.current) }
    }, [dice])

    // Auto-dismiss refs (display-layer concern only)
    const burstTimer    = useRef<ReturnType<typeof setTimeout> | null>(null)
    const feedbackTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

    // ── Create engine, wire signal channel ──────────────────────────────────
    useEffect(() => {
      const engine = new AsciiAnimEngine()
      engineRef.current = engine

      engine.onSignal((signal: AnimSignal) => {
        switch (signal.type) {
          case 'frame':
            setFrame(signal.frame)
            break

          case 'dice':
            setDice({ outcome: signal.outcome, key: Date.now() })
            break

          case 'dice_clear':
            setDice(null)
            break

          case 'burst':
            if (burstTimer.current) clearTimeout(burstTimer.current)
            setBurst({ symbol: signal.symbol, colour: signal.colour, key: Date.now() })
            burstTimer.current = setTimeout(() => setBurst(null), BURST_DISMISS_MS)
            break

          case 'feedback':
            if (feedbackTimer.current) clearTimeout(feedbackTimer.current)
            setFeedback({ text: signal.text, colour: signal.colour, key: Date.now() })
            feedbackTimer.current = setTimeout(() => setFeedback(null), FEEDBACK_DISMISS_MS)
            break

          case 'turn_show':
            setTurnDisplay(signal.data)
            break

          case 'turn_hide':
            setTurnDisplay(null)
            break
        }
      })

      engine.start()

      return () => {
        engine.stop()
        engineRef.current = null
        if (burstTimer.current)    clearTimeout(burstTimer.current)
        if (feedbackTimer.current) clearTimeout(feedbackTimer.current)
      }
    }, [])

    // ── Forward handle → engine (zero logic in React) ───────────────────────
    useImperativeHandle(ref, () => ({
      setTurnState(actingDefId, targetDefId, am?, tm?, isDamaged?) {
        engineRef.current?.setTurnState(actingDefId, targetDefId, am, tm, isDamaged)
      },
      clearTurn() {
        engineRef.current?.clearTurn()
      },
      playDice(outcome) {
        engineRef.current?.playDice(outcome)
      },
      skipActiveDice() {
        engineRef.current?.skipActiveDice()
      },
      playAttack(actingDefId, targetDefId, outcome, damage, isMelee, dashDx, projectile, feedbackText, feedbackColour, customSequence?) {
        engineRef.current?.playAttack(actingDefId, targetDefId, outcome, damage, isMelee, dashDx, projectile, feedbackText, feedbackColour, customSequence)
      },
      playDeath(defId) {
        engineRef.current?.playDeath(defId)
      },
      showTurnDisplay(data) {
        engineRef.current?.showTurnDisplay(data)
      },
      hideTurnDisplay() {
        engineRef.current?.hideTurnDisplay()
      },
    }), [])

    // ── Render (pure — no decisions, only signal-driven state) ──────────────

    const actingRarity  = turnDisplay?.actor?.rarity  ?? 1
    const targetRarity  = turnDisplay?.target?.rarity ?? 1
    const actingShield  = turnDisplay?.actor?.shieldHp  ?? 0
    const targetShield  = turnDisplay?.target?.shieldHp ?? 0

    return (
      <div className={styles.arena}>

        {turnDisplay && (
          <div className={styles.turnStrip}>
            {turnDisplay.actor && (
              <span className={styles.turnActor}>{turnDisplay.actor.name}</span>
            )}
            <span className={styles.turnSkill}>{turnDisplay.skillName}</span>
            {turnDisplay.actor && <span className={styles.turnArrow}>→</span>}
            <span className={styles.turnTarget}>{turnDisplay.target.name}</span>
          </div>
        )}

        <div
          ref={stageRef}
          className={styles.stage}
          style={{ '--figure-scale': figureScale } as React.CSSProperties}
        >

          <div className={styles.figureWrap}>
            <div className={styles.figureScaler}>
              {frame?.acting
                ? <SymbolFigure frame={frame.acting.frame} palette={GENERIC_PALETTE} rarity={actingRarity} />
                : <div className={styles.figureEmpty}>?</div>
              }
            </div>
            {turnDisplay?.actor && (
              <div className={styles.figureInfo}>
                <span className={styles.figureName}>{turnDisplay.actor.name}</span>
                <HpBar
                  hp={turnDisplay.actor.hp}
                  maxHp={turnDisplay.actor.maxHp}
                  shieldHp={actingShield}
                />
              </div>
            )}
          </div>

          {frame?.projectile?.visible && (
            <div
              className={styles.projectile}
              style={{ left: `${frame.projectile.progressX * 100}%` }}
            >
              {frame.projectile.symbol}
            </div>
          )}

          <div className={styles.figureWrap}>
            <div className={styles.figureScaler}>
              {frame?.target
                ? <SymbolFigure frame={frame.target.frame} palette={GENERIC_PALETTE} rarity={targetRarity} flipped />
                : <div className={styles.figureEmpty}>?</div>
              }
            </div>
            {turnDisplay?.target && (
              <div className={styles.figureInfo}>
                <span className={styles.figureName}>{turnDisplay.target.name}</span>
                <HpBar
                  hp={turnDisplay.target.hp}
                  maxHp={turnDisplay.target.maxHp}
                  shieldHp={targetShield}
                />
              </div>
            )}
          </div>
        </div>

        {burst && (
          <div key={burst.key} className={styles.burst} style={{ color: `var(${burst.colour})` }}>
            {burst.symbol}
          </div>
        )}

        {feedback && (
          <div key={feedback.key} className={styles.feedback} style={{ color: feedback.colour }}>
            {feedback.text}
          </div>
        )}

        {dice && diceDisplay && (
          <div key={dice.key} className={`${styles.diceOverlay} ${diceDisplay === dice.outcome ? styles.diceRevealed : styles.diceRolling}`}>
            <span className={styles.diceFace}>
              {DICE_SYMBOL[diceDisplay.toLowerCase()] ?? '◈'}
            </span>
            <span className={styles.diceLabel}>{diceDisplay.toUpperCase()}</span>
          </div>
        )}
      </div>
    )
  }
)
