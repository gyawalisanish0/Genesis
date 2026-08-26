// @vitest-environment jsdom
//
// The fleet is the only state that outlives a page load, and it holds the thing
// the demo exists to deliver. Every failure path here has to degrade to "no
// fleet yet" rather than throw: a demo gets opened in private windows, on
// WebViews with site data blocked, and after the schema has moved on.

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest'
import { loadFleet, saveFleet, clearFleet, EMPTY_FLEET } from '../fleetStorage'

const KEY = 'genesis-fleet-v1'

beforeEach(() => localStorage.clear())
afterEach(() => vi.restoreAllMocks())

describe('fleet persistence', () => {
  it('round-trips a fleet', () => {
    saveFleet({ recruitedIds: ['hugo_001', 'husty_001'], completedStages: ['stage_003'] })
    expect(loadFleet()).toEqual({
      recruitedIds: ['hugo_001', 'husty_001'],
      completedStages: ['stage_003'],
    })
  })

  it('returns an empty fleet when nothing is stored', () => {
    expect(loadFleet()).toEqual(EMPTY_FLEET)
  })

  it('clears', () => {
    saveFleet({ recruitedIds: ['hugo_001'], completedStages: [] })
    clearFleet()
    expect(loadFleet()).toEqual(EMPTY_FLEET)
  })
})

describe('a broken save never breaks the game', () => {
  it('survives malformed JSON', () => {
    localStorage.setItem(KEY, '{not json')
    expect(loadFleet()).toEqual(EMPTY_FLEET)
  })

  it('survives a save of the wrong shape', () => {
    localStorage.setItem(KEY, JSON.stringify({ recruitedIds: 'hugo_001' }))
    expect(loadFleet()).toEqual(EMPTY_FLEET)
  })

  it('drops non-string and empty ids rather than passing them on as lookup keys', () => {
    // A null in the roster surfaces later as a missing character at load time,
    // a long way from the corrupt save that caused it.
    localStorage.setItem(KEY, JSON.stringify({
      recruitedIds: ['hugo_001', null, 42, '', 'husty_001'],
      completedStages: [],
    }))
    expect(loadFleet().recruitedIds).toEqual(['hugo_001', 'husty_001'])
  })

  it('de-duplicates', () => {
    localStorage.setItem(KEY, JSON.stringify({
      recruitedIds: ['hugo_001', 'hugo_001'], completedStages: ['s1', 's1'],
    }))
    const fleet = loadFleet()
    expect(fleet.recruitedIds).toEqual(['hugo_001'])
    expect(fleet.completedStages).toEqual(['s1'])
  })

  it('survives storage that throws on read', () => {
    // Private browsing and WebViews with site data disabled both throw here
    // rather than returning null.
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => { throw new Error('denied') })
    expect(loadFleet()).toEqual(EMPTY_FLEET)
  })

  it('survives storage that throws on write', () => {
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('quota') })
    expect(() => saveFleet({ recruitedIds: ['hugo_001'], completedStages: [] })).not.toThrow()
  })
})
