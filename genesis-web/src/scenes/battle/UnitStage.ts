// UnitStage — manages the two unit figures shown during a turn.
// Acting unit slides in from the left, target from the right.
//
// Each figure slot owns one AuraPanel (scene-root, synced via update event).
// The aura definition lives on AnimationStateDef.aura — no separate config.
//
// Animation lock: fig.locked is true while a play-once animation runs on that
// figure. shoveActing() respects the acting lock (drops if already animating).
// flashTarget() and evasionDodge() respect the target lock (skip reaction if locked).

import Phaser from 'phaser'
import { tokenToHex }   from './tokens'
import type { AnimationManifest, AnimationStateDef } from '../../core/types'
import { AnimationPlayer, frameKey } from './AnimationPlayer'
import { AuraPanel } from './AuraPanel'
import {
  resolveIdleAnimation,
  resolveReactionAnimation,
  resolveDashAnimation,
  resolveDeathAnimation,
} from './AnimationResolver'

const UNIT_W        = 128
const UNIT_H        = 92
const SLIDE_MS      = 300
const SHOVE_MS      = 190
const SHOVE_HOLD_MS = 60
const FADE_MS       = 420
const ACTING_STROKE = 0x8b5cf6
const TARGET_STROKE = 0xef4444
const UNIT_BG       = 0x12121e

interface FigureRef {
  container:  Phaser.GameObjects.Container
  bg:         Phaser.GameObjects.Rectangle
  sprite:     Phaser.GameObjects.Image | null
  animPlayer: AnimationPlayer | null
  isDamaged:  boolean
  manifest:   AnimationManifest | null
  defId:      string
  locked:     boolean   // true while a play-once animation is running
}

export class UnitStage {
  private scene:       Phaser.Scene
  private topInset:    number
  private acting:      FigureRef | null = null
  private target:      FigureRef | null = null
  private actingDefId: string = ''
  private targetDefId: string = ''
  private visible:     boolean = false
  private idleTweens:  Phaser.Tweens.Tween[] = []
  private impactTimer: Phaser.Time.TimerEvent | null = null
  private actingAura:  AuraPanel
  private targetAura:  AuraPanel

  constructor(scene: Phaser.Scene, topInset = 0) {
    this.scene      = scene
    this.topInset   = topInset
    this.actingAura = new AuraPanel(scene)
    this.targetAura = new AuraPanel(scene)
  }

  get isVisible(): boolean { return this.visible }

  /** True while any figure has a play-once animation in progress. */
  isAnimating(): boolean {
    return (this.acting?.locked ?? false) || (this.target?.locked ?? false)
  }

  actingX(): number { return this.acting?.container.x ?? 0 }
  actingY(): number { return this.acting?.container.y ?? 0 }
  targetX(): number { return this.target?.container.x ?? 0 }
  targetY(): number { return this.target?.container.y ?? 0 }

  getActingContainer(): Phaser.GameObjects.Container | null { return this.acting?.container ?? null }
  getTargetContainer(): Phaser.GameObjects.Container | null { return this.target?.container ?? null }

  actingIsDamaged(): boolean { return this.acting?.isDamaged ?? false }
  targetIsDamaged(): boolean { return this.target?.isDamaged ?? false }

  show(
    actingDefId:    string,
    targetDefId:    string,
    actingManifest: AnimationManifest | null = null,
    targetManifest: AnimationManifest | null = null,
    isDamaged:      { acting: boolean; target: boolean } = { acting: false, target: false },
  ): void {
    this.destroyAll()
    this.actingDefId = actingDefId
    this.targetDefId = targetDefId

    const { width, height } = this.scene.scale
    const contentH = height - this.topInset
    const stageH   = Math.floor(contentH * 0.55)
    const cy       = this.topInset + Math.floor(stageH * 0.48)

    const ax = Math.floor(width * 0.22)
    this.acting = this.buildFigure(actingDefId, cy, 'acting', actingManifest, isDamaged.acting)
    this.acting.container.setPosition(-UNIT_W, cy)

    const tx = Math.floor(width * 0.78)
    this.target = this.buildFigure(targetDefId, cy, 'target', targetManifest, isDamaged.target)
    this.target.container.setPosition(width + UNIT_W, cy)

    this.visible = true

    let entered = 0
    const afterSlide = () => { if (++entered >= 2) this.startIdle() }
    this.scene.tweens.add({ targets: this.acting.container, x: ax, duration: SLIDE_MS, ease: 'Back.easeOut', onComplete: afterSlide })
    this.scene.tweens.add({ targets: this.target.container, x: tx, duration: SLIDE_MS, ease: 'Back.easeOut', onComplete: afterSlide })
  }

  /** Swap the idle animation (and aura) to/from the damaged variant. */
  setDamaged(defId: string, isDamaged: boolean): void {
    const fig = defId === this.actingDefId ? this.acting
              : defId === this.targetDefId ? this.target
              : null
    if (!fig || fig.isDamaged === isDamaged) return
    fig.isDamaged = isDamaged
    this.restartIdle(fig)
  }

  hide(onDone?: () => void): void {
    if (!this.visible) { onDone?.(); return }
    this.stopIdle()
    this.actingAura.hide()
    this.targetAura.hide()

    const { width } = this.scene.scale
    const oldActing = this.acting
    const oldTarget = this.target
    this.acting = null
    this.target = null
    this.visible = false

    const total = (oldActing ? 1 : 0) + (oldTarget ? 1 : 0)
    if (!total) { onDone?.(); return }

    let done = 0
    const each = () => { if (++done >= total) onDone?.() }

    if (oldActing) {
      this.scene.tweens.add({
        targets: oldActing.container, x: -UNIT_W,
        duration: SLIDE_MS, ease: 'Back.easeIn',
        onComplete: () => { oldActing.container.destroy(); each() },
      })
    }
    if (oldTarget) {
      this.scene.tweens.add({
        targets: oldTarget.container, x: width + UNIT_W,
        duration: SLIDE_MS, ease: 'Back.easeIn',
        onComplete: () => { oldTarget.container.destroy(); each() },
      })
    }
  }

  /**
   * Pure colour tint flash on any figure — no hurt animation.
   * Used by the standalone `flash` sequence phase.
   */
  pureFlash(figure: 'acting' | 'target', colour = 0xffffff): void {
    const fig = figure === 'acting' ? this.acting : this.target
    if (!fig) return
    const rect = this.scene.add.rectangle(0, 0, UNIT_W, UNIT_H, colour, 1)
    fig.container.add(rect)
    this.scene.tweens.add({
      targets: rect, alpha: 0, duration: 140, ease: 'Sine.easeOut',
      onComplete: () => rect.destroy(),
    })
  }

  /** Flash the target figure and play the hurt reaction animation concurrently. */
  flashTarget(hitColour: number): void {
    if (!this.target) return
    const flash = this.scene.add.rectangle(0, 0, UNIT_W, UNIT_H, hitColour, 1)
    this.target.container.add(flash)
    this.scene.tweens.add({
      targets: flash, alpha: 0, duration: 140, ease: 'Sine.easeOut',
      onComplete: () => flash.destroy(),
    })

    if (!this.target.locked) {
      const resolved = this.target.manifest
        ? resolveReactionAnimation(this.target.manifest, 'hurt', this.target.isDamaged)
        : null
      if (resolved) {
        this.playOneShot(this.target, resolved.stateKey, resolved.entry, () => {
          if (this.target) this.restartIdle(this.target)
        })
      }
    }
  }

  /** Dodge tween + dodge reaction animation on the target figure. */
  shoveActing(dx: number, onImpact: (() => void) | null, onDone: () => void): void {
    if (!this.acting) { onImpact?.(); onDone(); return }
    if (this.acting.locked) { onImpact?.(); onDone(); return }

    const c = this.acting.container
    this.stopIdle()

    // Show the dash pose for the duration of the shove tween.
    const dashResolved = this.acting.manifest
      ? resolveDashAnimation(this.acting.manifest, this.acting.isDamaged)
      : null
    if (dashResolved && this.acting.sprite) {
      const key = frameKey(this.acting.defId, dashResolved.stateKey, 0)
      if (this.scene.textures.exists(key)) {
        this.acting.animPlayer?.stop()
        this.acting.sprite.setTexture(key)
      }
    }

    this.acting.locked = true
    this.impactTimer?.destroy()
    if (onImpact) {
      this.impactTimer = this.scene.time.delayedCall(SHOVE_MS, () => {
        this.impactTimer = null
        onImpact()
      })
    }

    this.scene.tweens.add({
      targets: c, x: c.x + dx, duration: SHOVE_MS,
      ease: 'Sine.easeIn', yoyo: true, hold: SHOVE_HOLD_MS,
      onComplete: () => {
        if (this.acting) {
          this.acting.locked = false
          this.restartIdle(this.acting)
        }
        onDone()
      },
    })
  }

  /** Container dodge tween + dodge reaction animation on the target figure. */
  evasionDodge(onDone: () => void): void {
    if (!this.target) { onDone(); return }
    const c         = this.target.container
    this.stopIdle()
    const direction = c.x >= this.scene.scale.width / 2 ? 1 : -1
    const dodgeDx   = direction * Math.floor(this.scene.scale.width * 0.09)

    if (!this.target.locked) {
      const resolved = this.target.manifest
        ? resolveReactionAnimation(this.target.manifest, 'dodge', this.target.isDamaged)
        : null
      if (resolved) {
        this.playOneShot(this.target, resolved.stateKey, resolved.entry, () => {
          if (this.target) this.restartIdle(this.target)
        })
      }
    }

    this.scene.tweens.add({
      targets: c, x: c.x + dodgeDx,
      duration: 170, ease: 'Sine.easeOut', yoyo: true, hold: 40,
      onComplete: () => onDone(),
    })
  }

  /**
   * Play a named animation state on a figure. stateKey uses path-style
   * notation: top-level states ('hurt', 'idle') or skill states
   * ('skills/hugo_001_hammer_bash'). Advances onDone when frames complete.
   * No-ops gracefully if the figure, manifest, or texture is absent.
   */
  playFigureAnim(figure: 'acting' | 'target', stateKey: string, onDone: () => void): void {
    const fig = figure === 'acting' ? this.acting : this.target
    if (!fig || !fig.manifest) { onDone(); return }
    // Check skills sub-object first (most playAnim phases reference skill IDs),
    // then fall back to top-level states (idle, hurt, dodge, etc.).
    const entry = fig.manifest.animations.skills?.[stateKey]
      ?? (fig.manifest.animations[stateKey] as import('../../core/types').AnimationStateDef | undefined)
    if (!entry || fig.locked) { onDone(); return }
    this.playOneShot(fig, stateKey, entry, onDone)
  }

  /** Show or hide the aura for a figure. Used by the `aura` sequence phase. */
  setAura(figure: 'acting' | 'target', show: boolean): void {
    const fig  = figure === 'acting' ? this.acting : this.target
    const aura = figure === 'acting' ? this.actingAura : this.targetAura
    if (!fig) return
    if (show) {
      const resolved = fig.manifest ? resolveIdleAnimation(fig.manifest, fig.isDamaged) : null
      if (resolved?.entry.aura) aura.show(resolved.entry.aura, fig.container)
    } else {
      aura.hide()
    }
  }

  /** Play the death animation then fade out, then destroy. */
  collapseByDefId(defId: string, onDone: () => void): void {
    const fig = defId === this.actingDefId ? this.acting
              : defId === this.targetDefId ? this.target
              : null
    if (!fig) { onDone(); return }
    this.stopIdle()
    this.auraFor(fig).hide()

    const c = fig.container
    this.playDeathAndFade(fig, () => {
      c.destroy()
      if (fig === this.acting) this.acting = null
      else                      this.target = null
      onDone()
    })
  }

  // ── Private helpers ────────────────────────────────────────────────────────

  private auraFor(fig: FigureRef): AuraPanel {
    return fig === this.acting ? this.actingAura : this.targetAura
  }

  /** Restart the idle animation loop on a figure using AnimationResolver fallback chain. */
  private restartIdle(fig: FigureRef): void {
    if (!fig.sprite || !fig.manifest) return
    const resolved = resolveIdleAnimation(fig.manifest, fig.isDamaged)
    if (!resolved || !this.scene.textures.exists(frameKey(fig.defId, resolved.stateKey, 0))) return
    fig.animPlayer?.stop()
    const player = new AnimationPlayer(this.scene, fig.sprite)
    player.play(fig.defId, resolved.stateKey, resolved.entry)
    fig.animPlayer = player
    this.auraFor(fig).stop()
    if (resolved.entry.aura) this.auraFor(fig).show(resolved.entry.aura, fig.container)
  }

  /** Play a play-once animation, set the lock, clear it and call onDone when complete. */
  private playOneShot(
    fig:      FigureRef,
    stateKey: string,
    entry:    AnimationStateDef,
    onDone?:  () => void,
  ): void {
    if (!fig.sprite || !this.scene.textures.exists(frameKey(fig.defId, stateKey, 0))) {
      onDone?.(); return
    }
    fig.locked = true
    fig.animPlayer?.stop()
    const player = new AnimationPlayer(this.scene, fig.sprite)
    player.play(fig.defId, stateKey, entry, () => {
      fig.locked = false
      onDone?.()
    })
    fig.animPlayer = player
  }

  /** Play death animation (if manifest defines one) then fade the container to 0 alpha. */
  private playDeathAndFade(fig: FigureRef, onDone: () => void): void {
    const resolved = fig.manifest ? resolveDeathAnimation(fig.manifest, fig.isDamaged) : null
    const doFade = () => {
      this.scene.tweens.add({
        targets: fig.container, alpha: 0, y: fig.container.y + 24,
        duration: FADE_MS, ease: 'Sine.easeIn',
        onComplete: onDone,
      })
    }
    if (resolved && fig.sprite && this.scene.textures.exists(frameKey(fig.defId, resolved.stateKey, 0))) {
      this.playOneShot(fig, resolved.stateKey, resolved.entry, doFade)
    } else {
      doFade()
    }
  }

  private startIdle(): void {
    if (!this.acting || !this.target) return
    const containers = [this.acting.container, this.target.container]
    containers.forEach((c, i) => {
      const t = this.scene.tweens.add({
        targets:  c,
        scaleX:   { from: 1, to: 1.015 },
        scaleY:   { from: 1, to: 1.015 },
        duration: 1800,
        ease:     'Sine.easeInOut',
        yoyo:     true,
        repeat:   -1,
        delay:    i * 400,
      })
      this.idleTweens.push(t)
    })
  }

  private stopIdle(): void {
    for (const t of this.idleTweens) t.stop()
    this.idleTweens = []
    this.acting?.container.setScale(1)
    this.target?.container.setScale(1)
    this.impactTimer?.destroy()
    this.impactTimer = null
  }

  private destroyAll(): void {
    this.stopIdle()
    this.actingAura.stop()
    this.targetAura.stop()
    this.acting?.animPlayer?.stop()
    this.acting?.container.destroy()
    this.acting = null
    this.target?.animPlayer?.stop()
    this.target?.container.destroy()
    this.target = null
    this.visible = false
  }

  private buildFigure(
    defId:    string,
    cy:       number,
    role:     'acting' | 'target',
    manifest: AnimationManifest | null,
    damaged:  boolean,
  ): FigureRef {
    const stroke   = role === 'acting' ? ACTING_STROKE : TARGET_STROKE
    const roleText = role === 'acting' ? '▲ ACTING'    : '◎ TARGET'
    const roleTint = role === 'acting'
      ? tokenToHex('var(--accent-genesis)')
      : tokenToHex('var(--accent-danger)')

    const container = this.scene.add.container(0, cy)
    const bg        = this.scene.add.rectangle(0, 0, UNIT_W, UNIT_H, UNIT_BG).setStrokeStyle(2, stroke)
    container.add(bg)

    container.add(this.scene.add.text(0, -UNIT_H / 2 + 8, roleText, {
      fontFamily: 'system-ui,sans-serif', fontSize: '9px', color: roleTint,
    }).setOrigin(0.5, 0))

    const parts = defId.replace(/_/g, ' ').toUpperCase().split(' ')
    const line1 = parts.slice(0, -1).join(' ') || parts[0]
    const line2 = parts.length > 1 ? parts[parts.length - 1] : ''

    container.add(this.scene.add.text(0, -10, line1, {
      fontFamily: 'system-ui,sans-serif', fontSize: '13px', color: '#f1f0ff', fontStyle: 'bold',
    }).setOrigin(0.5))

    if (line2) {
      container.add(this.scene.add.text(0, 7, line2, {
        fontFamily: 'system-ui,sans-serif', fontSize: '10px', color: '#9b8ec4',
      }).setOrigin(0.5))
    }

    let sprite:     Phaser.GameObjects.Image | null = null
    let animPlayer: AnimationPlayer | null = null

    if (manifest) {
      const resolved = resolveIdleAnimation(manifest, damaged)
      const firstKey = resolved ? frameKey(defId, resolved.stateKey, 0) : null

      if (resolved && firstKey && this.scene.textures.exists(firstKey)) {
        bg.setVisible(false)
        sprite = this.scene.add.image(0, 0, firstKey)
        sprite.setScale(manifest.display.scale)
        sprite.setOrigin(manifest.display.anchorX, manifest.display.anchorY)
        container.add(sprite)

        animPlayer = new AnimationPlayer(this.scene, sprite)
        animPlayer.play(defId, resolved.stateKey, resolved.entry)

        if (resolved.entry.aura) {
          const aura = role === 'acting' ? this.actingAura : this.targetAura
          aura.show(resolved.entry.aura, container)
        }
      }
    }

    if (!sprite) {
      container.add(this.scene.add.text(0, UNIT_H / 2 - 12, '[ art ]', {
        fontFamily: 'system-ui,sans-serif', fontSize: '8px', color: '#5c5480',
      }).setOrigin(0.5))
    }

    return { container, bg, sprite, animPlayer, isDamaged: damaged, manifest, defId, locked: false }
  }
}
