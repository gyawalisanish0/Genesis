// @vitest-environment jsdom
//
// The one thing that must not regress here is the exemption: the opening asks
// the player to type their own name, and a game that blocks selection inside
// its only text field is hostile rather than immersive.

import { describe, it, expect, afterEach } from 'vitest'
import { suppressWebGestures } from '../suppressWebGestures'

let restore: (() => void) | null = null

afterEach(() => { restore?.(); restore = null; document.body.innerHTML = '' })

/** Dispatch on `target` and report whether the default was prevented. */
function fire(type: string, target: EventTarget = document.body): boolean {
  const event = new Event(type, { bubbles: true, cancelable: true })
  target.dispatchEvent(event)
  return event.defaultPrevented
}

describe('suppressWebGestures', () => {
  it('blocks the gestures that read as "web page"', () => {
    restore = suppressWebGestures()
    for (const type of ['contextmenu', 'dragstart', 'selectstart', 'copy', 'cut']) {
      expect(fire(type), type).toBe(true)
    }
  })

  it('leaves copy and cut alone inside a text field', () => {
    restore = suppressWebGestures()
    const field = document.createElement('input')
    document.body.appendChild(field)

    expect(fire('copy', field)).toBe(false)
    expect(fire('cut', field)).toBe(false)
  })

  it('still blocks the context menu inside a text field', () => {
    // The exemption is about the clipboard, not about restoring browser chrome.
    restore = suppressWebGestures()
    const field = document.createElement('textarea')
    document.body.appendChild(field)

    expect(fire('contextmenu', field)).toBe(true)
  })

  it('restores the browser defaults on cleanup', () => {
    suppressWebGestures()()
    expect(fire('contextmenu')).toBe(false)
    expect(fire('copy')).toBe(false)
  })

  it('is idempotent — a second install does not double-register', () => {
    // App.tsx mounts twice under StrictMode; the second call must not hand back
    // a cleanup that leaves the first install's listeners behind.
    restore = suppressWebGestures()
    const secondCleanup = suppressWebGestures()
    secondCleanup()

    expect(fire('contextmenu')).toBe(true)
  })
})
