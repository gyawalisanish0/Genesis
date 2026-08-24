// SpriteActor — one combatant on the battle stage.
// Renders the resolved animation frame when art exists, and a lettered box when
// it does not, so the stage is complete before any sprite is authored.
// Spec: docs/ui/01-components.md § SpriteActor.

import type { AnimationManifest } from '../core/types'
import type { Facing } from '../core/battle/AnimationResolver'
import { resolveIdleAnimation, withFacing } from '../core/battle/AnimationResolver'
import { characterFrameUrl } from '../services/DataService'
import { useSpriteFrames } from './useSpriteFrames'
import styles from './SpriteActor.module.css'

interface Props {
  defId:     string
  name:      string
  facing:    Facing
  manifest?: AnimationManifest | null
  isDamaged?: boolean
  dead?:      boolean
  /** Highlights the combatant whose turn is resolving. */
  acting?:    boolean
}

export function SpriteActor({
  defId, name, facing, manifest = null, isDamaged = false, dead = false, acting = false,
}: Props) {
  const resolved = manifest ? withFacing(resolveIdleAnimation(manifest, isDamaged), manifest, facing) : null
  const frame    = useSpriteFrames(resolved?.stateKey ?? null, resolved?.entry ?? null)

  // `display.scale` in the manifest is deliberately ignored. It was authored
  // against the deleted Phaser renderer's coordinate space (512 px source x 0.32),
  // and applying it on top of the CSS box double-scales the sprite. The slot is
  // a fixed 96 dp and the frame is fitted to it, which holds for any source size.
  return (
    <div
      className={[styles.actor, styles[facing], dead ? styles.dead : '', acting ? styles.acting : '']
        .filter(Boolean).join(' ')}
      aria-label={name}
    >
      <div className={styles.body}>
        {resolved
          ? <img className={styles.frame} src={characterFrameUrl(defId, resolved.stateKey, frame)} alt="" />
          : <span className={styles.fallback}>{name.charAt(0).toUpperCase()}</span>}
      </div>
      <div className={styles.platform} />
    </div>
  )
}
