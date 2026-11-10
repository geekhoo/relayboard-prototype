# Issue tracker: Local Markdown

Issues and specs for this repo live as markdown files in `.scratch/`.

## Conventions

- One feature per directory: `.scratch/<feature-slug>/`
- The spec is `.scratch/<feature-slug>/spec.md`
- Implementation issues are one file per ticket at `.scratch/<feature-slug>/issues/<NN>-<slug>.md`, numbered from `01`, never a single combined tickets file
- Triage state is recorded as a `Status:` line near the top of each issue file (see `triage-labels.md` for the role strings)
- Comments and conversation history append to the bottom of the file under a `## Comments` heading

## Current contents

- `.scratch/relayboard-app/spec.md` — `/to-spec` output for porting the static
  prototype into `apps/relayboard-web`. Status: `ready-for-agent`. Revision 8.
- `.scratch/relayboard-app/issues/` — `/to-tickets` output, restructured after a
  delivery review and a lead-dev review: **30 tickets**, each a green vertical
  slice that fits one focused session. Twelve keep their original number; the
  nine that were too large are now `02a–c`, `04a–c`, `06a–c`, `07a–b`, `08a–c`,
  `10a–b`, `11a–c`, `13a–b`, `15a–c`. Every ticket is `ready-for-agent` by
  construction.
- `.scratch/relayboard-app/reviews/` — the two reviews that shaped the set, plus
  the sub-issue proposals they came from. Read them when a ticket's reasoning is
  unclear; they cite line numbers.

Work the frontier: a ticket is startable when every ticket named in its
`**Blocked by:**` line is complete. `01` and `02a` have no blockers and can start
immediately, in parallel — but they share `vite.config.ts` and `package.json`, so
take `02a` second if both are claimed the same day.

## When a skill says "publish to the issue tracker"

Create a new file under `.scratch/<feature-slug>/` (creating the directory if needed).

## When a skill says "fetch the relevant ticket"

Read the file at the referenced path. The user will normally pass the path or the issue number directly.

## Wayfinding operations

Used by `/wayfinder`. The **map** is a file with one **child** file per ticket.

- **Map**: `.scratch/<effort>/map.md` (the Notes / Decisions-so-far / Fog body).
- **Child ticket**: `.scratch/<effort>/issues/NN-<slug>.md`, numbered from `01`, with the question in the body. A `Type:` line records the ticket type (`research`/`prototype`/`grilling`/`task`); a `Status:` line records `claimed`/`resolved`.
- **Blocking**: a `Blocked by: NN, NN` line near the top. A ticket is unblocked when every file it lists is `resolved`.
- **Frontier**: scan `.scratch/<effort>/issues/` for files that are open, unblocked, and unclaimed; first by number wins.
- **Claim**: set `Status: claimed` and save before any work.
- **Resolve**: append the answer under an `## Answer` heading, set `Status: resolved`, then append a context pointer (gist + link) to the map's Decisions-so-far in `map.md`.
