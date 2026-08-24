/**
 * Dungeon token layer — the party and every visible entity, drawn as one
 * absolutely-positioned layer above the tile grid.
 *
 * Tokens deliberately do NOT live inside their tile's cell. React re-parents a
 * child when its cell changes, which resets the element and makes movement snap
 * between tiles; positioning each token by transform instead lets it tween
 * along its step and keeps its idle animation running across the move.
 */

import styles from './DungeonArena.module.css'

export type TokenKind = 'party' | 'enemy' | 'chest' | 'exit' | 'npc'

export interface DungeonToken {
  id:       string
  x:        number
  y:        number
  kind:     TokenKind
  glyph:    string
  /** Out of sight range — drawn as a drained "last known position" marker. */
  gray?:    boolean
  /** Wave phase — one of several groups the player may choose to engage. */
  wave?:    boolean
  /** Detected the party; playing the pre-encounter alert. */
  spotted?: boolean
}

const KIND_CLASS: Record<TokenKind, string> = {
  party: styles.party,
  enemy: styles.enemy,
  chest: styles.chest,
  exit:  styles.exit,
  npc:   styles.npc,
}

interface Props {
  tokens: DungeonToken[]
  cellPx: number
}

export function DungeonTokenLayer({ tokens, cellPx }: Props) {
  return (
    <div className={styles.tokenLayer} aria-hidden>
      {tokens.map((t) => (
        <div
          key={t.id}
          className={[
            styles.token,
            KIND_CLASS[t.kind],
            t.gray    ? styles.gray    : '',
            t.wave    ? styles.wave    : '',
            t.spotted ? styles.spotted : '',
          ].filter(Boolean).join(' ')}
          style={{ transform: `translate(${t.x * cellPx}px, ${t.y * cellPx}px)` }}
        >
          <span className={styles.tokenShadow} />
          <span className={styles.tokenBody}>{t.glyph}</span>
          {t.spotted && <span className={styles.tokenAlert}>!</span>}
        </div>
      ))}
    </div>
  )
}
