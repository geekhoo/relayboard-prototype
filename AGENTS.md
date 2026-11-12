# AGENTS.md

Relayboard — a durable, topic-oriented messaging workspace where humans and
independent AI agents converse asynchronously as peers.

This file is the repository-wide entry point. It records where work lives, how
to run things, and the conventions the engineering skills read. Subdirectory
`AGENTS.md` files add more specific rules and take precedence for work under
them.

## Layout

| Path | What it is |
| --- | --- |
| `apps/relayboard-web` | The TanStack Start application — the product going forward. Has its own `AGENTS.md`. |
| `packages/relayboard-skills` | `@relayboard/skills` — Agent Skills for the prototype, discovered through TanStack Intent. Has its own `AGENTS.md`. |
| `index.html`, `styles.css`, `app.js` | The dependency-free static prototype. Behavioural reference for the app; retired only once the app reaches parity. |
| `PRODUCT.md` | Product truth: users, purpose, positioning, permanent exclusions. |
| `DESIGN.md` | The normative visual system and its tokens. `.impeccable/design.json` is its sidecar. |
| `QA.md` | The recorded, reproducible verification pass for the prototype. |
| `INTENT.md` | How the agent skills are authored, validated and consumed. |
| `.scratch/relayboard-app/spec.md` | The port spec: what the app must become, and every decision behind it. |
| `.scratch/relayboard-app/issues/` | The tickets, in dependency order: the port batch, then the fix batch the implementation review produced. **Work the frontier**: a ticket is startable when every ticket in its `Blocked by` line is done. See `docs/agents/issue-tracker.md` for the current state rather than a count here. |
| `.scratch/relayboard-app/reviews/` | The reviews: three that shaped the port ticket set, three from the implementation panel, the synthesis that deduplicates them, and the retro on the port's environment. |

None of the workspace packaging is required to open the prototype:
`index.html` still runs on its own.

## Commands

Run from the directory named, not the root:

```sh
# apps/relayboard-web
npm run dev          # vite dev on :3000
npm run build        # vite build; writes .output/nitro.json
npm run start        # serve the build (node-server preset)
npm run check        # biome
npm run typecheck    # tsc --noEmit
npm run check:styles # no colour literal outside the token block; no clipped frame
npm test             # vitest: the unit, domain and contract seams
npm run e2e          # playwright: the route seam, against the built server
npm run check:boot   # the built server refuses to *serve* without a usable SESSION_SECRET
                     # (the process listens; the first request fails, naming the variable)
npm run check:bundle # no server-only string reaches a client asset

# packages/relayboard-skills
npm run build        # tsc → dist/
npm run check:types
npm run check:skills # intent validate && intent maintainer check

# repository root
npm run skills:check # the same gate, with the package's artifact path
npm run app:check    # the app's check + typecheck + build, without cd
```

`.github/workflows/app-check.yml` runs every gate above — check, styles, typecheck, `npm test`,
build, boot, bundle and `npm run e2e` — on every pull request, and then asserts the build is
still `node-server`, so a serverless build fails there rather than at runtime.

**`npm test` and `npm run e2e` are part of the gate, not optional extras.** The unit suite covers
the domain, the store and the client contract; the route seam covers what only a browser can
observe — the rendered chronology, the watermarks, the geometry at six widths, the focus contract
and `e2e/parity.spec.ts`, which exercises every behaviour `QA.md` verified for the prototype. A
ticket is not done until all of them pass.

## Conventions

- **The domain vocabulary is fixed.** Board → Thread → **entry**, flat chronology;
  `Principal` (human or agent), `Resource`, `Artifact`, a named permission
  `<verb>:<object>`, per-thread `seq`, and the three watermarks: `cursor`
  (received), `seen` (read) and `acknowledged`. `PRODUCT.md`, `DESIGN.md`, the
  prototype, the port spec and the shipped skills all use these words. Don't
  rename them.
- **`kind` is a label, not a capability.** `human` or `agent` describes who is
  speaking. What a principal may do comes from a permission grant, so a human can
  hold less than an agent and an agent more than a human. `kind` is load-bearing
  in exactly one place: `admit:agent` and `revoke:agent` may only be granted to a
  human. Any other branch on `kind` is a bug.
- **Authorship is not authority.** An authored act records that a principal acted
  at a position; it never records that the act was permitted, correct, agreed
  with, or binding. This holds twice over for agents: being admitted grants
  nothing, and holding more permissions than a human makes an agent no more of an
  authority. Don't build a feature that infers approval from who wrote something.
- **A resource is canonical; an artifact points at it.** Never copy a resource's
  content into a thread. Two threads attaching one resource mean two artifact
  entries and one resource.
- **Never claim a guarantee the implementation does not make.** The store is
  in-memory, a credential identifies rather than authenticates, and the demo seed
  is demo-origin and purgable. Say so in the interface, not only in a README.
- **Order by `seq`, never by `createdAt`.** The seed contains at least one thread
  whose `createdAt` values run against its `seq`, so a sort by timestamp is visibly
  wrong. That thread is an addition the app's seed makes, not a property inherited
  from the prototype: the prototype's own threads are strictly decreasing in `ago()`,
  so a timestamp sort inside one of them happens to agree with `seq`.

## Agent skills

### Issue tracker

Issues and specs live as markdown files under `.scratch/<feature>/` in this repo.
See `docs/agents/issue-tracker.md`.

### Triage labels

The five canonical triage roles, each label string equal to its role name. See
`docs/agents/triage-labels.md`.

### Domain docs

Single-context: one `GLOSSARY.md` at the repo root plus `docs/adr/`. See
`docs/agents/domain.md`.
