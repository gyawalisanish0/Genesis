import { useRef, useCallback } from 'react'
import { SCROLL_DETECT_THRESHOLD_PX } from '../core/constants'

/**
 * Hook that creates scroll-aware pointer event handlers.
 * Prevents callbacks from firing if the user scrolled during the pointer interaction.
 *
 * @param scrollContainerRef Ref to the scrollable container (e.g. a div with overflow-y: auto)
 * @returns A function to wrap your onPointerDown callbacks
 *
 * @example
 * const scrollContainer = useRef<HTMLDivElement>(null)
 * const createScrollAwareHandler = useScrollAwarePointer(scrollContainer)
 *
 * return (
 *   <div ref={scrollContainer} style={{ overflowY: 'auto' }}>
 *     <button onPointerDown={createScrollAwareHandler(() => selectCard())}>
 *       Select
 *     </button>
 *   </div>
 * )
 */
export function useScrollAwarePointer(
  scrollContainerRef: React.RefObject<HTMLElement | null>
) {
  const pointerStateRef = useRef<{ scrollY: number } | null>(null)

  /**
   * Wraps a callback to execute only if scroll distance is below threshold.
   */
  const createHandler = useCallback(
    (callback: () => void): (() => void) => {
      return () => {
        const container = scrollContainerRef.current
        if (!container) {
          callback()
          return
        }

        // Record scroll position at pointer down
        pointerStateRef.current = { scrollY: container.scrollTop }

        // Listen for pointer up to check if user scrolled
        const handlePointerUp = () => {
          if (!pointerStateRef.current) return

          const scrollDelta = Math.abs(container.scrollTop - pointerStateRef.current.scrollY)

          // Only execute callback if user didn't scroll significantly
          if (scrollDelta < SCROLL_DETECT_THRESHOLD_PX) {
            callback()
          }

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
