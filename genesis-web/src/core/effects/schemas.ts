// ─────────────────────────────────────────────────────────────────────────────
// Zod schemas for the content contract (v0.1.0)
//
// Runtime validation for every JSON shape the effect system consumes.
// Schemas are deliberately strict — unknown keys throw, discriminated
// unions enforce exhaustive variants, and the outputs are structurally
// identical to the TS types in ./types.ts.
//
// Consumers (DataService, tests) import the parsed schemas and NEVER
// hand-roll validation. Adding a new primitive requires a new variant
// here alongside its handler module.
// ─────────────────────────────────────────────────────────────────────────────

import { z } from 'zod'

// ── Scalar vocabularies ──────────────────────────────────────────────────────

export const statKeySchema = z.enum([
  'strength', 'endurance', 'power', 'resistance', 'speed', 'precision',
])

export const tagSchema = z.enum([
  'physical', 'energy', 'melee', 'ranged',
  'utility', 'unique', 'special', 'awakened', 'misc', 'basic',
  'movement', 'hyper',
])

export const diceOutcomeSchema = z.enum(['Boosted', 'Hit', 'Evade', 'Fail'])

// ── ValueExpr (recursive) ────────────────────────────────────────────────────

const valueStatKeySchema = z.union([statKeySchema, z.enum(['maxHp', 'maxAp'])])

const valueExprBase = z.union([
  z.number(),
  z.object({
    stat:    valueStatKeySchema,
    percent: z.number(),
    of:      z.enum(['caster', 'target']).optional(),
  }).strict(),
  z.object({ secondary:            z.number() }).strict(),
  z.object({ globalApSpentPercent: z.number() }).strict(),
])

export const valueExprSchema: z.ZodType<unknown> = z.lazy(() =>
  z.union([
    valueExprBase,
    z.object({ sum: z.array(valueExprSchema) }).strict(),
  ]),
)

// ── WhenClause ───────────────────────────────────────────────────────────────

export const whenClauseSchema = z.discriminatedUnion('event', [
  z.object({ event: z.literal('onCast') }).strict(),
  z.object({ event: z.literal('onDiceRoll'),           outcome: diceOutcomeSchema.optional() }).strict(),
  z.object({ event: z.literal('onHit') }).strict(),
  z.object({ event: z.literal('onMiss') }).strict(),
  z.object({ event: z.literal('onAfterHit') }).strict(),
  z.object({ event: z.literal('onEvade') }).strict(),
  z.object({ event: z.literal('onApply') }).strict(),
  z.object({ event: z.literal('onExpire') }).strict(),
  z.object({ event: z.literal('onRemoved') }).strict(),
  z.object({ event: z.literal('onTickInterval'),       interval: z.number().int().positive() }).strict(),
  z.object({ event: z.literal('onBattleTickInterval'), interval: z.number().int().positive() }).strict(),
  z.object({ event: z.literal('onUnitTurnStart') }).strict(),
  z.object({ event: z.literal('onTakeDamage') }).strict(),
  z.object({ event: z.literal('onHpThreshold'),        below: z.number().optional(), above: z.number().optional() }).strict(),
  z.object({ event: z.literal('onApChange') }).strict(),
  z.object({ event: z.literal('onBattleStart') }).strict(),
  z.object({ event: z.literal('onBattleEnd') }).strict(),
  z.object({ event: z.literal('onApSpent') }).strict(),
])

// ── Condition (recursive) ────────────────────────────────────────────────────

const conditionLeaf = z.union([
  z.object({ chance:        z.number() }).strict(),
  z.object({ selfHpBelow:   z.number() }).strict(),
  z.object({ selfHpAbove:   z.number() }).strict(),
  z.object({ targetHpBelow: z.number() }).strict(),
  z.object({ targetHpAbove: z.number() }).strict(),
  z.object({ selfApBelow:   z.number() }).strict(),
  z.object({ selfApAbove:   z.number() }).strict(),
  z.object({ hasStatus:     z.string() }).strict(),
  z.object({ selfHasStatus: z.string() }).strict(),
  z.object({ hasTag:        z.string() }).strict(),
  z.object({ diceOutcome:   diceOutcomeSchema }).strict(),
  z.object({ apAccumGte:    z.number() }).strict(),
  z.object({ selfStatusStacksBelow: z.object({ id: z.string(), stacks: z.number() }) }).strict(),
])

export const conditionSchema: z.ZodType<unknown> = z.lazy(() =>
  z.union([
    conditionLeaf,
    z.object({ not: conditionSchema }).strict(),
    z.object({ all: z.array(conditionSchema) }).strict(),
    z.object({ any: z.array(conditionSchema) }).strict(),
  ]),
)

// ── TargetSelector ───────────────────────────────────────────────────────────

export const targetSelectorSchema = z.union([
  z.enum([
    'self', 'enemy', 'ally', 'all-enemies', 'all-allies',
    'lowest-hp-ally', 'lowest-hp-enemy', 'random-enemy', 'random-ally',
    'caster-and-target',
  ]),
  z.object({ tag: z.string() }).strict(),
])

export const targetingSchema = z.object({
  selector: targetSelectorSchema,
  range:    z.enum(['melee', 'ranged', 'global']),
}).strict()

// ── Effect primitive variants ────────────────────────────────────────────────

const effectCommon = {
  id:        z.string().optional(),
  when:      whenClauseSchema,
  condition: conditionSchema.optional(),
  target:    targetSelectorSchema.optional(),
}

const modDurationSchema = z.union([
  z.number(),
  z.enum(['battle', 'untilStatusGone']),
])

const onBreakTickCooldownSchema = z.object({
  skillId: z.string(),
  ticks:   z.number().int().positive(),
}).strict()

export const effectSchema = z.discriminatedUnion('type', [
  z.object({ ...effectCommon, type: z.literal('damage'),            amount: valueExprSchema, damageType: z.string().optional() }).strict(),
  z.object({ ...effectCommon, type: z.literal('heal'),              amount: valueExprSchema }).strict(),
  z.object({ ...effectCommon, type: z.literal('tickShove'),         amount: z.number() }).strict(),
  z.object({ ...effectCommon, type: z.literal('gainAp'),            amount: valueExprSchema }).strict(),
  z.object({ ...effectCommon, type: z.literal('spendAp'),           amount: z.number() }).strict(),
  z.object({
    ...effectCommon,
    type:         z.literal('modifyStat'),
    stat:         statKeySchema,
    delta:        z.number().optional(),
    deltaPercent: z.number().optional(),
    duration:     modDurationSchema,
  }).strict(),
  z.object({
    ...effectCommon,
    type:                 z.literal('applyStatus'),
    status:               z.string(),
    duration:             z.number().optional(),
    chance:               z.number().optional(),
    shieldPercent:        z.number().optional(),
    shieldFlat:           z.number().optional(),
    shieldValue:          valueExprSchema.optional(),
    companionStatus:      z.string().optional(),
    companionDuration:    z.number().optional(),
    onBreakTickCooldown:  onBreakTickCooldownSchema.optional(),
    blocksRecastOfSkill:  z.string().optional(),
    rangedBaseChanceBonus: z.number().optional(),
    stacks:               z.number().int().positive().optional(),
  }).strict(),
  z.object({ ...effectCommon, type: z.literal('removeStatus'),      status: z.string().optional(), tag: z.string().optional() }).strict(),
  z.object({ ...effectCommon, type: z.literal('shiftProbability'),  outcome: diceOutcomeSchema, delta: z.number() }).strict(),
  z.object({ ...effectCommon, type: z.literal('rerollDice'),        outcome: diceOutcomeSchema.optional(), uses: z.number().int().positive(), perBattle: z.boolean().optional() }).strict(),
  z.object({ ...effectCommon, type: z.literal('forceOutcome'),      outcome: diceOutcomeSchema }).strict(),
  z.object({ ...effectCommon, type: z.literal('triggerSkill'),      skillId: z.string(), ignoreCost: z.boolean().optional() }).strict(),
  z.object({ ...effectCommon, type: z.literal('secondaryResource'), delta: z.number() }).strict(),
  z.object({ ...effectCommon, type: z.literal('resetApAccum') }).strict(),
])

// ── Resolution + LevelUpgrade ───────────────────────────────────────────────

export const diceModifierSchema = z.object({
  type:    z.enum(['shiftProbability', 'forceOutcome']),
  outcome: diceOutcomeSchema,
  delta:   z.number().optional(),
}).strict()

export const resolutionSchema = z.object({
  baseChance:    z.number(),
  diceModifiers: z.array(diceModifierSchema).optional(),
}).strict()

export const levelUpgradeSchema = z.object({
  level: z.number().int().min(2),
  patch: z.record(z.string(), z.unknown()),
}).strict()

// ── Dodge config (embedded in statusDefSchema) ───────────────────────────────

const dodgeConfigSchema = z.object({
  allChance:        z.number().optional(),
  meleeChance:      z.number().optional(),
  rangedChance:     z.number().optional(),
  consumeOnAttempt: z.boolean().optional(),
  consumeOnSuccess: z.boolean().optional(),
}).strict()

// ── Script schemas ───────────────────────────────────────────────────────────

export const skillDefSchema = z.object({
  type:          z.literal('skill'),
  id:            z.string(),
  name:          z.string(),
  description:   z.string().optional(),
  tuCost:        z.number().int().nonnegative(),
  apCost:        z.number().int().nonnegative(),
  tickCooldown:  z.number().int().positive().optional(),
  turnCooldown:  z.number().int().positive().optional(),
  tags:          z.array(tagSchema).min(1).max(4),
  maxLevel:      z.number().int().min(1),
  targeting:     targetingSchema,
  resolution:    resolutionSchema.optional(),
  effects:       z.array(effectSchema),
  levelUpgrades: z.array(levelUpgradeSchema).optional(),
}).strict()

export const statusDefSchema = z.object({
  type:              z.literal('status'),
  id:                z.string(),
  name:              z.string(),
  stacking:          z.enum(['refresh', 'extend', 'stack', 'independent']),
  maxStacks:         z.number().int().positive().optional(),
  duration:           z.number().int().positive().optional(),
  expiresWithStatus:  z.string().optional(),
  expireSequenceId:   z.string().optional(),
  tags:              z.array(z.string()).optional(),
  blockedTags:       z.array(z.string()).optional(),
  dodgeConfig:       dodgeConfigSchema.optional(),
  tuCostConfig:      z.object({
    delta:               z.number().optional(),
    percentOfBase:       z.number().optional(),
    percentPerSecondary: z.number().optional(),
  }).optional(),
  critConfig:        z.object({
    chance:             z.number(),
    attackerStrPercent: z.number(),
  }).optional(),
  hyperModeTrigger:  z.boolean().optional(),
  hyperModeConfig:   z.object({ activeBelowStacks: z.number() }).optional(),
  effects:           z.array(effectSchema),
}).strict()

export const passiveDefSchema = z.object({
  type:        z.literal('passive'),
  id:          z.string(),
  name:        z.string(),
  description: z.string().optional(),
  effects:     z.array(effectSchema),
}).strict()
