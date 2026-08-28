# Engine audit — findings

Machine-recovered from a multi-agent audit whose own pipeline discarded its
output (the verification stage was killed by a spend limit, and the script
only emitted findings that survived verification). These are therefore
**unverified by a second agent** — the confidence field is the reporting
agent's own claim. `reproduced` means that agent ran something.

Treat every row as a lead to confirm, not a fact. Two have since been
confirmed and fixed by hand; one of those fixes is itself flagged as
incomplete below.

30 distinct findings.

---

## 1. tickShove on a non-acting unit desyncs unit.tickPosition from registeredTicks (LEAD A — CONFIRMED)

- **file** `genesis-web/src/core/battle/BattleApplyRunner.ts:108`
- **kind** desync · **confidence** reproduced

**Trigger.** Any skill whose tickShove effect lands on a unit other than the caster. The shipped instance is Tara's Chaotic Vortex (public/data/characters/tara_001/skills.json, selector `all-enemies`, tickShove amount 4). tickShove writes tickPosition into the snapshot (core/effects/builtins/tickShove.ts:15). runPlayerApplying commits the whole snapshot to engine.playerUnits/enemies at :104-108, so the new tickPosition lands on the Unit — but registeredTicks is only rewritten for the actor, via registerTickInternal at :113 (BattleEngine.ts:272-274). Every non-acting shoved unit keeps its old entry in the map.

**Consequence.** The engine's two representations of the timeline diverge and the wrong one drives the game. All scheduling reads registeredTicks (BattleTickRunner.ts:14, :50; BattleEnemyTelegraphRunner.ts:30; BattleEngine.getActivePlayerUnit:551), while the timeline UI positions every marker from unit.tickPosition (TimelineStrip.tsx:73, :125). After Chaotic Vortex the enemy markers visibly slide 4 ticks later and the enemies still act at their original ticks — the skill that is the character's entire identity is cosmetic. The stale map also feeds resolveTickDisplacement's occupancy count, so D8 displacement is computed against positions that no longer exist. The shove is then half-applied one action later, because BattleApplyRunner.ts:28/:112 read the shoved tickPosition off the snapshot when that unit finally acts.

**Proposed fix.** Make registeredTicks the single write path. In runPlayerApplying and runEnemyApplying, after the snapshot is committed, walk every unit and call engine.registerTickInternal(id, snapTick) for any unit whose snapshot tickPosition differs from registeredTicks.get(id) — not just the actor. registerTickInternal already writes both sides (BattleEngine.ts:272-274), applies the displacement/floor rules, and emits onTickDisplaced, so routing shoves through it fixes the desync, the occupancy math and the unexplained-marker-jump signal at once.

<details><summary>evidence</summary>

```
/tmp/audit-scratch/turnloop/leadA.test.ts (npx vitest run --root /tmp/audit-scratch/turnloop leadA) — Chaotic Vortex shape, all-enemies + tickShove 4:
AUDIT p1: unit.tickPosition=12  registeredTicks=12
AUDIT e1: unit.tickPosition=24  registeredTicks=20
AUDIT e2: unit.tickPosition=34  registeredTicks=30
AUDIT engine tickValue: 12
The caster stays in sync; both shoved enemies do not.
```
</details>

---

## 2. Interval passives fire after the snapshot is already committed, so their writes reach nothing — and the death check still reads them

- **file** `genesis-web/src/core/battle/BattleApplyRunner.ts:63`
- **kind** desync · **confidence** reproduced

**Trigger.** Any unit with an `onBattleTickInterval` passive while a turn resolves through `enemy_applying` / `player_applying`. Shipped: `public/data/characters/tara_001/passive.json` (gainAp every 25 TU) and `kiragen_controller_001/passive.json` (secondaryResource / broadcastResource / applyStatus every 15 TU).

**Consequence.** `runEnemyApplying` commits the snapshot to `engine.playerUnits`/`engine.enemies` at lines 52-53 (`runPlayerApplying`: 135-139) and only THEN calls `fireBattleTickIntervalPassives` at line 63 (147). The passive's effects mutate `snap` by replacing map entries with new objects; the engine arrays still hold the pre-passive objects, and nothing re-commits. So Tara's passive burns its interval (`lastIntervalFire`/`lastIntervalApAccum` are advanced) and grants zero AP — it only ever pays out on the skip paths, which order it correctly (`BattlePlayerActions.skipTurn:149`, `BattleAITurnHelpers.handleAISkip:97`, both before their commit). Worse, the death check at lines 73-78 DOES re-read `snap`, so the two disagree: a unit reduced to 0 HP by an interval passive is unregistered from `registeredTicks` and emits `unit_death`, while `engine.playerUnits` still shows it at full HP. That unit is a ghost — it can never act again and can never die, so a defeat that should happen never does.

**Proposed fix.** Move the `engine.globalBattleTick += effectiveTu` + `fireBattleTickIntervalPassives(...)` block (BattleApplyRunner.ts:62-69 and 146-153) to BEFORE the `engine.playerUnits = ... / engine.enemies = ...` commit, matching the ordering `skipTurn` and `handleAISkip` already use. The tick re-registration and `reRegisterMovedUnits` stay after the commit.

<details><summary>evidence</summary>

```
/tmp/audit-scratch/A_interval.test.ts — Tara-shaped passive (`onBattleTickInterval` interval 1 → gainAp 20) on a bystander ally.
  player turn: `bystander AP after the passive fired: 10 (started 10, passive grants 20)` / `engine.lastIntervalFire says it fired: [ [ 'p2', 8 ] ]`
  AI turn:     `AI-turn bystander AP: 10 fired: [ [ 'p2', 8 ] ]`
/tmp/audit-scratch/A2_ghost.test.ts — same passive shape with `damage 999 target self`:
  `p2 hp in engine state : 100` / `p2 in registeredTicks : false` / `death narrative fired : 1`
```
</details>

---

## 3. One tap on the dice-skip hotzone deletes the enemy's counter-attack

- **file** `genesis-web/src/core/battle/BattleAttackResolver.ts:270`
- **kind** lost-decision · **confidence** reproduced

**Trigger.** The player casts a single-target skill, the enemy evades and its AI counter roll succeeds, and the player taps the dice-skip hotzone (BattleScreen.tsx:614) early in the same turn. skipDiceAnim (BattleEngine.ts:229) fires pendingAttackCb immediately, which arms playerApplyTimer for ANIM_TIMEOUT_MS (BattlePlayerActions.ts:117), so runPlayerApplying commits and discards `snap` at tap+1500 ms — before the AI counter's runAttack, which is hard-scheduled at evade+COUNTER_ANNOUNCE_MS+DICE_RESULT_DISMISS_MS = evade+2000 ms. Same root cause as the player-side counter loss, but requires no hesitation: it is deterministic on a single deliberate tap of a UI affordance the game invites the player to use.

**Consequence.** The enemy's counter resolves into a discarded snapshot: the player takes no damage, no status is applied, and the AI's AP is not spent — yet the battle log prints the counter as a hit. Tapping the dice-skip hotzone therefore silently makes the player immune to counter-attacks, which is a free exploit as well as a log/state divergence.

**Proposed fix.** Track outstanding counter work on the engine: increment a `counterChainPending` counter in scheduleCounterChain (BattleAttackResolver.ts:238) and decrement it when the chained runAttack finishes (and when the roll fails at :257 or the AI declines at :268). Refuse to enter enemy_applying / player_applying while it is > 0, and call engine.drive() on the decrement. The same guard fixes the player-side loss above.

<details><summary>evidence</summary>

```
/tmp/audit-scratch/turnloop/skipdice.test.ts (npx vitest run --root /tmp/audit-scratch/turnloop skipdice):
AUDIT tapSkip=false: player hp=950/1000  (AI counter LANDED)
AUDIT   logs: ["Test Unit evaded Basic Strike!","Test Unit -> Riposte on Test Unit [Hit]"]
AUDIT tapSkip=true: player hp=1000/1000  (AI counter LOST)
AUDIT   logs: ["Test Unit evaded Basic Strike!","Test Unit -> Riposte on Test Unit [Hit]"]
Identical inputs; the only difference is engine.skipDiceAnim() at t=100 ms.
```
</details>

---

## 4. A player counter decision outlives the turn it belongs to and is applied to a discarded snapshot

- **file** `genesis-web/src/core/battle/BattleAttackResolver.ts:262`
- **kind** lost-decision · **confidence** reproduced

**Trigger.** The player evades a single-target attack, the counter roll succeeds, and the player takes longer than ~1.9 s to tap COUNTER. The prompt (`BattleScreen.CounterPromptOverlay`) has no deadline and nothing in the step machine waits on `pendingCounterDecision`.

**Consequence.** The prompt is raised at `COUNTER_ANNOUNCE_MS` (800 ms) into the attack's resolution, but `enemy_applying` commits at `DICE_RESULT_DISMISS_MS + ANIM_TIMEOUT_MS` = 2700 ms (`BattleEnemyTelegraphRunner.ts:191`), and `runEnemyApplying` nulls `pendingAITurn` and moves on. `confirmCounter` (`BattleEngine.ts:204-222`) then runs `runAttack` against `pendingCounterDecision.snap` — the map that was committed and abandoned turns ago. The counter's damage, its AP cost and any status it applies all land in that dead map. The player still sees the dice overlay and the battle-log line saying the counter hit, because `runAttack` calls `engine.showDiceResult` and `engine.appendLog` on the live engine; and it still mutates real engine state that outlives the snapshot (`engine.unitSkillsMap` on shield break, `engine.pendingExpiryAnims`, and it can schedule a further counter chain). The overlay also stays up across subsequent turns until dismissed. With the tap-to-skip dice hotzone the window shrinks further: `skipDiceAnim` fires `pendingAttackCb` immediately, so the commit can land ~1.5 s after the attack, before even the AI-side counter at 800 + 1200 = 2000 ms (`BattleAttackResolver.ts:270`) has run.

**Proposed fix.** Make the commit wait for the decision: in the `applyTimer` callback at `BattleEnemyTelegraphRunner.ts:191` and the `playerApplyTimer` callback at `BattlePlayerActions.ts:117`, re-arm the timer instead of advancing while `engine.pendingCounterDecision !== null`, and have `confirmCounter`/`skipCounter` call `drive()` when they clear it. (A prompt deadline that auto-skips before the commit is the alternative, but it silently discards player intent.)

<details><summary>evidence</summary>

```
/tmp/audit-scratch/probe3.test.ts — enemy attacks, player evades, counter roll succeeds, player taps after the commit:
  `step when the player finally taps COUNTER: enemy_acting` (the enemy has since started another turn)
  `enemy hp 100 -> 100 (counter should deal 50)`
  `player ap 50 -> 50 (counter costs 5)`
  `log tail: [ 'Test Unit evaded Basic Strike!', 'Test Unit → Basic Strike on Test Unit [Hit]', 'Test Unit → Riposte on Test Unit [Hit]' ]` — the log announces a counter that changed nothing.
```
</details>

---

## 5. `onEvade` effects are multiplied by outcomeScale('Evade') = 0, so they can never do anything

- **file** `genesis-web/src/core/battle/BattleAttackResolver.ts:136`
- **kind** corruption · **confidence** reproduced

**Trigger.** Any skill with an `onEvade` damage or heal effect, on an Evade. Shipped: `husty_001_cached_shockwave_dmg_evade` in `public/data/characters/husty_001/skills.json`.

**Consequence.** `scale = outcomeScale(diceOutcome)` (line 77) is 0 for Evade, and it is baked into `ctx.outcomeScale` once for the whole cast (line 113). The `onEvade` branch derives `evadeCtx` from that same ctx, so the `damage` handler's `Math.round(resolveValueExpr(...) * (ctx.outcomeScale ?? 1))` resolves to 0. Cached Shockwave's documented behaviour — `docs/characters/in-game/husty.md:123` "On Evade | 125% Surge + 15% Power", and line 116 "a shockwave can't be fully dodged" — is unreachable: an evaded Shockwave deals literally nothing while still burning 25 AP, the 25-tick cooldown, and the entire Power Surge pool (the `secondaryResource set: 0` effect is `onCast` and still fires). The whole `onEvade` event is dead weight for magnitude-scaled effects.

**Proposed fix.** Build the Evade context with a neutral magnitude: `const evadeCtx = { ...ctx, target, outcomeScale: 1, event: { event: 'onEvade' } as const }` at BattleAttackResolver.ts:136. An `onEvade` effect is already the author's statement of what happens when the attack is dodged; scaling it by the dodge is scaling it twice.

<details><summary>evidence</summary>

```
/tmp/audit-scratch/E_onevade.test.ts — real Cached Shockwave JSON, surge 40, power 50, `Math.random` pinned to 0.65 (Evade):
  `enemy hp after an evaded Cached Shockwave: 500 (500 - (1.25*40 + 0.15*50) = 442 expected)`
```
</details>

---

## 6. A throw inside the AI turn's setTimeout escapes everything and freezes the battle at enemy_acting

- **file** `genesis-web/src/core/battle/BattleEnemyTelegraphRunner.ts:138`
- **kind** uncaught-throw · **confidence** reproduced

**Trigger.** Any throw raised by engine code running inside engine.applyTimer — the AI attack resolution. The cheapest reachable source is content: core/effects/schemas.ts:172-176 accepts five effect types (`removeStatus`, `shiftProbability`, `rerollDice`, `forceOutcome`, `triggerSkill`) that have NO registered handler (builtins/index.ts registers 12), and getHandler throws `No effect handler registered for type: <type>` (core/effects/registry.ts:28). docs/engine/00_content_contract.md:377-381 lists all five in the effect-primitive table with no "planned" marker, so a content author following the contract will write them. Concrete edit: add `{"id":"cleanse","when":{"event":"onCast"},"type":"removeStatus","status":"guard"}` to any effects array in public/data/characters/hunter_001/skills.json (the default enemy — see BattleContext.tsx:367). It passes Zod, loads, and throws the first time the enemy casts.

**Consequence.** The throw is raised in a setTimeout callback body, which is engine code, not a `cb.onX` — BattleContext's `safe()` wrapper (BattleContext.tsx:290) only wraps callback bodies and safeEngineCall (:253) only wraps synchronous calls from event handlers. It is not a render, so the ErrorBoundary never sees it. It reaches window.onerror and nothing else. The step is left at `enemy_acting`, which is in YIELDED_STEPS (BattleStepMachine.ts:34), so drive() refuses to advance; no timer remains and executeSkill/skipTurn both bail because step !== 'player_turn'. Permanent, silent freeze with no error toast — the only exit is back-button pause then LEAVE BATTLE. The identical content on a player skill is caught by safeEngineCall and at least surfaces the toast, so the failure mode is visible for the player and invisible for the AI.

**Proposed fix.** Two parts. (1) Close the content hole: either register the five missing handlers or delete their variants from the effect union in core/effects/schemas.ts:172-176 so DataService rejects the JSON at load, where the existing load-error path already reports it (BattleContext.tsx:487). (2) Stop the class of bug: give the engine a `safeTimeout(fn, ms)` helper that wraps every engine-owned setTimeout body in try/catch and routes the error to a new `cb.onEngineError` (wired to reportError), then use it for the timers at BattleEnemyTelegraphRunner.ts:70/138/191/199, BattlePlayerActions.ts:117/122, BattleAttackResolver.ts:249/270, BattleApplyRunner.ts:72/155 and BattleEngine.ts:213/458.

<details><summary>evidence</summary>

```
/tmp/audit-scratch/turnloop/handler.test.ts (npx vitest run --root /tmp/audit-scratch/turnloop handler):
AUDIT zod accepts removeStatus skill: true
AUDIT throw escaped the timer: No effect handler registered for type: removeStatus
AUDIT step after throw: enemy_acting
AUDIT pending timers left: 1
AUDIT step after 60s more: enemy_acting  timers=0
```
</details>

---

## 7. A throw inside the engine's own setTimeout callbacks escapes every guard and parks the battle forever

- **file** `genesis-web/src/core/battle/BattleEnemyTelegraphRunner.ts:138`
- **kind** uncaught-throw · **confidence** reproduced

**Trigger.** Add `"of": "target"` to any `onCast` damage `amount` in `public/data/characters/*/skills.json` (the schema accepts it — `tara_001/skills.json:51` already uses the sibling `"of": "caster"`), then let an AI unit cast it and have the target evade. `resolveValue.ts:44` throws `ValueExpr references target stats but no target in context`, because `runAttack` sets `target: noDamage ? undefined : target` on an Evade.

**Consequence.** The throw is raised inside the `applyTimer` callback at line 138 — a timer the engine armed itself. `BattleContext.safeEngineCall` wraps synchronous engine calls made from React event handlers only, and the React error boundaries catch render throws only, so nothing catches this. The callback dies before setting `pendingAITurn`, before `engine.pendingAttackCb`, and before arming the next timer. The step machine is left in `enemy_acting`, which is in `YIELDED_STEPS`, with zero timers pending: `drive()` will never advance it and no callback will ever re-enter. The battle is permanently frozen with no error shown; the only exit is the pause menu's LEAVE BATTLE. The same shape applies to the counter timers at `BattleAttackResolver.ts:249`/`:270` and `BattleEngine.confirmCounter:213`.

**Proposed fix.** Route the engine's self-armed timer callbacks through one guarded helper (`engine.safeTimeout(fn, ms)`) that catches, reports through a callback the way `safeEngineCall` does, and ends the battle cleanly instead of leaving a yielded step with no timer. Apply it at BattleEnemyTelegraphRunner.ts:70/138/191/199, BattleAttackResolver.ts:249/270 and BattleEngine.ts:213.

<details><summary>evidence</summary>

```
/tmp/audit-scratch/G_stall.test.ts — AI casts a skill whose onCast damage uses `{ stat: 'endurance', percent: 50, of: 'target' }`, roll pinned to Evade:
  `escaped throw: ValueExpr references target stats but no target in context`
  `step after 20s: enemy_acting`
  `pending timers: 0`
```
</details>

---

## 8. applySplashEffects builds its context from the pre-attack target object, undoing damage dealt during runAttack

- **file** `genesis-web/src/core/battle/BattleEngine.ts:372`
- **kind** corruption · **confidence** reproduced

**Trigger.** Any multi-target skill where a secondary target was also touched during the primary resolution. `extraTargets` comes from resolveSkillTargets, captured at BattlePlayerActions.ts:38 before the AP cost is even applied. Line 371 computes `extraSnap` from the live snapshot but uses it only for the isAlive check; line 372 puts the stale `extra` into ctx.target. Any handler that writes from ctx (tickShove.ts:15, damage.ts:23, heal.ts:22, modifyStat.ts:24, gainAp.ts:16, spendAp.ts:15) then writes the pre-attack Unit back. Shipped: tara_001_chaotic_vortex (all-enemies tickShove + a `random-enemy` damage that can pick a splash target); stage_002/003 group 5-7 enemies into parties, so multi-enemy battles are the norm.

**Consequence.** Silent HP restoration. Reproduced: Chaotic Vortex's random-enemy damage takes e2 from 200 to 167, then the splash pass shoves e2 and writes the stale copy back — e2 ends at hp 200 with tickPosition 34. The tick shove lands, the damage is gone, and the log still reports the damage.

**Proposed fix.** Use the live unit in the context: `target: noDamage ? undefined : extraSnap` at BattleEngine.ts:372. The durable fix is for the ctx-derived handlers to re-read (`ctx.battle.getUnit(target.id) ?? target`) before writing, the way resetApAccum.ts:8, syncResources.ts:11 and broadcastResource.ts:20 already do.

<details><summary>evidence</summary>

```
/tmp/audit-scratch/splash.test.ts:
  after runAttack: e2.hp=167 (took 66% of 50 power = 33)
  after splash:    e2.hp=200, e2.tickPosition=34
```
</details>

---

## 9. A confirmed player counter is silently discarded once the enemy turn has committed (LEAD B — CONFIRMED)

- **file** `genesis-web/src/core/battle/BattleEngine.ts:213`
- **kind** lost-decision · **confidence** reproduced

**Trigger.** An AI attack is evaded by the controlled player, the counter roll succeeds, and the player takes longer than ~1.9 s to press COUNTER. The prompt (BattleScreen.tsx:429 CounterPromptOverlay) has no timeout and nothing in the step machine waits for it: the counter roll resolves at attack+COUNTER_ANNOUNCE_MS (800 ms) but BattleEnemyTelegraphRunner.ts:191 hands the turn to enemy_applying at attack+DICE_RESULT_DISMISS_MS+ANIM_TIMEOUT_MS (2700 ms) regardless. runEnemyApplying commits `pending.snap` into engine.playerUnits/enemies and nulls pendingAITurn (BattleApplyRunner.ts:16-23). confirmCounter then mutates that now-orphaned map (BattleEngine.ts:210 and the runAttack inside the 200 ms setTimeout at :214) and nobody ever applies it. The comment at :217 ("runPlayerApplying will apply it at the correct time") is only true inside the window.

**Consequence.** The counter is fully resolved and logged but has zero effect: the target takes no damage, the defender is not charged the AP, any status the counter applies is dropped, and a kill is lost. The battle log still prints "<unit> -> <counterSkill> on <target> [Hit]", so the player sees the counter land while the HP bars do not move — silent divergence between the log and state, no error and no toast. A deterministic sub-case exists that is 100% lossy: a depth-2 player counter (player casts -> enemy evades -> enemy counters at t0+2000 -> player evades that) raises its prompt at t0+2800, which is always after runPlayerApplying commits at t0+2700, so that prompt can never be honoured.

**Proposed fix.** Make the counter decision gate the commit instead of racing it. Add a pending-counter guard to the apply step: in runEnemyApplying/runPlayerApplying return early WITHOUT clearing pendingAITurn/pendingPlayerTurn while engine.pendingCounterDecision is non-null, and have confirmCounter (after its chained runAttack completes) and skipCounter call engine.drive() to release the commit. Equivalently, block the transition at BattleEnemyTelegraphRunner.ts:191 and BattlePlayerActions.ts:117 while a decision is outstanding.

<details><summary>evidence</summary>

```
/tmp/audit-scratch/turnloop/leadB2.test.ts (npx vitest run --root /tmp/audit-scratch/turnloop leadB2):
AUDIT prompt appeared at t=3500ms, step=enemy_acting
AUDIT   after waiting 100ms: step=enemy_acting pendingAITurn=true
AUDIT   enemy hp 100 -> 50  (counter LANDED)
AUDIT   logs: ["Test Unit evaded Basic Strike!","Test Unit -> Riposte on Test Unit [Hit]"]
AUDIT prompt appeared at t=3500ms, step=enemy_acting
AUDIT   after waiting 2500ms: step=enemy_acting pendingAITurn=false
AUDIT   enemy hp 100 -> 100  (counter LOST)
AUDIT   logs: ["Test Unit evaded Basic Strike!","Test Unit -> Riposte on Test Unit [Hit]","Test Unit -> Basic Strike on Test Unit [Hit]"]
Note the existing suite already encodes the window as a constraint on the test rather than on the engine: BattleEngine.counter.test.ts:96-99 says the confirm "must fire before that commit happens or its damage is silently orphaned".
```
</details>

---

## 10. destroy() leaves six untracked timers running; the destroyed engine keeps playing and can navigate the user away

- **file** `genesis-web/src/core/battle/BattleEngine.ts:152`
- **kind** stall · **confidence** reproduced

**Trigger.** destroy() clears only the seven timers stored in fields (:153-159). Six setTimeout calls are never stored anywhere and so survive it: the death-animation timers at BattleApplyRunner.ts:72 and :155 (which call engine.drive() and restart the whole loop), the counter-chain timers at BattleAttackResolver.ts:249 and :270, confirmCounter's at BattleEngine.ts:213, and playPendingActivationAnims' at :458. destroy() is called on unmount (BattleContext.tsx:554) — i.e. LEAVE BATTLE from the pause menu — and also from reportError (:249) on every caught engine error. Pressing LEAVE BATTLE during the 1500 ms death animation, or any engine error raised while a counter chain is in flight, leaves a live timer holding the engine.

**Consequence.** The engine is not stopped, it is only orphaned. The surviving timer calls drive() and the battle continues to play out against a screen that no longer exists: logs accumulate, AI turns resolve, and the loop can reach endBattle -> cb.onBattleEnd, which writes the result into the global Zustand store and schedules navigate(BATTLE_RESULT) 2.5 s later (BattleContext.tsx:336-340). A player who quits to the main menu is yanked onto a Victory/Defeat screen for a battle they abandoned. In the reportError case the same thing happens behind the error toast, so the toast says the battle failed while the battle is still running.

**Proposed fix.** Give BattleEngine a `private timers = new Set<ReturnType<typeof setTimeout>>()` and a `schedule(fn, ms)` helper that registers the handle and removes it on fire; route all twelve engine setTimeout sites through it and have destroy() clear the whole set (this composes with the safeTimeout wrapper above — make it one helper). Add `destroyed = true` in destroy() and an early `if (this.destroyed) return` at the top of drive(), notify() and endBattle() so any callback that has already been dequeued cannot restart the loop.

<details><summary>evidence</summary>

```
/tmp/audit-scratch/turnloop/destroy.test.ts (npx vitest run --root /tmp/audit-scratch/turnloop destroy) — destroy() called during the death-animation window:
AUDIT timers before destroy: 1
AUDIT timers after destroy:  1   <-- destroy() left these running
AUDIT onBattleEnd called after destroy: 1 [["defeat",1,0]]
AUDIT logs after destroy: ["Test Unit -> Basic Strike on Test Unit [Hit]","Test Unit -> Basic Strike on Test Unit [Hit]","Defeat! All allies have been slain."]
A full AI turn ran and the battle ended after the engine was destroyed.
```
</details>

---

## 11. A missed multi-target cast applies its enemy status to the caster

- **file** `genesis-web/src/core/battle/BattleEngine.ts:366`
- **kind** corruption · **confidence** reproduced

**Trigger.** Cast Tara's Change of Order (`public/data/characters/tara_001/skills.json`, selector `all-enemies`, one `onCast` applyStatus with no `target` override) at 2+ enemies and roll Evade or Fail. `MIN_OUTCOME_POOL` in `shiftProbabilities` guarantees both are always possible.

**Consequence.** `applySplashEffects` sets `noDamage = outcome === 'Evade' || outcome === 'Fail'` and then builds the context with `target: noDamage ? undefined : extra` (line 372) before firing every `onCast` effect (line 381). With no `target` override on the effect there is no rescope, so `applyStatus`'s recipient fallback at `core/effects/builtins/applyStatus.ts:141` (`return ctx.target ? [ctx.target] : [ctx.caster]`) hands the handler the CASTER. Tara applies `tara_001_order_swap` to herself — the `hp-ap-swap` tag, i.e. `payload.hpApSwapped = true`, so for the next 15 ticks her own skill costs are deducted from HP (`BattleEngine.applySkillAPCost:348-351`) and incoming damage drains her AP (`BattleDamage.makeShieldedBattleState:115-118`). The enemies she aimed at get nothing. This fires once per extra target.

**Proposed fix.** In `applySplashEffects`, mirror `runAttack` instead of inventing a second rule: return early on `Evade` (the cast was dodged, nothing splashes), and on `Fail` pass `target: extra` with `outcomeScale` set and the `GRAZEABLE_EFFECTS` filter applied, exactly as `BattleAttackResolver.ts:126` does. Independently, `applyStatus`'s `[ctx.caster]` fallback should not silently substitute the caster for a target the caller failed to supply.

<details><summary>evidence</summary>

```
/tmp/audit-scratch/B_splash.test.ts, real JSON for the skill and the status, `Math.random` pinned to 0.99 (Fail):
  `Tara statusSlots : [ 'tara_001_order_swap(hpApSwapped=true)' ]`
  `enemy statusSlots: [ 'e1:', 'e2:', 'e3:' ]`
```
</details>

---

## 12. applySplashEffects replays only `onCast` effects, so an all-enemies skill whose effects are `onHit` hits exactly one enemy

- **file** `genesis-web/src/core/battle/BattleEngine.ts:381`
- **kind** corruption · **confidence** reproduced

**Trigger.** Cast Husty's Disruption (`public/data/characters/husty_001/skills.json`, selector `all-enemies`, both effects declared `when.event === 'onHit'`) at 2+ enemies and land a Hit.

**Consequence.** `runAttack` fires two passes over `skillInst.cachedEffects` — `onCast` (line 121) and `onHit` (line 132) — but `applySplashEffects` filters `if (effect.when.event === 'onCast')` only. Targets 2..n of a multi-target skill therefore receive nothing from an `onHit`-declared effect. Husty's opener, documented in `docs/characters/in-game/husty.md:111` as "Locks enemy repositioning for 15 ticks while dealing immediate AoE energy damage", damages and debuffs exactly one enemy. The engine drops declared effects from well-formed content with no error, which also means the two branches of the framework disagree about what an effect list means depending on which target you are.

**Proposed fix.** Give `applySplashEffects` the same two passes `runAttack` uses: fire `onCast` effects, then (when the outcome is not an Evade) fire `onHit` effects against the extra target.

<details><summary>evidence</summary>

```
/tmp/audit-scratch/C_onhit_splash.test.ts — real Disruption JSON, real `husty_001_movement_block` status, 3 enemies, Boosted roll:
  `enemy hp     : e1=462 e2=500 e3=500`
  `enemy statuses: e1:[husty_001_movement_block] e2:[] e3:[]`
```
</details>

---

## 13. spawnUnit registers the tick before inserting the unit, so a displaced summon disagrees with the timeline from birth

- **file** `genesis-web/src/core/battle/BattleEngine.ts:185`
- **kind** desync · **confidence** reproduced

**Trigger.** Kiragen Controller's Critical Spawn (`public/data/statuses/kiragen_critical_spawn_grunt.json` / `_elite.json`, `onApply` → `spawnUnit`) resolving while `TICK_MAX_OCCUPANCY` (4) units already sit on `currentTick + 1`, the tick `BattleContext`'s spawn handler picks (`screens/BattleContext.tsx:509`).

**Consequence.** `registerTickInternal(unit.id, unit.tickPosition)` runs at line 185, before the unit is pushed into `this.playerUnits`/`this.enemies` at lines 187/189. `registerTickInternal` writes the resolved tick back by mapping over those arrays — which do not contain the new unit yet — so `registeredTicks[id]` gets the D8-displaced tick while `unit.tickPosition` keeps the un-displaced one. The engine schedules the summon at one tick; the timeline strip draws it at another. This is now actively harmful because of the tickShove fix: `reRegisterMovedUnits` (BattleApplyRunner.ts:30-40) sees `registered !== unit.tickPosition` on the next apply and calls `registerTickInternal(id, unit.tickPosition)`, dragging the scheduler back onto the tick the displacement was there to avoid — the fix propagates the desync into the map it was written to protect.

**Proposed fix.** Insert first, register second, in `BattleEngine.spawnUnit`: move `this.registerTickInternal(unit.id, unit.tickPosition)` below the `this.playerUnits = [...]` / `this.enemies = [...]` assignments so its back-write can reach the new unit.

<details><summary>evidence</summary>

```
/tmp/audit-scratch/F_spawn.test.ts — four enemies pinned on tick 51, `tickValue = 50`, spawn requested at 51:
  `registeredTicks[sum] = 50`
  `unit.tickPosition    = 51`
```
</details>

---

## 14. Each cooldown helper zeroes the cooldown axis it does not set, so an event-applied cooldown cancels a live one

- **file** `genesis-web/src/core/combat/CooldownResolver.ts:45`
- **kind** json-reachable · **confidence** reproduced

**Trigger.** applyCooldown resets cooldownReadyAtTick to 0 when the def has no tickCooldown (line 45-47) and cooldownReadyAtAction to 0 when it has no turnCooldown (line 48-50); applyTickCooldown hardcodes `cooldownReadyAtAction: 0` (line 56); applyTurnCooldown hardcodes `cooldownReadyAtTick: 0` (line 61). isOnCooldown ORs the two axes, so zeroing one releases half the gate. The event path is live in shipped content — a shield break calls applyTickCooldown at BattleAttackResolver.ts:196. It is harmless today only because hugo_001_shelling_point's onBreakTickCooldown points at itself and that skill declares neither cooldown field. Concrete edit: in public/data/characters/hugo_001/skills.json:112 change `"skillId": "hugo_001_shelling_point"` to `"hugo_001_hammer_bash"` — hammer_bash carries turnCooldown 2 (line 60) — so a shield break while Hammer Bash is on its two-action cooldown wipes that cooldown outright.

**Consequence.** A skill becomes usable earlier than its authored cooldown allows, with no log line and no visible state change — the ActionGrid simply lights up again. Reversed, the Hyper Mode override path (BattlePlayerActions.ts:55) already discards hugo_001_hyper_sense's authored tickCooldown of 20 whenever the hyper cast fires; that one is arguably intentional but it is the same unguarded assignment, so nothing distinguishes the deliberate case from the accidental one.

**Proposed fix.** Make the three helpers additive rather than assignment-based: each should set only the axis it owns and carry the other forward as `Math.max(existing, newValue)`, e.g. applyCooldown returns `cooldownReadyAtTick: patchedDef.tickCooldown ? unit.tickPosition + patchedDef.tickCooldown : inst.cooldownReadyAtTick`. If the Hyper override genuinely means 'replace both', spell that out with an explicit clearCooldowns() call at BattlePlayerActions.ts:55 rather than as a side effect.

<details><summary>evidence</summary>

```
/tmp/audit-scratch/mathaudit.test.ts E4: starting from an instance with cooldownReadyAtTick 999, `applyCooldown(unit, inst, {turnCooldown: 2})` -> `0 5` (the 999-tick cooldown erased); starting from cooldownReadyAtAction 99, `applyTickCooldown(inst, 60)` -> `60 0` (the 99-action cooldown erased).
```
</details>

---

## 15. calculateStartingTick inverts and returns ticks below the class minimum, including negative ticks, once speed exceeds 100

- **file** `genesis-web/src/core/combat/TickCalculator.ts:11`
- **kind** json-reachable · **confidence** reproduced

**Trigger.** `spread = Math.round((max - min) * (1 - speed / 100))` goes negative above speed 100, and `Math.floor(Math.random() * (spread + 1))` then samples a NEGATIVE offset instead of the intended randint(0, spread). statBlockDefSchema.speed is a bare z.number() with no ceiling — I confirmed characterDefSchema.safeParse accepts speed 200. Concrete edit: raise `speed` in public/data/characters/hugo_001/main.json (or any main.json) above 100. Shipped values top out at 45, so the guard the range formula assumes is entirely implicit.

**Consequence.** Two distinct failures. Below ~180 the roll silently pins every fast unit to a single tick and the speed→tick relationship stops being monotonic. Above that it emits negative starting ticks: Hunter at speed 200 yields -3..0. BattleContext.tsx:384-388 feeds the result straight into setTickPosition with no floor, and the 'force unique starting ticks' loop just below (line 396) only increments on collision, so a negative tick reaches registeredTicks. runAdvanceTick then does `tickValue = Math.min(...ticks)` (BattleTickRunner.ts:34) and the whole shared stream starts below zero, which contradicts resolveTickDisplacement's own stated invariant that a unit 'can never be displaced into the past'. A NaN speed propagates all the way through to a NaN tickPosition.

**Proposed fix.** Clamp the spread before sampling: `const spread = Math.max(0, Math.round((max - min) * (1 - Math.min(speed, 100) / 100)))`. That keeps the intended randint(0, spread) domain and pins a super-100 unit to its class minimum, which is the meaningful limit.

<details><summary>evidence</summary>

```
/tmp/audit-scratch/mathaudit.test.ts, 5000 samples each: `Hunter [1,6] speed=101 -> [1]`, `speed=130 -> [0]`, `speed=200 -> [-3,-2,-1,0]`, `Warrior [6,14] speed=130 -> [5]`, `NaN speed -> NaN`. /tmp/audit-scratch/zodprobe.test.ts: `speed=200 accepted: true`.
```
</details>

---

## 16. A fractional tickShove moves a unit permanently off the integer tick lattice, silently disabling occupancy displacement and clash detection for it

- **file** `genesis-web/src/core/combat/TickDisplacer.ts:51`
- **kind** json-reachable · **confidence** reproduced

**Trigger.** tickShove's amount is `z.number()` with no `.int()` (core/effects/schemas.ts:144) — I confirmed `{type:'tickShove', amount:2.5}` parses. tickShove.ts:14 adds it straight onto tickPosition. Every consumer of a tick then compares with strict equality: countOccupants uses `t === tick` (TickDisplacer.ts:51), wouldDisplace uses `at === tick` (TickOccupancy.ts:44), runClashCheck buckets active units with `tick === current` (BattleTickRunner.ts:51). Concrete edit: change Chaotic Vortex's tickShove amount in public/data/characters/tara_001/skills.json:84 from an integer to e.g. -3.5 — a natural thing to try when tuning the one skill in the game that does active tick manipulation.

**Consequence.** The shoved units live on a parallel half-tick lattice for the rest of the battle: TICK_MAX_OCCUPANCY never fires for them (four units already sitting on tick 7 do not displace an arrival at 7.5), they can never share a tick with anyone on the integer lattice, and so they can never clash or trigger a team collision. The engine keeps running and the timeline draws normally — the collision system is just off for those units, invisibly, and only for them. Since every subsequent advanceTick adds an integer tuCost, the offset never washes out.

**Proposed fix.** Make the tick lattice integral at the schema boundary — `amount: z.number().int()` in effects/schemas.ts:144 — and round defensively at the write: `Math.max(0, Math.round(target.tickPosition + effect.amount))` in tickShove.ts:14.

<details><summary>evidence</summary>

```
/tmp/audit-scratch/repro.test.ts R3: real tickShove handler with amount 2.5 -> `tick after tickShove 2.5 -> 7.5`; then `4 units already on 7.5 - arrival displaced to 8.5` versus `same with integer 7 - arrival displaced to 6`. /tmp/audit-scratch/zodprobe.test.ts: `tickShove amount=2.5 accepted: true` (and Infinity rejected).
```
</details>

---

## 17. applyStatus writes back a stale ctx-captured Unit, silently reverting every state change made earlier in the same cast

- **file** `genesis-web/src/core/effects/builtins/applyStatus.ts:96`
- **kind** corruption · **confidence** reproduced

**Trigger.** Any effect list where an applyStatus follows another write to the same unit. resolveRecipients (applyStatus.ts:139) returns ctx.targets / ctx.target / ctx.caster — Unit objects captured when the EffectContext was built (BattleAttackResolver.ts:110 uses the pre-cost `caster` argument, and `target` is the pre-effect target object). mergeStatus at line 96 spreads that captured object and hands it to ctx.battle.setUnit, which blind-writes it (BattleDamage.ts:112, `unit.hp >= prev.hp` -> snap.set). Lines 101 and 121 of this same file already do the correct thing (`ctx.battle.getUnit(target.id) ?? target`); line 96 does not. Reached by 18 shipped effect lists across the whole roster.

**Consequence.** Damage and resource changes are silently erased, and skill AP costs are refunded. Reproduced on shipped content: (1) husty_001_disruption deals 0 damage — the onHit damage lands, then the onHit applyStatus writes the pre-damage target back (hp 200 -> 200, status applied); same for kiragen_combatant_001_plasma_beam. (2) A self-targeted applyStatus restores the caster's pre-cast AP: husty_001_cached_shockwave ends at ap=60 instead of 42 (25 AP cost refunded, 7 AP regen credit lost) and apSpentAccum reset 25 -> 0, which also breaks apAccumGte / globalApSpentPercent passives. (3) hugo_001_primal_awareness fires five self applyStatus effects on the <10% HP threshold and only the LAST survives — Hugo gets `primal_awareness_spent` but never the dodge stacks or the AP freeze, so his signature survival passive marks itself used without doing anything. (4) netrolume Hertz Beats starts battle with secondaryResource=0 instead of 2, so tuCostConfig.percentPerSecondary yields a 0% TU reduction — the faction identity mechanic is inert. Nothing throws; the battle continues with wrong numbers.

**Proposed fix.** In the recipient loop, re-read the unit from battle state before merging, exactly as lines 101 and 121 already do: `const live = ctx.battle.getUnit(target.id) ?? target` and pass `live` to mergeStatus. Use `live` for the shieldPercent computation at line 32 as well. This one change fixes all four shipped consequences above.

<details><summary>evidence</summary>

```
/tmp/audit-scratch/clobber.test.ts, leadC.test.ts, passive.test.ts, netro.test.ts (run: npx vitest run --config /tmp/audit-scratch/vitest.config.ts). Output:
  hp 200 -> 200 (damage should be 25); statuses=["husty_001_movement_block"]
  plasma beam: hp 200 -> 200, statuses=["kiragen_plasma_stun"]
  [applyStatus only] committed ap=42 -> after=60, apSpentAccum=0
  status slots after threshold cross: ["hugo_001_primal_awareness_spent(dur=Infinity,stacks=1)"]
  secondaryResource=0  statuses=["netrolume_hertz_beats_active"]
```
</details>

---

## 18. applyStatus writes duration: Infinity into Unit.statusSlots; the UI renders the literal string "Infinity"

- **file** `genesis-web/src/core/effects/builtins/applyStatus.ts:18`
- **kind** corruption · **confidence** reproduced

**Trigger.** `effect.duration ?? def.duration ?? Infinity` — reached whenever neither the StatusDef nor the applying effect declares a duration. Four shipped statuses omit it (hugo_001_primal_awareness_dodge, hugo_001_primal_awareness_spent, hugo_001_hyper_sense_hyper_active, hugo_001_shelling_point_active) and none of the applying effects in hugo_001/passive.json or hugo_001/skills.json supply one.

**Consequence.** A non-finite number is stored in a Unit field and propagates to the render layer. statusChips.ts:28 guards with `slot.duration > 0 ? slot.duration : slot.stacks` — the comment says "Indefinite statuses have no duration, so show stacks instead", i.e. the author expected 0 — but `Infinity > 0` is true, so the guard never fires. StatusChipBar.tsx:24 then interpolates it and Hugo's PRIMAL chip (durationDisplay: "turns") displays "Infinity" instead of its stack count. tickStatusDurations (unit.ts:72) computes Infinity - 1 = Infinity, so the slot also never expires — correct for a stack-consumed status, but by accident rather than by the intended `duration: 0` sentinel.

**Proposed fix.** Default to 0, the sentinel the consumers already expect: `const duration = effect.duration ?? def.duration ?? 0`, and make tickStatusDurations skip slots whose duration is 0 so they still never expire on time.

<details><summary>evidence</summary>

```
/tmp/audit-scratch/passive.test.ts:
  PRIMAL slot: duration=Infinity stacks=5
  StatusChipBar durationBadge (durationDisplay:"turns") would render "Infinity"
```
</details>

---

## 19. applyStatus lands on the CASTER when a multi-target selector resolves to an empty list

- **file** `genesis-web/src/core/effects/builtins/applyStatus.ts:141`
- **kind** corruption · **confidence** reproduced

**Trigger.** A skill whose effect list damages a multi-target selector and then applies a status to the same selector, where the damage kills the last live member. Shipped content: public/data/characters/kiragen_controller_001/skills.json `kiragen_controller_001_data_pulse` — effect[0] damage target 'all-enemies', effect[1] applyStatus target 'all-enemies' status 'kiragen_virus'. applyEffect.rescope() resolves 'all-enemies' against the LIVE snapshot (targetSelector.ts:51 filters hp>0), so once effect[0] kills the last enemy, rescope returns {target: undefined, targets: []} — which resolveRecipients cannot distinguish from 'this effect declared no targeting at all', and so falls through to [ctx.caster].

**Consequence.** Kiragen Controller applies the enemy debuff Virus (-6% accuracy, 8 ticks) to himself on any Data Pulse that finishes the last enemy. The slot is written into the snapshot and committed by runPlayerApplying/runEnemyApplying like any other state, so it persists for the rest of the battle. Nothing throws and no log line is emitted. applyStatus is the ONLY builtin with this fallback — damage.ts:29, heal.ts:62, gainAp.ts:89, tickShove.ts:141 and modifyStat.ts:177 all return [] in the same position, so the divergence is an accident, not a rule.

**Proposed fix.** Distinguish 'no targeting declared' from 'targeting resolved to nobody'. In applyEffect.rescope (applyEffect.ts:64) always populate `targets` (even when empty) for a selector override, and change applyStatus's resolveRecipients to `if (ctx.targets) return ctx.targets; return ctx.target ? [ctx.target] : [ctx.caster]` so an explicitly-empty selector result yields no recipients while an untargeted self-buff still reaches the caster.

<details><summary>evidence</summary>

```
/tmp/audit-scratch/repro.test.ts, run via `cd /home/user/Genesis/genesis-web && npx vitest run --root=/tmp/audit-scratch repro`. Drives the real registered builtins through applyEffect with the real makeShieldedBattleState. Output:
  foe hp after damage: 0
  CASTER status slots : [ 'kiragen_virus' ]
  DEAD FOE status slots: []
```
</details>

---

## 20. applyStatus `chance` is declared in the schema, authored in shipped skills, and never rolled

- **file** `genesis-web/src/core/effects/builtins/applyStatus.ts:14`
- **kind** desync · **confidence** reproduced

**Trigger.** Any applyStatus effect carrying a `chance` field. effectSchema declares it (core/effects/schemas.ts:160) and the Effect type declares it (core/effects/types.ts, applyStatus variant), and two shipped skills author it: public/data/characters/kiragen_controller_001/skills.json:27 and public/data/characters/kiragen_combatant_001/skills.json:26, both "chance": 0.10. The handler body never reads effect.chance — the only `chance` the engine evaluates is the Condition leaf form at core/effects/conditions.ts:18.

**Consequence.** Data Pulse's description says 'Each target has independent 10% chance to receive Virus'; the status lands on every target every cast. The same for Plasma Beam. This is exactly the 'declared in one place and silently not honoured in another' family that core/__tests__/engineInvariants.test.ts was written to catch, and that suite does not cover effect fields — it only checks handler existence, status-file existence and patch paths. It also multiplies the previous finding: the self-application via the empty-selector fallback happens at 100%, not 10%.

**Proposed fix.** Either honour it in the handler — `if (effect.chance !== undefined && Math.random() >= effect.chance) continue` inside the per-target loop, so it stays independent per recipient as the description promises — or delete the field from schemas.ts:160 and types.ts and rewrite the two skills to use `condition: { chance: 0.1 }`. Add an invariant test asserting every schema-declared effect field is read by its handler.

<details><summary>evidence</summary>

```
/tmp/audit-scratch/repro.test.ts second case, same command. 100 casts of an applyStatus effect with chance 0.1 against a live enemy: `applyStatus with chance 0.1 landed 100 / 100`. Confirmed by grep that `effect.chance` appears in no handler: only core/effects/conditions.ts:18 reads a `chance` key.
```
</details>

---

## 21. secondaryResource `set` branch clobbers the caster snapshot; the `delta` branch two lines below does not

- **file** `genesis-web/src/core/effects/builtins/secondaryResource.ts:16`
- **kind** corruption · **confidence** reproduced

**Trigger.** Any effect with `"type": "secondaryResource"` and a `set` value. Line 16 spreads `ctx.caster` (the stale pre-cast Unit from BattleAttackResolver.ts:110 or the hoisted `unit` in BattlePassive.ts:19 / BattleContext.tsx:449); line 22 correctly re-reads via `snap.getUnit(current.id)`. Shipped in husty_001_cached_shockwave (`set: 0`), netrolume_elite_001/grunt_001 hertz_beats (`set: 2`), kiragen tactical_scan and vast_influence.

**Consequence.** Everything written to the caster since the context was built is rolled back. On husty_001_cached_shockwave this is the whole cast: the 25 AP cost is refunded (ap 42 -> 60), apSpentAccum resets to 0, and — because the `set` effect is listed after the applyStatus — the Power Surge status the skill just applied to itself is erased. Husty ends the cast with an empty statusSlots array, so the status that generates Surge never exists and the character's charge/dump mechanic cannot start.

**Proposed fix.** `snap.setUnit({ ...(snap.getUnit(current.id) ?? current), secondaryResource: effect.set })` — make the `set` branch re-read like the `delta` branch at line 22.

<details><summary>evidence</summary>

```
/tmp/audit-scratch/leadC.test.ts:
  [secondaryResource only] committed ap=42 -> after=60
  [full cast] ap=60 accum=0 slots=[]   (expected ap=42, accum=25, slots=['husty_001_power_surge'])
```
</details>

---

## 22. Five Effect types pass Zod validation but have no registered handler — getHandler throws on valid content JSON

- **file** `genesis-web/src/core/effects/registry.ts:28`
- **kind** json-reachable · **confidence** reproduced

**Trigger.** `removeStatus`, `shiftProbability`, `rerollDice`, `forceOutcome` and `triggerSkill` are variants of the Effect union (types.ts:205-209) and of effectSchema (schemas.ts:172-176), so DataService accepts them, but registerBuiltins (builtins/index.ts:22-35) registers only the other 12. Adding e.g. `{"when":{"event":"onCast"},"type":"removeStatus","status":"husty_001_power_surge"}` to any skills.json — a documented primitive, listed in the contract types — makes applyEffect.ts:23 throw "No effect handler registered for type: removeStatus".

**Consequence.** Nothing catches it on the AI path. There is no try/catch anywhere in src/core/battle/. BattleContext's safeEngineCall (BattleContext.tsx:254) only wraps player-initiated synchronous calls (executeSkill, skipTurn, confirmCounter...). An enemy cast runs inside `engine.applyTimer = setTimeout(...)` at BattleEnemyTelegraphRunner.ts:138, which calls runAttack -> applyEffect: the throw escapes as an unhandled task-queue error, no error boundary sees it (not a render throw), no toast fires, `engine.step` stays 'enemy_acting' and pendingAITurn is never set — the turn loop stalls permanently with the battle looking alive.

**Proposed fix.** Either register no-op/real handlers for the five orphan types, or remove them from effectSchema so DataService rejects the JSON at load time with a named validation error instead of at cast time inside a timer. Independently, wrap the setTimeout bodies in BattleEnemyTelegraphRunner.ts:138/191 and BattleAttackResolver.ts:249/270 so an engine throw reaches reportError instead of the task queue.

<details><summary>evidence</summary>

```
/tmp/audit-scratch/throws.test.ts — each of the five types is round-tripped through skillDefSchema.parse (accepted) and then asserted to throw /No effect handler registered/. All assertions pass. Escape path confirmed by `grep -rn 'try {\|catch' src/core/battle/*.ts` returning no matches.
```
</details>

---

## 23. A ValueExpr with of:"target" throws mid-cast whenever the roll is an Evade

- **file** `genesis-web/src/core/effects/resolveValue.ts:44`
- **kind** json-reachable · **confidence** reproduced

**Trigger.** BattleAttackResolver.ts:112 sets `target: noDamage ? undefined : target` — on an Evade the context has no target, but the onCast effect loop at line 121 still runs every onCast effect. damage.ts:21 and heal.ts:20 call resolveValueExpr before resolving recipients, so `{"stat":"power","percent":50,"of":"target"}` throws "ValueExpr references target stats but no target in context". The `of` field is part of the shipped contract and already used with `of: "caster"` in tara_001/skills.json:51 and statuses/tara_001_phoenix_burn.json:14; switching one of those to "target" — a natural design change for a %-of-target-HP effect — arms it. It also throws for `target: "all-enemies"` once every enemy is dead, because the amount is resolved before the (empty) recipient list.

**Consequence.** Same uncaught path as the finding above: a player cast surfaces the error toast via safeEngineCall, but an AI cast throws inside the applyTimer setTimeout with nothing to catch it, killing the turn loop at 'enemy_acting'. The failure is roll-dependent, so it appears intermittent and untraceable to the JSON edit that caused it.

**Proposed fix.** Resolve recipients before the amount in damage.ts / heal.ts and return early on an empty list; and make pickStatSource fall back to the caster (or return 0) rather than throwing, since conditions.ts already treats an absent target as "skip silently" (conditions.ts:21-22) — the two modules disagree on the same situation.

<details><summary>evidence</summary>

```
/tmp/audit-scratch/throws.test.ts — skillDefSchema.parse accepts a damage effect with `of:"target"`; applyEffect with ctx.target undefined throws /no target in context/. Assertion passes.
```
</details>

---

## 24. { tag } target selectors validate but throw at dispatch

- **file** `genesis-web/src/core/effects/targetSelector.ts:25`
- **kind** json-reachable · **confidence** reproduced

**Trigger.** targetSelectorSchema (schemas.ts:114) accepts `{ "tag": "..." }` for both `effect.target` and `targeting.selector`, and types.ts:142 documents it as "selects all units carrying any status with the given tag". applyEffect.ts:21 calls rescope -> resolveTargetSelector for any effect with a `target` field, which throws "Tag-based target selectors require status tags (Wave C)" for the object form.

**Consequence.** Same escape path as the two findings above — uncaught inside the AI turn's setTimeout, permanent stall at 'enemy_acting'. Note the skill-level form fails differently and silently: BattleResolution.ts:22 returns [] for an object selector, so a skill whose targeting.selector is a tag object is simply un-castable with no feedback (BattlePlayerActions.ts:39 returns), while the same object on an effect throws. Two different failure modes for one JSON shape.

**Proposed fix.** Drop the `{ tag }` branch from targetSelectorSchema until the Wave C status-tag work lands, so unsupported content is rejected at load with a path-qualified Zod error rather than at cast time inside a timer.

<details><summary>evidence</summary>

```
/tmp/audit-scratch/throws.test.ts — a damage effect with `"target": {"tag":"burn"}` passes skillDefSchema.parse and then throws /Tag-based target selectors require status tags/. Assertion passes.
```
</details>

---

## 25. takeDamage has no maxHp ceiling, so a negative damage amount raises HP above maximum permanently

- **file** `genesis-web/src/core/unit.ts:36`
- **kind** json-reachable · **confidence** reproduced

**Trigger.** `Math.max(0, unit.hp - amount)` clamps only the floor. A damage effect whose ValueExpr resolves negative inverts it into an uncapped heal. valueExprSchema imposes no sign constraint — I confirmed effectSchema.safeParse accepts both `{type:'damage', amount:-40}` and `{type:'damage', amount:{stat:'power',percent:-50}}`. Concrete edit: in public/data/characters/tara_001/skills.json change phoenix_burst's damage `percent` from a positive value to a negative one (a plausible sign slip on a drain-style rework). makeShieldedBattleState.setUnit (BattleDamage.ts:111) takes the `unit.hp >= prev.hp` early-return branch and writes the over-max value through unchanged.

**Consequence.** The target's hp exceeds maxHp for the rest of the battle. Nothing throws: ResourceBar renders a >100% fill, unitIsDamaged's hp/maxHp threshold reads clean, isAlive stays true, and the value is carried into BattleResult. takeDamage is also the one Unit helper with no NaN barrier — Math.max(0, NaN) is NaN — so if a non-finite ever does reach it, the Unit silently carries NaN hp rather than crashing. (Zod 4 rejects NaN and Infinity for z.number(), which I verified, so JSON cannot supply one today; the missing ceiling is the live half.)

**Proposed fix.** Mirror healUnit's clamp: `hp: Math.min(unit.maxHp, Math.max(0, unit.hp - amount))`. If negative damage should be impossible rather than merely capped, clamp at the source instead — `Math.max(0, ...)` around the resolved amount in effects/builtins/damage.ts:21 — and leave takeDamage's ceiling as the backstop.

<details><summary>evidence</summary>

```
/tmp/audit-scratch/overheal.test.ts: `takeDamage({hp:60,maxHp:100}, -200)` -> hp 260. /tmp/audit-scratch/mathaudit.test.ts also shows `takeDamage NaN -> NaN` and `takeDamage -Infinity -> Infinity`. /tmp/audit-scratch/zodprobe.test.ts confirms the schema accepts negative damage amounts and rejects Infinity.
```
</details>

---

## 26. tickShove on a non-acting unit updates Unit.tickPosition but never engine.registeredTicks — the timeline never sees the shove

- **file** `genesis-web/src/core/battle/BattleApplyRunner.ts:23`
- **kind** desync · **confidence** traced

**Trigger.** Any tickShove aimed at a unit other than the actor — i.e. tara_001_chaotic_vortex, the only shipped active tick manipulation. tickShove.ts:15 writes `tickPosition` into the effects snapshot. BattleApplyRunner commits that snapshot wholesale (`engine.enemies = engine.enemies.map(e => snap.get(e.id) ?? e)`, lines 22-23 and 104-108) so the new tickPosition lands on the Unit, but `registerTickInternal` — the only writer of registeredTicks (BattleEngine.ts:272) — is called only for the acting unit (lines 30 and 113). Settles LEAD A.

**Consequence.** Two representations of the same truth diverge and both stay live. BattleTickRunner.ts:14 picks the next actor from `[...engine.registeredTicks.values()]`, so the shoved enemy still acts at its un-shoved tick; TimelineStrip renders markers from registeredTicks (BattleContext.tsx:192), so the marker does not move either — Chaotic Vortex visibly does nothing. resolveTickDisplacement (BattleEngine.ts:268) also computes occupancy from registeredTicks, so the shoved unit's real position is invisible to the D8 displacement cap and two units can silently occupy one tick. The desync resolves only later and wrongly: when the shoved unit finally acts, BattleApplyRunner.ts:28/112 reads `snap.get(id).tickPosition` and advances from the shoved value, so its marker jumps after it has already acted at the wrong time.

**Proposed fix.** After committing the snapshot in runEnemyApplying / runPlayerApplying, re-register any unit whose committed tickPosition differs from registeredTicks: `for (const u of [...engine.playerUnits, ...engine.enemies]) if (engine.registeredTicks.get(u.id) !== u.tickPosition) engine.registerTickInternal(u.id, u.tickPosition)` — run it before the actor's own registerTickInternal call so displacement resolution sees the shoved positions.

<details><summary>evidence</summary>

```
registerTickInternal (BattleEngine.ts:270-275) is the sole writer of registeredTicks and is invoked only at BattleApplyRunner.ts:30 (aiUnit.id) and :113 (actor.id), plus resolveTeamCollision. grep over src confirms no other writer and no re-derivation from Unit.tickPosition. A sibling agent's probe on the same lead is at genesis-web/_probe.test.ts (not mine — see note).
```
</details>

---

## 27. reRegisterMovedUnits covers two of the six sites that write snapshot units back into engine state

- **file** `genesis-web/src/core/battle/BattleApplyRunner.ts:30`
- **kind** desync · **confidence** traced

**Trigger.** Any `tickShove` reached outside a normal cast's effect list. No shipped JSON does this yet (`tickShove` appears only in `tara_001/skills.json:84`), but adding one to an `onExpire` block in e.g. `public/data/statuses/netrolume_great_growl_active.json`, or to an `onUnitTurnStart` status, or to an `onBattleTickInterval` passive, reaches all of the sites below.

**Consequence.** The fix is not wrong where it runs, but it is incomplete in two demonstrable ways. (a) Ordering: it is called at BattleApplyRunner.ts:61 and :145, BEFORE `fireBattleTickIntervalPassives` at :63 and :147 — a tick move made by an interval passive is neither reconciled nor (per the first finding) committed at all. (b) Coverage: four other places commit snapshot units into `engine.playerUnits`/`engine.enemies` with no reconciliation — `BattlePlayerActions.skipTurn:159-160`, `BattleAITurnHelpers.handleAISkip:104-105`, `BattleAITurnHelpers.fireAITurnStart:34-35`, `BattleTickRunner.runClashCheck:128-129`. Each reproduces exactly the bug the fix was written for: `unit.tickPosition` moves, `registeredTicks` does not, and the unit acts on schedule while the timeline shows it displaced. Minor third point: `reRegisterMovedUnits` runs before the dead-unit purge at BattleApplyRunner.ts:77-78, so a unit that died this turn is re-registered and counted as an occupant during the pass, which can spuriously D8-displace a live unit reconciled after it.

**Proposed fix.** Hoist the commit into one helper — `commitSnapshot(engine, snap)` that assigns the arrays and then runs the tick reconciliation — and call it from all six sites; and run it after `fireBattleTickIntervalPassives`, not before. Move the dead-unit `unregisterTickInternal` calls ahead of the reconciliation pass so corpses are not counted as tick occupants.

<details><summary>evidence</summary>

```
Call-site audit: `grep -n "engine.playerUnits = " genesis-web/src/core/battle/*.ts` yields six commit sites; only BattleApplyRunner.ts:52 and :135 are followed by `reRegisterMovedUnits`. The ordering point is confirmed by /tmp/audit-scratch/A_interval.test.ts, which shows interval-passive writes never reaching the engine arrays at all.
```
</details>

---

## 28. The player counter prompt has no deadline; confirmCounter writes into a snapshot the engine has already committed and discarded

- **file** `genesis-web/src/core/battle/BattleEngine.ts:204`
- **kind** lost-decision · **confidence** traced

**Trigger.** A controlled ally evades a single-target enemy attack and the counter roll succeeds. scheduleCounterChain (BattleAttackResolver.ts:262) sets pendingCounterDecision at COUNTER_ANNOUNCE_MS = 800 ms after runAttack. Nothing gates the step machine on pendingCounterDecision — it is not in YIELDED_STEPS (BattleStepMachine.ts:26) and no runner checks it. The enemy path continues on its own timers: attackTimer at DICE_RESULT_DISMISS_MS (1200 ms) then applyTimer at ANIM_TIMEOUT_MS (1500 ms), so runEnemyApplying fires at ~2700 ms and does `engine.pendingAITurn = null` plus commits `snap` into playerUnits/enemies. The player therefore has ~1900 ms — or ~700 ms if they used the tap-to-skip hotzone, which calls skipDiceAnim() and runs pendingAttackCb immediately. Past that the overlay is still on screen: BattleScreen.tsx:431 renders purely on `pendingCounterDecision`, and nothing clears it on a step change.

**Consequence.** Pressing COUNTER after the turn has been applied deducts the AP cost into the stale map (BattleEngine.ts:210) and 200 ms later runs a full runAttack against it (line 214). Every HP, AP and status write goes into a Map nobody reads again — the counter deals literally nothing. But it is not a clean no-op: the same runAttack mutates real engine state on the way through — engine.appendLog and engine.showDiceResult (so the player sees 'Counter!' and a dice overlay), engine.cb.onNarrativeEmit, and engine.unitSkillsMap for shield-break cooldowns (BattleAttackResolver.ts:196-201). Those persist while the damage does not, and the dice overlay lands on top of whatever turn is now running. It can also re-enter scheduleCounterChain and leave a second orphaned prompt.

**Proposed fix.** Make the counter decision a step the machine yields on. Add a 'counter_prompt' BattleStep to YIELDED_STEPS, set it where pendingCounterDecision is assigned, and have confirmCounter/skipCounter return control; alternatively stamp the decision with the pendingAITurn/pendingPlayerTurn it belongs to and have confirmCounter bail (and skipCounter implicitly fire) when that pending turn has already been consumed.

<details><summary>evidence</summary>

```
Call path read end to end: BattleAttackResolver.ts:260-263 sets the prompt; BattleEnemyTelegraphRunner.ts:181-199 owns the 1200/1500 ms timers to enemy_applying; BattleApplyRunner.ts:44-45 nulls pendingAITurn and commits snap; BattleEngine.ts:204-221 confirmCounter reads the same `snap` reference afterwards; BattleStepMachine.ts:26 YIELDED_STEPS contains no counter state; BattleScreen.tsx:429-431 CounterPromptOverlay has no timeout and no step dependency.
```
</details>

---

## 29. skipTurn never re-registers units its own effects moved on the timeline, and advances the actor from a stale tick

- **file** `genesis-web/src/core/battle/BattlePlayerActions.ts:161`
- **kind** desync · **confidence** traced

**Trigger.** Both apply runners call reRegisterMovedUnits (BattleApplyRunner.ts:61 and :145) to reconcile unit.tickPosition back into registeredTicks after effects have written through battle.setUnit. skipTurn commits the same class of snapshot — it runs fireExpiryChain (line 148) and fireBattleTickIntervalPassives (line 149) over skipSnap and then assigns playerUnits/enemies from it (lines 159-160) — but has no equivalent call, and it advances the actor with `fromTick + SKIP_TU_COST` where fromTick was captured pre-effect at line 137. Separately, both apply runners call fireBattleTickIntervalPassives AFTER reRegisterMovedUnits, so a shove from a battle-tick-interval passive is missed there too. Reachable by adding a tickShove effect to any StatusDef or PassiveDef under public/data/ (e.g. an onExpire tickShove on public/data/statuses/tara_001_phoenix_burn.json); no shipped content shoves outside a skill's onCast today, which is the only reason this is currently dormant.

**Consequence.** The exact desync BattleApplyRunner.ts:13-29 documents and fixes for the attack paths, left open in the skip path: unit.tickPosition (what the timeline strip draws) diverges from registeredTicks (what the engine schedules from). The marker slides and the unit still acts on its old tick — and because registerTickInternal is the only thing that writes both, the two never reconverge for that unit. A self-shove during a skip is discarded outright.

**Proposed fix.** Export reRegisterMovedUnits from BattleApplyRunner and call it in skipTurn after the playerUnits/enemies assignment, and register the actor from `skipSnap.get(actor.id)?.tickPosition ?? fromTick` rather than the pre-effect `fromTick`. In both apply runners, move the reRegisterMovedUnits call to after fireBattleTickIntervalPassives (or call it again) so passive-driven shoves are covered.

<details><summary>evidence</summary>

```
BattleApplyRunner.ts:30-40 defines reRegisterMovedUnits and lines 61/145 call it in both attack paths; BattlePlayerActions.ts:137-161 performs the same commit sequence with no such call, and line 161 uses the pre-effect `fromTick`. Comment at BattleApplyRunner.ts:55-58 names the stale-fromTick bug as fixed for the attack paths only.
```
</details>

---

## 30. 'all-allies' means two different things depending on which layer resolves it

- **file** `genesis-web/src/core/effects/targetSelector.ts:47`
- **kind** desync · **confidence** traced

**Trigger.** targetSelector.ts:47 resolves 'all-allies' as `u.isAlly === ctx.caster.isAlly && hp > 0` — the caster included. BattleResolution.ts:36 resolves the same string as `friends`, built at line 25 with `u.id !== caster.id` — the caster excluded. Skill-level targeting goes through the second; effect-level `target` overrides go through the first.

**Consequence.** tara_001_intell_of_goddess declares `targeting.selector: "all-allies"` and is documented as "Applies a 20% Tara max HP shield to all allies and self" — the shield effect carries no target override, so it resolves through BattleResolution and never reaches Tara. Her allies get the shield; she gets only the self-targeted dodge. The same skill in a solo-leader party resolves to an empty target list and BattlePlayerActions.ts:39 returns before spending AP or logging anything, so the skill is a dead button with no feedback.

**Proposed fix.** Pick one meaning and use it in both places. Given the shipped description, include the caster in BattleResolution.ts:25's `friends` for the 'all-allies' / 'lowest-hp-ally' / 'random-ally' cases, or add an explicit 'all-allies-and-self' selector and have targetSelector.ts exclude the caster from 'all-allies' to match.

<details><summary>evidence</summary>

```
targetSelector.ts:46-51 vs BattleResolution.ts:23-25/36. Content: public/data/characters/tara_001/skills.json (tara_001_intell_of_goddess, targeting.selector 'all-allies', description 'all allies and self').
```
</details>

---

