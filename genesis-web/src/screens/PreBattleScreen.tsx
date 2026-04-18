// Pre-Battle 3-step wizard: Mode → Team → Items → Battle.
// Per-screen state is managed by PreBattleProvider (screen-local context).

import { ScreenShell } from '../navigation/ScreenShell'
import { useScreen } from '../navigation/useScreen'
import { SCREEN_IDS } from '../navigation/screenRegistry'
import { useBackButton } from '../input/useBackButton'
import { useScrollAwarePointer } from '../utils/useScrollAwarePointer'
import { PreBattleProvider, usePreBattleScreen, type WizardStep } from './PreBattleContext'
import { PreBattleStepMode }  from './PreBattleStepMode'
import { PreBattleStepTeam }  from './PreBattleStepTeam'
import { PreBattleStepItems } from './PreBattleStepItems'
import { useGameStore } from '../core/GameContext'
import type { ModeDef } from '../core/types'
import styles from './PreBattleScreen.module.css'

// Builds a minimal ModeDef from the wizard's mode id until DataService is wired.
function buildModeDef(id: string): ModeDef {
  const names: Record<string, string> = { story: 'Story Mode', ranked: 'Ranked', draft: 'Draft Mode' }
  return {
    type: 'mode', id, name: names[id] ?? id,
    description: '', settings: { enemyAi: 'basic', respawn: false, timeLimitTicks: null },
  }
}

const STEP_LABELS = ['MODE', 'TEAM', 'ITEMS'] as const

function PreBattleWizard() {
  const { step, setStep, canContinue, selectedModeId, selectedTeam } = usePreBattleScreen()
  const { navigateTo } = useScreen()
  const setSelectedMode    = useGameStore((s) => s.setSelectedMode)
  const setSelectedTeamIds = useGameStore((s) => s.setSelectedTeamIds)

  // handleBack is registered with the global input registry so the hardware back
  // button and the on-screen ← button always invoke the same wizard-step logic.
  const handleBack = useBackButton(() => {
    if (step > 0) { setStep((step - 1) as WizardStep); return }
    navigateTo(SCREEN_IDS.MAIN_MENU)
  })
  const createHandler = useScrollAwarePointer()

  const handleContinue = () => {
    if (step < 2) { setStep((step + 1) as WizardStep); return }
    // Step 3 confirm — write to global store and enter battle.
    if (selectedModeId) setSelectedMode(buildModeDef(selectedModeId))
    setSelectedTeamIds(selectedTeam.map((c) => c.id))
    navigateTo(SCREEN_IDS.BATTLE)
  }

  return (
    <div className={styles.wizard}>
      {/* Wizard header */}
      <header className={styles.header}>
        <button className={styles.backBtn} onPointerDown={createHandler({ onTap: handleBack })} aria-label="Back">←</button>
        <div className={styles.stepIndicator}>
          {STEP_LABELS.map((label, i) => (
            <span key={label} className={`${styles.stepDot} ${i === step ? styles.stepDotActive : ''}`} />
          ))}
        </div>
        <span className={styles.stepLabel}>{STEP_LABELS.join(' · ')}</span>
        <div className={styles.headerSpacer} />
      </header>

      {/* Step content */}
      <div className={styles.content}>
        {step === 0 && <PreBattleStepMode />}
        {step === 1 && <PreBattleStepTeam />}
        {step === 2 && <PreBattleStepItems />}
      </div>

      {/* Sticky continue button */}
      <div className={styles.footer}>
        <button
          className={`${styles.continueBtn} ${!canContinue ? styles.continueBtnDisabled : ''}`}
          disabled={!canContinue}
          onPointerDown={createHandler({ onTap: handleContinue })}
        >
          {step < 2 ? 'CONTINUE →' : '▶ START BATTLE'}
        </button>
      </div>
    </div>
  )
}

export function PreBattleScreen() {
  return (
    <ScreenShell>
      <PreBattleProvider>
        <PreBattleWizard />
      </PreBattleProvider>
    </ScreenShell>
  )
}
