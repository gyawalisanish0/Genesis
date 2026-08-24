# Deployment

Two web targets share one build. They differ only in `base`.

| Target | Base | Why |
|---|---|---|
| Capacitor (Android/iOS) | `./` | Assets load over `file://` in the WebView, so paths must be relative. This is the default in `vite.config.ts`. |
| Vercel / GitHub Pages | `/` or `/RepoName` | Served from a web root. A relative base would resolve assets against the current path, so any deep URL would 404. Overridden per-target on the CLI. |

## Vercel

**Root Directory must be `genesis-web`** in the Vercel project settings, and
`vercel.json` lives in that same directory. Vercel reads `vercel.json` from the
Root Directory, not from the repository root — a `vercel.json` at the repo root
is silently ignored when a Root Directory is set, which is easy to miss because
nothing warns about it.

```
buildCommand     npm run build -- --base=/
outputDirectory  dist
framework        vite
```

**Node version.** `engines.node` in `package.json` (backed by `.nvmrc`) pins
Node for Vercel. This is not optional: Vite 8 and rolldown declare
`^20.19.0 || >=22.12.0`, so an unpinned project can land on a default Node that
fails the engine check at install time even though CI — which pins Node 22 —
passes.

`build` runs `prebuild` → `validate:data` first, so a deploy fails on invalid
game JSON rather than shipping it.

**Rewrites.** Everything that is not a real asset directory rewrites to
`index.html`. The app uses `HashRouter`, so routes live after `#` and the path
stays `/` in normal use; the rewrite only covers hand-typed deep links.

**Caching.** Hashed files under `/assets/` are immutable and cached for a year.
Game JSON under `/data/` is revalidated every request, so content changes ship
without a rebuild of the client bundle.

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
