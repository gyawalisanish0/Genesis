import { useRef, useCallback } from 'react'
import { SCROLL_DETECT_THRESHOLD_PX, LONG_PRESS_DURATION_MS } from '../core/constants'

export type PointerEventType = 'tap' | 'scroll' | 'hold'

// Pointer movement is tracked from the initial touch position rather than from
// container scroll position, so the hook works on any element — scrollable or not.
interface PointerState {
  startX:    number
  startY:    number
  startTime: number
  timeoutId: ReturnType<typeof setTimeout> | null
}

interface ScrollAwareHandlerOptions {
  onTap?:    () => void
  onScroll?: () => void
  onHold?:   () => void
}

/**
 * Hook that creates pointer event handlers distinguishing tap, hold, and scroll gestures.
 * Detects gesture intent via pointer movement (not container scroll position), so it is
 * safe to apply to any interactive element — scrollable container or not.
 *
 * **Critical Rule for Future Contributors:**
 * ALL interactive pointer-based UI elements (buttons, cards, clickable items) MUST use
 * this hook. Failure to do so creates broken UX where accidental gestures trigger actions.
 *
 * @returns A factory function to create onPointerDown handlers
 *
 * @example
 * ```tsx
 * const createHandler = useScrollAwarePointer()
 *
 * return (
 *   <button onPointerDown={createHandler({
 *     onTap:  () => selectCard(),
 *     onHold: () => showContextMenu(),
 *   })}>
 *     Select
 *   </button>
 * )
 * ```
 */
export function useScrollAwarePointer() {
  const pointerStateRef = useRef<PointerState | null>(null)

  const createHandler = useCallback(
    (options: ScrollAwareHandlerOptions | (() => void)): ((e: React.PointerEvent) => void) => {
      // Support both old-style (direct callback) and new-style (options object)
      const handlers: ScrollAwareHandlerOptions =
        typeof options === 'function' ? { onTap: options } : options

      return (e: React.PointerEvent) => {
        const startX    = e.clientX
        const startY    = e.clientY
        const startTime = Date.now()

        pointerStateRef.current = { startX, startY, startTime, timeoutId: null }

        // Fire hold callback after LONG_PRESS_DURATION_MS if the finger hasn't moved
        const timeoutId = setTimeout(() => {
          if (pointerStateRef.current) {
            handlers.onHold?.()
          }
        }, LONG_PRESS_DURATION_MS)

        pointerStateRef.current.timeoutId = timeoutId

        // Cancel the hold timer as soon as the finger drifts beyond the scroll threshold
        function handleMove(moveEvent: PointerEvent) {
          if (!pointerStateRef.current?.timeoutId) return
          const dx = moveEvent.clientX - startX
          const dy = moveEvent.clientY - startY
          if (Math.abs(dx) + Math.abs(dy) >= SCROLL_DETECT_THRESHOLD_PX) {
            clearTimeout(pointerStateRef.current.timeoutId)
            pointerStateRef.current.timeoutId = null
          }
        }

        // Classify and dispatch on pointer release
        function handleUp(upEvent: PointerEvent) {
          document.removeEventListener('pointermove', handleMove)
          if (!pointerStateRef.current) return

          const { startTime, timeoutId } = pointerStateRef.current
          if (timeoutId) clearTimeout(timeoutId)
          pointerStateRef.current = null

          const elapsedTime = Date.now() - startTime
          const dx          = upEvent.clientX - startX
          const dy          = upEvent.clientY - startY
          const moveDelta   = Math.abs(dx) + Math.abs(dy)

          if (moveDelta >= SCROLL_DETECT_THRESHOLD_PX) {
            handlers.onScroll?.()
          } else if (elapsedTime < LONG_PRESS_DURATION_MS) {
            // Quick tap — no significant movement, released before hold threshold
            handlers.onTap?.()
          }
          // If elapsedTime >= LONG_PRESS_DURATION_MS, hold already fired from the timeout
        }

        document.addEventListener('pointermove', handleMove)
        document.addEventListener('pointerup', handleUp, { once: true })
      }
    },
    []
  )

  return createHandler
}
