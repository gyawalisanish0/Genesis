# BattleProvider refactor — planned custom-hook extraction

The `BattleProvider` body in `BattleContext.tsx` is ~1475 lines.
Pure module-level functions have already been extracted into the four `.ts` helper
files in this folder. The remaining work is splitting the provider body itself.

## Planned hooks (one file each, all under `src/screens/battle/`)

| Hook | File | Responsibility | Approx. lines |
|---|---|---|---|
| `useBattleLoader` | `BattleLoader.ts` | Async data load `useEffect` — characters, skills, manifests, status/passive prefetch, SpawnBus wiring, onBattleStart passives, tick displacement, NarrativeUnits registration | ~230 |
| `useRunAttack` | `BattleAttack.ts` | `runAttack` callback + `scheduleCounterChain` callback + `confirmCounter` / `skipCounter` / `resolveClash` / `resolveTeamCollision` | ~280 |
| `useEnemyAI` | `BattleEnemyAI.ts` | The enemy AI `useEffect` — telegraph phase, AI turn loop, AI counter chain, AI skip-turn path | ~280 |

The hooks all share the same large set of refs
(`passiveDefsRef`, `statusDefsRef`, `unitSkillsMapRef`, `playerUnitsRef`,
`enemiesRef`, `globalBattleTickRef`, …). Bundle them into a single
`BattleRefs` object before passing to keep signatures manageable.

After extraction the provider body should be ~150 lines of state declarations +
hook calls + the `<BattleContext.Provider value={…}>` JSX.
