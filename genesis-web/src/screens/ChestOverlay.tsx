import type { InteractableEntityDef } from '../core/types'
import { PrimaryButton } from '../components/PrimaryButton'
import styles from './ChestOverlay.module.css'

interface Props {
  chest:     InteractableEntityDef
  onCollect: () => void
}

export function ChestOverlay({ chest, onCollect }: Props) {
  const reward = chest.reward
  return (
    <div className={styles.backdrop}>
      <div className={styles.panel}>
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
        <PrimaryButton variant="primary" onPress={onCollect}>COLLECT</PrimaryButton>
      </div>
    </div>
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
