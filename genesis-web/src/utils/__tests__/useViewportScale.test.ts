// @vitest-environment jsdom
//
// The scale rule decides whether a screen fits at all. It previously branched on
// orientation and applied only a width guard in portrait, which clipped the main
// menu's bottom row off-screen on tablets. These pin the invariant that broke:
// there is always at least 640 dp of design height to lay out in.

import { describe, it, expect, afterEach } from 'vitest'
import { renderHook } from '@testing-library/react'
import { act } from 'react'
import { useViewportScale } from '../useViewportScale'

const MIN_DESIGN_HEIGHT = 640
const BASE_WIDTH = 360

function setViewport(w: number, h: number) {
  Object.defineProperty(window, 'innerWidth',  { value: w, configurable: true, writable: true })
  Object.defineProperty(window, 'innerHeight', { value: h, configurable: true, writable: true })
}

const measure = (w: number, h: number) => {
  setViewport(w, h)
  const { result } = renderHook(() => useViewportScale())
  return result.current
}

afterEach(() => setViewport(1024, 768))

/** Every device the game is expected to run on. */
const DEVICES: Array<[string, number, number]> = [
  ['fold closed',      280, 653],
  ['iPhone SE',        375, 667],
  ['iPhone 14',        390, 844],
  ['Pixel 7',          412, 915],
  ['iPhone Pro Max',   430, 932],
  ['iPad Mini',        768, 1024],
  ['iPad Pro',        1024, 1366],
  ['phone landscape',  844, 390],
  ['desktop',         1920, 1080],
  ['ultrawide',       3440, 1440],
  ['tiny',             240, 320],
]

describe('useViewportScale', () => {
  it('never leaves less design height than screens are laid out for', () => {
    // The invariant the tablet bug violated.
    for (const [name, w, h] of DEVICES) {
      const { innerHeight } = measure(w, h)
      expect(innerHeight, `${name} ${w}x${h}`).toBeGreaterThanOrEqual(MIN_DESIGN_HEIGHT)
    }
  })

  it('never scales the 360 dp column wider than the viewport', () => {
    for (const [name, w, h] of DEVICES) {
      const { scale } = measure(w, h)
      expect(scale * BASE_WIDTH, `${name} ${w}x${h}`).toBeLessThanOrEqual(w + 0.01)
    }
  })

  it('fills the width on a phone, where width is the binding constraint', () => {
    const { scale } = measure(390, 844)
    expect(scale).toBeCloseTo(390 / BASE_WIDTH, 5)
  })

  it('pillarboxes a tablet rather than over-zooming it', () => {
    // 1024/360 = 2.84 would leave 480 dp of height — the menu's bottom row was
    // clipped and unreachable. Height must be the binding constraint here.
    const { scale, innerHeight } = measure(1024, 1366)
    expect(scale).toBeCloseTo(1366 / MIN_DESIGN_HEIGHT, 5)
    expect(innerHeight).toBe(MIN_DESIGN_HEIGHT)
    expect(scale * BASE_WIDTH).toBeLessThan(1024)   // real pillarbox margin
  })

  it('letterboxes landscape, where height is the binding constraint', () => {
    const { scale, innerHeight } = measure(844, 390)
    expect(scale).toBeCloseTo(390 / MIN_DESIGN_HEIGHT, 5)
    expect(innerHeight).toBe(MIN_DESIGN_HEIGHT)
  })

  it('gives a tall phone extra design height rather than clipping it', () => {
    const { innerHeight } = measure(412, 915)
    expect(innerHeight).toBeGreaterThan(MIN_DESIGN_HEIGHT)
  })

  it('leaves phone scaling unchanged — the old rule was only wrong for tablets', () => {
    for (const [name, w, h] of DEVICES.filter(([, w2, h2]) => w2 <= h2 && w2 / h2 <= 360 / 640)) {
      const { scale } = measure(w, h)
      expect(scale, name).toBeCloseTo(w / BASE_WIDTH, 5)
    }
  })

  it('recomputes when the viewport changes', () => {
    setViewport(390, 844)
    const { result } = renderHook(() => useViewportScale())
    const before = result.current.scale
    act(() => {
      setViewport(1024, 1366)
      window.dispatchEvent(new Event('resize'))
    })
    expect(result.current.scale).not.toBe(before)
    expect(result.current.innerHeight).toBeGreaterThanOrEqual(MIN_DESIGN_HEIGHT)
  })

  it('falls back to the design size when the viewport reports zero', () => {
    const { scale, innerHeight } = measure(0, 0)
    expect(scale).toBe(1)
    expect(innerHeight).toBe(MIN_DESIGN_HEIGHT)
  })
})
