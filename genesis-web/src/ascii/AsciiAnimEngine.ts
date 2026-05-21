// AsciiAnimEngine — rAF-driven ASCII animation orchestrator.
// Pure TS: no React, no Phaser. All logic lives here.
//
// Architecture:
//   BattleEngine → [BattleArenaHandle commands] → AsciiAnimEngine → [AnimSignal] → React
//
// React is a pure renderer. It subscribes via onSignal() and renders whatever
// signals arrive. No callbacks flow from React back to this engine.
//
// Fire-and-forget contract:
//   Every setTurnState / clearTurn bumps turnGen. Async loads and the onImpact
//   callback compare gen before touching animators — stale results are no-ops.

import { FigureAnimator } from './FigureAnimator'
import { ProjectileAnimator } from './ProjectileAnimator'
import type { AnimSignal, FigureAnimFrame, TurnDisplayData } from './types'
import {
  loadAsciiManifest,
  loadAsciiSequence,
  loadAsciiAction,
} from '../services/DataService'
import type { AnimationManifest, AnimationProjectileDef, AnimPhase } from '../core/types'

// ── Outcome → display symbol + colour ────────────────────────────────────────

const OUTCOME_SYMBOL: Record<string, string> = {
  hit:     '⚔',
  boosted: '★',
  evade:   '◎',
  miss:    '✕',
  fail:    '✕',
}

const OUTCOME_COLOUR: Record<string, string> = {
  hit:     '--accent-heal',
  boosted: '--accent-gold',
  evade:   '--accent-evasion',
  miss:    '--text-muted',
  fail:    '--text-muted',
}

// ── Engine ────────────────────────────────────────────────────────────────────

export class AsciiAnimEngine {
  private actingAnimator = new FigureAnimator()
  private targetAnimator = new FigureAnimator()
  private projectile     = new ProjectileAnimator()

  private actingDefId: string | null = null
  private targetDefId: string | null = null

  // Monotonically increasing counter. Every setTurnState / clearTurn bumps it.
  // Async loads and deferred callbacks capture the value and compare before
  // touching animators — stale results are silent no-ops.
  private turnGen = 0

  private signalCallback: ((s: AnimSignal) => void) | null = null

  private rafHandle: number | null = null
  private lastTime  = 0

  // ── Lifecycle ─────────────────────────────────────────────────────────────

  start(): void {
    if (this.rafHandle !== null) return
    this.lastTime = performance.now()
    this.rafHandle = requestAnimationFrame(this.loop)
  }

  stop(): void {
    if (this.rafHandle !== null) {
      cancelAnimationFrame(this.rafHandle)
      this.rafHandle = null
    }
  }

  // Single signal channel: engine → React (no return path).
  onSignal(cb: (s: AnimSignal) => void): void {
    this.signalCallback = cb
  }

  // ── BattleArenaHandle commands (the full set) ─────────────────────────────

  setTurnState(
    actingDefId:   string,
    targetDefId:   string,
    _actingMf?:    AnimationManifest | null,
    _targetMf?:    AnimationManifest | null,
    _isDamaged?:   { acting: boolean; target: boolean },
  ): void {
    this.turnGen++
    const gen = this.turnGen

    this.actingDefId = actingDefId
    this.targetDefId = targetDefId
    this.actingAnimator.reset()
    this.targetAnimator.reset()
    this.projectile.cancel()

    this.loadCharacterData(actingDefId, this.actingAnimator, gen)
    this.loadCharacterData(targetDefId, this.targetAnimator, gen)
    this.emitFrame()
  }

  clearTurn(): void {
    this.turnGen++
    this.actingDefId = null
    this.targetDefId = null
    this.actingAnimator.reset()
    this.targetAnimator.reset()
    this.projectile.cancel()
    this.emitFrame()
    this.emit({ type: 'turn_hide' })
  }

  playDice(outcome: string): void {
    this.emit({ type: 'dice', outcome })
  }

  skipActiveDice(): void {
    this.emit({ type: 'dice_clear' })
  }

  playAttack(
    actingDefId:    string,
    targetDefId:    string,
    outcome:        string,
    _damage:        number,
    _isMelee:       boolean,
    _dashDx:        number,
    _projectile:    AnimationProjectileDef | null,
    feedbackText:   string,
    feedbackColour: string,
    _customSeq?:    AnimPhase[],
  ): void {
    const gen = this.turnGen

    const isActing  = actingDefId === this.actingDefId
    const animator  = isActing ? this.actingAnimator : this.targetAnimator
    const hurtAnim  = isActing ? this.targetAnimator  : this.actingAnimator
    const hurtDefId = isActing ? targetDefId           : actingDefId

    // Clear dice overlay and emit visual signals — engine drives all display
    this.emit({ type: 'dice_clear' })

    const key = outcome.toLowerCase()
    this.emit({ type: 'burst',    symbol: OUTCOME_SYMBOL[key] ?? '•', colour: OUTCOME_COLOUR[key] ?? '--text-muted' })
    this.emit({ type: 'feedback', text: feedbackText, colour: feedbackColour })

    this.ensureActionLoaded(actingDefId, 'attack', animator, gen)

    animator.playAttack(undefined, () => {
      if (gen !== this.turnGen) return   // turn changed — discard
      hurtAnim.playHurt()
      this.ensureActionLoaded(hurtDefId, 'hurt', hurtAnim, gen)
    })
  }

  playDeath(defId: string): void {
    const gen      = this.turnGen
    const isActing = defId === this.actingDefId
    const animator = isActing ? this.actingAnimator : this.targetAnimator
    this.ensureActionLoaded(defId, 'death', animator, gen)
    animator.playDeath()
  }

  showTurnDisplay(data: TurnDisplayData): void {
    this.emit({ type: 'turn_show', data })
  }

  hideTurnDisplay(): void {
    this.emit({ type: 'turn_hide' })
  }

  // ── rAF loop ──────────────────────────────────────────────────────────────

  private readonly loop = (time: number): void => {
    const dt = time - this.lastTime
    this.lastTime = time

    const a = this.actingAnimator.update(dt)
    const t = this.targetAnimator.update(dt)
    const p = this.projectile.update(dt)

    if (a || t || p) this.emitFrame()

    this.rafHandle = requestAnimationFrame(this.loop)
  }

  // ── Signal helpers ────────────────────────────────────────────────────────

  private emit(signal: AnimSignal): void {
    this.signalCallback?.(signal)
  }

  private emitFrame(): void {
    this.emit({
      type:  'frame',
      frame: {
        acting:     this.buildFigureFrame(this.actingDefId, this.actingAnimator, false),
        target:     this.buildFigureFrame(this.targetDefId, this.targetAnimator, true),
        projectile: this.projectile.getFrame(),
      },
    })
  }

  private buildFigureFrame(
    defId:    string | null,
    animator: FigureAnimator,
    flipped:  boolean,
  ): FigureAnimFrame | null {
    if (!defId) return null
    return { frame: animator.getCurrentFrame(), defId, state: animator.getCurrentState(), flipped }
  }

  // ── Lazy data loading ─────────────────────────────────────────────────────

  private async loadCharacterData(
    defId:    string,
    animator: FigureAnimator,
    gen:      number,
  ): Promise<void> {
    const [_manifest, sequence] = await Promise.all([
      loadAsciiManifest(defId),
      loadAsciiSequence(defId),
    ])
    if (gen !== this.turnGen) return   // stale — turn changed while loading

    if (sequence) animator.setSequence(sequence)

    const idleFrames = await loadAsciiAction(defId, 'idle')
    if (gen !== this.turnGen) return   // stale — check again after second await

    if (idleFrames) animator.setActionFrames('idle', idleFrames)
    this.emitFrame()
  }

  private async ensureActionLoaded(
    defId:    string,
    action:   string,
    animator: FigureAnimator,
    gen:      number,
  ): Promise<void> {
    const frames = await loadAsciiAction(defId, action)
    if (gen !== this.turnGen) return   // stale — discard silently
    if (frames) animator.setActionFrames(action, frames)
  }
}
