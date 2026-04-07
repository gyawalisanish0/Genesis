// Displays a character portrait with a rarity-coloured border.
// Size variants: sm 40dp · md 64dp · lg 96dp · xl 120dp

import styles from './UnitPortrait.module.css'

type PortraitSize = 'sm' | 'md' | 'lg' | 'xl'

interface Props {
  name: string
  rarity: number          // 1–7
  imageUrl?: string
  size?: PortraitSize
  greyscale?: boolean     // used on defeat screen for fallen units
}

const RARITY_VARS: Record<number, string> = {
  1: 'var(--rarity-1)', 2: 'var(--rarity-2)', 3: 'var(--rarity-3)',
  4: 'var(--rarity-4)', 5: 'var(--rarity-5)', 6: 'var(--rarity-6)',
  7: 'var(--rarity-4)',  // Omega uses genesis purple border; gradient applied elsewhere
}

export function UnitPortrait({ name, rarity, imageUrl, size = 'md', greyscale = false }: Props) {
  const borderColor = RARITY_VARS[rarity] ?? 'var(--rarity-1)'
  const initial = name.charAt(0).toUpperCase()

  return (
    <div
      className={`${styles.portrait} ${styles[size]} ${greyscale ? styles.greyscale : ''}`}
      style={{ borderColor }}
      aria-label={name}
    >
      {imageUrl
        ? <img src={imageUrl} alt={name} className={styles.image} />
        : <span className={styles.initial}>{initial}</span>
      }
    </div>
  )
}
