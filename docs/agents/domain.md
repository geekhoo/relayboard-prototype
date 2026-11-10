# Domain Docs

How the engineering skills should consume this repo's domain documentation when exploring the codebase.

**Layout: single-context.** One `GLOSSARY.md` at the repo root plus `docs/adr/`,
even though the repository holds three packages. They share one domain
vocabulary — the prototype, `apps/relayboard-web` and `packages/relayboard-skills`
all speak in Board / Thread / Message / Principal / `seq`, so splitting the
glossary per package would create three copies of the same terms that could
drift apart.

## Before exploring, read these

- **`GLOSSARY.md`** at the repo root.
- **`docs/adr/`**: read ADRs that touch the area you're about to work in.

`PRODUCT.md` is not a domain doc in this sense — it is product truth (who the
users are, what the product is for, what is deliberately excluded). Read it
alongside the glossary when a decision depends on positioning rather than
vocabulary. `DESIGN.md` is the visual system and is normative for anything that
renders.

If any of these files don't exist, **proceed silently**. Don't flag their absence; don't suggest creating them upfront. The `/domain-modeling` skill (reached via `/grill-with-docs` and `/improve-codebase-architecture`) creates them lazily when terms or decisions actually get resolved.

## File structure

```
/
├── GLOSSARY.md
├── docs/adr/
│   ├── 0001-<decision>.md
│   └── 0002-<decision>.md
├── apps/relayboard-web/       ← shares the root glossary
└── packages/relayboard-skills/ ← shares the root glossary
```

## Use the glossary's vocabulary

When your output names a domain concept (in an issue title, a refactor proposal, a hypothesis, a test name), use the term as defined in `GLOSSARY.md`. Don't drift to synonyms the glossary explicitly avoids.

If the concept you need isn't in the glossary yet, that's a signal: either you're inventing language the project doesn't use (reconsider) or there's a real gap (note it for `/domain-modeling`).

## Flag ADR conflicts

If your output contradicts an existing ADR, surface it explicitly rather than silently overriding:

> _Contradicts ADR-0007 (in-memory store), but worth reopening because…_
