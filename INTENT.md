# TanStack Intent in this repository

How the Agent Skills in [`packages/relayboard-skills`](packages/relayboard-skills) are
authored, versioned, validated, published and consumed, and where the TanStack CLI
and Intent stop being able to help. Everything below was run in this repository;
outputs quoted are real.

## Layout

| Path | What it is | Published? |
| --- | --- | --- |
| `apps/relayboard-web` | TanStack Start app scaffolded by `@tanstack/cli`; the **consumer** | no (`private: true`) |
| `packages/relayboard-skills` | `@relayboard/skills@0.1.0` — the **library**; ships skills | yes, npm tarball |
| `packages/relayboard-skills/docs` | Source documentation the skills cite | yes (they are the evidence) |
| `packages/relayboard-skills/skills/<name>/SKILL.md` | The guidance itself | yes |
| `packages/relayboard-skills/skills/_artifacts` | `domain_map.yaml`, `skill_spec.md`, `skill_tree.yaml` | **no** (excluded by `files`) |
| `package.json` (root) | Workspace manifest: `@tanstack/intent` + `typescript` devDependencies only | no |
| `.github/workflows/check-skills.yml` | CI gate for skill validation and recorded reviews | — |
| `packages/relayboard-skills/.github/workflows/check-skills.yml` | Inert copy left by running `intent setup` inside the package. GitHub only reads `.github/` at the repository root, so this one never runs; the root file above is the gate. Kept for provenance. | — |
| `.intent/review-state.json` | Intent's recorded review baseline (Intent writes it at the Git root) | — |
| `scripts/annotate-intent-review.mjs` | Fills outcomes/evidence into a `review --json` report | — |

The root manifest exists for three reasons and nothing else: it is the lockfile owner
the CI workflow installs from, it makes `typescript` available so `intent validate`
typechecks the fenced examples, and it is the nearest manifest to `.intent/`, which
Intent always writes at the Git root.

## Authoring a skill

Skills live **beside their source documentation** — `skills/<name>/SKILL.md` next to
`docs/<topic>.md` — and each `SKILL.md` declares its evidence:

```yaml
sources:
  - 'docs/thread-sequencing.md'
  - 'docs/mock-api.md'
```

Those `sources` are package-relative on purpose: Intent requires a source to resolve
inside the owning package. The prototype files a document was derived from
(`app.js`, `README.md`, `PRODUCT.md`, `DESIGN.md`, `QA.md`) are cited inside the
document bodies instead.

Maintainer loop, run from the repository root:

```sh
npm run skills:status    # intent maintainer status — gaps, files to sync, pending reviews
npm run skills:sync      # intent maintainer sync   — align skill_tree + package.json with frontmatter
npm run skills:validate  # intent validate packages/relayboard-skills/skills
npm run skills:check     # intent maintainer check --artifacts packages/relayboard-skills/skills/_artifacts
npm run skills:stale     # intent stale --json
npm run skills:pack      # npm pack ./packages/relayboard-skills --dry-run --json
npm run skills:list      # re-runs `intent list` in apps/relayboard-web, the consumer
```

`skills:list` deliberately delegates to the app directory. Running `intent list` at the
root prints `No intent-enabled packages found.` — the root manifest sets no allowlist and
the library is not linked into a `node_modules` tree, so the root is not a consumer.

### Two findings worth keeping

1. **`maintainer add <name>` cannot register an already-authored `SKILL.md`** when
   `--description` / `--source` / `--requires` are supplied. It answers:
   *"To register an existing skill, supply its --path and --domain; edit its
   frontmatter directly before running sync."* Author the file first, then register
   it with `--path`/`--domain` (or let `maintainer setup` register it).
2. **`review-state.json` is always written at the Git root.** A package that lives in
   a subdirectory therefore cannot record its own review without the record covering
   the whole tree. Here that is handled deliberately at the root (see below) rather
   than by leaving the package's gate open.

## Recording a review

`intent maintainer check` fails while any skill, planning record, or unmapped change
is unreviewed. The full loop, with every item given its own outcome, reason and
evidence:

```sh
npx intent maintainer review --json > .intent/review.json
node scripts/annotate-intent-review.mjs          # adds outcome/reason/evidence per item
npx intent maintainer review --record .intent/review.json
npm run skills:check
```

Annotating by hand is also supported; the script exists only so the same five items
are not re-typed and so a missing annotation fails loudly instead of silently
recording nothing. Outcomes used so far: `updated`, `no-change`, `out-of-scope`.

A single-verdict shortcut (`maintainer review --unchanged "<reason>"`) is available
when every item shares one conclusion. It was **not** used here: the mock-api and
identity guidance genuinely changed, thread-sequencing did not, and `.gitignore` is
out of scope.

## What `intent stale` does and does not prove

Measured on this package:

| Change made | `intent stale --json` |
| --- | --- |
| baseline | `versionDrift: null`, every skill `needsReview: false` |
| appended a paragraph to a referenced doc, no skill edit | **no signal at all** |
| bumped `package.json#version` without touching skills | `versionDrift: "minor"`, each skill `version drift (0.1.0 → 0.2.0)` |
| added a source whose SHA is absent from `skills/sync-state.json` | extra reason `new source (docs/mock-api.md)` |

So `stale` is a **conservative, cheap** gate: version drift, missing source SHAs,
artifact/coverage warnings. It never diffs prose, so an edited source document alone
is invisible to it. Source-aware judgement is `intent maintainer review`, which is why
the CI gate runs `maintainer check` and not `stale` alone.

## Publishing and verification

```sh
npm --prefix packages/relayboard-skills run build       # tsc → dist/ with .d.ts
npm run skills:pack                                     # 20 entries
```

The packed tarball contains `dist/`, `docs/`, `skills/**/SKILL.md`,
`package.json`, `README.md` — and **not** `skills/_artifacts`, `src/`, `AGENTS.md`,
`.github/`, or `.consumer-demo/`. `package.json` carries the `tanstack-intent`
keyword and:

```json
"files": ["dist", "skills", "!skills/_artifacts", "docs"]
```

One automation detail: `npm pack --dry-run --json` under npm 12 returns an **object
keyed by package name**, not the array earlier npm versions produced, so a parser has
to reach through `output['@relayboard/skills'].files`:

```powershell
$pkg = (npm pack --dry-run --json | ConvertFrom-Json).'@relayboard/skills'
$pkg.entryCount                       # 20
$pkg.files.path | Where-Object { $_ -like '*SKILL.md' }   # 3 skills
```

Verify the packaged copy, not just the working tree: the tarball in
`packages/relayboard-skills/` was once stale relative to the reviewed guidance.
`apps/relayboard-web/vendor/relayboard-skills-0.1.0.tgz` and a freshly packed tarball
now hash identically (`npm pack --ignore-scripts` — without `--ignore-scripts`,
`prepack` re-runs `tsc`).

## Consuming the skills

Discovery is static: Intent reads package files as data and never imports, requires
or executes package code — verified with a fixture package that wrote a marker from
both `require` and `postinstall`; the marker stayed absent through `intent list` and
`intent load` and appeared only on a direct `require`. For the real installed copy,
SHA-256 of all 26 entries in `node_modules/@relayboard/skills` were unchanged across
`list`, three `load`s and `exclude list`.

Access is allowlisted per consuming project in `package.json#intent.skills`, with
`intent.exclude` applied afterwards. [`apps/relayboard-web`](apps/relayboard-web) is
the working example:

```json
{
  "intent": {
    "skills": ["@tanstack/*", "@relayboard/skills"],
    "exclude": ["@relayboard/skills#relayboard-identity"]
  }
}
```

`"@tanstack/*"` opts in to the Agent Skills that the installed TanStack packages ship
themselves — see *TanStack's own skills* below. It is a scope rule, so it also covers
TanStack packages added later; that is a deliberate trust decision, not a default.

It installs the packed tarball as a real dependency
(`"@relayboard/skills": "file:vendor/relayboard-skills-0.1.0.tgz"`; the published form
would be `^0.1.0`), which is reproducible from a clean clone because the tarball is
vendored rather than referenced from a temp path.

Verified there against the packed tarball: a package entry surfaces all its skills, an
exact `<pkg>#<skill>` entry surfaces one, `intent exclude add` removes exactly that
skill while the allowlist stays, and **trust does not propagate** — a transitive
dependency that ships skills is hidden and `intent load` on it fails with *"is not
listed in intent.skills"*. That last rule is exactly why TanStack's skills were
invisible until `"@tanstack/*"` was added: they are transitive dependencies of the app,
and discovery finds them but does not grant trust.

### TanStack's own skills

The scaffold's TanStack packages ship their own `skills/**/SKILL.md`. Once
`"@tanstack/*"` is allowlisted, discovery surfaces **11 packages / 35 skills** alongside
the two Relayboard ones (12 packages, 37 skills total, `hiddenSourceCount: 0`,
`conflicts: []`):

| Package | Skills | Type |
| --- | --- | --- |
| `@tanstack/router-core` | 10 | `router-core` core + `auth-and-guards`, `code-splitting`, `data-loading`, `navigation`, `not-found-and-errors`, `path-params`, `search-params`, `ssr`, `type-safety` |
| `@tanstack/start-client-core` | 7 | `start-core` core + `auth-server-primitives`, `deployment`, `execution-model`, `middleware`, `server-functions`, `server-routes` |
| `@tanstack/devtools` | 4 | `devtools-app-setup`, `devtools-plugin-panel`, `devtools-marketplace`, `devtools-production` |
| `@tanstack/devtools-event-client` | 3 | `devtools-event-client`, `devtools-bidirectional`, `devtools-instrumentation` |
| `@tanstack/react-router` | 3 | `react-router`, `compositions/router-query`, `lifecycle/migrate-from-react-router` |
| `@tanstack/react-start` | 3 | `react-start`, `react-start/server-components`, `lifecycle/migrate-from-nextjs` |
| `@tanstack/devtools-vite`, `match-sorter-utils`, `router-plugin`, `start-server-core`, `virtual-file-routes` | 1 each | core |

The `core` / `framework` entries are entry points; the `sub-skill` entries are loaded
*in addition* when the task is narrow (for example
`@tanstack/router-core#router-core/data-loading` for loader work,
`@tanstack/start-client-core#start-core/server-routes` for API routes). `intent list`
prints the `intent load` command for each, and
`npx intent install --map` writes all 37 explicit task-to-skill mappings into
`AGENTS.md` (17 KB) if you would rather have routing in the guidance file than in
`intent list`. This repository keeps the compact default block and relies on
`intent list`.

Their guidance is genuinely useful and occasionally more current than the app:
`@tanstack/devtools-vite#devtools-vite-plugin` says "Vite ^6 || ^7 only" in its prose,
while the installed package's `peerDependencies` allow `^8` and the app builds on Vite
8.3.7. Prefer the installed package metadata when prose and metadata disagree, and say
which you trusted.

**Stale checks on TanStack's own skills mostly report drift you cannot fix.** Packaged
skills carry the library version they were written against, which lags the package they
ship inside:

| Package | Skill was written for | Installed | Skills flagged |
| --- | --- | --- | --- |
| `@tanstack/router-core` | 1.171.15 | 1.171.39 | 10 / 10 |
| `@tanstack/start-client-core` | 1.170.14 | 1.170.39 | 7 / 7 |
| `@tanstack/react-router` | 1.166.2 | 1.170.46 | 3 / 3 |
| `@tanstack/react-start` | 1.168.32 | 1.169.5 | 3 / 3 |
| `@tanstack/devtools` | 0.10.12 | 0.16.0 | 4 / 4 |
| `@tanstack/router-plugin` | 1.168.23 | 1.169.0 | 1 / 1 |
| `@tanstack/start-server-core` | 1.169.17 | 1.169.45 | 1 / 1 |
| `@tanstack/virtual-file-routes` | 1.161.4 | 1.162.0 | 1 / 1 |
| `@tanstack/devtools-event-client`, `devtools-vite` | 0.10.12 | 0.5.1 / 0.8.6 | 0 (patch-level or older-numbered) |
| `@tanstack/match-sorter-utils` | 9.2.6 | 9.2.6 | 0 |

`npx intent stale` scoped to the app itself reports nothing (`skills: []`), because the
app has no `skills/` of its own; scope `stale` at a package directory to see the rows
above. These are upstream drift notices — a patch bump inside the same minor — not
actionable here, and none of them affect the Relayboard library's own gate.

Behaviour worth knowing before you debug it:

- **`intent list --json` never reports exclusions.** The excluded skill is simply
  absent from `skills[]`; there is no `excludedSkills` field. `intent exclude list`
  and the `load` refusal are the only observable evidence.
- **`--show-hidden` refuses to name hidden sources in an agent session.** Audience is
  detected by environment sniffing (including a `PATH` match on `\.pi[\\/]agent`), and
  an agent session gets only a count plus "run this outside the agent session".
  `INTENT_AUDIENCE=human npx intent list --show-hidden` reveals them.
- **`intent install` does work unattended** once an allowlist exists; it writes the
  `intent-skills` block into `AGENTS.md`. Its generated text says to run `intent list`
  "from the workspace root", which is wrong for this layout — the root has no skills of
  its own. Run it in `apps/relayboard-web`, where the allowlist and the installed
  package are. Re-running it after a hand-edit of `AGENTS.md` is safe: it reports
  `No changes to AGENTS.md; skill loading guidance already current.` and leaves the
  surrounding text alone.
- **Workspace (unpublished) packages are only discovered when linked.** A
  `skills/**/SKILL.md` inside a `packages/*` directory stays invisible — `"… is
  declared in intent.skills but was not discovered"` — until the package is in
  `node_modules` (via `workspaces` + install) *and* carries a `repository` field;
  without the latter Intent warns it "could not determine repo/docs". Measured in a
  scratch workspace. The root manifest deliberately sets no `intent.skills`: a
  `workspace:@relayboard/skills` entry there matches nothing, so the app is the
  consumer of record.
- **`@tanstack/intent` is not an app dependency.** `npx` finds the repo-root copy by
  walking up to the root `node_modules/.bin` (`npx --no-install intent --version` →
  0.5.6). That inheritance is by layout, not declaration: pin it in the app if the
  directory structure may change.

## Editor hooks are convenience, not a boundary

`intent hooks install` writes a session catalog and an edit gate that waits until it
sees an `intent load` command. Per Intent's own trust model, a hook cannot verify that
the command succeeded, that the skill matched the task, or that the guidance was
applied. Hooks are not installed here; the `.github/workflows/check-skills.yml` gate
plus the recorded review is what actually holds the line.

## CI

`.github/workflows/check-skills.yml` is the caller `intent setup` generates, pinned to
`TanStack/intent@b9f205d69ba2bec93954508ff76281ae2178062c # v0.5.6` — the immutable
commit packaged with `@tanstack/intent@0.5.6`, not a moving tag. Two generated values
were hand-corrected (and both are marked in the file):

- `artifacts: 'packages/relayboard-skills/skills/_artifacts'` → the planning
  directory, repo-root relative, which belongs to the package, not to the root that
  generated the file. The `npm run skills:check` script passes the same path.
- `package-label: '@relayboard/skills'` → names the library whose skills are checked,
  instead of the workspace package that owns the workflow.

The workflow has not been executed on GitHub: this repository has no remote and no
Actions runs. Its contents and the pin are verified; its execution is not.
