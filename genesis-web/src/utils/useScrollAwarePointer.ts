import { useRef, useCallback } from 'react'
import { SCROLL_DETECT_THRESHOLD_PX, LONG_PRESS_DURATION_MS } from '../core/constants'

export type PointerEventType = 'tap' | 'scroll' | 'hold'

interface PointerState {
  scrollY: number
  startTime: number
  timeoutId: NodeJS.Timeout | null
}

interface ScrollAwareHandlerOptions {
  onTap?: () => void
  onScroll?: () => void
  onHold?: () => void
}

/**
 * Hook that creates scroll-aware pointer event handlers with hold detection.
 * Distinguishes between quick taps, scrolling gestures, and long-press holds.
 *
 * **Critical Rule for Future Contributors:**
 * ALL interactive pointer-based UI elements (buttons, cards, clickable items) in scrollable
 * containers MUST use this hook or similar scroll detection. Failure to do so creates
 * broken UX where scrolling accidentally triggers actions.
 *
 * @param scrollContainerRef Ref to the scrollable container (e.g. a div with overflow-y: auto)
 * @returns A function to wrap your onPointerDown callbacks with optional event handlers
 *
 * @example
 * ```tsx
 * const scrollContainer = useRef<HTMLDivElement>(null)
 * const createHandler = useScrollAwarePointer(scrollContainer)
 *
 * return (
 *   <div ref={scrollContainer} style={{ overflowY: 'auto' }}>
 *     <button onPointerDown={createHandler({
 *       onTap: () => selectCard(),
 *       onHold: () => showContextMenu(),
 *       onScroll: () => { /* optional feedback */ }
 *     })}>
 *       Select
 *     </button>
 *   </div>
 * )
 * ```
 */
export function useScrollAwarePointer(
  scrollContainerRef: React.RefObject<HTMLElement | null>
) {
  const pointerStateRef = useRef<PointerState | null>(null)

  /**
   * Wraps a callback to execute only if conditions match (tap, hold, or scroll).
   * Prevents mis-fires when user intends to scroll.
   *
   * @param options Handlers for tap, hold, and scroll events
   * @returns Event handler to attach to onPointerDown
   */
  const createHandler = useCallback(
    (options: ScrollAwareHandlerOptions | (() => void)): (() => void) => {
      // Support both old-style (direct callback) and new-style (options object)
      const handlers: ScrollAwareHandlerOptions =
        typeof options === 'function' ? { onTap: options } : options

      return () => {
        const container = scrollContainerRef.current
        const startTime = Date.now()

        // Initialize pointer state
        pointerStateRef.current = {
          scrollY: container?.scrollTop ?? 0,
          startTime,
          timeoutId: null,
        }

        // Set timer to detect long-press/hold
        const timeoutId = setTimeout(() => {
          if (pointerStateRef.current) {
            handlers.onHold?.()
          }
        }, LONG_PRESS_DURATION_MS)

        pointerStateRef.current.timeoutId = timeoutId

        // Listen for pointer up to classify the interaction
        const handlePointerUp = () => {
          if (!pointerStateRef.current) return

          const { scrollY, startTime, timeoutId } = pointerStateRef.current

          // Clear the hold timeout
          if (timeoutId) clearTimeout(timeoutId)

          // Calculate deltas
          const elapsedTime = Date.now() - startTime
          const scrollDelta = container
            ? Math.abs(container.scrollTop - scrollY)
            : 0

          // Classify the interaction
          if (scrollDelta >= SCROLL_DETECT_THRESHOLD_PX) {
            // User scrolled significantly
            handlers.onScroll?.()
          } else if (elapsedTime < LONG_PRESS_DURATION_MS) {
            // Quick tap (no scroll, no hold)
            handlers.onTap?.()
          }
          // If elapsedTime >= LONG_PRESS_DURATION_MS, hold was already fired by timeout

          pointerStateRef.current = null
          document.removeEventListener('pointerup', handlePointerUp)
        }

        document.addEventListener('pointerup', handlePointerUp, { once: true })
      }
    },
    [scrollContainerRef]
  )

  return createHandler
}
