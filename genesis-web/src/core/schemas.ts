// ─────────────────────────────────────────────────────────────────────────────
// Zod schemas for the top-level content types loaded by DataService:
// CharacterDef, ModeDef, StageDef, MapDef, TilesetDef, AnimationManifest,
// AnimSequenceManifest. Mirrors core/effects/schemas.ts — schemas are
// deliberately strict (unknown keys throw) and structurally match types.ts.
// ─────────────────────────────────────────────────────────────────────────────

import { z } from 'zod'
import type { AnimPhase } from './types'
import { diceOutcomeSchema } from './effects/schemas'

// ── Shared primitives ─────────────────────────────────────────────────────────

const point2DSchema = z.object({ x: z.number(), y: z.number() }).strict()

const statBlockDefSchema = z.object({
  strength:   z.number(),
  endurance:  z.number(),
  power:      z.number(),
  resistance: z.number(),
  speed:      z.number(),
  precision:  z.number(),
}).strict()

// ── CharacterDef ──────────────────────────────────────────────────────────────

const classNameSchema = z.enum(['Warrior', 'Caster', 'Hunter', 'Guardian', 'Ranger', 'Enchanter'])

const characterClashDefSchema = z.object({
  speedModifier: z.number().optional(),
  uniqueClash:   z.boolean().optional(),
}).strict()

const dungeonGimmickSchema = z.object({
  type:      z.literal('extendedMove'),
  moveRange: z.number(),
}).strict()

export const characterDefSchema = z.object({
  type:            z.literal('character'),
  id:              z.string(),
  name:            z.string(),
  className:       classNameSchema,
  rarity:          z.number(),
  stats:           statBlockDefSchema,
  maxHp:           z.number(),
  maxAp:           z.number(),
  apRegenRate:     z.number(),
  startingAp:      z.number().optional(),
  passive:         z.string().nullable(),
  skillPath:       z.string(),
  clash:           characterClashDefSchema.optional(),
  dungeonGimmick:  dungeonGimmickSchema.optional(),
}).strict()

// ── ModeDef / StageDef (share the same settings shape) ─────────────────────────

const modeSettingsSchema = z.object({
  enemyAi:        z.string(),
  respawn:        z.boolean(),
  timeLimitTicks: z.number().nullable(),
  playerControl:  z.enum(['single', 'all']).optional(),
  enemies:        z.array(z.string()).optional(),
}).strict()

export const modeDefSchema = z.object({
  type:        z.literal('mode'),
  id:          z.string(),
  name:        z.string(),
  description: z.string(),
  settings:    modeSettingsSchema,
}).strict()

const playerUnitsDefSchema = z.object({
  mode:  z.enum(['fixed', 'selectable']),
  units: z.array(z.string()),
}).strict()

const stageSettingsSchema = z.object({
  enemyAi:        z.string(),
  respawn:        z.boolean(),
  timeLimitTicks: z.number().nullable(),
  playerControl:  z.enum(['single', 'all']).optional(),
}).strict()

export const stageDefSchema = z.object({
  type:        z.literal('stage'),
  id:          z.string(),
  name:        z.string(),
  description: z.string(),
  playerUnits: playerUnitsDefSchema,
  moveRange:   z.number(),
  settings:    stageSettingsSchema,
}).strict()

// ── MapDef ────────────────────────────────────────────────────────────────────

const tileTypeDefSchema = z.object({
  passable:      z.boolean(),
  id:            z.string(),
  rotation:      z.number().optional(),
  entityOffset:  point2DSchema.optional(),
}).strict()

const wavePhaseConfigSchema = z.object({
  mode:  z.enum(['player-select', 'sequential', 'simultaneous']),
  order: z.array(z.string()).optional(),
}).strict()

const entityBase = {
  entityId:    z.string(),
  x:           z.number(),
  y:           z.number(),
  narrativeId: z.string().optional(),
}

const chestRewardSchema = z.object({
  gold:          z.number().optional(),
  xp:            z.number().optional(),
  items:         z.array(z.string()).optional(),
  narrativeText: z.string().optional(),
}).strict()

const entityDefSchema = z.discriminatedUnion('type', [
  z.object({
    ...entityBase,
    type:        z.literal('enemy'),
    defId:       z.string(),
    patrol:      z.array(point2DSchema),
    visualRange: z.number().optional(),
    partyId:     z.string().optional(),
  }).strict(),
  z.object({
    ...entityBase,
    type:           z.literal('npc'),
    defId:          z.string(),
    destination:    point2DSchema.nullable().optional(),
    visualRange:    z.number().optional(),
    blocksMovement: z.boolean().optional(),
  }).strict(),
  z.object({
    ...entityBase,
    type:    z.literal('interactable'),
    subtype: z.string().optional(),
    reward:  chestRewardSchema.optional(),
  }).strict(),
  z.object({
    ...entityBase,
    type:    z.literal('exit'),
    leadsTo: z.string().optional(),
  }).strict(),
  z.object({
    ...entityBase,
    type: z.literal('trigger'),
    once: z.boolean().optional(),
  }).strict(),
])

export const mapDefSchema = z.object({
  type:         z.literal('map'),
  stageId:      z.string(),
  grid:         z.object({ cols: z.number(), rows: z.number() }).strict(),
  tiles:        z.array(z.array(z.number())),
  tileTypes:    z.record(z.string(), tileTypeDefSchema),
  playerStart:  point2DSchema,
  fogOfWar:     z.boolean(),
  revealRadius: z.number(),
  entities:     z.array(entityDefSchema),
  wavePhase:    wavePhaseConfigSchema,
  tilesetKey:   z.string().optional(),
}).strict()

// ── TilesetDef ────────────────────────────────────────────────────────────────

const tileVisualDefSchema = z.object({
  color: z.string(),
  art:   z.string().optional(),
}).strict()

export const tilesetDefSchema = z.object({
  type:    z.literal('tileset'),
  key:     z.string(),
  bgColor: z.string().optional(),
  tiles:   z.record(z.string(), tileVisualDefSchema),
}).strict()

// ── AnimationManifest ─────────────────────────────────────────────────────────

const auraDefSchema = z.object({
  colour:    z.string(),
  blendMode: z.enum(['ADD', 'SCREEN', 'MULTIPLY', 'NORMAL']),
  radius:    z.number(),
  alpha:     z.number(),
  pulse:     z.object({ period: z.number(), minAlpha: z.number() }).strict().optional(),
  fadeIn:    z.number().optional(),
  fadeOut:   z.number().optional(),
}).strict()

const animationStateDefSchema = z.object({
  frames:    z.number(),
  frameRate: z.number(),
  repeat:    z.number(),
  aura:      auraDefSchema.nullable().optional(),
}).strict()

const animationProjectileDefSchema = z.object({
  frames:    z.number(),
  frameRate: z.number(),
  speed:     z.number(),
  scale:     z.number(),
}).strict()

// `animations` is an open string-keyed map of AnimationStateDef, plus a
// reserved `skills` key holding its own nested map of the same value type.
const animationsMapSchema = z.object({
  skills: z.record(z.string(), animationStateDefSchema).optional(),
}).catchall(animationStateDefSchema)

export const animationManifestSchema = z.object({
  type:   z.literal('animations'),
  defId:  z.string(),
  display: z.object({
    sourceWidth:  z.number(),
    sourceHeight: z.number(),
    scale:        z.number(),
    anchorX:      z.number(),
    anchorY:      z.number(),
  }).strict(),
  idleSwapBelowHpPercent: z.number(),
  meleeDashDx:            z.number(),
  tagMap:                 z.record(z.string(), z.string()),
  animations:             animationsMapSchema,
  projectile:             animationProjectileDefSchema.nullable(),
}).strict()

// ── AnimSequenceManifest (skill id / sequence id → AnimPhase[]) ────────────────

const animPhaseSchema: z.ZodType<AnimPhase> = z.lazy(() => z.discriminatedUnion('type', [
  z.object({ type: z.literal('wait'),         ms: z.number() }).strict(),
  z.object({ type: z.literal('playAnim'),     figure: z.enum(['acting', 'target']), stateKey: z.string() }).strict(),
  z.object({ type: z.literal('shove') }).strict(),
  z.object({ type: z.literal('evasionDodge') }).strict(),
  z.object({ type: z.literal('projectile') }).strict(),
  z.object({ type: z.literal('impact') }).strict(),
  z.object({ type: z.literal('flash'),        figure: z.enum(['acting', 'target']), colour: z.string().optional() }).strict(),
  z.object({ type: z.literal('particles'),    figure: z.enum(['acting', 'target']) }).strict(),
  z.object({ type: z.literal('damageNumber') }).strict(),
  z.object({ type: z.literal('statusText'),   text: z.string(), colour: z.string() }).strict(),
  z.object({ type: z.literal('feedback') }).strict(),
  z.object({ type: z.literal('cameraShake'),  duration: z.number(), intensity: z.number() }).strict(),
  z.object({ type: z.literal('aura'),         figure: z.enum(['acting', 'target']), show: z.boolean() }).strict(),
  z.object({ type: z.literal('parallel'),     phases: z.array(animPhaseSchema) }).strict(),
  z.object({
    type:  z.literal('branch'),
    cases: z.record(z.union([diceOutcomeSchema, z.literal('default')]), z.array(animPhaseSchema)),
  }).strict(),
]))

export const animSequenceManifestSchema = z.record(z.string(), z.array(animPhaseSchema))
