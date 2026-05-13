// ProjectilePanel — fires a projectile from the acting unit to the target.
// If the manifest provides projectile frames they drive texture animation while
// travelling; otherwise a runtime-generated orb is used as the fallback.
//
// onImpact fires the instant the projectile arrives at the target position.
// onDone fires IMPACT_HOLD_MS later so particles/flash have time to ignite
// before the phase advances.

import Phaser from 'phaser'
import type { AnimationProjectileDef, AnimationStateDef } from '../../core/types'
import { AnimationPlayer, frameKey } from './AnimationPlayer'

export const PROJECTILE_ORB_KEY = 'battle_orb'

const ORB_COLOUR         = 0xc084fc   // soft purple — matches --accent-genesis family
const ORB_RADIUS         = 8
const ORB_SIZE           = ORB_RADIUS * 2
const DEFAULT_SPEED_PX_S = 400        // px/s when manifest omits speed
const IMPACT_HOLD_MS     = 60         // brief hold so impact FX ignite before onDone

export class ProjectilePanel {
  private scene: Phaser.Scene

  constructor(scene: Phaser.Scene) {
    this.scene = scene
    this.ensureOrbTexture()
  }

  fire(
    defId:      string,
    projectile: AnimationProjectileDef | null,
    fromX:      number,
    fromY:      number,
    toX:        number,
    toY:        number,
    onImpact:   () => void,
    onDone:     () => void,
  ): void {
    const textureKey = this.resolveTextureKey(defId, projectile)
    const scale      = projectile?.scale ?? 1
    const speedPxS   = projectile?.speed ?? DEFAULT_SPEED_PX_S
    const travelMs   = this.travelDuration(fromX, fromY, toX, toY, speedPxS)

    const sprite = this.scene.add.image(fromX, fromY, textureKey)
    sprite.setScale(scale)
    sprite.setRotation(Math.atan2(toY - fromY, toX - fromX))

    const player = this.startFrameLoop(sprite, defId, projectile)

    this.scene.tweens.add({
      targets:  sprite,
      x:        toX,
      y:        toY,
      duration: travelMs,
      ease:     'Linear',
      onComplete: () => {
        player?.stop()
        sprite.destroy()
        onImpact()
        this.scene.time.delayedCall(IMPACT_HOLD_MS, onDone)
      },
    })
  }

  // ── Private helpers ────────────────────────────────────────────────────────

  private ensureOrbTexture(): void {
    if (this.scene.textures.exists(PROJECTILE_ORB_KEY)) return
    const gfx = this.scene.make.graphics({}, false)
    gfx.fillStyle(ORB_COLOUR)
    gfx.fillCircle(ORB_RADIUS, ORB_RADIUS, ORB_RADIUS)
    gfx.generateTexture(PROJECTILE_ORB_KEY, ORB_SIZE, ORB_SIZE)
    gfx.destroy()
  }

  private resolveTextureKey(defId: string, projectile: AnimationProjectileDef | null): string {
    if (!projectile || projectile.frames <= 0) return PROJECTILE_ORB_KEY
    const key = frameKey(defId, 'projectile', 0)
    return this.scene.textures.exists(key) ? key : PROJECTILE_ORB_KEY
  }

  private startFrameLoop(
    sprite:     Phaser.GameObjects.Image,
    defId:      string,
    projectile: AnimationProjectileDef | null,
  ): AnimationPlayer | null {
    if (!projectile || projectile.frames <= 1) return null
    if (!this.scene.textures.exists(frameKey(defId, 'projectile', 0))) return null

    const entry: AnimationStateDef = {
      frames:    projectile.frames,
      frameRate: projectile.frameRate,
      repeat:    -1,
    }
    const player = new AnimationPlayer(this.scene, sprite)
    player.play(defId, 'projectile', entry)
    return player
  }

  private travelDuration(
    fromX: number, fromY: number,
    toX:   number, toY:   number,
    speedPxS: number,
  ): number {
    const dx   = toX - fromX
    const dy   = toY - fromY
    const dist = Math.sqrt(dx * dx + dy * dy)
    return Math.round((dist / speedPxS) * 1000)
  }
}
