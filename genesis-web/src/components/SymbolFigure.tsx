// SymbolFigure — renders a 32×32 ASCII frame with Unicode-block-derived color.
// Color comes from the drawn character, not markup. No inline style tags in frame data.

import type { ReactNode } from 'react'
import styles from './SymbolFigure.module.css'

interface Props {
  frame:   string[]
  palette: Record<string, string>   // paletteKey → CSS token e.g. '--accent-heal'
  rarity:  number
  flipped?: boolean
}

// ── Unicode range → palette key ──────────────────────────────────────────────

const PARTICLE_CODES = new Set([
  0x00B7,  // · middle dot (nanite)
  0x223F,  // ∿ sine wave (psychic)
  0x224B,  // ≋ triple tilde (frequency)
  0x007E,  // ~ tilde
])

function classifyCode(cp: number): string {
  if (cp === 0x0021) return 'impact'                   // !
  if (PARTICLE_CODES.has(cp)) return 'particle'
  if (cp === 0x0020) return 'base'                     // space
  if (cp >= 0x0021 && cp <= 0x007E) return 'base'     // printable ASCII
  if (cp >= 0x2500 && cp <= 0x257F) return 'box'      // box drawing
  if (cp >= 0x2580 && cp <= 0x259F) return 'block'    // block elements
  if (cp >= 0x25A0 && cp <= 0x25FF) return 'identity' // geometric shapes
  if (cp >= 0x2600 && cp <= 0x26FF) return 'weapon'   // misc symbols
  return 'base'
}

// ── Row renderer ─────────────────────────────────────────────────────────────

function renderRow(
  row:       string,
  palette:   Record<string, string>,
  rarityVar: string,
): ReactNode[] {
  const spans: ReactNode[] = []
  let runKey   = ''
  let runChars = ''
  let spanIdx  = 0

  const flush = (): void => {
    if (!runChars) return
    if (runKey === 'base') {
      spans.push(runChars)
    } else {
      const token = runKey === 'identity' ? rarityVar : (palette[runKey] ?? '')
      if (token) {
        spans.push(
          <span key={spanIdx++} style={{ color: `var(${token})` }}>
            {runChars}
          </span>
        )
      } else {
        spans.push(runChars)
      }
    }
    runChars = ''
  }

  for (const char of row) {
    const cp  = char.codePointAt(0) ?? 0
    const key = classifyCode(cp)
    if (key === runKey) {
      runChars += char
    } else {
      flush()
      runKey   = key
      runChars = char
    }
  }
  flush()
  return spans
}

// ── Component ────────────────────────────────────────────────────────────────

export function SymbolFigure({ frame, palette, rarity, flipped }: Props) {
  const rarityVar = `--rarity-${rarity}`

  return (
    <pre
      className={styles.figure}
      style={flipped ? { transform: 'scaleX(-1)' } : undefined}
      aria-hidden="true"
    >
      {frame.map((row, rowIdx) => (
        <div key={rowIdx} className={styles.row}>
          {renderRow(row, palette, rarityVar)}
        </div>
      ))}
    </pre>
  )
}
