// Screen-local context for the Battle screen.
// Holds ephemeral within-session state: active turn, action log, animation locks.
// The global Zustand store is NOT written during battle frames — only on battle end.

import { createContext, useContext, useState, useCallback, type ReactNode } from 'react'
import type { Unit, SkillInstance } from '../core/types'

export type TurnPhase = 'player' | 'enemy' | 'resolving'

export interface LogEntry {
  id:      string
  text:    string
  colour?: string   // CSS colour value; undefined = default text-muted
}

interface BattleState {
  phase:           TurnPhase
  turnNumber:      number
  tickValue:       number
  playerUnit:      Unit | null
  enemies:         Unit[]
  log:             LogEntry[]
  selectedSkill:   SkillInstance | null
  gridCollapsed:   boolean
  isPaused:        boolean
  // Actions
  setPhase:        (p: TurnPhase) => void
  appendLog:       (entry: Omit<LogEntry, 'id'>) => void
  selectSkill:     (skill: SkillInstance | null) => void
  toggleGrid:      () => void
  setPaused:       (v: boolean) => void
}

const BattleContext = createContext<BattleState | null>(null)

export function useBattleScreen(): BattleState {
  const ctx = useContext(BattleContext)
  if (!ctx) throw new Error('useBattleScreen must be used inside BattleProvider')
  return ctx
}

interface Props { children: ReactNode }

export function BattleProvider({ children }: Props) {
  const [phase, setPhase]               = useState<TurnPhase>('player')
  const [turnNumber]                    = useState(1)
  const [tickValue]                     = useState(0)
  const [playerUnit]                    = useState<Unit | null>(null)
  const [enemies]                       = useState<Unit[]>([])
  const [log, setLog]                   = useState<LogEntry[]>([
    { id: '0', text: 'Battle started. Your turn.', colour: 'var(--accent-genesis)' },
  ])
  const [selectedSkill, setSelectedSkill] = useState<SkillInstance | null>(null)
  const [gridCollapsed, setGridCollapsed] = useState(false)
  const [isPaused, setPaused]             = useState(false)

  const appendLog = useCallback((entry: Omit<LogEntry, 'id'>) => {
    setLog((prev) => [...prev, { ...entry, id: String(Date.now()) }])
  }, [])

  const selectSkill = useCallback((skill: SkillInstance | null) => {
    setSelectedSkill(skill)
  }, [])

  const toggleGrid = useCallback(() => {
    setGridCollapsed((prev) => !prev)
  }, [])

  return (
    <BattleContext.Provider value={{
      phase, turnNumber, tickValue, playerUnit, enemies, log,
      selectedSkill, gridCollapsed, isPaused,
      setPhase, appendLog, selectSkill, toggleGrid, setPaused,
    }}>
      {children}
    </BattleContext.Provider>
  )
}
