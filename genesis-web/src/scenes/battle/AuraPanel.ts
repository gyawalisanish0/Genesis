// AuraPanel — scene-root radial glow that tracks a Phaser container.
//
// Base texture: white radial gradient generated once via Canvas 2D API.
// setTint()     → any hue from the full colour space.
// setBlendMode() → ADD for glow, SCREEN for soft bloom, MULTIPLY for shadows.
// setAlpha()    → intensity.
// scene 'update' listener → automatic position sync through any container tween.
//
// Lifetime is caller-driven:
//   show() — fades in, starts optional pulse, begins tracking.
//   hide() — fades out (respects fadeOut from AuraDef), stops tracking.
//   stop() — immediate destroy, no tween.

import Phaser from 'phaser'
import type { AuraDef } from '../../core/types'
import { tokenToInt } from './tokens'

export const AURA_TEXTURE_KEY  = 'aura_radial'
const        AURA_TEXTURE_SIZE = 256    // px; radius at scale 1 = 128 px
const        DEFAULT_FADE_IN   = 200
const        DEFAULT_FADE_OUT  = 400

const BLEND_MODE: Record<string, Phaser.BlendModes> = {
  ADD:      Phaser.BlendModes.ADD,
  SCREEN:   Phaser.BlendModes.SCREEN,
  MULTIPLY: Phaser.BlendModes.MULTIPLY,
  NORMAL:   Phaser.BlendModes.NORMAL,
}

export class AuraPanel {
  private scene:      Phaser.Scene
  private image:      Phaser.GameObjects.Image | null = null
  private pulse:      Phaser.Tweens.Tween | null = null
  private updateFn:   (() => void) | null = null
  private fadeOutMs:  number = DEFAULT_FADE_OUT

  constructor(scene: Phaser.Scene) {
    this.scene = scene
    this.ensureTexture()
  }

  show(auraDef: AuraDef, container: Phaser.GameObjects.Container): void {
    this.stop()

    this.fadeOutMs = auraDef.fadeOut ?? DEFAULT_FADE_OUT

    const mat   = container.getWorldTransformMatrix()
    const image = this.scene.add.image(mat.tx, mat.ty, AURA_TEXTURE_KEY)
    image.setTint(tokenToInt(auraDef.colour))
    image.setBlendMode(BLEND_MODE[auraDef.blendMode] ?? Phaser.BlendModes.ADD)
    image.setScale(auraDef.radius / (AURA_TEXTURE_SIZE / 2))
    image.setAlpha(0)
    this.image = image

    this.updateFn = () => {
      const m = container.getWorldTransformMatrix()
      image.setPosition(m.tx, m.ty)
    }
    this.scene.events.on('update', this.updateFn)

    const peak = auraDef.alpha
    this.scene.tweens.add({
      targets:  image,
      alpha:    peak,
      duration: auraDef.fadeIn ?? DEFAULT_FADE_IN,
      ease:     'Sine.easeOut',
      onComplete: () => {
        if (!auraDef.pulse || this.image !== image) return
        this.pulse = this.scene.tweens.add({
          targets:  image,
          alpha:    { from: peak, to: auraDef.pulse.minAlpha },
          duration: auraDef.pulse.period / 2,
          ease:     'Sine.easeInOut',
          yoyo:     true,
          repeat:   -1,
        })
      },
    })
  }

  hide(onDone?: () => void): void {
    this.clearTracking()
    this.pulse?.destroy()
    this.pulse = null

    if (!this.image) { onDone?.(); return }

    const img = this.image
    this.image = null
    this.scene.tweens.add({
      targets:  img,
      alpha:    0,
      duration: this.fadeOutMs,
      ease:     'Sine.easeOut',
      onComplete: () => { img.destroy(); onDone?.() },
    })
  }

  stop(): void {
    this.clearTracking()
    this.pulse?.destroy()
    this.pulse = null
    this.image?.destroy()
    this.image = null
  }

  // ── Private ────────────────────────────────────────────────────────────────

  private clearTracking(): void {
    if (!this.updateFn) return
    this.scene.events.off('update', this.updateFn)
    this.updateFn = null
  }

  private ensureTexture(): void {
    if (this.scene.textures.exists(AURA_TEXTURE_KEY)) return
    const size   = AURA_TEXTURE_SIZE
    const centre = size / 2
    const canvas = document.createElement('canvas')
    canvas.width  = size
    canvas.height = size
    const ctx  = canvas.getContext('2d')!
    const grad = ctx.createRadialGradient(centre, centre, 0, centre, centre, centre)
    grad.addColorStop(0,    'rgba(255,255,255,1.0)')
    grad.addColorStop(0.35, 'rgba(255,255,255,0.7)')
    grad.addColorStop(0.7,  'rgba(255,255,255,0.25)')
    grad.addColorStop(1,    'rgba(255,255,255,0.0)')
    ctx.fillStyle = grad
    ctx.fillRect(0, 0, size, size)
    this.scene.textures.addCanvas(AURA_TEXTURE_KEY, canvas)
  }
}
