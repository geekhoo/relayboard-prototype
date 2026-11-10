# @relayboard/skills skill spec

Coverage, maintainer decisions, check results and batch history for the Agent
Skills shipped by this package. Source evidence for every skill lives in
`docs/` beside `skills/`; the prototype itself is the authoritative behaviour.

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

### Remaining gaps

- No end-to-end client task skill (see `gaps` in `domain_map.yaml`); it needs a
  real consumer, which does not exist yet.
- Prototype accessibility behaviour is documented in the prototype's own
  README/QA and is out of scope for this package.

## History

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

