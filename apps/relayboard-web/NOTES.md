# relayboard-web — scaffold notes

Everything below was produced by the real TanStack CLI, then inspected and verified.
This file is a reproducibility record; `README.md` is the untouched CLI output.

## 1. Exact scaffold invocation

Run from the **repo root** (`C:\Users\MarkeFin\Codes\relayboard-prototype\relayboard-prototype`), PowerShell 7:

```powershell
$env:CI="1"
npx -y @tanstack/cli@0.72.16 create relayboard-web `
  --framework React `
  --build-tool vite `
  --deployment vercel `
  --add-ons tanstack-query,biome,t3env `
  --toolchain biome `
  --package-manager npm `
  --no-git `
  --intent `
  --json `
  --non-interactive `
  --target-dir apps
```

Toolchain versions used: Node v26.12.1, npm 12.2.2. CLI exit code `0`.

### Important: `--target-dir` behaviour (confirmed)

With `--target-dir apps`, the CLI wrote the project **directly into `apps/`**, not into
`apps/relayboard-web/`. The final line of the CLI output said
`Your TanStack app is ready in 'apps'.` Files were moved afterwards:

```powershell
New-Item -ItemType Directory -Path apps\relayboard-web -Force | Out-Null
Get-ChildItem apps -Force | Where-Object { $_.Name -ne 'relayboard-web' } | ForEach-Object {
  Move-Item -LiteralPath $_.FullName -Destination (Join-Path (Resolve-Path apps\relayboard-web).Path $_.Name) -Force
}
```

Dependency install **was** run by the CLI (`Installed dependencies`, `--no-install` was not passed).
It did not need a manual retry.

### One non-fatal CLI error

The CLI reported at the end:

```
Errors were encountered during the creation of your app:

Command "npx -y @tanstack/intent install" did not run successfully. Please run this manually in your project.
```

This is expected in a non-interactive/CI shell — see §8 (Intent).

## 2. File inventory (excludes `node_modules/`)

Hand-written / config files (line counts):

| Path | Lines | Bytes |
| --- | --- | --- |
| `.cta.json` | 23 | 433 |
| `.gitignore` | 14 | 123 |
| `.vscode/settings.json` | 35 | 729 |
| `biome.json` | 35 | 622 |
| `package.json` | 50 | 1306 |
| `package-lock.json` | 4903 | 167940 |
| `README.md` | 158 | 6001 |
| `tsconfig.json` | 26 | 649 |
| `tsr.config.json` | 3 | 24 |
| `vercel.json` | 4 | 90 |
| `vite.config.ts` | 11 | 457 |
| `src/env.ts` | 34 | 1172 |
| `src/router.tsx` | 21 | 706 |
| `src/routeTree.gen.ts` | 95 | 3145 |
| `src/styles.css` | 405 | 10476 |
| `src/components/Footer.tsx` | 43 | 2141 |
| `src/components/Header.tsx` | 87 | 3776 |
| `src/components/ThemeToggle.tsx` | 65 | 2185 |
| `src/integrations/tanstack-query/devtools.tsx` | 5 | 158 |
| `src/integrations/tanstack-query/root-provider.tsx` | 8 | 208 |
| `src/routes/__root.tsx` | 68 | 2359 |
| `src/routes/index.tsx` | 83 | 3386 |
| `src/routes/about.tsx` | 21 | 762 |
| `src/routes/demo/tanstack-query.tsx` | 34 | 947 |

Build output (gitignored, present after `npm run build`): `.output/nitro.json`,
`.output/public/assets/{styles,index,routes,about,tanstack-query}-*.{css,js}`,
`.output/server/index.mjs`, `.output/server/_runtime.mjs`, `.output/server/_chunks/ssr-renderer.mjs`,
`.output/server/_libs/*.mjs`, `.output/server/_ssr/*.mjs`, `.output/server/_tanstack-start-manifest_v-*.mjs`.

Directories: `.output/{public,server}`, `.tanstack/tmp` (empty scratch dir), `.vscode`, `src/{components,integrations/tanstack-query,routes/demo}`.

**Added later, in §11** (so this table describes the *freshly scaffolded* state only):

| Path | Lines | Bytes | Why |
| --- | --- | --- | --- |
| `AGENTS.md` | 11 | 844 | written by `npx intent install` — the generated skill-loading block |
| `vendor/relayboard-skills-0.1.0.tgz` | (binary) | 25205 | the packed `@relayboard/skills@0.1.0` the app installs from |
| `package.json` | 59 | 1515 | gained the `@relayboard/skills` dependency and the `intent` block |
| `package-lock.json` | 4910 | 168099 | gained the `file:vendor/…tgz` resolution + integrity |

No `src/` file changed in §11.

## 3. `.cta.json` (verbatim — do not edit or delete)

```json
{
  "projectName": "relayboard-web",
  "mode": "file-router",
  "bundler": "vite",
  "typescript": true,
  "tailwind": true,
  "packageManager": "npm",
  "git": false,
  "install": true,
  "intent": true,
  "addOnOptions": {},
  "projectPreset": "default",
  "routerOnly": false,
  "includeExamples": true,
  "version": 1,
  "framework": "react",
  "chosenAddOns": [
    "tanstack-query",
    "biome",
    "t3env",
    "vercel"
  ]
}
```

Field-by-field mapping to the flags:

| Field | Value | Comes from |
| --- | --- | --- |
| `projectName` | `relayboard-web` | positional `create relayboard-web` |
| `mode` | `file-router` | `--framework React` default file-based routing |
| `bundler` | `vite` | `--build-tool vite` |
| `typescript` | `true` | always TypeScript in this CLI version |
| `tailwind` | `true` | part of the `default` preset |
| `packageManager` | `npm` | `--package-manager npm` |
| `git` | `false` | `--no-git` (no `git init`, no hooks) |
| `install` | `true` | `--no-install` was NOT passed, so the CLI installed deps |
| `intent` | `true` | `--intent` |
| `addOnOptions` | `{}` | no per-add-on options given |
| `projectPreset` | `default` | implied preset (gives Tailwind + demo routes) |
| `routerOnly` | `false` | full TanStack Start app, not Router-only |
| `includeExamples` | `true` | example routes/components shipped |
| `version` | `1` | `.cta.json` schema version |
| `framework` | `react` | `--framework React` |
| `chosenAddOns` | `tanstack-query`, `biome`, `t3env`, `vercel` | `--add-ons tanstack-query,biome,t3env` + `--deployment vercel` (`vercel` is folded into add-ons) |

Note: `--toolchain biome` is not represented as its own field; it is what makes `biome` the
linter/formatter add-on (which is also listed in `chosenAddOns`).

## 4. `package.json` — scripts and resolved versions

Scripts (all of them):

| Script | Command |
| --- | --- |
| `dev` | `vite dev --port 3000` |
| `generate-routes` | `vite build` |
| `build` | `vite build` |
| `preview` | `vite preview` |
| `format` | `biome format` |
| `lint` | `biome lint` |
| `check` | `biome check` |

There is **no** `start`, `test`, `typecheck` or `deploy` script. `npx tsc --noEmit` must be run directly.

Dependencies — declared range vs. actually installed in `node_modules`:

| Package | Declared | Installed |
| --- | --- | --- |
| `@t3-oss/env-core` | `^0.13.10` | 0.13.11 |
| `@tailwindcss/vite` | `^4.1.18` | 4.3.5 |
| `@tanstack/react-devtools` | `0.10.14` | 0.10.14 |
| `@tanstack/react-query` | `5.107.1` | 5.107.1 |
| `@tanstack/react-query-devtools` | `5.107.1` | 5.107.1 |
| `@tanstack/react-router` | `1.170.46` | 1.170.46 |
| `@tanstack/react-router-devtools` | `1.167.3` | 1.167.3 |
| `@tanstack/react-router-ssr-query` | `1.167.3` | 1.167.3 |
| `@tanstack/react-start` | `1.169.5` | 1.169.5 |
| `nitro` | `3.0.260610-beta` | 3.0.260610-beta |
| `react` | `^19.2.0` | 19.3.1 |
| `react-dom` | `^19.2.0` | 19.3.1 |
| `tailwindcss` | `^4.1.18` | 4.3.5 |
| `zod` | `^4.3.6` | 4.6.7 |

devDependencies:

| Package | Declared | Installed |
| --- | --- | --- |
| `@biomejs/biome` | `2.4.5` | 2.4.5 |
| `@tailwindcss/typography` | `^0.5.16` | 0.5.20 |
| `@tanstack/devtools-vite` | `0.8.6` | 0.8.6 |
| `@types/node` | `^22.10.2` | 22.20.5 |
| `@types/react` | `^19.2.0` | 19.3.0 |
| `@types/react-dom` | `^19.2.0` | 19.3.0 |
| `@vitejs/plugin-react` | `^6.0.1` | 6.3.0 |
| `typescript` | `^6.0.2` | 6.0.3 |
| `vite` | `^8.0.0` | 8.3.7 |

Other `package.json` facts: `"private": true`, `"type": "module"`,
`"imports": { "#/*": "./src/*" }`, plus a leftover `"pnpm": { "onlyBuiltDependencies": [...] }` block
(harmless under npm). The CLI did not add `packageManager` or `engines`.

## 5. Environment requirements (t3env)

`src/env.ts` (generated, 34 lines) is the only env surface:

```ts
export const env = createEnv({
  server: { SERVER_URL: z.url().optional() },
  clientPrefix: 'VITE_',
  client: { VITE_APP_TITLE: z.string().min(1).optional() },
  runtimeEnv: import.meta.env,
  emptyStringAsUndefined: true,
})
```

What t3env introduced here, precisely:

- **No `.env` or `.env.example` file is generated** by the CLI. `README.md` mentions `.env.example`
  in the Vercel steps and mentions `src/env.mjs`, but neither file exists — the README text is stale.
- Both variables are **`.optional()`**, so there is **no build-time env validation failure** out of the box.
- `runtimeEnv: import.meta.env` — this runs in both the client and the SSR/Vite context. Vite statically
  replaces `import.meta.env.VITE_*` at build time.
- **`src/env.ts` is not imported by any generated file.** `grep` over `src/` shows the only references
  are inside `env.ts` itself. So no env var is read at runtime by the scaffold.

### Proof runs

**(a) Build with no `.env` and no env vars — succeeds (exit 0):**

```
> relayboard-web@ build
> vite build
vite v8.3.7 building client environment for production...
✓ 203 modules transformed.
✓ built in 615ms
vite v8.3.7 building ssr environment for production...
✓ 63 modules transformed.
✓ built in 286ms
[nitro] √ Generated public .output/public
vite v8.3.7 building nitro environment for production...
✓ 251 modules transformed.
✓ built in 320ms
[nitro] √ You can preview this build using npx vite preview
```

`npx tsc --noEmit` also exits 0 with no env present.

**(b) Same with a local `.env` (gitignored) containing placeholders — still exit 0.**

`.env` used during the test (`.env` is ignored by `.gitignore`; the file was removed again afterwards):

```
SERVER_URL=https://relayboard.local/api
VITE_APP_TITLE=Relayboard
```

Result: build exit 0, identical output. So the *scaffold as generated* requires **zero** env vars to build.

**(c) To show the real t3env failure text**, a throwaway script called `createEnv` with the same
schemas but **without** `.optional()` and with an empty `runtimeEnv` (`node probe-t3env.mjs`):

```
--- t3env threw ---
Invalid environment variables
❌ Invalid environment variables: [
  {
    expected: 'string',
    code: 'invalid_type',
    path: [ 'SERVER_URL' ],
    message: 'Invalid input: expected string, received undefined'
  },
  {
    expected: 'string',
    code: 'invalid_type',
    path: [ 'VITE_APP_TITLE' ],
    message: 'Invalid input: expected string, received undefined'
  }
]
```

That is the message you will see (thrown at import time, so it surfaces as a build or request error)
as soon as someone removes `.optional()` from a declared variable.

**(d) Behaviour of the two declared variables, measured, not guessed:**

- `VITE_APP_TITLE` — a temporary `/envprobe` route was added, `.env` created, `npm run build`,
  then the built server started with `node ./.output/server/index.mjs` and `GET /envprobe` returned:
  `{"VITE_APP_TITLE":"Relayboard","SERVER_URL":null}`. So a Vite-prefixed client var **is** picked up
  from `.env` at build time.
- `SERVER_URL` (server-side, non-`VITE_` name) — **came back `null` even with `SERVER_URL` exported in
  the process environment before starting the built server.** Root cause: `runtimeEnv: import.meta.env`
  only sees Vite-exposed vars; a plain server var must be read from `process.env`. If Relayboard needs
  real server-only config, `src/env.ts` must change to
  `runtimeEnv: { ...import.meta.env, ...process.env }` (or `runtimeEnv: process.env` on the server side).
  This is a genuine scaffold gotcha worth fixing before any server config is added.

The temporary probe route was deleted and the route tree/build regenerated; the tree is back to
`/`, `/about`, `/demo/tanstack-query`.

## 6. Deployment (Vercel)

Files shipped for Vercel:

- `vercel.json` (whole file):
  ```json
  {
    "$schema": "https://openapi.vercel.sh/vercel.json",
    "framework": "tanstack-start"
  }
  ```
- **No `api/` directory and no Vercel adapter package** — the adapter is `nitro` (`nitro/vite` plugin in
  `vite.config.ts`), which switches preset based on the environment.

What `npm run build` produces:

- Locally (no `VERCEL` env var): nitro preset `node-server` →
  `.output/public/*` (static), `.output/server/index.mjs` (server entry), `.output/nitro.json`
  (`"serverEntry": "server/index.mjs"`, `"commands": {"preview": "node ./server/index.mjs"}`).
- With `VERCEL=1` set (how Vercel's build image behaves) the same command switched preset automatically:
  ```
  [nitro:vercel] i Using nodejs24.x runtime.
  [nitro:vercel] i Using web entry format.
  [nitro] o Building [Nitro] (preset: vercel, compatibility: 2026-11-10)
  [nitro] √ Generated public .vercel/output/static
  ```
  and produced Build Output API v3 shaped output:
  - `.vercel/output/static/assets/*` (css + js)
  - `.vercel/output/functions/__server.func/index.mjs` + `_runtime.mjs`, `_chunks/`, `_libs/`, `_ssr/`
  - exit code 0. Note there is **no `.vercel/output/config.json` and no `.vercel/output/functions/__server.func/.vc-config.json`** in the nitro 3 beta output — Vercel infers routing for the `tanstack-start` framework. Treat that as a "watch this" item rather than a bug.
  - `.vercel/` was **not** in the generated `.gitignore`; `.vercel` was added manually (see §9).

Deploying for real requires Vercel credentials. There is **no `npm run deploy` script** and no
`vercel` CLI dependency in the project. The realistic paths are:
`npx vercel` manually, `npx vercel --prod`, or the Git integration described in `README.md` §
"Deploy to Vercel" (import the repo in the Vercel dashboard, keep detected TanStack Start settings,
add production env values, deploy). **No real deploy was attempted** (no token in this environment).

## 7. Hooks, editor and CI

- **Git hooks: none.** `--no-git` was used, no `.git/hooks` was created, and no `lefthook.yml`,
  `husky`, `.husky/`, or `pre-commit` config exists anywhere in the app.
- **Repo-level CI: none generated.** No `.github/` directory, no workflow file was written by the CLI
  (`intent setup-github-actions` would create one, but it was not run).
- **VS Code**: `.vscode/settings.json` (35 lines) — sets `biomejs.biome` as
  `editor.defaultFormatter` for js/jsx/ts/tsx/json/jsonc/css, sets
  `editor.codeActionsOnSave["source.organizeImports.biome"] = "explicit"`, and excludes / makes
  read-only `**/routeTree.gen.ts` from the watcher, search and editing.
  Note it enables organize-imports-on-save only, **not** a full format-on-save key
  (`editor.formatOnSave` is not set).
- **Biome**: `biome.json` (35 lines). Formatter on, `indentStyle: tab`, `quoteStyle: double`,
  linter recommended rules on, `assist.actions.source.organizeImports: "on"`. Includes
  `**/src/**/*`, `**/.vscode/**/*`, `**/index.html`, `**/vite.config.ts`; excludes
  `**/src/routeTree.gen.ts` and `**/src/styles.css`. `vcs.enabled: false` (no git-aware ignores).
- **Route generation**: `@tanstack/router-plugin` via `tanstackStart()` in `vite.config.ts` plus
  `tsr.config.json` (`{"target":"react"}`); `src/routeTree.gen.ts` is regenerated on every `vite build`.
- **Devtools**: `@tanstack/devtools-vite` strips devtools code from `src/routes/__root.tsx` in
  production builds (`Removed devtools code from: /src/routes/__root.tsx`).

## 8. Intent setup

The CLI printed `Setting up TanStack Intent skill discovery` → `TanStack Intent configured`, and its
closing hint says the agent config (`AGENTS.md` / `CLAUDE.md`) was wired up. What actually exists:

- **No `AGENTS.md`, no `CLAUDE.md`, no intent block, no `skills/` directory, no `.intent/` directory**
  in `apps/relayboard-web/` or at the repo root.
- **No `intent` field in `package.json`** — so no `intent.skills` allowlist and no `intent.exclude`.
- `@tanstack/intent` is **not** installed as a dependency (`node_modules/@tanstack/intent` absent).
- Running the step manually reproduces the CLI's error:
  ```
  $ npx -y @tanstack/intent install
  Permissions: failed: intent.skills is not configured. Run `intent install` in an interactive terminal to review and confirm permissions.
  [exit 1]
  ```
  `--dry-run` fails the same way. The permission review is interactive-only, so it cannot complete here.
- `npx -y @tanstack/intent list` **does** work and reports `11 intent-enabled packages, 35 skills`
  discovered from `node_modules` (all `local` source: `@tanstack/devtools`, `@tanstack/router-core`,
  `@tanstack/react-start`, `@tanstack/start-client-core`, …), with
  `ℹ intent.skills is not set — all discovered skill sources are surfaced.`

Conclusion: the *discovery* half works and needs no files; the *install* half (writing the AGENTS.md
skill-loading guidance + an `intent.skills` allowlist) was skipped by the non-interactive run and must be
run in an interactive terminal. Skills authoring belongs to `packages/relayboard-skills`, not here.

> **Superseded by §11.** The diagnosis above was half right: the blocker was the missing
> `intent.skills` allowlist, not the lack of a TTY. Once §11 adds the allowlist, plain
> `npx intent install` runs unattended and writes `apps/relayboard-web/AGENTS.md` (exit 0). That file
> now exists — §8's "No `AGENTS.md`" line describes the freshly scaffolded state only.

## 9. Verification runs (final state)

| Command | Result |
| --- | --- |
| `npm run build` | **exit 0** — client+SSR+nitro built (`.output/`, preset `node-server`) |
| `npx tsc --noEmit` | **exit 0** — no type errors |
| `npm run check` (biome) | **exit 0** — `Checked 14 files. No fixes applied.` |

Builds also emit non-fatal noise from Vite 8 / rolldown, which is **not** an error:

- `[MODULE_LEVEL_DIRECTIVE] The semantics of the module level directive "use client" in node_modules/@tanstack/react-router/... may not be preserved when bundling.` (×~35, all inside `node_modules`)
- `` `output.codeSplitting.groups[0].name` is a function. Set `output.codeSplitting.groups[0].debugName` … ``

Server smoke test (local, preset `node-server`):
`node ./.output/server/index.mjs` → `➜ Listening on: http://localhost:3000/ (all interfaces)`,
`GET /` and `GET /envprobe` both `200`.

### Scaffold defects that were fixed here (no product features added)

1. **`npm run check` failed with 19 errors on a fresh scaffold.** Every generated `.ts/.tsx` file was
   written with 2-space indentation and single quotes while the generated `biome.json` demands tabs and
   double quotes, and several files had unsorted imports. `npx biome check --write` reformatted 14 files
   (source only; behaviour unchanged).
2. **`lint/security/noDangerouslySetInnerHtml`** in `src/routes/__root.tsx:48` (the inline theme-init
   script) still failed after autofix. A scoped suppression comment was added explaining that
   `THEME_INIT_SCRIPT` is a hard-coded constant with no interpolation:
   ```tsx
   {/* biome-ignore lint/security/noDangerouslySetInnerHtml: THEME_INIT_SCRIPT is a hard-coded constant with no interpolation or user input; inlining it is required to apply the stored theme before first paint. */}
   ```
3. **`biome.json` schema pointed at `2.2.4` but the installed CLI is `2.4.5`**, producing an info
   diagnostic on every run. `npx biome migrate --write` bumped only the `$schema` URL.
4. **`.vercel` was missing from `.gitignore`** even though a Vercel build writes
   `.vercel/output/{static,functions}` into the project. Added `.vercel` between `.output` and `.vinxi`.

`src/styles.css` and `src/routeTree.gen.ts` were untouched (both excluded from Biome by `biome.json`),
and `README.md` was left exactly as generated.

## 10. Reproducing from scratch

```powershell
# from the repo root
$env:CI="1"
npx -y @tanstack/cli@0.72.16 create relayboard-web --framework React --build-tool vite `
  --deployment vercel --add-ons tanstack-query,biome,t3env --toolchain biome `
  --package-manager npm --no-git --intent --json --non-interactive --target-dir apps
# files land in apps/ -- move them into apps/relayboard-web as shown in §1
cd apps\relayboard-web
npx biome check --write          # fix scaffold formatting (see §9.1)
npx biome migrate --write        # sync biome schema version (see §9.3)
npm run build                    # exit 0, no env vars needed
npx tsc --noEmit                 # exit 0
npm run check                    # exit 0
# interactive only, cannot run in CI:
#   npx -y @tanstack/intent install
```

## 11. TanStack Intent consumer wiring

This app is an **explicit** TanStack Intent consumer of `@relayboard/skills` (built in
`packages/relayboard-skills`): the package is a real installed dependency, the app's `package.json`
carries an `intent.skills` allowlist plus one `intent.exclude`, and every claim below is backed by
captured command output. Toolchain: Node v26.12.1, npm 12.2.2, `@tanstack/intent` **0.5.6**.

### 11.1 Pack + install (tarball, not a symlink)

```powershell
# from apps/relayboard-web
$dest = Join-Path $env:TEMP "rb-skills-pack2"
New-Item -ItemType Directory -Path $dest -Force | Out-Null
npm pack --ignore-scripts ../..\packages\relayboard-skills --pack-destination $dest
```

`npm pack` output (facts worth keeping):

```
npm notice name: @relayboard/skills
npm notice version: 0.1.0
npm notice filename: relayboard-skills-0.1.0.tgz
npm notice package size: 25.2 kB
npm notice unpacked size: 77.2 kB
npm notice shasum: dfd2d8cb8a02983dc76cd199f2d54a09592a1473
npm notice integrity: sha512-jwpk6x3b4zPCX[...]e6osu/eIJi6mQ==
npm notice total files: 20
```

Tarball contents (20 files, exactly the `files` allowlist — no `src/`, no `skills/_artifacts/`,
no `.consumer-demo`, no `tsconfig.json`):

```
package/dist/{cli,index,types}.{js,d.ts} + *.map
package/docs/{identity-provenance,mock-api,thread-sequencing}.md
package/skills/relayboard-identity/SKILL.md
package/skills/relayboard-mock-api/SKILL.md
package/skills/relayboard-thread-sequencing/SKILL.md
package/package.json
package/README.md
```

Then installed into the app and **vendored** so the lockfile entry is stable and repo-relative:

```powershell
New-Item -ItemType Directory -Path vendor -Force | Out-Null
Copy-Item "$env:TEMP\rb-skills-pack2\relayboard-skills-0.1.0.tgz" vendor\relayboard-skills-0.1.0.tgz -Force
npm install --no-audit --no-fund ".\vendor\relayboard-skills-0.1.0.tgz"
```

Resolved `package.json` entry (honest form):

```json
"@relayboard/skills": "file:vendor/relayboard-skills-0.1.0.tgz"
```

and in `package-lock.json`:

```json
"node_modules/@relayboard/skills": {
  "version": "0.1.0",
  "resolved": "file:vendor/relayboard-skills-0.1.0.tgz",
  "integrity": "sha512-jwpk6x3b4zPCXzSY/lES08tr1qcgBFq3UjTSiB8uY+rFh0ghFyTTdARqoYjDvfXhWIsr6HKFXe6osu/eIJi6mQ==",
  "license": "UNLICENSED",
  "bin": { "relayboard-skills": "dist/cli.js" }
}
```

**Why `file:` and what it would look like published.** A `file:` spec is what npm records for a local
tarball; it is not a semver range and it is not how a published dependency would look. Once
`@relayboard/skills@0.1.0` is on a registry, the entry becomes an ordinary range, e.g.
`"@relayboard/skills": "^0.1.0"`, and `npm install` resolves it from the registry instead of the
tarball. The `vendor/relayboard-skills-0.1.0.tgz` file is committed precisely so the install is
reproducible offline today; it should be deleted when the package is published. `vendor/` is **not**
gitignored (verified with `git check-ignore`, exit 1).

Reproducibility check — the installed tree was deleted and rebuilt from the vendored tarball:

```powershell
Move-Item node_modules\@relayboard\skills node_modules\@relayboard\skills.bak -Force
npm install --no-audit --no-fund
# added 1 package, and removed 1 package in 861ms     (exit 0)
```

and the restored copy then matched the live package source byte-for-byte for every
`SKILL.md` / `docs/` / `dist/` / `package.json` file (SHA-256 equal).

#### A trap worth recording: a pre-existing tarball in the package repo was stale

`packages/relayboard-skills/relayboard-skills-0.1.0.tgz` already existed (mtime 13:06:25). Extracting and
hashing it showed `dist/*` and `package.json` matched disk, **but `docs/identity-provenance.md`,
`skills/relayboard-identity/SKILL.md` and `skills/relayboard-mock-api/SKILL.md` in it were older than
the working tree** (those files carry 13:13–13:14 mtimes — the package was being edited at the same
time this app was being wired). Installing that tarball would have shipped outdated skill text into the
app. Fix: re-pack from current source and reinstall (§11.1).

After the re-pack, the vendored tarball was extracted and compared file-by-file against the **live**
package source — `skills/relayboard-{mock-api,identity,thread-sequencing}/SKILL.md`,
`docs/{identity-provenance,mock-api}.md`, `dist/index.js` and `package.json` are all SHA-256 equal to
both the installed copy and the live tree. **Re-run `npm pack` + `npm install` whenever the package
changes**; the vendored tarball does not track the source automatically, and `packages/` is owned by
another teammate.

Nothing in `packages/` was modified by this work: 36 files were hashed before and after and the diff
contains no file I wrote (the 4–5 differing entries are all `dist/*` from the package's own `prepack`
build plus files the package owner was editing concurrently — see §11.1 note on `--ignore-scripts`).

Note on `--ignore-scripts`: dropping it makes `npm pack` run the package's `prepack`
(`npm run build` → `tsc`). That rewrites `packages/relayboard-skills/dist/*` — harmless but it is a
write into someone else's scope, so the final pack used `--ignore-scripts`. `dist/` was already
current and byte-identical, so the tarball is the same either way.

### 11.2 The `intent` block in `package.json`

```json
"intent": {
  "skills": [
    "@relayboard/skills"
  ],
  "exclude": [
    "@relayboard/skills#relayboard-identity"
  ]
}
```

Both keys were exercised through the Intent CLI: the allowlist was written by hand first, then the
exclusion was added and removed with `npx intent exclude add|remove "<pattern>"`. After that round trip
the CLI's rewrite of `package.json` compared **byte-identical** to the hand-written block
(`Compare-Object` on the two files: zero differences), so the CLI and a manual edit agree on the shape.
The allowlist can also be generated by the interactive `npx intent install` (which cannot run in a
non-interactive session — see §8).

**Final state kept: allowlist `["@relayboard/skills"]` + exclude `relayboard-identity`.** Rationale:
thread-sequencing and mock-api describe the read path and the `window.RelayboardMockAPI` write path that
this app consumes today, while relayboard-identity's guidance depends on a principal read that the mock
API does not expose (`getPrincipal` does not exist on the API surface). Keeping it out of the surfaced
set avoids steering the app at a read that cannot be implemented; it stays discoverable behind
`intent.skills` for whoever adds the principal endpoint, by removing the one exclude line.

### 11.3 `npx intent list --json` (with the allowlist) — raw

```json
{
  "skills": [
    {
      "use": "@relayboard/skills#relayboard-mock-api",
      "packageName": "@relayboard/skills",
      "packageRoot": "C:\\...\\apps\\relayboard-web\\node_modules\\@relayboard\\skills",
      "packageVersion": "0.1.0",
      "packageSource": "local",
      "skillName": "relayboard-mock-api",
      "description": "Use when calling window.RelayboardMockAPI in the Relayboard prototype to list boards and threads, post or simulate messages, create boards and threads, add resource links, or toggle the simulated stream — and when deciding what the mock does and does not persist. Covers method shapes, error messages and localStorage behaviour; use relayboard-thread-sequencing for read ordering and cursors.",
      "purpose": "Call the prototype's asynchronous mock client correctly: the nine method signatures, the record shapes they return, the exact errors they throw, the localStorage key and reset, and the guarantees the mock deliberately omits.",
      "type": "core"
    },
    {
      "use": "@relayboard/skills#relayboard-thread-sequencing",
      "packageName": "@relayboard/skills",
      "packageRoot": "C:\\...\\apps\\relayboard-web\\node_modules\\@relayboard\\skills",
      "packageVersion": "0.1.0",
      "packageSource": "local",
      "skillName": "relayboard-thread-sequencing",
      "description": "Use when reading, ordering, replaying, or resuming Relayboard thread messages in the prototype, including per-thread canonical sequence numbers, delivery cursors versus read watermarks, catching up after a pause, and idempotent re-sends. Covers the window.RelayboardMockAPI read path only; use relayboard-mock-api to post messages or create boards and threads.",
      "purpose": "Keep thread reads correct: order by the immutable per-thread sequence, keep the delivery cursor separate from the human read watermark, catch up with readMessages({ after }), and retry with the original idempotency key.",
      "type": "core"
    }
  ],
  "packages": [
    {
      "name": "@relayboard/skills",
      "version": "0.1.0",
      "source": "local",
      "packageRoot": "C:\\...\\apps\\relayboard-web\\node_modules\\@relayboard\\skills",
      "skillCount": 2
    }
  ],
  "hiddenSourceCount": 11,
  "hiddenSources": [],
  "warnings": [],
  "notices": [
    "11 discovered skill sources with 35 skills are hidden because they are not listed in intent.skills. Ask the user to run `intent list --show-hidden` outside the agent session to review candidates."
  ],
  "conflicts": []
}
```

Reading it precisely: the allowlist does **not** merely prefer the package — it **hides** the 11 other
`@tanstack/*` packages (35 skills) that ship skills inside `node_modules`. `skillCount: 2` is the
allowlist minus the exclusion. Important: **`--json` does not enumerate the exclusion at all** — there
is no `excludedSkills` field, and `relayboard-identity` simply is not in `skills[]`. The exclusion is
visible only through `intent exclude list` and by the refusal in §11.6.

### 11.4 `npx intent exclude list --json` — raw

```json
[
  "@relayboard/skills#relayboard-identity"
]
```

### 11.5 `npx intent list --show-hidden`

Human/a TTY-free run inside this agent session:

```
1 intent-enabled packages, 2 skills

PACKAGE             SOURCE  VERSION  SKILLS
─────────────────────────────────────────────
@relayboard/skills  local   0.1.0    2
Hidden skill sources are not revealed in agent sessions. Run this command outside the agent session to review candidates.

Skills:

  @relayboard/skills
    relayboard-mock-api           [core]        Use when calling window.RelayboardMockAPI …
      Load: npm exec --no -- intent load @relayboard/skills#relayboard-mock-api
    relayboard-thread-sequencing  [core]        Use when reading, ordering, replaying …
      Load: npm exec --no -- intent load @relayboard/skills#relayboard-thread-sequencing

Notices:
  ℹ 11 discovered skill sources with 35 skills are hidden because they are not listed in intent.skills. Ask the user to run `intent list --show-hidden` outside the agent session to review candidates.
```

So `--show-hidden` did **not** actually reveal them here. Cause, read from the installed
`@tanstack/intent` source: `detectIntentAudience()` treats the process as an agent session when any of
`AI_AGENT`, `CLAUDECODE`, `CLAUDE_CODE`, `REPL_ID`, `GEMINI_CLI`, `CODEX_SANDBOX`,
`CODEX_THREAD_ID`, `OPENCODE`, `AUGMENT_AGENT`, `GOOSE_PROVIDER`, `JUNIE_DATA`,
`JUNIE_SHIM_PATH`, `CURSOR_AGENT` is set (or `PATH` matches `\.pi[\\/]agent`, or `EDITOR` matches
`devin`). In this shell none of those env vars is set, but `PATH` matches `\.pi[\\/]agent`, so the
audience resolves to `agent` and `printHiddenSources()` prints the refusal instead of the list.

`INTENT_AUDIENCE=human` overrides it — the identical command then reveals the hidden sources:

```
Hidden skill sources:

  @tanstack/devtools (4 skills)
  @tanstack/devtools-event-client (3 skills)
  @tanstack/devtools-vite (1 skill)
  @tanstack/match-sorter-utils (1 skills)
  @tanstack/react-router (3 skills)
  @tanstack/react-start (3 skills)
  @tanstack/router-core (10 skills)
  @tanstack/router-plugin (1 skill)
  @tanstack/start-client-core (7 skills)
  @tanstack/start-server-core (1 skill)
  @tanstack/virtual-file-routes (1 skill)
```

and the notice switches to the human wording:

```
ℹ 11 discovered packages ship skills but are not listed in intent.skills: @tanstack/devtools,
@tanstack/devtools-event-client, @tanstack/devtools-vite, @tanstack/match-sorter-utils,
@tanstack/react-router, @tanstack/react-start, @tanstack/router-core, @tanstack/router-plugin,
@tanstack/start-client-core, @tanstack/start-server-core, @tanstack/virtual-file-routes. Add to opt in.
```

(Also note `1 skills` — the CLI's pluralisation in that listing.)

### 11.6 `npx intent load` — served and refused

Surfaced skill, `npx intent load @relayboard/skills#relayboard-mock-api` → **exit 0**, prints the whole
`SKILL.md` (frontmatter `name`/`description`/`metadata.purpose`/`metadata.type: core`/
`metadata.library: '@relayboard/skills'`/`metadata.library_version: 0.1.0`/`sources`, then the body).
Its relative doc link is rewritten to the installed path:
`[docs/mock-api.md](node_modules/@relayboard/skills/docs/mock-api.md)`.

Second surfaced skill, `npx intent load @relayboard/skills#relayboard-thread-sequencing` → **exit 0**,
same shape, `sources: ['docs/thread-sequencing.md']`.

Excluded skill, `npx intent load @relayboard/skills#relayboard-identity` → **exit 1**, stderr verbatim:

```
Cannot load skill use "@relayboard/skills#relayboard-identity": skill "@relayboard/skills#relayboard-identity" is excluded by Intent configuration.
```

### 11.7 Removal → restore round trip

```powershell
npx intent exclude remove "@relayboard/skills#relayboard-identity"
# Removed exclude pattern "@relayboard/skills#relayboard-identity" from package.json intent.exclude.   (exit 0)

npx intent exclude list --json      # []
npx intent list --json              # skills[] = identity, mock-api, thread-sequencing ; packages[0].skillCount = 3
npx intent load @relayboard/skills#relayboard-identity
# exit 0 — prints the SKILL.md (identity/provenance guidance) as expected

npx intent exclude add "@relayboard/skills#relayboard-identity"
# Added exclude pattern "@relayboard/skills#relayboard-identity" to package.json intent.exclude.   (exit 0)
npx intent exclude list --json      # ["@relayboard/skills#relayboard-identity"]
npx intent load @relayboard/skills#relayboard-identity
# exit 1 — "…is excluded by Intent configuration."
```

Note the CLI leaves `"exclude": []` rather than deleting the key after a remove — hence the key exists
in the final file. Final state = allowlist + the one exclusion (§11.2).

### 11.8 Discovery does not execute package code, and writes nothing

- **Installed copy contains only data + compiled entry points.** Full listing of
  `node_modules/@relayboard/skills` (26 entries: 20 files + 6 dirs):
  `dist/{cli,index,types}.{js,d.ts}` + 6 `.map`, `docs/{identity-provenance,mock-api,thread-sequencing}.md`,
  `skills/relayboard-{identity,mock-api,thread-sequencing}/SKILL.md`, `package.json`, `README.md`.
  **No `src/`, no `skills/_artifacts/`, no `tsconfig.json`, no tarball** — the published `files`
  allowlist held.
- **No writes.** Every file under `node_modules/@relayboard/skills` was SHA-256 hashed before and after
  running `intent list --json`, `intent load` (×3) and `intent exclude list --json`: 26 entries before,
  26 after, **zero added / changed / removed**.
- **No code execution.** `@tanstack/intent` discovers skills by reading `package.json` and the
  `skills/<name>/SKILL.md` files (`scanner` → `parseFrontmatter` → `readFile`); nothing in its `dist/`
  imports a discovered package's `main`/`exports`. `relayboard-skills`' own CLI
  (`dist/cli.js`, `bin.relayboard-skills`) was never invoked. The app never imports
  `@relayboard/skills` from application code either — the dependency exists purely so Intent can find
  the `SKILL.md` files and so the version is pinned.
- **No stray state.** No `.intent/` in the app, `.tanstack/` still contains only the empty `tmp/`
  the scaffold made, and no `~/.tanstack` cache directory was created. The only app files touched in
  this section were `package.json`, `package-lock.json` and `vendor/relayboard-skills-0.1.0.tgz`.

### 11.9 Which `intent` does `npx` run? (measured)

`@tanstack/intent` is **not** a dependency of the app: absent from `package.json` dependencies and
devDependencies, absent from `node_modules/@tanstack/intent`, and `npm ls @tanstack/intent` reports
`(empty)` (exit 1). It lives at the **repo root** (`node_modules/@tanstack/intent@0.5.6`, a
`devDependency` of the root workspace `package.json`).

`npx` in `apps/relayboard-web` **finds the repo-root binary by walking up to the root `node_modules/.bin`**;
it does not download a throwaway copy:

- `npx intent --version` → `0.5.6`, identical to the root install.
- `npx --no-install intent --version` → `0.5.6`, exit 0. `--no-install` fails outright when a package
  must be fetched, so this proves local resolution.
- Control: the same `npx --no-install intent --version` run in a directory outside the repo
  (`%TEMP%\rb-npx-probe`) → `npm error could not determine executable to run` (exit 1).
- The root `node_modules` bin dir is **not** on `PATH`, so this is `npx`'s upward
  `node_modules/.bin` walk, not a shell alias: `node_modules/.bin/intent[.cmd|.ps1]` is a shim for
  `node_modules/@tanstack/intent/dist/cli.mjs`.

Consequence: the app inherits the root toolchain version by accident of directory layout. If the app
directory is ever copied elsewhere, or the root `node_modules` is not installed, `npx intent` would
silently fetch whatever `@tanstack/intent` is latest. Add `@tanstack/intent` to the app's own
devDependencies (pinned to `0.5.6`) if that matters.

### 11.10 Biome and the new `node_modules` package

`biome.json` was **not** changed. Measured: `npm run check` still reports `Checked 14 files` — the same
14 as before the install — and `npx biome check node_modules/@relayboard/skills/skills` responds:

```
Checked 0 files in 4ms. No fixes applied.
× No files were processed in the specified paths.
i Check your biome.json or biome.jsonc to ensure the paths are not ignored by the configuration.
i These paths were provided but ignored:
- node_modules/@relayboard/skills/skills
```

Two independent reasons it is skipped: `biome.json`'s `files.includes` allowlist is
`**/src/**/*`, `**/.vscode/**/*`, `**/index.html`, `**/vite.config.ts`, which matches nothing under
`node_modules`; and Biome skips `node_modules` by default. **Decision: documented, not changed** — no
ignore entry was added, because adding one would imply the package is otherwise in scope. A future
`biome.json` rewrite must keep an allowlist (or an explicit `!**/node_modules` negation) to preserve
this; a bare `files.includes: ["**"]` would start linting installed packages.

### 11.11 The agent config file (`AGENTS.md`) — now installable

In §8 `npx intent install` refused with *"intent.skills is not configured … run in an interactive
terminal"*. **That was the allowlist, not the TTY.** With `intent.skills` now present, an
unattended run works:

```powershell
npx intent install --dry-run     # exit 0, prints the block it would write
npx intent install               # exit 0
# Created AGENTS.md with skill loading guidance.
# To change permissions, run intent install --review.
# Tip: Keep the intent-skills block near the top of AGENTS.md so agents read it before task-specific instructions.
```

`apps/relayboard-web/AGENTS.md` (844 bytes) now holds exactly that generated block, nothing else:

```markdown
<!-- intent-skills:start -->
## Skill Loading

Use the repository’s installed Intent. If it is unavailable, report the missing dependency instead of downloading a replacement.
Before editing files for a substantial task:
- Run `npm exec --no -- intent list` from the workspace root to see available local skills.
- If a listed skill matches the task, run `npm exec --no -- intent load <package>#<skill>` before changing files.
- Use the loaded `SKILL.md` guidance while making the change.
- Monorepos: when working across packages, run the skill check from the workspace root and prefer the local skill for the package being changed.
- Multiple matches: prefer the most specific local skill for the package or concern you are changing; load additional skills only when the task spans multiple packages or concerns.
<!-- intent-skills:end -->
```

`npx intent install` did **not** touch `package.json` (intent block unchanged afterwards).

**One caveat, measured.** The block says "from the workspace root"; in *this* repo that is wrong.
Discovery is package-relative to the directory you run in, and the allowlist lives in the app's
`package.json`, so:

| cwd | `intent list` |
| --- | --- |
| `apps/relayboard-web` (and `npm exec --no -- intent list`, which the block recommends) | `1 intent-enabled packages, 2 skills` — `@relayboard/skills 0.1.0`, both surfaced skills listed |
| repo root | `No intent-enabled packages found.` (the root `node_modules` has no `@relayboard/skills`, and `hiddenSourceCount` is 0 because the root sets no `intent.skills`) |

So the correct instruction for contributors here is: run it in **`apps/relayboard-web`**, not the
workspace root. `npm exec --no -- intent list` and `npm exec --no -- intent load
@relayboard/skills#relayboard-mock-api` from the app directory both behave exactly like the plain
`npx intent …` forms (exit 0).

### 11.12 Re-verification after the wiring

| Command | Result |
| --- | --- |
| `npm run build` | **exit 0** (`✓ built …`, `[nitro] √ You can preview this build using npx vite preview`) |
| `npx tsc --noEmit` | **exit 0**, no output |
| `npm run check` | **exit 0**, `Checked 14 files in 19ms. No fixes applied.` |

The trio was run twice: once right after the package install + `intent` block, and again after
`AGENTS.md` was generated. Both times all three were exit 0, and `npm run check` kept reporting the
same **14 files** — `AGENTS.md` is Markdown and not in Biome's `files.includes` allowlist, and the
installed package stays outside it.

Installing the package changed nothing about the build: `@relayboard/skills` is not imported by any
route or component, so it is absent from the client/SSR/nitro bundles.

### 11.13 Reproducing this wiring

```powershell
cd apps\relayboard-web
npm pack --ignore-scripts ../..\packages\relayboard-skills --pack-destination $env:TEMP\rb-skills-pack2
New-Item -ItemType Directory -Path vendor -Force | Out-Null
Copy-Item "$env:TEMP\rb-skills-pack2\relayboard-skills-0.1.0.tgz" vendor\relayboard-skills-0.1.0.tgz -Force
npm install --no-audit --no-fund ".\vendor\relayboard-skills-0.1.0.tgz"

npx intent exclude add "@relayboard/skills#relayboard-identity"   # writes intent.exclude
# add "intent": { "skills": ["@relayboard/skills"] } to package.json (or let an interactive
# `npx intent install` do it), then confirm:
npx intent exclude list --json          # ["@relayboard/skills#relayboard-identity"]
npx intent list --json                  # 1 package, skillCount 2, hiddenSourceCount 11
npx intent load @relayboard/skills#relayboard-mock-api            # exit 0, prints SKILL.md
npx intent load @relayboard/skills#relayboard-identity            # exit 1, "excluded by Intent configuration"
# outside an agent shell, add INTENT_AUDIENCE=human to see hidden sources in `list --show-hidden`.

npx intent install               # writes AGENTS.md with the skill-loading block (exit 0)

npm run build; npx tsc --noEmit; npm run check                    # all exit 0
```
