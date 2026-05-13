// AnimationPlayer — drives per-frame texture swaps on a Phaser sprite.
// Loads individual PNG frames from public/images/characters/{defId}/{stateKey}/{n}.png
// and swaps them at the declared frameRate. No spritesheets — each frame is
// a separate texture key loaded via BattleScene.preload().

import Phaser from 'phaser'
import type { AnimationStateDef } from '../../core/types'

export function frameKey(defId: string, stateKey: string, index: number): string {
  return `${defId}/${stateKey}/${index}`
}

export function framePath(defId: string, stateKey: string, index: number): string {
  return `images/characters/${defId}/${stateKey}/${index}.png`
}

export class AnimationPlayer {
  private scene:      Phaser.Scene
  private sprite:     Phaser.GameObjects.Image
  private timer:      Phaser.Time.TimerEvent | null = null
  private frameIndex: number = 0
  private defId:      string = ''
  private stateKey:   string = ''

  constructor(scene: Phaser.Scene, sprite: Phaser.GameObjects.Image) {
    this.scene  = scene
    this.sprite = sprite
  }

  /** Preload all frames for a given state into the Phaser texture cache. */
  static preloadState(scene: Phaser.Scene, defId: string, stateKey: string, frames: number): void {
    for (let i = 0; i < frames; i++) {
      const key  = frameKey(defId, stateKey, i)
      const path = framePath(defId, stateKey, i)
      if (!scene.textures.exists(key)) {
        scene.load.image(key, path)
      }
    }
  }

  play(defId: string, stateKey: string, entry: AnimationStateDef, onComplete?: () => void): void {
    this.stop()
    this.defId    = defId
    this.stateKey = stateKey
    this.frameIndex = 0

    const intervalMs = 1000 / entry.frameRate
    const totalFrames = entry.frames

    const advance = () => {
      const key = frameKey(defId, stateKey, this.frameIndex)
      if (this.scene.textures.exists(key)) {
        this.sprite.setTexture(key)
      }

      this.frameIndex++

      if (this.frameIndex >= totalFrames) {
        if (entry.repeat === -1) {
          this.frameIndex = 0
        } else {
          this.stop()
          onComplete?.()
        }
      }
    }

    // Show first frame immediately
    advance()

    if (entry.repeat === 0 && totalFrames <= 1) {
      // Single frame play-once — already done
      onComplete?.()
      return
    }

    this.timer = this.scene.time.addEvent({
      delay:    intervalMs,
      callback: advance,
      loop:     true,
    })
  }

  stop(): void {
    this.timer?.destroy()
    this.timer = null
  }

  isPlaying(): boolean {
    return this.timer !== null
  }
}
