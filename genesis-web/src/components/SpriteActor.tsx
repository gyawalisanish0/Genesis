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
  /** Someone else holds the tick — this combatant recedes. */
  dimmed?:    boolean
  /** Sequence-driven motion — see components/useAnimSequence.ts. */
  shoving?:      boolean
  dodging?:      boolean
  flashColour?:  string | null
  /** Animation state requested by a `playAnim` phase, overriding idle. */
  stateOverride?: string
}

export function SpriteActor({
  defId, name, facing, manifest = null, isDamaged = false, dead = false, acting = false,
  dimmed = false,
  shoving = false, dodging = false, flashColour = null, stateOverride,
}: Props) {
  const idle = manifest ? withFacing(resolveIdleAnimation(manifest, isDamaged), manifest, facing) : null
  // A playAnim phase names a state directly; fall back to idle's own entry so
  // the frame clock still has a duration to work with.
  const resolved = stateOverride && idle
    ? { ...idle, stateKey: stateOverride, entry: manifest?.animations[stateOverride] ?? idle.entry }
    : idle
  const frame    = useSpriteFrames(resolved?.stateKey ?? null, resolved?.entry ?? null)

  // `display.scale` in the manifest is deliberately ignored. It was authored
  // against the deleted Phaser renderer's coordinate space (512 px source x 0.32),
  // and applying it on top of the CSS box double-scales the sprite. The slot is
  // a fixed 96 dp and the frame is fitted to it, which holds for any source size.
  const frameUrl = resolved ? characterFrameUrl(defId, resolved.stateKey, frame) : null

  return (
    <div
      className={[
        styles.actor, styles[facing],
        dead ? styles.dead : '', acting ? styles.acting : '',
        dimmed ? styles.dimmed : '',
        shoving ? styles.shoving : '', dodging ? styles.dodging : '',
      ].filter(Boolean).join(' ')}
      aria-label={name}
    >
      <div className={styles.body}>
        {/* Impact flash — a flat colour silhouette. Masked by the current frame
            so it takes the sprite's shape; an unmasked overlay would paint a
            solid rectangle over the whole slot. */}
        {flashColour && frameUrl && (
          <span
            className={styles.flash}
            style={{
              background:            flashColour,
              maskImage:             `url(${frameUrl})`,
              WebkitMaskImage:       `url(${frameUrl})`,
            }}
          />
        )}
        {frameUrl
          ? <img className={styles.frame} src={frameUrl} alt="" />
          : <span className={styles.fallback}>{name.charAt(0).toUpperCase()}</span>}
      </div>
      {/* Whose turn it is has to survive having no sprite at all — most of the
          roster still renders the letter fallback — so the cue is chrome around
          the slot, not a change to the figure. */}
      {acting && !dead && <span className={styles.marker} aria-hidden>▼</span>}
      <div className={styles.platform} />
    </div>
  )
}
