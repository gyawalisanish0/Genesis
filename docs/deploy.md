# Deployment

Two web targets share one build. They differ only in `base`.

| Target | Base | Why |
|---|---|---|
| Capacitor (Android/iOS) | `./` | Assets load over `file://` in the WebView, so paths must be relative. This is the default in `vite.config.ts`. |
| Vercel / GitHub Pages | `/` or `/RepoName` | Served from a web root. A relative base would resolve assets against the current path, so any deep URL would 404. Overridden per-target on the CLI. |

## Vercel

Config exists for **both** possible Root Directory settings, so the deploy works
either way:

| Root Directory | Config used | Build |
|---|---|---|
| repository root (default) | `vercel.json` | `cd genesis-web && npm ci` → `cd genesis-web && npm run build -- --base=/` → `genesis-web/dist` |
| `genesis-web` | `genesis-web/vercel.json` | `npm run build -- --base=/` → `dist` |

Vercel reads `vercel.json` from the Root Directory, so a config at the
repository root is silently ignored when a Root Directory is set — and nothing
warns about it. Keeping one in each place removes that failure mode.

**Never use `npm ci --prefix <dir>`.** `--prefix` sets where packages are
installed but npm still resolves `package-lock.json` from the *working
directory*. From the repository root — which has no lockfile — this fails with
`EUSAGE: can only install with an existing package-lock.json`. It is
version-dependent: npm 10.9 locally tolerates it, Vercel's npm does not, so it
passes locally and fails in CI. Use `cd genesis-web && npm ci`.

**Node version.** `engines.node` in `package.json` (backed by `.nvmrc`) pins
Node for Vercel. Vite 8 and rolldown declare `^20.19.0 || >=22.12.0`, so an
unpinned project can land on a default Node that fails the engine check even
though CI — which pins Node 22 — passes.

## GitHub Pages

`.github/workflows/deploy-web.yml` already deploys on push to `main`. It derives
the base from the repository name. The two can coexist — they are independent
targets from the same source.

## Verifying a build locally the way a host serves it

```sh
npm run build --prefix genesis-web -- --base=/
cd genesis-web/dist && python3 -m http.server 8123
```

Then open `http://localhost:8123/`. This is how the loop was verified end to
end: splash → main menu → campaign → dungeon → encounter → battle.

## Known console noise

Characters without an `animations.json` / `anim_sequence.json` log a 404 on
load. This is the documented optional-manifest path — `DataService`
`fetchOptional` returns `null` silently and the character falls back to a
placeholder. Only `hugo_001` has manifests today.
