import { useEffect, useState } from 'react'
import { loadCharacterIndex, loadCharacter } from '../services/DataService'
import type { CharacterDef } from '../core/types'

interface RosterState {
  characters: CharacterDef[]
  isLoading:  boolean
  error:      string | null
}

export function useRosterData(): RosterState {
  const [state, setState] = useState<RosterState>({ characters: [], isLoading: true, error: null })

  useEffect(() => {
    let cancelled = false
    loadCharacterIndex()
      .then((ids) => Promise.all(ids.map(loadCharacter)))
      .then((chars) => {
        if (!cancelled) setState({ characters: chars, isLoading: false, error: null })
      })
      .catch((err: unknown) => {
        if (!cancelled) setState({
          characters: [],
          isLoading:  false,
          error:      err instanceof Error ? err.message : 'Load failed',
        })
      })
    return () => { cancelled = true }
  }, [])

  return state
}
