// Screen-local context for the Battle screen.
// Holds ephemeral within-session state: active turn, action log, animation locks.
// The global Zustand store is NOT written during battle frames — only on battle end.

import { createContext, useContext, useState, useCallback, type ReactNode } from 'react'
import type { Unit, SkillInstance, StatBlockDef } from '../core/types'

// ── Mock data — replace with DataService + createUnit() when wired ──────────
const MOCK_STATS: StatBlockDef = {
  strength: 50, endurance: 50, power: 30,
  resistance: 30, speed: 60, precision: 70,
}

const MOCK_PLAYER: Unit = {
  id: 'player-1', defId: 'warrior_001', name: 'Iron Warden',
  className: 'Warrior', rarity: 3, stats: MOCK_STATS,
  maxHp: 1200, hp: 980, maxAp: 100, ap: 40, apRegenRate: 5,
  tickPosition: 8, skills: [], statusSlots: [], isAlly: true,
}

const MOCK_ENEMIES: Unit[] = [
  {
    id: 'enemy-1', defId: 'caster_001', name: 'Ember Sage',
    className: 'Caster', rarity: 4, stats: MOCK_STATS,
    maxHp: 600, hp: 420, maxAp: 100, ap: 30, apRegenRate: 8,
    tickPosition: 5, skills: [], statusSlots: [], isAlly: false,
  },
  {
    id: 'enemy-2', defId: 'guardian_001', name: 'Stone Bastion',
    className: 'Guardian', rarity: 5, stats: MOCK_STATS,
    maxHp: 1600, hp: 1600, maxAp: 100, ap: 60, apRegenRate: 3,
    tickPosition: 18, skills: [], statusSlots: [], isAlly: false,
  },
]

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
  const [playerUnit]                    = useState<Unit | null>(MOCK_PLAYER)
  const [enemies]                       = useState<Unit[]>(MOCK_ENEMIES)
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
