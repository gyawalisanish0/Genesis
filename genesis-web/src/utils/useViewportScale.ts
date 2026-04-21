import { useState, useEffect } from 'react'

const BASE_WIDTH  = 360
const BASE_HEIGHT = 640

interface ViewportScale {
  scale:       number
  innerHeight: number
}

function compute(): ViewportScale {
  const w = window.innerWidth  || BASE_WIDTH
  const h = window.innerHeight || BASE_HEIGHT
  const scale = Math.min(w / BASE_WIDTH, h / BASE_HEIGHT)
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
