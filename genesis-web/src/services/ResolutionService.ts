// ResolutionService — device quality tier via rAF FPS benchmark.
// Sets data-quality attribute on documentElement so CSS can gate
// expensive effects (particles, blur, animation density) per tier.
// Tier persists to localStorage; stepUp() promotes one level.

import type { QualityTier } from '../core/types'
import {
  QUALITY_BENCHMARK_FRAMES,
  QUALITY_HIGH_FPS_THRESHOLD,
  QUALITY_MED_FPS_THRESHOLD,
} from '../core/constants'

const STORAGE_KEY = 'genesis_quality_tier'
const VALID_TIERS: QualityTier[] = ['High', 'Medium', 'Low']

type TierListener = (tier: QualityTier) => void

let _tier: QualityTier = 'Medium'
const _listeners = new Set<TierListener>()

function applyCSS(tier: QualityTier): void {
  document.documentElement.dataset.quality = tier.toLowerCase()
}

function measureFPS(): Promise<number> {
  return new Promise((resolve) => {
    const deltas: number[] = []
    let last = performance.now()

    function step(now: number) {
      deltas.push(now - last)
      last = now
      if (deltas.length < QUALITY_BENCHMARK_FRAMES) {
        requestAnimationFrame(step)
      } else {
        const avgMs = deltas.reduce((a, b) => a + b, 0) / deltas.length
        resolve(1000 / avgMs)
      }
    }
    requestAnimationFrame(step)
  })
}

function tierFromFPS(fps: number): QualityTier {
  if (fps >= QUALITY_HIGH_FPS_THRESHOLD) return 'High'
  if (fps >= QUALITY_MED_FPS_THRESHOLD)  return 'Medium'
  return 'Low'
}

export const ResolutionService = {
  get currentTier(): QualityTier { return _tier },

  async detectTier(): Promise<void> {
    const saved = localStorage.getItem(STORAGE_KEY)
    if (saved && (VALID_TIERS as string[]).includes(saved)) {
      _tier = saved as QualityTier
      applyCSS(_tier)
      return
    }
    const fps = await measureFPS()
    _tier = tierFromFPS(fps)
    localStorage.setItem(STORAGE_KEY, _tier)
    applyCSS(_tier)
  },

  setTier(tier: QualityTier): void {
    _tier = tier
    localStorage.setItem(STORAGE_KEY, _tier)
    applyCSS(_tier)
    _listeners.forEach((l) => l(_tier))
  },

  stepUp(): void {
    const next: QualityTier =
      _tier === 'Low' ? 'Medium' :
      _tier === 'Medium' ? 'High' : 'High'
    if (next !== _tier) ResolutionService.setTier(next)
  },

  subscribe(listener: TierListener): () => void {
    _listeners.add(listener)
    return () => _listeners.delete(listener)
  },
}
