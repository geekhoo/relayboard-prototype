# Issue tracker: Local Markdown

Issues and specs for this repo live as markdown files in `.scratch/`.

## Conventions

- One feature per directory: `.scratch/<feature-slug>/`
- The spec is `.scratch/<feature-slug>/spec.md`
- Implementation issues are one file per ticket at `.scratch/<feature-slug>/issues/<NN>-<slug>.md`, numbered from `01`, never a single combined tickets file
- Triage state is recorded as a `Status:` line near the top of each issue file (see `triage-labels.md` for the role strings)
- Comments and conversation history append to the bottom of the file under a `## Comments` heading

## Current contents

Counts are deliberately absent: a hard number in a steering file is stale the day
the frontier moves. List the directory instead.

| Artefact | What it is | Status |
| --- | --- | --- |
| `spec.md` | `/to-spec` output: what the app must become, and the decisions behind it | Revision 8, closed out |
| `issues/01`–`15c` | the port tickets — the build that reached parity | Complete |
| `parity-checklist.md` | `QA.md`'s 64 prototype assertions, frozen and rewritten as app observables | Frozen at `cb0564a`; do not edit to fit a suite |
| `issues/16`–`31` | the fix tickets, from the implementation review | `16`–`30` `ready-for-agent`; `31` `wontfix` |
| `reviews/lead-dev-review.md`, `pm-review.md`, `sequence-plan.md` | the reviews that shaped the port ticket set | Historical; cite when a port ticket's reasoning is unclear |
| `reviews/implementation-*.md` (three) | the implementation panel: security, architecture, product/UX, with line-numbered evidence | Current evidence; `implementation-review-synthesis.md` is the deduplicated spine and the fix order |
| `reviews/retro-environment.md` | the retro on the port: which findings a check could have caught | Current; it is what the fix batch and the environment checks came from |

Start from `implementation-review-synthesis.md` rather than the three panel reports:
they overlap, and the synthesis names which findings are the same defect.

Work the frontier: a ticket is startable when every ticket named in its
`**Blocked by:**` line is complete. Read the ticket file's own `Blocked by:` line
rather than trusting a summary of the graph.

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
