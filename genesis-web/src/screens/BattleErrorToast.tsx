// BattleErrorToast — full-screen blocking overlay shown when the BattleEngine
// throws an unhandled error. Auto-navigates after BATTLE_ERROR_TOAST_MS.

import { useEffect, useRef, useState } from 'react'
import { BATTLE_ERROR_TOAST_MS } from '../core/constants'
import styles from './BattleErrorToast.module.css'

interface Props {
  message: string
  onLeave: () => void
}

export function BattleErrorToast({ message, onLeave }: Props) {
  const totalSeconds   = Math.ceil(BATTLE_ERROR_TOAST_MS / 1000)
  const [remaining, setRemaining] = useState(totalSeconds)
  const onLeaveRef = useRef(onLeave)
  useEffect(() => { onLeaveRef.current = onLeave }, [onLeave])

  useEffect(() => {
    const interval = setInterval(() => {
      setRemaining(prev => Math.max(0, prev - 1))
    }, 1000)
    const nav = setTimeout(() => onLeaveRef.current(), BATTLE_ERROR_TOAST_MS)
    return () => { clearInterval(interval); clearTimeout(nav) }
  }, [])

  return (
    <div className={styles.backdrop}>
      <div className={styles.card}>
        <p className={styles.heading}>Battle Error</p>
        <p className={styles.message}>{message}</p>
        <p className={styles.countdown}>Leaving in {remaining}s</p>
        <button className={styles.leaveBtn} onPointerDown={() => onLeaveRef.current()}>
          Leave Battle
        </button>
      </div>
    </div>
  )
}
