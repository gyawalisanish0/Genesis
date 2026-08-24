import { useState, useEffect } from 'react'

/** The design canvas is a fixed 360 dp column — the game is portrait-only. */
const BASE_WIDTH = 360

/**
 * Shortest design height any screen is laid out to survive. Scaling must never
 * push the available design height below this, or content is clipped: a screen
 * built to fill 640 dp cannot be shown in 480.
 */
const MIN_DESIGN_HEIGHT = 640

interface ViewportScale {
  scale:       number
  innerHeight: number
}

/**
 * Fit the 360 dp design column to the viewport.
 *
 * Both terms are guards, and the smaller wins:
 *   w / BASE_WIDTH        — never wider than the viewport
 *   h / MIN_DESIGN_HEIGHT — never so zoomed that under 640 dp of design height remains
 *
 * This used to branch on orientation and apply only the width guard in portrait.
 * That was wrong for any portrait viewport wider than 9:16 — on a 1024x1366
 * tablet it scaled to 2.84x, leaving 480 dp of design height, and the main
 * menu's bottom row (Settings / Shop) was clipped off-screen with no way to
 * reach it. Tablets now pillarbox instead of over-zooming.
 *
 * Phones are unaffected: on every viewport taller than 16:9 the width guard is
 * already the smaller of the two, which is what made the bug tablet-only.
 */
function compute(): ViewportScale {
  const w = window.innerWidth  || BASE_WIDTH
  const h = window.innerHeight || MIN_DESIGN_HEIGHT
  const scale = Math.min(w / BASE_WIDTH, h / MIN_DESIGN_HEIGHT)
  return { scale, innerHeight: Math.round(h / scale) }
}

export function useViewportScale(): ViewportScale {
  const [state, setState] = useState(compute)

  useEffect(() => {
    const update = () => setState(compute())
    window.addEventListener('resize', update)
    window.addEventListener('orientationchange', update)
    // visualViewport fires on mobile when the URL bar shows/hides (window.resize does not).
    window.visualViewport?.addEventListener('resize', update)
    return () => {
      window.removeEventListener('resize', update)
      window.removeEventListener('orientationchange', update)
      window.visualViewport?.removeEventListener('resize', update)
    }
  }, [])

  return state
}
