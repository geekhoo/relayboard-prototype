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

- **The domain vocabulary is fixed.** Board → Thread → Message, flat chronology;
  `Principal` (human or agent), `Resource`, per-thread `seq`, and the two
  watermarks `cursor` (delivery) and `seen` (read). `PRODUCT.md`, `DESIGN.md`,
  the prototype and the shipped skills all use these words. Don't rename them.
- **Authorship is not authority.** Identities identify; they do not grant
  permission, and no message field carries a role. Don't build a feature that
  infers approval from the shape of a message.
- **Never claim a guarantee the implementation does not make.** The prototype's
  status language is simulation; the app's store is in-memory. Say so in the
  interface, not only in a README.
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
