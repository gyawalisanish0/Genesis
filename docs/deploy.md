# Deployment

Two web targets share one build. They differ only in `base`.

| Target | Base | Why |
|---|---|---|
| Capacitor (Android/iOS) | `./` | Assets load over `file://` in the WebView, so paths must be relative. This is the default in `vite.config.ts`. |
| Vercel / GitHub Pages | `/` or `/RepoName` | Served from a web root. A relative base would resolve assets against the current path, so any deep URL would 404. Overridden per-target on the CLI. |

## Vercel

**Root Directory is `genesis-web`**, so `vercel.json` lives there and every
command in it runs with that directory as the working directory. There is
deliberately no `vercel.json` at the repository root — with a Root Directory
set, one there is either ignored or actively wrong, since a `cd genesis-web`
would resolve to `genesis-web/genesis-web`.

```
installCommand   npm ci
buildCommand     npm run build -- --base=/
outputDirectory  dist
framework        vite
```

**Declare `installCommand` explicitly, even though `npm ci` is the default.**
An Install Command saved in the Vercel dashboard wins whenever `vercel.json`
does not specify one. A stale dashboard value of `npm ci --prefix genesis-web`
survived several config changes and kept failing the deploy with
`EUSAGE: can only install with an existing package-lock.json`, because the
prefix resolved to `genesis-web/genesis-web`. Specifying it in `vercel.json`
takes precedence and keeps the source of truth in the repository.

Two related traps, both of which cost a deploy here:

- **Never `npm ci --prefix <dir>`.** `--prefix` sets where packages are
  installed; npm still resolves `package-lock.json` from the working directory.
  It is also version-dependent — npm 10.9 tolerates it locally, Vercel's does
  not — so it passes every local check and fails only on deploy.
- **`engines.node` must use a form Vercel resolves**, e.g. `22.x`. It overrides
  the Node version in Project Settings, and the build log states so explicitly:
  `Due to "engines": { "node": "22.x" } ... Node.js Version "22.x" will be used`.
  Vite 8 and rolldown require `^20.19.0 || >=22.12.0`, so this pin is load-bearing.

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
