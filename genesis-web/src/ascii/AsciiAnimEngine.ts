// AsciiAnimEngine — rAF-driven ASCII animation orchestrator.
// Pure TS: no React, no Phaser. Fires onFrame callbacks that React uses to setState.
// Mirrors BattleEngine architecture: own timer loop, fire-and-forget model.

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
  private actingAnimator  = new FigureAnimator()
  private targetAnimator  = new FigureAnimator()
  private projectile      = new ProjectileAnimator()

  private actingDefId: string | null = null
  private targetDefId: string | null = null

  private onFrameCallback: ((f: AsciiArenaFrame) => void) | null = null

  private rafHandle: number | null = null
  private lastTime  = 0

  // ── Lifecycle ───────────────────────────────────────────────────────────────

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

  // ── BattleArenaHandle-compatible commands ───────────────────────────────────

  setTurnState(actingDefId: string, targetDefId: string): void {
    this.actingDefId = actingDefId
    this.targetDefId = targetDefId
    this.actingAnimator.reset()
    this.targetAnimator.reset()
    this.projectile.cancel()

    this.loadCharacterData(actingDefId, this.actingAnimator)
    this.loadCharacterData(targetDefId, this.targetAnimator)
    this.emitFrame()
  }

  clearTurn(): void {
    this.actingDefId = null
    this.targetDefId = null
    this.actingAnimator.reset()
    this.targetAnimator.reset()
    this.projectile.cancel()
    this.emitFrame()
  }

  playAttack(
    actingDefId:  string,
    targetDefId:  string,
    _outcome:     string,
    _isMelee:     boolean,
  ): void {
    const isActing = actingDefId === this.actingDefId
    const animator = isActing ? this.actingAnimator : this.targetAnimator
    const hurtAnim = isActing ? this.targetAnimator  : this.actingAnimator

    // Pre-fetch attack frames lazily
    this.ensureActionLoaded(actingDefId, 'attack', isActing ? this.actingAnimator : this.targetAnimator)

    animator.playAttack(undefined, () => {
      hurtAnim.playHurt()
      this.ensureActionLoaded(targetDefId, 'hurt', isActing ? this.targetAnimator : this.actingAnimator)
    })
  }

  playDeath(defId: string): void {
    const isActing = defId === this.actingDefId
    const animator = isActing ? this.actingAnimator : this.targetAnimator
    this.ensureActionLoaded(defId, 'death', animator)
    animator.playDeath()
  }

  // ── Callback wiring ─────────────────────────────────────────────────────────

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

  // ── Lazy data loading ────────────────────────────────────────────────────────

  private async loadCharacterData(defId: string, animator: FigureAnimator): Promise<void> {
    const [manifest, sequence] = await Promise.all([
      loadAsciiManifest(defId),
      loadAsciiSequence(defId),
    ])

    if (sequence) animator.setSequence(sequence)

    // Load idle frames immediately; other actions load on demand
    const idleFrames = await loadAsciiAction(defId, 'idle')
    if (idleFrames) animator.setActionFrames('idle', idleFrames)

    this.emitFrame()
  }

  private async ensureActionLoaded(
    defId: string,
    action: string,
    animator: FigureAnimator,
  ): Promise<void> {
    const frames = await loadAsciiAction(defId, action)
    if (frames) {
      animator.setActionFrames(action, frames)
    }
  }
}
