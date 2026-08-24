import type { InteractableEntityDef } from '../core/types'
import { PixelButton } from '../components/PixelButton'
import { Sheet } from '../components/Sheet'
import styles from './ChestOverlay.module.css'

interface Props {
  chest:     InteractableEntityDef
  onCollect: () => void
}

// Not dismissible — the player must COLLECT to close. Chrome is the shared Sheet.
export function ChestOverlay({ chest, onCollect }: Props) {
  const reward = chest.reward
  return (
    <Sheet placement="centre" dismissible={false} accent="var(--accent-gold)">
      <div className={styles.body}>
        <div className={styles.icon}>◈</div>
        <span className={styles.title}>SUPPLY CACHE</span>
        {reward?.narrativeText && (
          <p className={styles.flavour}>{reward.narrativeText}</p>
        )}
        {reward && (
          <div className={styles.rewards}>
            {reward.gold != null && (
              <RewardRow icon="⬡" label="Credits" value={`+${reward.gold}`} />
            )}
            {reward.xp != null && (
              <RewardRow icon="▲" label="Experience" value={`+${reward.xp} XP`} />
            )}
            {reward.items?.map((item) => (
              <RewardRow key={item} icon="▣" label={item.replace(/_/g, ' ').toUpperCase()} />
            ))}
          </div>
        )}
        <PixelButton variant="primary" onPress={onCollect}>COLLECT</PixelButton>
      </div>
    </Sheet>
  )
}

function RewardRow({ icon, label, value }: { icon: string; label: string; value?: string }) {
  return (
    <div className={styles.rewardRow}>
      <span className={styles.rewardIcon}>{icon}</span>
      <span className={styles.rewardLabel}>{label}</span>
      {value && <span className={styles.rewardValue}>{value}</span>}
    </div>
  )
}
