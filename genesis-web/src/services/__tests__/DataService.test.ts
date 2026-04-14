import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import {
  loadCharacterIndex, loadCharacter, loadCharacterSkillDefs,
  loadCharacterWithSkills, loadMode, clearCache,
} from '../DataService'

// ── Fixtures ──────────────────────────────────────────────────────────────────

const WARRIOR: Record<string, unknown> = {
  type: 'character', id: 'warrior_001', name: 'Iron Warden',
  className: 'Warrior', rarity: 3,
  stats: { strength: 75, endurance: 60, power: 20, resistance: 45, speed: 40, precision: 55 },
  maxHp: 1200, maxAp: 100, apRegenRate: 8, passive: null, skillPath: 'warrior_path',
}

const SLASH: Record<string, unknown> = {
  type: 'skill', id: 'slash_001', name: 'Slash', tuCost: 8, apCost: 20,
  tags: ['physical', 'melee'], maxLevel: 5,
  targeting: { selector: 'enemy', range: 'melee' },
  resolution: { baseChance: 1.0 },
  effects: [{ id: 'dmg', when: { event: 'onCast' }, type: 'damage',
    amount: { stat: 'strength', percent: 80 }, damageType: 'physical' }],
  levelUpgrades: [],
}

const WARRIOR_SKILLS = [SLASH]

const CHARACTER_INDEX = ['warrior_001', 'hunter_001']

const STORY_MODE: Record<string, unknown> = {
  type: 'mode', id: 'story', name: 'Story Mode', description: 'Easy mode',
  settings: { enemyAi: 'story', respawn: false, timeLimitTicks: null },
}

function mockOk(data: unknown) {
  return vi.fn().mockResolvedValue({ ok: true, json: () => Promise.resolve(data) })
}

function mockErr(status = 404) {
  return vi.fn().mockResolvedValue({ ok: false, status })
}

// ── Tests ──────────────────────────────────────────────────────────────────────

describe('DataService', () => {
  beforeEach(() => clearCache())
  afterEach(() => vi.restoreAllMocks())

  // ── loadCharacterIndex ───────────────────────────────────────────────────────

  describe('loadCharacterIndex', () => {
    it('fetches and returns the character ID list', async () => {
      vi.stubGlobal('fetch', mockOk(CHARACTER_INDEX))
      const ids = await loadCharacterIndex()
      expect(ids).toEqual(['warrior_001', 'hunter_001'])
    })

    it('passes the correct URL', async () => {
      const fetchMock = mockOk(CHARACTER_INDEX)
      vi.stubGlobal('fetch', fetchMock)
      await loadCharacterIndex()
      expect(fetchMock).toHaveBeenCalledWith(expect.stringContaining('data/characters/index.json'))
    })

    it('throws on HTTP error', async () => {
      vi.stubGlobal('fetch', mockErr(404))
      await expect(loadCharacterIndex()).rejects.toThrow('DataService: failed to fetch')
    })
  })

  // ── loadCharacter ────────────────────────────────────────────────────────────

  describe('loadCharacter', () => {
    it('fetches and returns a CharacterDef', async () => {
      vi.stubGlobal('fetch', mockOk(WARRIOR))
      const def = await loadCharacter('warrior_001')
      expect(def.id).toBe('warrior_001')
      expect(def.name).toBe('Iron Warden')
      expect(def.className).toBe('Warrior')
      expect(def.stats.strength).toBe(75)
    })

    it('passes the correct URL', async () => {
      const fetchMock = mockOk(WARRIOR)
      vi.stubGlobal('fetch', fetchMock)
      await loadCharacter('warrior_001')
      expect(fetchMock).toHaveBeenCalledWith(
        expect.stringContaining('data/characters/warrior_001/main.json'),
      )
    })

    it('caches — second call does not refetch', async () => {
      const fetchMock = mockOk(WARRIOR)
      vi.stubGlobal('fetch', fetchMock)
      await loadCharacter('warrior_001')
      await loadCharacter('warrior_001')
      expect(fetchMock).toHaveBeenCalledTimes(1)
    })

    it('throws on HTTP error', async () => {
      vi.stubGlobal('fetch', mockErr(404))
      await expect(loadCharacter('missing')).rejects.toThrow('DataService: failed to fetch')
    })
  })

  // ── loadCharacterSkillDefs ───────────────────────────────────────────────────

  describe('loadCharacterSkillDefs', () => {
    it('fetches and returns a SkillDef array', async () => {
      vi.stubGlobal('fetch', mockOk(WARRIOR_SKILLS))
      const defs = await loadCharacterSkillDefs('warrior_001')
      expect(defs).toHaveLength(1)
      expect(defs[0].id).toBe('slash_001')
      expect(defs[0].tuCost).toBe(8)
    })

    it('passes the correct URL', async () => {
      const fetchMock = mockOk(WARRIOR_SKILLS)
      vi.stubGlobal('fetch', fetchMock)
      await loadCharacterSkillDefs('warrior_001')
      expect(fetchMock).toHaveBeenCalledWith(
        expect.stringContaining('data/characters/warrior_001/skills.json'),
      )
    })

    it('caches — second call does not refetch', async () => {
      const fetchMock = mockOk(WARRIOR_SKILLS)
      vi.stubGlobal('fetch', fetchMock)
      await loadCharacterSkillDefs('warrior_001')
      await loadCharacterSkillDefs('warrior_001')
      expect(fetchMock).toHaveBeenCalledTimes(1)
    })

    it('throws on HTTP error', async () => {
      vi.stubGlobal('fetch', mockErr(404))
      await expect(loadCharacterSkillDefs('missing')).rejects.toThrow('DataService: failed to fetch')
    })
  })

  // ── loadMode ─────────────────────────────────────────────────────────────────

  describe('loadMode', () => {
    it('fetches and returns a ModeDef', async () => {
      vi.stubGlobal('fetch', mockOk(STORY_MODE))
      const def = await loadMode('story')
      expect(def.id).toBe('story')
      expect(def.settings.enemyAi).toBe('story')
    })
  })

  // ── loadCharacterWithSkills ──────────────────────────────────────────────────

  describe('loadCharacterWithSkills', () => {
    it('loads character and its skills in parallel', async () => {
      vi.stubGlobal('fetch', vi.fn()
        .mockResolvedValueOnce({ ok: true, json: () => Promise.resolve(WARRIOR) })
        .mockResolvedValueOnce({ ok: true, json: () => Promise.resolve(WARRIOR_SKILLS) }),
      )
      const { characterDef, skillDefs } = await loadCharacterWithSkills('warrior_001')
      expect(characterDef.id).toBe('warrior_001')
      expect(skillDefs).toHaveLength(1)
      expect(skillDefs[0].id).toBe('slash_001')
    })

    it('caches character and skills independently', async () => {
      const fetchMock = vi.fn()
        .mockResolvedValueOnce({ ok: true, json: () => Promise.resolve(WARRIOR) })
        .mockResolvedValueOnce({ ok: true, json: () => Promise.resolve(WARRIOR_SKILLS) })
      vi.stubGlobal('fetch', fetchMock)
      await loadCharacterWithSkills('warrior_001')
      // Second call: both are cached — no extra fetches
      await loadCharacterWithSkills('warrior_001')
      expect(fetchMock).toHaveBeenCalledTimes(2)
    })
  })
})
