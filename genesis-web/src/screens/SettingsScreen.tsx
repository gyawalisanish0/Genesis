// Settings screen — audio, display, notifications, account.
// Reads and writes AppSettings from the Zustand store.

import { ScreenShell } from '../navigation/ScreenShell'
import { useScreen } from '../navigation/useScreen'
import { useGameStore } from '../core/GameContext'
import type { AppSettings } from '../core/types'
import styles from './SettingsScreen.module.css'

const APP_VERSION = '0.1.0'

// ── Reusable row components ────────────────────────────────────────────────

function SectionHeader({ label }: { label: string }) {
  return <p className={styles.sectionHeader}>{label}</p>
}

interface SliderRowProps {
  label: string
  value: number
  disabled?: boolean
  onChange: (v: number) => void
}

function SliderRow({ label, value, disabled = false, onChange }: SliderRowProps) {
  return (
    <div className={`${styles.row} ${disabled ? styles.rowDisabled : ''}`}>
      <span className={styles.rowLabel}>{label}</span>
      <input
        type="range"
        min={0}
        max={100}
        value={value}
        disabled={disabled}
        onChange={(e) => onChange(Number(e.target.value))}
        className={styles.slider}
      />
      <span className={styles.sliderValue}>{value}</span>
    </div>
  )
}

interface ToggleRowProps {
  label: string
  value: boolean
  onToggle: () => void
}

function ToggleRow({ label, value, onToggle }: ToggleRowProps) {
  return (
    <div className={styles.row} onPointerDown={onToggle}>
      <span className={styles.rowLabel}>{label}</span>
      <div className={`${styles.toggleTrack} ${value ? styles.toggleTrackOn : ''}`}>
        <div className={`${styles.toggleThumb} ${value ? styles.toggleThumbOn : ''}`} />
      </div>
    </div>
  )
}

interface NavRowProps {
  label: string
  onPress?: () => void
}

function NavRow({ label, onPress }: NavRowProps) {
  return (
    <div className={styles.row} onPointerDown={onPress}>
      <span className={styles.rowLabel}>{label}</span>
      <span className={styles.chevron}>›</span>
    </div>
  )
}

function SectionGroup({ children }: { children: React.ReactNode }) {
  return <div className={styles.group}>{children}</div>
}

// ── Screen ─────────────────────────────────────────────────────────────────

export function SettingsScreen() {
  useScreen()
  const settings      = useGameStore((s) => s.settings)
  const updateSetting = useGameStore((s) => s.updateSetting)

  function set<K extends keyof AppSettings>(key: K, value: AppSettings[K]) {
    updateSetting(key, value)
  }

  return (
    <ScreenShell>
      <div className={styles.root}>

        {/* Sticky header */}
        <header className={styles.header}>
          <button className={styles.backBtn} onPointerDown={() => window.history.back()} aria-label="Back">←</button>
          <span className={styles.headerTitle}>SETTINGS</span>
        </header>

        {/* Scrollable content */}
        <div className={styles.scroll}>

          <SectionHeader label="AUDIO" />
          <SectionGroup>
            <SliderRow label="Music Volume" value={settings.musicVolume} disabled={settings.muteAll} onChange={(v) => set('musicVolume', v)} />
            <div className={styles.divider} />
            <SliderRow label="SFX Volume"   value={settings.sfxVolume}   disabled={settings.muteAll} onChange={(v) => set('sfxVolume', v)} />
            <div className={styles.divider} />
            <ToggleRow label="Mute All"     value={settings.muteAll}     onToggle={() => set('muteAll', !settings.muteAll)} />
          </SectionGroup>

          <SectionHeader label="DISPLAY" />
          <SectionGroup>
            <ToggleRow label="Reduce Animations"    value={settings.reduceAnimations}  onToggle={() => set('reduceAnimations',  !settings.reduceAnimations)} />
            <div className={styles.divider} />
            <ToggleRow label="Show Damage Numbers"  value={settings.showDamageNumbers} onToggle={() => set('showDamageNumbers', !settings.showDamageNumbers)} />
            <div className={styles.divider} />
            <SliderRow label="Timeline Zoom" value={settings.timelineZoom} onChange={(v) => set('timelineZoom', v)} />
          </SectionGroup>

          <SectionHeader label="NOTIFICATIONS" />
          <SectionGroup>
            <ToggleRow label="Battle Reminders"   value={settings.battleReminders}   onToggle={() => set('battleReminders',   !settings.battleReminders)} />
            <div className={styles.divider} />
            <ToggleRow label="New Content Alerts" value={settings.newContentAlerts}  onToggle={() => set('newContentAlerts',  !settings.newContentAlerts)} />
          </SectionGroup>

          <SectionHeader label="ACCOUNT" />
          <SectionGroup>
            <NavRow label="Sync / Cloud Save" />
            <div className={styles.divider} />
            <NavRow label="Restore Purchases" />
            <div className={styles.divider} />
            <NavRow label="Privacy Policy" />
            <div className={styles.divider} />
            <NavRow label="Terms of Service" />
          </SectionGroup>

          <p className={styles.versionFooter}>Genesis v{APP_VERSION} · Build 001</p>

        </div>
      </div>
    </ScreenShell>
  )
}
