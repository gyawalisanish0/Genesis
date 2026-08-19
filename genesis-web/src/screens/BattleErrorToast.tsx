// BattleErrorToast — shown when the BattleEngine throws an unhandled error.
// Blocking, so it composes PromptOverlay rather than being a Toaster tone:
// a blocking message needs a backdrop and an actions row, which PromptOverlay
// already owns. Auto-navigates after BATTLE_ERROR_TOAST_MS.

import { useEffect, useRef, useState } from 'react'
import { BATTLE_ERROR_TOAST_MS } from '../core/constants'
import { PromptOverlay } from '../components/PromptOverlay'
import styles from './BattleErrorToast.module.css'

interface Props {
  message: string
  onLeave: () => void
}

export function BattleErrorToast({ message, onLeave }: Props) {
  const totalSeconds = Math.ceil(BATTLE_ERROR_TOAST_MS / 1000)
  const [remaining, setRemaining] = useState(totalSeconds)
  const onLeaveRef = useRef(onLeave)
  useEffect(() => { onLeaveRef.current = onLeave }, [onLeave])

  useEffect(() => {
    const interval = setInterval(() => setRemaining(prev => Math.max(0, prev - 1)), 1000)
    const nav      = setTimeout(() => onLeaveRef.current(), BATTLE_ERROR_TOAST_MS)
    return () => { clearInterval(interval); clearTimeout(nav) }
  }, [])

  return (
    <PromptOverlay
      title="BATTLE ERROR"
      subtitle={`Leaving in ${remaining}s`}
      actions={[{ label: 'LEAVE BATTLE', variant: 'danger', onPress: () => onLeaveRef.current() }]}
    >
      <p className={styles.message}>{message}</p>
    </PromptOverlay>
  )
}
