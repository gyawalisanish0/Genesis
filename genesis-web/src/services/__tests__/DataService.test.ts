import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { loadCharacter, loadSkill, loadMode, loadCharacterWithSkills, clearCache } from '../DataService'

// ── Fixtures ──────────────────────────────────────────────────────────────────

const WARRIOR: Record<string, unknown> = {
  type: 'character', id: 'warrior_001', name: 'Iron Warden',
  className: 'Warrior', rarity: 3,
  stats: { strength: 75, endurance: 60, power: 20, resistance: 45, speed: 40, precision: 55 },
  maxHp: 1200, maxAp: 100, apRegenRate: 8, passive: null, skillPath: 'warrior_path',
  skills: ['slash_001'],
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
      // URL is BASE_URL + path; BASE_URL is './' per vite.config base setting
      expect(fetchMock).toHaveBeenCalledWith(expect.stringContaining('data/characters/warrior_001.json'))
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

  // ── loadSkill ────────────────────────────────────────────────────────────────

  describe('loadSkill', () => {
    it('fetches and returns a SkillDef', async () => {
      vi.stubGlobal('fetch', mockOk(SLASH))
      const def = await loadSkill('slash_001')
      expect(def.id).toBe('slash_001')
      expect(def.tuCost).toBe(8)
      expect(def.effects).toHaveLength(1)
      expect(def.effects[0].type).toBe('damage')
    })

    it('caches — second call does not refetch', async () => {
      const fetchMock = mockOk(SLASH)
      vi.stubGlobal('fetch', fetchMock)
      await loadSkill('slash_001')
      await loadSkill('slash_001')
      expect(fetchMock).toHaveBeenCalledTimes(1)
    })

    it('throws on HTTP error', async () => {
      vi.stubGlobal('fetch', mockErr(500))
      await expect(loadSkill('missing')).rejects.toThrow('DataService: failed to fetch')
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
    it('loads character and all its skills', async () => {
      vi.stubGlobal('fetch', vi.fn()
        .mockResolvedValueOnce({ ok: true, json: () => Promise.resolve(WARRIOR) })
        .mockResolvedValueOnce({ ok: true, json: () => Promise.resolve(SLASH) }),
      )
      const { characterDef, skillDefs } = await loadCharacterWithSkills('warrior_001')
      expect(characterDef.id).toBe('warrior_001')
      expect(skillDefs).toHaveLength(1)
      expect(skillDefs[0].id).toBe('slash_001')
    })

    it('returns empty skillDefs when character has no skills field', async () => {
      const noSkills = { ...WARRIOR, skills: undefined }
      vi.stubGlobal('fetch', mockOk(noSkills))
      const { skillDefs } = await loadCharacterWithSkills('warrior_001')
      expect(skillDefs).toHaveLength(0)
    })

    it('caches character and skills independently', async () => {
      const fetchMock = vi.fn()
        .mockResolvedValueOnce({ ok: true, json: () => Promise.resolve(WARRIOR) })
        .mockResolvedValueOnce({ ok: true, json: () => Promise.resolve(SLASH) })
      vi.stubGlobal('fetch', fetchMock)
      await loadCharacterWithSkills('warrior_001')
      // Second call: both are cached — no extra fetches
      await loadCharacterWithSkills('warrior_001')
      expect(fetchMock).toHaveBeenCalledTimes(2)
    })
  })
})
