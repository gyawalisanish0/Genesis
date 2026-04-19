// Screen-local context for the Pre-Battle wizard.
// Holds ephemeral step state shared between the three step sub-components.
// Cross-screen selections (selectedMode, selectedTeam) are written to Zustand
// only when the player confirms and navigates to Battle.

import { createContext, useContext, useState, type ReactNode } from 'react'

export type WizardStep = 0 | 1 | 2

interface SelectedChar {
  id: string
  name: string
  className: string
  rarity: number
  maxHp: number
  hp: number
}

interface PreBattleState {
  step: WizardStep
  selectedModeId: string | null
  selectedTeam: SelectedChar[]
  setStep: (s: WizardStep) => void
  selectMode: (id: string) => void
  toggleTeamMember: (char: SelectedChar) => void
  canContinue: boolean
}

const PreBattleContext = createContext<PreBattleState | null>(null)

export function usePreBattleScreen(): PreBattleState {
  const ctx = useContext(PreBattleContext)
  if (!ctx) throw new Error('usePreBattleScreen must be used inside PreBattleProvider')
  return ctx
}

interface Props { children: ReactNode }

export function PreBattleProvider({ children }: Props) {
  const [step, setStep]               = useState<WizardStep>(0)
  const [selectedModeId, setModeId]   = useState<string | null>(null)
  const [selectedTeam, setTeam]       = useState<SelectedChar[]>([])

  const selectMode = (id: string) => setModeId(id)

  const toggleTeamMember = (char: SelectedChar) => {
    setTeam((prev) => {
      const already = prev.some((c) => c.id === char.id)
      if (already) return prev.filter((c) => c.id !== char.id)
      if (prev.length >= 2) return prev  // TEAM_SIZE_MAX = 2
      return [...prev, char]
    })
  }

  const canContinue =
    (step === 0 && selectedModeId !== null) ||
    (step === 1 && selectedTeam.length >= 1) ||
    (step === 2 && selectedTeam.length >= 1)  // START BATTLE requires a selected character

  return (
    <PreBattleContext.Provider value={{
      step, selectedModeId, selectedTeam,
      setStep, selectMode, toggleTeamMember, canContinue,
    }}>
      {children}
    </PreBattleContext.Provider>
  )
}
