// The unlock rule is what makes the demo's ending reachable at all. Before it,
// CampaignScreen hardcoded `unlocked={idx === 0}` and the dungeon hardcoded
// stage_001, so two of three authored stages — and the recruitment they lead
// to — could not be played.

import { describe, it, expect } from 'vitest'
import { isStageUnlocked, nextStageId, isCampaignComplete } from '../campaignProgress'

const ORDER = ['stage_001', 'stage_002', 'stage_003']

describe('isStageUnlocked', () => {
  it('opens the first stage to a player with no progress', () => {
    expect(isStageUnlocked(ORDER, 'stage_001', [])).toBe(true)
  })

  it('keeps later stages shut until the one before is cleared', () => {
    expect(isStageUnlocked(ORDER, 'stage_002', [])).toBe(false)
    expect(isStageUnlocked(ORDER, 'stage_003', ['stage_001'])).toBe(false)
  })

  it('opens each stage as its predecessor is cleared', () => {
    expect(isStageUnlocked(ORDER, 'stage_002', ['stage_001'])).toBe(true)
    expect(isStageUnlocked(ORDER, 'stage_003', ['stage_001', 'stage_002'])).toBe(true)
  })

  it('is strictly sequential — clearing a later stage does not open a gap', () => {
    // The demo escalates deliberately: bigger maps, more patrols, a new enemy
    // type per stage. Skipping ahead skips the teaching.
    expect(isStageUnlocked(ORDER, 'stage_003', ['stage_003'])).toBe(false)
  })

  it('refuses a stage that is not in the campaign', () => {
    expect(isStageUnlocked(ORDER, 'stage_999', ['stage_001', 'stage_002'])).toBe(false)
  })

  it('is safe on an empty campaign', () => {
    expect(isStageUnlocked([], 'stage_001', [])).toBe(false)
  })
})

describe('nextStageId', () => {
  it('points at the first unfinished stage', () => {
    expect(nextStageId(ORDER, [])).toBe('stage_001')
    expect(nextStageId(ORDER, ['stage_001'])).toBe('stage_002')
  })

  it('stays on the last stage once everything is cleared, rather than dead-ending', () => {
    expect(nextStageId(ORDER, ORDER)).toBe('stage_003')
  })

  it('returns null when there is no campaign', () => {
    expect(nextStageId([], [])).toBeNull()
  })
})

describe('isCampaignComplete', () => {
  it('is true only when every authored stage is cleared', () => {
    expect(isCampaignComplete(ORDER, ['stage_001', 'stage_002'])).toBe(false)
    expect(isCampaignComplete(ORDER, ORDER)).toBe(true)
  })

  it('is false for an empty campaign rather than vacuously true', () => {
    expect(isCampaignComplete([], [])).toBe(false)
  })
})
