# @relayboard/skills skill spec

Coverage, maintainer decisions, check results and batch history for the Agent
Skills shipped by this package. Source evidence for every skill lives in
`docs/` beside `skills/`. **Since Batch 2 the authoritative behaviour is the
application under `apps/relayboard-web`**, which has reached parity with the
prototype; `app.js` at the repository root is kept as the behavioural reference
the parity suite was written from and is no longer what guidance cites.

## Batch 1 — initial three-skill batch (2026-11-10)

Scope: three independent developer tasks for the Relayboard prototype, chosen
because each is a task a developer would look up separately and each has real
source documentation behind it.

| Skill | Domain | Developer tasks | Source documentation |
| --- | --- | --- | --- |
| `relayboard-thread-sequencing` | `messaging-replay` | read a thread in canonical order; persist and advance a delivery cursor; retry without duplicating | `docs/thread-sequencing.md`, `docs/mock-api.md` |
| `relayboard-mock-api` | `api-contract` | call the mock client; match its errors; reset demo state | `docs/mock-api.md`, `docs/thread-sequencing.md` |
| `relayboard-identity` | `identity-provenance` | render a byline; distinguish human from agent; review provenance claims | `docs/identity-provenance.md` |

### Decisions

1. **Three skills, not one.** The read path (ordering and cursors), the write
   path (mock API surface and errors) and provenance are separable tasks with
   different failure modes, and each is discoverable from its own description.
2. **Package-relative sources only.** Frontmatter `sources` point at
   `docs/*.md` inside this package rather than at the prototype root, because
   only the package is installed in a consumer project and Intent rejects
   source paths that leave a verified repository. The prototype files the docs
   were derived from are cited inside the documents themselves.
3. **`metadata.library_version` = the package version.** The guidance describes
   the prototypes' behaviour as of this release, so the two move together;
   `intent validate --set-version` stamps them at release time.
4. **Package-only distribution.** `maintainer setup --distribution none`: the
   skills ship in the npm tarball, and no repository/plugin exports are
   generated for a prototype repository.
5. **Planning records stay out of the tarball.** `skills/_artifacts` is
   excluded from the published `files` list, per the packaging warning Intent
   emits for standalone packages that publish a whole `skills/` directory.
6. **Examples are typechecked, not executed.** The TypeScript fences declare
   their own narrow interfaces rather than importing the prototype, so
   `intent validate` can typecheck them without the prototype being a module.

### Tree paths depend on which Git root owns the records

Intent resolves `skill_tree.yaml`'s `path` relative to the entry's `package`
directory, and every maintainer path must be repository-relative. This
repository's Git root is the repository root, so the committed tree carries
`package: packages/relayboard-skills` with `path: skills/<skill>/SKILL.md`, and
`generated_from` uses `packages/relayboard-skills/skills/_artifacts/...`.

When the same package is extracted as its own repository (the published,
standalone-npm case), the `package` key and the path prefix must be dropped.
This was verified by cloning the package into a temporary Git repository: with
the prefixed tree, `maintainer sync` and `maintainer check` report
`Missing skill: skills/...`; after normalizing to package-relative entries both
commands pass. Do not "fix" one form with the other inside the same checkout.


### Checks recorded

| Check | Result |
| --- | --- |
| `intent validate` / `validate --check` | 3 skill files, all passed; no pending frontmatter migrations |
| `tsc -p tsconfig.json` (`npm run build`, `npm run check:types`) | passed, `dist/` emitted |
| `node dist/cli.js check` | package/skill metadata invariants hold |
| `npm pack --dry-run --json` + `tar -tf` | 20 entries; three `skills/**/SKILL.md` present; `skills/_artifacts`, `src/`, `AGENTS.md`, `.github/`, `.consumer-demo/` absent |
| `intent stale --json` | no version drift; artifacts parse; local package, so no registry fallback |
| `intent maintainer sync` | `Nothing to synchronize.` |
| `intent maintainer check` (repository root, `--artifacts`) | passed: 0 authoring issues, 0 pending review items |
| `intent maintainer check` (inside this package directory) | passed: same result, running from the package directory |
| `npm run check:skills`, `npm run stale` | both exit 0 in the standalone copy |
| Consumer demo (`intent list` / `load` / `exclude add`) | allowlist, load, exclusion and dependency-trust boundary all verified against the packed tarball |

### Why the review was recorded at the repository root

`intent maintainer review` records its baseline and content hashes in
`.intent/review-state.json` at the **Git root**, and that file is keyed to the
comparison it was recorded against. Two consequences here:

1. `packages/relayboard-skills` is not a Git root in this repository, so review
   state written from the package lands at the repository root and covers the
   whole tree, including files this package does not own. `review.ignore` in
   `skill_tree.yaml` narrows unmapped-change noise.
2. In an isolated Git repository containing only this package (verified by
   copying it to a temporary directory and recording
   `maintainer review --unchanged "<evidence>"`), `maintainer check` also passes
   with 0 pending items — so the guidance itself is clean either way.

The record was therefore made **once, at the root, per item** rather than with a
single blanket verdict:

- `intent maintainer review --json > .intent/review.json`
- `node scripts/annotate-intent-review.mjs` — adds `outcome`, `reason` and
  `evidence` to each item, and fails instead of recording if an item has no
  annotation.
- `intent maintainer review --record .intent/review.json` — "Recorded 5 review
  outcome(s)."
- `npm run skills:check` — "0 pending review item(s). Maintainer checks passed."

`review.ignore` gained `scripts/**`, `INTENT.md` and the root manifests because
the repository-level review plumbing itself surfaced as unmapped evidence.

`review.ignore` later gained `.scratch/**` for the same class of reason, found the
day the first port ticket was edited: the local-markdown issue tracker puts the
port spec, the 30 tickets and the shaping reviews under `.scratch/relayboard-app/`,
they are tracked files, and every one of them surfaced as an unmapped change. They
are planning records — intended future behaviour — so no skill cites them, and the
package's own review record cannot be re-recorded for each ticket. The ignore is a
Git glob rather than a file list, so a new spec, ticket or review under `.scratch/`
is silent without a code change.

`.github/workflows/**` followed for the same reason one step later: an app CI
caller (`.github/workflows/app-check.yml`) arrived with the first app guardrail and
surfaced as an unmapped change. Intent's default list ignores the `check-skills.yml`
it generates, at the root only; every other workflow is the same kind of
repository plumbing, and the app's are expected to grow with the port (tickets 02a
and 04c add a Vitest suite and a Playwright route seam). A per-file recorded
review would have to be re-paid on each new workflow and each workflow edit, so
the directory is ignored once instead.

`review.ignore` in `skill_tree.yaml` is now the single source of truth for which
tracked paths are in scope for this package: Intent reads that list directly
(`reviewIgnorePatterns`, then `createReview`'s `isIgnored` skip). The path rules
in `scripts/annotate-intent-review.mjs` — including its `.scratch/` and
`docs/agents/` branch — remain only as a fallback for items Intent still surfaces;
they no longer decide scope. Prefer widening the ignore list over teaching the
script another prefix.

### Remaining gaps

- **CLOSED in Batch 2**: the missing principal read. `readPrincipal` shipped with the
  app's ticket 12, so `relayboard-identity` is loadable and its exclusion was removed.
- Accessibility behaviour is **asserted rather than documented**: `e2e/keyboard.spec.ts`
  and `e2e/geometry.spec.ts` own focus order, the focus ring's colour per surface, the
  live region for arriving entries, and the type and contrast floors. A skill restating
  those assertions would be a second source that drifts, so it is a boundary rather than a
  gap.
- No skill covers the admission cycle (knock → decide → credential) as a developer task.
  It is described inside `relayboard-identity` because the derived/declared split is what
  a developer needs there, but a consumer building the gate itself would look for it
  separately. Recorded as the next batch's candidate rather than as work this one owes.

## Batch 2 — guidance rewritten against the application (15c)

Scope: the same three skills, rewritten because the code they described was replaced. The
port reached parity and the static prototype retired as a reference, so guidance that
documented `window.RelayboardMockAPI`, the `authorId`-bearing `appendMessage` signature and
a `localStorage` store was describing software nobody runs.

What changed, per skill:

- **`relayboard-mock-api`** — the whole surface. It documents `RelayboardClient`'s operation
  vocabulary, the three requirement shapes (and which one a **workspace** permission needs,
  a mistake made twice in this repository), the `Entry` union's four kinds, the refusal
  vocabulary with its check order and its families, the demo-origin boundary with
  `purgeImpact`'s overlap, and the in-memory store's limits. The superseded signature is
  named explicitly so a reader recognises their own stale code.
- **`relayboard-thread-sequencing`** — corrected where it claimed a thread's entries are
  messages, and extended with the third watermark (`acknowledged`) and the carried unread
  rule. Its two surviving rules (order by `seq`; filter by thread) are worded exactly as
  before, which is the evidence that the rewrite was a correction and not a rewrite of the
  parts that were right.
- **`relayboard-identity`** — rewritten against `readPrincipal`, and its **exclusion removed**
  from `apps/relayboard-web/package.json`. Derived and declared are separate fields rather
  than one bag of strings. Every honesty rule was sharpened: the derived fingerprint is
  evidence about this workspace's record and never about the principal's honesty, an absent
  derivation is stated rather than faked, and a credential identifies rather than
  authenticates.

Distribution: the package is repacked and the vendored tarball the app installs was replaced,
because the gates read the source tree and never `vendor/` — without the repack the app keeps
serving the old guidance from a green build.

Review: four outcomes recorded (`updated` for the three skills, `updated` for the planning
records) with source paths at HEAD `7520bd1`. A fresh-consumer task check was **not run** —
this repository has no harness that hands an independent agent a task — and that limitation is
recorded in the review evidence rather than implied away.

## History

- 2026-11-12 — Batch 2: all three skills and their source documents rewritten against the
  application; `relayboard-identity`'s exclusion removed; package repacked; four review
  outcomes recorded.
- 2026-11-10 — Batch 1 created: three skills, three source documents, typed
  TypeScript surface, CI workflow copied from Intent 0.5.6.
- 2026-11-10 — Consumer verification added under `.consumer-demo/`; planning
  records reconciled with the standalone-vs-monorepo path finding.
- 2026-11-10 — First recorded review at the repository root (5 items, each with
  its own outcome). Corrected `docs/identity-provenance.md` (four seeded humans,
  not five) and documented the real constraint that the mock API exposes no
  principal record; added the idempotency-before-validation ordering to the
  mock-api skill; recorded the missing `getPrincipal` endpoint as the blocking
  gap for the identity task.
- 2026-11-10 — `apps/relayboard-web` wired as the first real consumer: tarball
  dependency, allowlist `["@relayboard/skills"]`, `relayboard-identity` excluded
  until a principal read exists. Re-packed the tarball so the published copy
  matches the reviewed guidance.
- 2026-11-11 — `review.ignore` gained `.scratch/**` and `.github/workflows/**`.
  Tracking the first port ticket edit
  (`.scratch/relayboard-app/issues/01-scaffold-to-relayboard-shell.md`) turned the
  gate red with "Review unmapped change"; planning records describe intended
  future behaviour and appear in no `sources` list, so they join `apps/**`,
  `DESIGN.md`, `scripts/**` and the other paths this package does not own. The
  first app CI caller (`.github/workflows/app-check.yml`) then did the same, and
  app workflows are expected to keep arriving. No SKILL.md, `docs/` file,
  `sources` entry or guidance text changed, so nothing needed re-syncing.

