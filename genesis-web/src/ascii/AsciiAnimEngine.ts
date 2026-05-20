// AsciiAnimEngine — rAF-driven ASCII animation orchestrator.
// Pure TS: no React, no Phaser. Fires onFrame callbacks that React uses to setState.
// Mirrors BattleEngine architecture: own timer loop, fire-and-forget model.
//
// Fire-and-forget contract (same as BattleEngine / BattleScene):
//   Every command (setTurnState, playAttack, playDeath) increments `turnGen`.
//   Any async load or onImpact callback that fires after turnGen changed is a
//   no-op — the stale result is silently discarded. This matches the `turnVersion`
//   guard in BattleScene.ts that prevents stale setTurnState callbacks from
//   touching the wrong turn's animators.

import { FigureAnimator } from './FigureAnimator'
import { ProjectileAnimator } from './ProjectileAnimator'
import type { AsciiArenaFrame, FigureAnimFrame } from './types'
import {
  loadAsciiManifest,
  loadAsciiSequence,
  loadAsciiAction,
} from '../services/DataService'

// ── Engine ───────────────────────────────────────────────────────────────────

export class AsciiAnimEngine {
  private actingAnimator = new FigureAnimator()
  private targetAnimator = new FigureAnimator()
  private projectile     = new ProjectileAnimator()

  private actingDefId: string | null = null
  private targetDefId: string | null = null

  // Monotonically increasing counter. Every setTurnState / clearTurn bumps it.
  // Async loads and deferred callbacks capture the value at call time and
  // compare before touching animators — stale results are no-ops.
  private turnGen = 0

  private onFrameCallback: ((f: AsciiArenaFrame) => void) | null = null

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

  onFrame(cb: (f: AsciiArenaFrame) => void): void {
    this.onFrameCallback = cb
  }

  // ── BattleArenaHandle-compatible commands ─────────────────────────────────

  setTurnState(actingDefId: string, targetDefId: string): void {
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
  }

  playAttack(
    actingDefId: string,
    targetDefId: string,
    _outcome:    string,
    _isMelee:    boolean,
  ): void {
    const gen = this.turnGen

    const isActing  = actingDefId === this.actingDefId
    const animator  = isActing ? this.actingAnimator : this.targetAnimator
    const hurtAnim  = isActing ? this.targetAnimator  : this.actingAnimator
    const hurtDefId = isActing ? targetDefId           : actingDefId

    this.ensureActionLoaded(actingDefId, 'attack', animator, gen)

    animator.playAttack(undefined, () => {
      // Guard: skip if turn changed since this attack was fired
      if (gen !== this.turnGen) return
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

  private emitFrame(): void {
    this.onFrameCallback?.({
      acting:     this.buildFigureFrame(this.actingDefId, this.actingAnimator, false),
      target:     this.buildFigureFrame(this.targetDefId, this.targetAnimator, true),
      projectile: this.projectile.getFrame(),
    })
  }

  private buildFigureFrame(
    defId: string | null,
    animator: FigureAnimator,
    flipped: boolean,
  ): FigureAnimFrame | null {
    if (!defId) return null
    return {
      frame:   animator.getCurrentFrame(),
      defId,
      state:   animator.getCurrentState(),
      flipped,
    }
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
    if (gen !== this.turnGen) return  // stale — turn changed while loading

    if (sequence) animator.setSequence(sequence)

    const idleFrames = await loadAsciiAction(defId, 'idle')
    if (gen !== this.turnGen) return  // stale — check again after second await

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
    if (gen !== this.turnGen) return  // stale — discard silently

    if (frames) animator.setActionFrames(action, frames)
  }
}
