# The port, closed — what it set out to do, what it did, and what it did not finish

**Read this first if you are arriving fresh; the record below is the detail it summarises.**

## What it set out to do

Replace the dependency-free static prototype at the repository root (`index.html`, `app.js`,
`styles.css`) with a real application — a durable, topic-oriented messaging workspace where humans and
independent AI agents converse asynchronously as peers — without losing a single behaviour the prototype
had. The bar was not "looks the same". It was: **every behaviour `QA.md` recorded as verified must be
exercised against the app through its routes**, and the two behaviours that file admitted as gaps must be
fixed rather than carried forward.

That was written down as `.scratch/relayboard-app/spec.md` (the decisions), 30 tickets in dependency order
(the work), and `parity-checklist.md` — 64 assertions across `QA.md`'s 13 bullets, **frozen at `cb0564a`
before the suite that grades it was written**, so the suite could not grade its own homework.

## What it did

**All 30 tickets are implemented and committed.** The application serves every operation the prototype had
and several it could not have: a server-side store two browsers share, server-resolved authorship,
Server-Sent Events with a real cursor and a server-held pause, four kinds of entry in one chronology,
fifteen named permissions with scoped grants, an admission cycle with expiry, revocation and renewal, and a
demo purge that separates what the reader made from what the app seeded.

**307 criteria are ticked and 35 are left open, every one of them with the reason on its own line.** The
gates run green: `check`, `check:styles`, `typecheck`, `npm test` (369 tests), `build`, `check:boot`,
`check:bundle`, and `npm run e2e` (172 tests in 17 files), and `npm run skills:check` plus
`npm run skills:validate` at the root.

**How to read the open boxes: they are the port's own account of itself, not a debt it forgot.** Three
kinds recur, and each is recorded where it happens rather than summarised here:

- **A criterion that was wrong** — false, untestable, or weaker than the check that already existed. Six
  were found and corrected before they were implemented; the corrections are in the criteria themselves,
  with the original wording and the reason kept.
- **A criterion asking for something the app deliberately does not do** — the frame sets `overflow: hidden`
  (13a:14), the stream panel is inline content rather than an overlay (13a:20, 15a:13), the act controls are
  not a dialog (13b:20). Each says which ticket made the decision and what is asserted instead.
- **An assertion that exists nowhere yet** — a behaviour true of the code that no test would notice
  changing. These are the ones worth reading: they are the difference between "done" and "proven".

## The six things it did not finish

Each is a criterion left open, and each names the file that argues it. None is invisible from inside the
app: every one is a claim the app makes that nothing yet checks, or a surface it does not have.

1. **A permission refusal and an absent session are distinguishable on the client, and nothing renders a
   dropped stream.** The classifier now has five families and is on the path (`src/client/http.ts`), but
   `stream-error` reaches `applyStreamEvent`'s default branch and no component consumes it — so a reader
   whose stream has dropped still sees *Live*. Recorded at 11b:20.
2. **A purge announces itself to subscribers that no longer listen.** `announceWorkspaceChange` is called and
   `onWorkspaceChange` has no subscriber anywhere in `src`; the SSE route listens for access endings and
   commits. Recorded at 14:17.
3. **The revocation wire is asserted at no route.** Both ends are tested and the route is not; a browser
   holds a cookie session rather than a revocable credential, which is the same limit that keeps an agent's
   side of the admission cycle out of the browser. Recorded at 11c:20 and 08a:16.
4. **A granted credential changing mid-stream does not reach an open connection.** What is emitted is an
   *access ending*, not a permission change. Recorded at 11c:13.
5. **A simulated entry carries no provenance of its own.** It goes through the real commit path — which is
   the part that matters — and a reader tells it apart from the panel's copy rather than from the entry.
   Recorded at 11c:18.
6. **Two layout claims are asserted by measurement rather than by the property the criterion names**: the
   frame's own clip (13a:14), and column narrowing, which no test compares across widths (13a:23). The
   stream panel's vertical viewport fit is narrowed for the same reason (13a:20, and checklist lines 51–52
   in `e2e/helpers/parity.ts`).

**One more, and it is the one to fix first if you fix anything:** **4 of the 64 frozen parity assertions have
no passing test of the shape the checklist describes.** Two are the checklist's own *not carried* (lines 5
and 32) and two are `blocked-by-the-app` (lines 51 and 52, the stream panel's anchored-overlay geometry).
The other 60 are covered, three of them at another seam. Every one of the four is named with its reason,
and the suite fails if a line goes missing without one. Recorded at 15a:13.

## And what it is worth knowing about the ticket set itself

The tickets are the durable artefact here, not the diffs. Three things were true of them at the end and
were not at the start:

- **Every open box names the ticket or the reason that closes it, on its own line.** A box with no reason is
  a box nobody can act on.
- **The substitutions are in the criteria, not in footnotes.** Where the build differs from what the ticket
  asked, the criterion carries both — so a reader who trusts the checklist is not misled by it.
- **The citations resolve.** `spec.md` gained two lines during the port; the shift rule is written in
  `reviews/sequence-plan.md` §5.21, and a citation was verified by content rather than by arithmetic.

---
# Retiring the static prototype — the carry-across record

**What this is.** The dependency-free prototype at the repository root (`index.html`, `app.js`,
`styles.css`) is retired as a behavioural reference. The application under `apps/relayboard-web`
has reached parity with everything the prototype's `QA.md` recorded, and `e2e/parity.spec.ts`
asserts it against the frozen checklist. **This file states what was carried verbatim, what
changed, and why** — so retiring the prototype is a deliberate act rather than a delete (spec
L628 keeps the deletion itself out of scope), and so a future reader cannot mistake an omission
for a regression.

## Carried across verbatim

- **The domain vocabulary.** Board → Thread → entry; `Principal`, `Resource`, `Artifact`;
  `<verb>:<object>` permissions; per-thread `seq`; the watermarks `cursor`, `seen`,
  `acknowledged`. `GLOSSARY.md` is the record.
- **The visual system.** `DESIGN.md` and its sidecar were normative for the prototype and stayed
  normative for the app: the three depth layers, the 11px label floor and the 13px body floor,
  the one-voice accent rule, the status-dot-plus-word rule, the inset edge, the rounded-square
  avatars against circular status dots, and the four board-mark hues.
- **The seeded workspace**, entry for entry: **three boards, ten threads, 31 entries and seven
  resources**, and the per-principal watermarks — counted from `demo-seed.ts` rather than quoted
  from memory, because a closing document that miscounts the seed is worse than one that does not
  count at all. `demo-seed.ts` transcribes them with the
  prototype's own relative offsets, converted to fixed instants so a test can reason about them.
- **The interaction shape**: a rail, an index pane, a conversation; one flat chronology per
  thread; the composer pinned to the bottom; search over thread titles and latest entries;
  the unread filter; in-thread search; the three board views.
- **The keyboard shortcuts** — `/` and `Ctrl/Cmd + K` focus thread search, `Ctrl/Cmd + Enter`
  sends — including the prototype's `typing` guard, which stops `/` from stealing a slash typed
  into the composer.

## Changed, and why

- **The store is server-side and in memory**, not `localStorage`. The prototype's single
  browser was the whole world; the app has a process that two browsers share, which is what
  makes "two participants, one workspace" a claim worth making. `localStorage` now holds the
  remembered board and thread and nothing else — which is also why the selection survives a
  reload, closing a gap the prototype recorded.
- **Authorship is resolved server-side.** The prototype's `appendMessage({ authorId, … })` let a
  caller say who spoke; no operation in the app takes an author.
- **Delivery is Server-Sent Events with a real cursor.** The prototype's simulated stream
  dispatched events on an internal `EventTarget`; the app serves `/api/stream`, resumes from
  `Last-Event-ID` or `?after=`, and — unlike the prototype — holds the pause **on the server**, so
  a paused reader's cursor genuinely stops and a resume genuinely replays.
- **A thread is a chronology of four kinds of entry**, not a list of messages. Status moves,
  artifacts and acknowledgements take positions in the same sequence. The prototype had only
  messages.
- **Permissions exist.** The prototype had no permission model at all; the app has fifteen named
  permissions, scoped grants, an admission cycle with expiry and revocation, and a
  disabled-with-reason rule for every control a reader may not use.
- **Identity is derived as well as declared.** The prototype's drawer showed both under a heading
  reading "Verified identity" with a hard-coded fingerprint; the app computes the fingerprint from
  a key it holds, shows it under a *derived* heading, and shows what a principal asserts under a
  *declared* one. No admission record means nothing derived, and the panel says so.
- **Demo content can be purged.** The prototype's demo was the only content; the app's is
  demo-origin, separable from what a reader made, and removable with the overlap named first.

## Not carried across

- **The `localStorage` store** (`relayboard-demo-v3`) — replaced by the server's in-memory store.
  Its parity assertion is one of the two the frozen checklist marks *not carried*.
- **The `authorId`-bearing `appendMessage` signature** — superseded by a session-resolved author.
  The shipped skill now says so explicitly, because a reader may still have code written to it.
- **The simulated stream's `CustomEvent` target** — replaced by Server-Sent Events. The
  simulation *control* survives, because a demo needs a way to make an agent appear to speak, but
  it commits a real entry through the real post path and its author is chosen server-side.
- **The theme toggle and the `data-theme` / `prefers-color-scheme` overrides** — one palette, no
  toggle. `e2e/parity.spec.ts` asserts their absence, because a surviving theme control is the
  most visible way a scaffold stays alive.
- **The prototype's People-row geometry** (full width inside a fixed 335px column, pointer
  cursor) — a measurement of that stylesheet, with no requirement behind it in `DESIGN.md`. The
  second of the two *not carried* lines.
- **The prototype's document-level overflow check**, which its own `QA.md` admitted was vacuous
  under `overflow: hidden`. Replaced by a per-scroll-container measurement at six widths.

## What the port left behind, by ticket

Recorded because a closing document that lists only successes is a brochure. Each line is a
place a reader can go to find the decision rather than the diff.

- **Found and fixed inside another ticket's scope, three times.** The gate's `create:board` bound
  read a board-scoped list and disabled the control for the only principal who held the
  permission (09). A created board granted its creator nothing, so a reader could make a room they
  could not speak in (found by 14, fixed with `app.js` L116 as the evidence). A message's
  `references` were stored and never rendered (found by 15a, fixed in `Conversation`). All three
  were values the code held and never surfaced, and none was visible to a unit test.
- **A browser cannot reach an admission.** `admit:agent` needs a human session, and no agent
  credential exists in a browser, so an agent's side of the knock → decide → credential cycle is
  asserted at the contract seam and admissions seam rather than through a page. Recorded in 08b
  and 11c; the parity suite does not claim it.
- **The in-memory transport gives two browsers the same principal.** The HTTP transport gives them
  different ones from a rotating seed set. `VITE_RELAYBOARD_TRANSPORT=memory` therefore *skips*
  the six shared-workspace specs with a stated reason rather than failing them, and the default
  build never sees that variable.
- **The stream panel is inline content**, in the conversation column, not the prototype's
  right-anchored overlay. Two checklist lines (51, 52) could not be met as written for that
  reason; both are recorded as `blocked-by-the-app` in `e2e/helpers/parity.ts` with the tickets
  that decided it.
- **The frame keeps its own `overflow: hidden`**, against 13a's literal wording. A grid of three
  internally-scrolling columns needs its own clip; removing it produced a document overflow at
  every width. What 13a's criterion was protecting is asserted instead: a document-level
  overflow test with the clip temporarily lifted, which proves nothing is concealed.
- **A revoked principal's panel is partially met.** The model marks a revoked principal's access as
  ended and its entries keep their author, and that is asserted at the admissions seam — but the
  participant panel does not *render* the ended state in a browser, because the same credential limit
  as above applies. 12 recorded it as partially met rather than claiming it.
- **No durable storage, no authentication, no agent execution.** Permanent exclusions in
  `PRODUCT.md`, and the interface says so wherever a reader might otherwise assume otherwise: the
  store-lifetime note, the purge dialog, and the session note.

## Records rather than bugs

Two things the port left in a state no ticket owns, recorded here so they are answered rather than
rediscovered. Neither is a defect: both are consequences of decisions made deliberately, and both are
invisible to a reader who has not read this note.

- **The same-status refusal is a string only a test has seen.** Moving a thread to the status it is
  already in is refused with *"This thread is already in that status"*, and that refusal is asserted
  only at the contract seam. The reader's control disables itself in that state, so the sentence is
  never rendered — which is the right behaviour and an unexercised string. If a later ticket makes
  the control always enabled, the copy is ready; until then the assertion is evidence for a path no
  reader takes.
- **`pinned` is carried, rendered and unpinnable.** `Thread.pinned` exists because the seed pins
  exactly one thread and the prototype rendered a pin beside it. No action pins or unpins anything,
  so the seeded pin is the only one that will ever exist, and the field is a label with one possible
  value in practice. Recorded rather than removed: removing it would drop a rendered state the seed
  can produce, and the prototype had the same shape.

## The one operation this record exists to stop you getting wrong

The shipped skills are vendored: the app depends on `file:vendor/relayboard-skills-0.1.0.tgz`,
and every skills gate reads the package's **source tree**. So after any change to the guidance:

```sh
# packages/relayboard-skills
npm pack --pack-destination ../../apps/relayboard-web/vendor

# apps/relayboard-web — name the dependency; a bare `npm install` is not enough
npm install 'file:vendor/relayboard-skills-0.1.0.tgz' --save-exact
```

**Repacking is not installing, and npm will not tell you so.** A `file:` dependency's recorded
`integrity` is over the resolved package rather than the tarball file, so a tarball with a new
shasum at an unchanged path looks unchanged. Measured when this record was written: `npm install`
printed **`up to date`** and left the previous guidance installed — 5218 bytes with zero
`readPrincipal` hits, against a 8319-byte tarball with four. `--force` did not help; deleting
`package-lock.json` did not help; naming the dependency did.

Then verify **against the installed copy**, because that is what a consumer actually loads:

```sh
npx intent list --json                              # three Relayboard skills, exclusions empty
npx intent load @relayboard/skills#relayboard-identity   # the new guidance, not the old
```

This is the same class of failure as the rest of the port: a green gate over the wrong artefact.
`skills:check` was green for the whole time the app was serving the prototype's guidance.

## What a reader should NOT read into this

Parity is with **what `QA.md` verified**, which was 64 assertions of behaviour, not with every
implementation detail. The prototype remains useful as a reference for the interaction model; it
is no longer the thing to code against, and `QA.md` now records the app.
