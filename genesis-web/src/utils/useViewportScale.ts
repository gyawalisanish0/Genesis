import { useState, useEffect } from 'react'

const BASE_WIDTH      = 360
const FALLBACK_HEIGHT = 640  // JSDOM guard + landscape reference; not a portrait design constraint

interface ViewportScale {
  scale:       number
  innerHeight: number
}

function compute(): ViewportScale {
  const w = window.innerWidth  || BASE_WIDTH
  const h = window.innerHeight || FALLBACK_HEIGHT
  // Portrait orientation (phones, tall tablets): fill the full screen width.
  // Landscape orientation (desktop, rotated tablet): constrain to a portrait
  // 9:16 column centered with black letterbox — prevents an unusably short canvas.
  const scale = w <= h
    ? w / BASE_WIDTH
    : Math.min(w / BASE_WIDTH, h / FALLBACK_HEIGHT)
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
