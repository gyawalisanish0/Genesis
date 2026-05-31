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
import type { AnimationManifest, AnimationProjectileDef, AnimPhase, StatusChipDef } from '../core/types'
import type { TurnDisplayData, TurnDisplayUnitData } from '../ascii/types'
import { AsciiAnimEngine } from '../ascii/AsciiAnimEngine'
import type { AsciiArenaFrame, AnimSignal } from '../ascii/types'
import { SymbolFigure } from './SymbolFigure'
import type { StatusChipData } from './StatusChipBar'
import styles from './AsciiArena.module.css'

// ── Re-export handle types so BattleContext import path stays unchanged ────────

export type { TurnDisplayData, TurnDisplayUnitData }

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

// ── Props ─────────────────────────────────────────────────────────────────────

interface AsciiArenaProps {
  /** Live leader data shown in the acting column when actor === null (player turn). */
  playerFigureInfo?: TurnDisplayUnitData
  /** Resolves StatusChipDef for a given status ID — passed from BattleScreen. */
  resolveChip?:      (id: string) => StatusChipDef | null
  /** Called when a chip dot in the figure info is tapped. */
  onChipTap?:        (chip: StatusChipData) => void
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
const DICE_ROLL_DURATION_MS = 800
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

// ── Chip dot — compact tappable status indicator ──────────────────────────────

interface ChipDotProps {
  colour:  string
  ascii?:  string[]
  label:   string
  onTap:   () => void
}

function extractAsciiCenter(ascii: string[]): string {
  const mid = ascii[Math.floor(ascii.length / 2)] ?? ascii[0] ?? ''
  return [...mid][Math.floor([...mid].length / 2)] ?? '◈'
}

function ChipDot({ colour, ascii, label, onTap }: ChipDotProps) {
  return (
    <div
      className={styles.chipDot}
      style={{ '--chip-colour': colour } as React.CSSProperties}
      onPointerDown={(e) => { e.stopPropagation(); onTap() }}
    >
      <span className={styles.chipDotSymbol}>
        {ascii ? extractAsciiCenter(ascii) : label[0]}
      </span>
    </div>
  )
}

// ── Figure info panel — name, bars, chips ─────────────────────────────────────

interface FigureInfoPanelProps {
  data:          TurnDisplayUnitData
  factionColour: string
  resolveChip?:  (id: string) => StatusChipDef | null
  onChipTap?:    (chip: StatusChipData) => void
}

function FigureInfoPanel({ data, factionColour, resolveChip, onChipTap }: FigureInfoPanelProps) {
  const hpPct      = data.maxHp > 0 ? Math.max(0, Math.min(1, data.hp / data.maxHp)) : 0
  const apPct      = data.maxAp > 0 ? Math.max(0, Math.min(1, data.ap / data.maxAp)) : 0
  const shieldPct  = data.maxHp > 0 ? Math.max(0, Math.min(1, data.shieldHp / data.maxHp)) : 0
  const secPct     = Math.max(0, Math.min(100, data.secondaryResource))

  const resolvedChips = resolveChip && onChipTap
    ? data.statusSlots.flatMap(slot => {
        const def = resolveChip(slot.id)
        if (!def) return []
        return [{ slot, def }]
      })
    : []

  return (
    <div className={styles.figureInfo}>
      <span className={styles.figureName} style={{ color: factionColour }}>
        {data.name}
      </span>

      {/* HP */}
      <div className={styles.barRow}>
        <span className={styles.barRowLabel}>HP</span>
        <div className={styles.barTrack}>
          <div className={styles.hpFill} style={{ width: `${hpPct * 100}%` }} />
          {shieldPct > 0 && (
            <div className={styles.shieldOverlay} style={{ width: `${shieldPct * 100}%` }} />
          )}
        </div>
        <span className={styles.barValue}>{data.hp}</span>
      </div>

      {/* AP */}
      <div className={styles.barRow}>
        <span className={styles.barRowLabel}>AP</span>
        <div className={styles.barTrack}>
          <div className={styles.apFill} style={{ width: `${apPct * 100}%` }} />
        </div>
        <span className={styles.barValue}>{data.ap}</span>
      </div>

      {/* Secondary resource — only shown when non-zero */}
      {secPct > 0 && (
        <div className={styles.barRow}>
          <span className={styles.barRowLabel}>SP</span>
          <div className={styles.barTrack}>
            <div className={styles.secFill} style={{ width: `${secPct}%` }} />
          </div>
          <span className={styles.barValue}>{Math.round(secPct)}</span>
        </div>
      )}

      {/* Status chip dots */}
      {resolvedChips.length > 0 && (
        <div className={styles.chipDots}>
          {resolvedChips.map(({ slot, def }) => (
            <ChipDot
              key={slot.id}
              colour={def.colour}
              ascii={def.ascii}
              label={def.label}
              onTap={() => onChipTap!({
                slotId:          slot.id,
                label:           def.label,
                colour:          def.colour,
                durationDisplay: def.durationDisplay,
                duration:        slot.duration,
                ascii:           def.ascii,
                description:     def.description,
                portraitGlow:    def.portraitGlow,
              })}
            />
          ))}
        </div>
      )}
    </div>
  )
}

// ── Main component ────────────────────────────────────────────────────────────

export const AsciiArena = forwardRef<BattleArenaHandle, AsciiArenaProps>(
  function AsciiArena({ playerFigureInfo, resolveChip, onChipTap }, ref) {
    const engineRef = useRef<AsciiAnimEngine | null>(null)
    const stageRef  = useRef<HTMLDivElement>(null)

    // ── Figure scale — fit 153.6×128 block into available stage space ───────
    const [figureScale, setFigureScale] = useState(1)

    // Info panel is ~100px: name 12px + 3 bar rows (8px each) + gaps + chips
    const INFO_H_PX = 100

    const updateScale = useCallback((width: number, height: number) => {
      const availW = Math.max(1, (width  - 24) / 2)
      const availH = Math.max(1,  height - INFO_H_PX)
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

    const actingRarity = turnDisplay?.actor?.rarity ?? (playerFigureInfo?.rarity ?? 1)
    const targetRarity = turnDisplay?.target?.rarity ?? 1

    // Acting column info: use actor snapshot (enemy turn) or live player data (player turn)
    const actingInfo = turnDisplay?.actor ?? playerFigureInfo ?? null
    const targetInfo = turnDisplay?.target ?? null

    // Faction colours — ally (player / allied AI) = heal green, enemy = danger red.
    // isAlly: true  → acting unit is on the player's side, target is an enemy.
    // isAlly: false → acting unit is an enemy, target is on the player's side.
    const isAlly         = turnDisplay?.isAlly !== false  // default ally when idle
    const allyColour     = 'var(--accent-heal)'
    const enemyColour    = 'var(--accent-danger)'
    const actingColour   = isAlly ? allyColour  : enemyColour
    const targetColour   = isAlly ? enemyColour : allyColour

    return (
      <div className={styles.arena}>

        {turnDisplay && (
          <div className={styles.turnStrip}>
            {turnDisplay.actor && (
              <span className={styles.turnActor} style={{ color: actingColour }}>
                {turnDisplay.actor.name}
              </span>
            )}
            <span className={styles.turnSkill}>{turnDisplay.skillName}</span>
            {turnDisplay.actor && <span className={styles.turnArrow}>→</span>}
            <span className={styles.turnTarget} style={{ color: targetColour }}>
              {turnDisplay.target.name}
            </span>
          </div>
        )}

        <div
          ref={stageRef}
          className={styles.stage}
          style={{ '--figure-scale': figureScale } as React.CSSProperties}
        >

          {/* ── Acting figure (left) ── */}
          <div className={styles.figureWrap}>
            <div className={styles.figureScaler}>
              {frame?.acting
                ? <SymbolFigure frame={frame.acting.frame} palette={GENERIC_PALETTE} rarity={actingRarity} />
                : <div className={styles.figureEmpty}>?</div>
              }
            </div>
            {actingInfo && (
              <FigureInfoPanel
                data={actingInfo}
                factionColour={actingColour}
                resolveChip={resolveChip}
                onChipTap={onChipTap}
              />
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

          {/* ── Target figure (right, flipped) ── */}
          <div className={styles.figureWrap}>
            <div className={`${styles.figureScaler} ${styles.figureScalerFlipped}`}>
              {frame?.target
                ? <SymbolFigure frame={frame.target.frame} palette={GENERIC_PALETTE} rarity={targetRarity} />
                : <div className={styles.figureEmpty}>?</div>
              }
            </div>
            {targetInfo && (
              <FigureInfoPanel
                data={targetInfo}
                factionColour={targetColour}
                resolveChip={resolveChip}
                onChipTap={onChipTap}
              />
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
