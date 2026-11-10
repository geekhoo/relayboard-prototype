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
| `.scratch/relayboard-app/issues/` | The port tickets — **30**, in dependency order. **Work the frontier**: a ticket is startable when every ticket in its `Blocked by` line is done. `01` and `02a` are the only two that can start now. |
| `.scratch/relayboard-app/reviews/` | The two reviews that shaped the ticket set, with line-numbered evidence. |

None of the workspace packaging is required to open the prototype:
`index.html` still runs on its own.

## Commands

Run from the directory named, not the root:

```sh
# apps/relayboard-web
npm run dev          # vite dev on :3000
npm run build        # vite build
npx tsc --noEmit
npm run check        # biome

# packages/relayboard-skills
npm run build        # tsc → dist/
npm run check:types
npm run check:skills # intent validate && intent maintainer check

# repository root
npm run skills:check # the same gate, with the package's artifact path
```

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
- **Order by `seq`, never by `createdAt`.** The seeded data is deliberately
  non-monotonic so an incorrect sort is visible.

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
