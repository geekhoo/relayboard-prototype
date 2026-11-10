# @relayboard/skills

Agent Skills for the **Relayboard** messaging workspace prototype, shipped as a
versioned npm package and discovered through
[TanStack Intent](https://tanstack.com/intent/latest/docs/overview).

Relayboard is a static HTML/CSS/JS prototype of a durable messaging space where
humans and independent AI agents converse asynchronously as peers. These skills
teach a coding agent how the prototype actually behaves, grounded in source
documentation that lives beside the skills.

## What ships

| Skill | Use it when | Source document |
| --- | --- | --- |
| `relayboard-thread-sequencing` | reading, ordering, replaying or resuming thread messages: canonical `seq`, delivery cursors vs read watermarks, catch-up, idempotent re-sends | [`docs/thread-sequencing.md`](docs/thread-sequencing.md) |
| `relayboard-mock-api` | calling `window.RelayboardMockAPI`: method shapes, error messages, `localStorage` persistence and reset | [`docs/mock-api.md`](docs/mock-api.md) |
| `relayboard-identity` | authorship and provenance: human vs agent, principal id vs display name, the `AGENT` chip, claims an identity view must not make | [`docs/identity-provenance.md`](docs/identity-provenance.md) |

Every `SKILL.md` declares its `docs/*.md` evidence under `sources`, so Intent's
review and staleness checks can point a reviewer back at the document that
justifies each claim.

## Consume

```sh
npm install @relayboard/skills
npx intent list
npx intent load @relayboard/skills#relayboard-thread-sequencing
```

Skill access is gated by `package.json#intent.skills` in the consuming project:

```json
{
  "intent": {
    "skills": ["@relayboard/skills"],
    "exclude": ["@relayboard/skills#relayboard-mock-api"]
  }
}
```

- `"@relayboard/skills"` permits every skill the package ships, including ones
  added later.
- `"@relayboard/skills#relayboard-identity"` permits one exact skill.
- `intent.exclude` removes a package or skill *after* the allowlist resolves.
- Unlisted packages are omitted and reported; **trust does not propagate to
  dependencies**.
- Discovery is static: Intent reads package files as data and never imports,
  requires or executes this package's JavaScript to find or load a skill.

## TypeScript surface

The package is a normal TypeScript library, not just Markdown:

```ts
import { listSkills, parseSkillFrontmatter, resolveSkill, PACKAGE_VERSION } from '@relayboard/skills'

const [first] = listSkills()
if (first !== undefined) {
  const record = resolveSkill(first.name)          // { name, use, skillPath, packageRoot }
  const meta = parseSkillFrontmatter(markdownText) // typed SkillFrontmatter
  console.log(record.use, PACKAGE_VERSION, meta.metadata.type)
}
```

`src/index.ts` exports the skill inventory, frontmatter types and a small
frontmatter reader; `src/cli.ts` builds to `dist/cli.js` and provides:

```sh
relayboard-skills list    # shipped skills and their intent load identities
relayboard-skills check   # package/skill metadata invariants
```

`npm run build` runs `tsc` and emits `dist/` (JavaScript, `.d.ts`, source maps).

## Maintainer workflow

Prerequisites: Node.js and `npm install` in this directory (Intent is a
devDependency; the repository root has no `package.json`, so the nearest
package is this one).

```sh
npx intent validate                              # SKILL.md structure, links, examples
npx intent maintainer status                     # authoring gaps, files to sync, pending reviews
npx intent maintainer sync                       # align skill_tree/package.json with frontmatter
npx intent maintainer review --json              # pending source-review items
npx intent maintainer check                      # CI gate: structure + sync + reviews
npx intent stale --json                          # conservative version/artifact signals
npm run build                                    # tsc
npm pack --dry-run --json                        # inspect the published file list
```

npm scripts: `build`, `check:types`, `list:skills`, `validate:skills`,
`check:skills` (`intent validate && intent maintainer check`), `stale`,
`maintainer:sync`, `maintainer:status`, `prepack`.

### What `intent stale` does and does not prove

`stale` reports **conservative package-level signals**: version drift between a
skill's `metadata.library_version` and the package version, missing source SHAs
in `skills/sync-state.json`, artifact parse/coverage warnings, and workspace
package coverage. It never diffs source content, so editing a referenced
document without touching the skill produces **no** signal. Use
`intent maintainer review` for source-aware, recorded decisions.

Measured on this package:

| Change made | `intent stale --json` result |
| --- | --- |
| baseline | `versionDrift: null`, all three skills `needsReview: false` |
| appended a paragraph to `docs/thread-sequencing.md`, no skill edit | unchanged — every skill `needsReview: false` |
| bumped `package.json#version` to `0.2.0` without touching skills | `versionDrift: "minor"`, each skill flagged `version drift (0.1.0 → 0.2.0)` |
| added a source entry whose SHA is not stored in `skills/sync-state.json` | extra reason `new source (docs/mock-api.md)` |

So `stale` catches **version drift and missing sync SHAs**, not stale prose.


### Layout

```text
packages/relayboard-skills/
  docs/                        # source documentation the skills cite
  skills/
    <skill>/SKILL.md           # published guidance
    _artifacts/                # planning records, excluded from the tarball
  src/ dist/                   # TypeScript source and build output
  .github/workflows/           # check-skills.yml copied by `intent setup`
  AGENTS.md                    # intent-maintainer block installed by setup
```

`_artifacts` (planning records) is deliberately excluded from the published
`files` list. Git-ignored: `node_modules/`, `dist/`, `*.tgz`,
`.consumer-demo/node_modules/` and `.consumer-demo/package-lock.json`.

### CI state

`intent maintainer check` **passes with 0 pending reviews** — both in this package
directory and from the repository root
(`npm run skills:check`, which passes `--artifacts packages/relayboard-skills/skills/_artifacts`).

Recording happens at the repository root because Intent always writes
`.intent/review-state.json` at the Git root, so a review recorded from a
subdirectory would silently cover unrelated repository files. The record was made
deliberately and per item: `npx intent maintainer review --json` produced the report,
[`scripts/annotate-intent-review.mjs`](../../scripts/annotate-intent-review.mjs) added an
outcome, reason and evidence to each item, and
`npx intent maintainer review --record .intent/review.json` stored it. Later edits to a
skill or to one of its `sources` reopen review for that item; that is the gate working,
not a failure.

See [`INTENT.md`](../../INTENT.md) at the repository root for the full workflow and for
what `intent stale` does and does not prove.


## CI

`.github/workflows/check-skills.yml` is the caller Intent generates, pinned to
`TanStack/intent@b9f205d69ba2bec93954508ff76281ae2178062c # v0.5.6`. Pull
requests run the reusable validation job; release and manual runs write a
read-only review report. It currently lives inside the package; whether to hoist
it to the repository root is a repository-level decision.

## Scope and honesty

The prototype is frontend-only: no backend, no broker, no authentication, no
cross-device sync. The skills describe cursor-based recovery and provenance as
the prototype simulates them, and they explicitly forbid claiming guarantees
the implementation does not make.
