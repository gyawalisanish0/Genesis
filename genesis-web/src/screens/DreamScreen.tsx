// The opening — the dream, character creation, and the wake.
//
// docs/demo/demo-flow.md Acts 1 and 2, played from
// public/data/scripts/opening.json. Those 54 lines were authored and then
// stranded: the narrative system that played them was removed for a redesign
// and the script survived it, so the demo has had no opening at all.
//
// Speaker names resolve at read time rather than being baked into the script,
// because two of them are the player's own answers — the Commander is unnamed
// until they name themselves partway through this very sequence.

import { useEffect, useState } from 'react'
import { ScreenShell }   from '../navigation/ScreenShell'
import { useScreen }     from '../navigation/useScreen'
import { SCREEN_IDS }    from '../navigation/screenRegistry'
import { useGameStore }  from '../core/GameContext'
import { loadScript }    from '../services/DataService'
import { ScriptPlayer }  from '../components/ScriptPlayer'
import type { ScriptLine, InputKey } from '../core/script/types'
import styles from './DreamScreen.module.css'

const OPENING_SCRIPT_ID = 'opening'

export function DreamScreen() {
  const { navigateTo } = useScreen()
  const commanderName     = useGameStore((s) => s.fleet.commanderName)
  const organisationName  = useGameStore((s) => s.fleet.organisationName)
  const setCommanderName  = useGameStore((s) => s.setCommanderName)
  const setOrganisationName = useGameStore((s) => s.setOrganisationName)

  const [lines, setLines] = useState<readonly ScriptLine[] | null>(null)
  const [failed, setFailed] = useState(false)

  useEffect(() => {
    let cancelled = false
    loadScript(OPENING_SCRIPT_ID)
      .then((s) => { if (!cancelled) setLines(s.lines) })
      .catch(() => { if (!cancelled) setFailed(true) })
    return () => { cancelled = true }
  }, [])

  // A broken opening must not trap the player on a black screen — the campaign
  // is still playable without it.
  useEffect(() => {
    if (failed) navigateTo(SCREEN_IDS.CAMPAIGN)
  }, [failed, navigateTo])

  function handleInput(key: InputKey, value: string) {
    if (key === 'commanderName')    setCommanderName(value)
    if (key === 'organisationName') setOrganisationName(value)
  }

  /** The Commander has no name until they give one, so fall back to a rank. */
  function speakerName(who: string): string {
    switch (who) {
      case 'creator':   return '???'
      case 'kali':      return 'KALI'
      case 'celan':     return 'CELAN'
      case 'narration': return ''
      // Both the pre-name dreamer and the named Commander are the player.
      case 'player':
      case 'commander': return commanderName || 'COMMANDER'
      default:          return who.toUpperCase()
    }
  }

  /**
   * The script is authored with [NAME] and [ORG] where the player's answers go.
   * They are substituted at read time for the same reason the nameplate is: the
   * Creator says the name back one line after it is typed.
   */
  function resolveText(text: string): string {
    return text
      .split('[NAME]').join(commanderName    || 'COMMANDER')
      .split('[ORG]').join(organisationName || 'UNREGISTERED')
  }

  return (
    <ScreenShell>
      <div className={styles.root}>
        {lines && (
          <ScriptPlayer
            lines={lines}
            speakerName={speakerName}
            resolveText={resolveText}
            onInput={handleInput}
            onComplete={() => navigateTo(SCREEN_IDS.CAMPAIGN)}
          />
        )}
      </div>
    </ScreenShell>
  )
}
