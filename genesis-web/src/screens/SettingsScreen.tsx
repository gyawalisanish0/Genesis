// Settings screen — tabbed layout: Sound · Display · Account.
// Notifications folds into Display to keep each tab's content within viewport height.

import { useState } from 'react'
import { ScreenShell } from '../navigation/ScreenShell'
import { useScreen } from '../navigation/useScreen'
import { SCREEN_IDS } from '../navigation/screenRegistry'
import { useBackButton } from '../input/useBackButton'
import { useGameStore } from '../core/GameContext'
import { useScrollAwarePointer } from '../utils/useScrollAwarePointer'
import type { AppSettings } from '../core/types'
import styles from './SettingsScreen.module.css'

const APP_VERSION = '0.1.0'

type SettingsTab = 'sound' | 'display' | 'account'

const TABS: { id: SettingsTab; label: string }[] = [
  { id: 'sound',   label: 'SOUND'   },
  { id: 'display', label: 'DISPLAY' },
  { id: 'account', label: 'ACCOUNT' },
]

// ── Reusable row components ────────────────────────────────────────────────

function SectionHeader({ label }: { label: string }) {
  return <p className={styles.sectionHeader}>{label}</p>
}

interface SliderRowProps {
  label:     string
  value:     number
  disabled?: boolean
  onChange:  (v: number) => void
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
  label:         string
  value:         boolean
  onPointerDown: React.PointerEventHandler<HTMLDivElement>
}

function ToggleRow({ label, value, onPointerDown }: ToggleRowProps) {
  return (
    <div className={styles.row} onPointerDown={onPointerDown}>
      <span className={styles.rowLabel}>{label}</span>
      <div className={`${styles.toggleTrack} ${value ? styles.toggleTrackOn : ''}`}>
        <div className={`${styles.toggleThumb} ${value ? styles.toggleThumbOn : ''}`} />
      </div>
    </div>
  )
}

interface NavRowProps {
  label:         string
  onPointerDown: React.PointerEventHandler<HTMLDivElement>
}

function NavRow({ label, onPointerDown }: NavRowProps) {
  return (
    <div className={styles.row} onPointerDown={onPointerDown}>
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
  const { navigateTo }            = useScreen()
  const handleBack                = useBackButton(() => navigateTo(SCREEN_IDS.MAIN_MENU))
  const settings                  = useGameStore((s) => s.settings)
  const updateSetting             = useGameStore((s) => s.updateSetting)
  const createHandler             = useScrollAwarePointer()
  const [activeTab, setActiveTab] = useState<SettingsTab>('sound')

  function set<K extends keyof AppSettings>(key: K, value: AppSettings[K]) {
    updateSetting(key, value)
  }

  return (
    <ScreenShell>
      <div className={styles.root}>

        {/* Sticky header */}
        <header className={styles.header}>
          <button
            className={styles.backBtn}
            onPointerDown={createHandler({ onTap: handleBack })}
            aria-label="Back"
          >
            ←
          </button>
          <span className={styles.headerTitle}>SETTINGS</span>
        </header>

        {/* Tab bar */}
        <div className={styles.tabBar}>
          {TABS.map(({ id, label }) => (
            <button
              key={id}
              className={`${styles.tabBtn} ${activeTab === id ? styles.tabBtnActive : ''}`}
              onPointerDown={createHandler({ onTap: () => setActiveTab(id) })}
            >
              {label}
            </button>
          ))}
        </div>

        {/* Tab content */}
        <div className={styles.scroll}>

          {activeTab === 'sound' && (
            <SectionGroup>
              <SliderRow
                label="Music Volume"
                value={settings.musicVolume}
                disabled={settings.muteAll}
                onChange={(v) => set('musicVolume', v)}
              />
              <div className={styles.divider} />
              <SliderRow
                label="SFX Volume"
                value={settings.sfxVolume}
                disabled={settings.muteAll}
                onChange={(v) => set('sfxVolume', v)}
              />
              <div className={styles.divider} />
              <ToggleRow
                label="Mute All"
                value={settings.muteAll}
                onPointerDown={createHandler({ onTap: () => set('muteAll', !settings.muteAll) })}
              />
            </SectionGroup>
          )}

          {activeTab === 'display' && (
            <>
              <SectionGroup>
                <ToggleRow
                  label="Reduce Animations"
                  value={settings.reduceAnimations}
                  onPointerDown={createHandler({ onTap: () => set('reduceAnimations', !settings.reduceAnimations) })}
                />
                <div className={styles.divider} />
                <ToggleRow
                  label="Show Damage Numbers"
                  value={settings.showDamageNumbers}
                  onPointerDown={createHandler({ onTap: () => set('showDamageNumbers', !settings.showDamageNumbers) })}
                />
                <div className={styles.divider} />
                <SliderRow
                  label="Timeline Zoom"
                  value={settings.timelineZoom}
                  onChange={(v) => set('timelineZoom', v)}
                />
              </SectionGroup>
              <SectionHeader label="NOTIFICATIONS" />
              <SectionGroup>
                <ToggleRow
                  label="Battle Reminders"
                  value={settings.battleReminders}
                  onPointerDown={createHandler({ onTap: () => set('battleReminders', !settings.battleReminders) })}
                />
                <div className={styles.divider} />
                <ToggleRow
                  label="New Content Alerts"
                  value={settings.newContentAlerts}
                  onPointerDown={createHandler({ onTap: () => set('newContentAlerts', !settings.newContentAlerts) })}
                />
              </SectionGroup>
            </>
          )}

          {activeTab === 'account' && (
            <>
              <SectionGroup>
                <NavRow
                  label="Sync / Cloud Save"
                  onPointerDown={createHandler({ onTap: () => { /* TODO: sync */ } })}
                />
                <div className={styles.divider} />
                <NavRow
                  label="Restore Purchases"
                  onPointerDown={createHandler({ onTap: () => { /* TODO: restore */ } })}
                />
                <div className={styles.divider} />
                <NavRow
                  label="Privacy Policy"
                  onPointerDown={createHandler({ onTap: () => { /* TODO: privacy */ } })}
                />
                <div className={styles.divider} />
                <NavRow
                  label="Terms of Service"
                  onPointerDown={createHandler({ onTap: () => { /* TODO: ToS */ } })}
                />
              </SectionGroup>
              <p className={styles.versionFooter}>Genesis v{APP_VERSION} · Build 001</p>
            </>
          )}

        </div>
      </div>
    </ScreenShell>
  )
}
