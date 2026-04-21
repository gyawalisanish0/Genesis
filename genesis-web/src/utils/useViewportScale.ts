import { useState, useEffect } from 'react'

const BASE_WIDTH      = 360
const FALLBACK_HEIGHT = 640  // JSDOM guard only — not a design constraint

interface ViewportScale {
  scale:       number
  innerHeight: number
}

function compute(): ViewportScale {
  const w = window.innerWidth  || BASE_WIDTH
  const h = window.innerHeight || FALLBACK_HEIGHT
  // Width-first: always fill the full screen width; height adapts to the device.
  const scale = w / BASE_WIDTH
  return { scale, innerHeight: Math.round(h / scale) }
}

export function useViewportScale(): ViewportScale {
  const [state, setState] = useState(compute)

  useEffect(() => {
    const update = () => setState(compute())
    window.addEventListener('resize', update)
    window.addEventListener('orientationchange', update)
    return () => {
      window.removeEventListener('resize', update)
      window.removeEventListener('orientationchange', update)
    }
  }, [])

  return state
}
