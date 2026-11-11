# Validation

This record covers the **application** at `apps/relayboard-web`, and it replaces the prototype record that
stood here. The history matters and is kept: the behaviour this app must reproduce was verified against
the dependency-free static prototype at the repository root, and `.scratch/relayboard-app/parity-checklist.md`
froze those 64 assertions, each rewritten as a claim about this app at its own route seam. Ticket 15a
built the suite that asserts them; this file records the run.

**Method:** Playwright 1.65.0 driving **Chromium** against the **built** server (`npm run build`, then
`node .output/server/index.mjs` on port 3218 with `RELAYBOARD_TEST_MODE=1`), not the dev server. Two
defects this project found were visible only in a build: a server-rendered false first paint, and a
module-scope throw that shipped into the client bundle and left every control inert. Viewports:
**1440x900** and **390x844**, plus **320x700**, **680x900**, **980x900** and **1200x900** for the layout
checks, all six named once in `e2e/helpers/layout.ts` so no two suites can drift into seven sets of
numbers. Every test starts from a reset workspace through 06a's hook (the fixture makes that
unconditional rather than a habit each file remembers) and a fresh browser context, and
`e2e/isolation.spec.ts` asserts the reset's effect rather than assuming it.

**Suite:** `npm run e2e` — **172 tests in 17 files**. The parity scenarios are `e2e/parity.spec.ts`,
where every test title begins `parity N:` and N is the number of the line in the frozen checklist it
asserts. `e2e/helpers/parity.ts` holds all 64 lines as data, and three tests in that file make the
coverage countable rather than judged: the 64 numbers are present exactly once each, every line that is
not `covered` carries a reason, and every claimed test title exists verbatim in the spec. Proven to bite —
renumbering one line fails the first, and renaming one test fails the second.

## Verified

**60 of the frozen checklist's 64 assertions pass** (57 asserted by this suite and 3 at the contract seam, cited in the data file with the file that owns each), across the 13 bullets the prototype recorded
(`QA.md`'s original file said "12 scenarios" because its two stream-pause bullets were run as one; the
checklist counts the bullets, so 64 across 13 is the number to quote). Two are not carried across and
two more could not be met as written; all four are listed below with reasons rather than dropped, and
the checklist file itself was not edited to fit the suite.

What the parity suite asserts, by scenario:

- **Initial load** — the address names the open thread and the title is that thread's; nine entries each
  with its own position; the rendered positions are `#1`..`#9` with no gap and no repeat; the stated
  entry count matches the entries rendered. *(The prototype's `relayboard-demo-v3` storage key is not
  carried: this app has no `localStorage` store.)*
- **Posting** — one new entry and a count that rises by one; the next position, not a reused one; the
  composer clears and Send returns to disabled; Send is disabled while the draft is empty or whitespace;
  the committed text is the typed text, trimmed.
- **Pause, simulate, replay** — the indicator starts connected and offers pausing; pausing flips the word
  and offers resuming; one entry committed while paused reads as a pending count of one; resuming renders
  the withheld entry and returns the indicator to connected. *(The cursor values themselves are asserted
  at the contract seam, where the watermark is observable; this suite asserts what a reader sees.)*
- **Board, thread, post** — creating a board adds a rail row, opens it and shows its empty state; an empty
  board's state names the next action; a new thread is one row holding nothing; its first entry is `#1`
  and the stated count is one; and board, thread and entry survive a reload **with the thread still open**
  — the line where this app is deliberately the opposite of the prototype, whose selection reset on
  reload was recorded as a gap.
- **Resources** — the seeded resources are listed with names and URLs; adding one renders a row that
  survives a re-read; a non-HTTP URL is refused with a reason and stores nothing while the surface stays
  open; a malformed URL is refused **by the app's own validator**; and a resource referenced in a thread
  renders a safe external link (`target="_blank"`, `rel="noopener noreferrer"`).
- **Board views** — a bare board URL renders threads with that view marked selected; resources and people
  render and mark themselves; returning to threads renders the same list; a person row opens that
  principal's panel; and the row exposes exactly one activation rather than the prototype's two.
- **Search and the unread filter** — a term narrows the list; a zero-result state reads differently from
  an empty board; clearing restores every thread; and the unread filter narrows from the **`seen`
  watermark**, exposes `aria-pressed`, and clears.
- **Keyboard** — `/`, `Ctrl+K` and `Cmd/Meta+K` all focus thread search; a `/` typed in the composer stays
  text and keeps the draft; `Ctrl+Enter` and `Cmd/Meta+Enter` both post.
- **Horizontal overflow** — measured **per scroll container**, never on `documentElement`. At 1440 in the
  thread view, in People and Resources, and with the stream panel; at 390 for the thread list, the
  conversation, the rail as an overlay drawer and the resources view; at 320 for the thread list, the
  conversation and a usable composer.
- **The stream panel's geometry** — inside the viewport horizontally at all six widths; the connection
  indicator is inside it and visible; it never overlaps the composer at any width; and its controls are
  operable while it is open.
- **Supporting paths** — thread details state the entry count and the last position; a participant's panel
  distinguishes derived from declared and says plainly when this workspace derived nothing; in-thread
  search narrows, shows zero matches and restores; sending works at 390; in-thread search is reachable
  below 680px; and at 320 nothing overflows and the composer is usable.
- **No errors** — a walk of every scenario route produces no `pageerror`, no error-level console entry,
  and no unprovoked HTTP response >= 400. *(Suite-level conditions: a Playwright test cannot observe a
  sibling test's console, so the walk is the closest honest equivalent and is stated as such.)*

Asserted beyond the checklist, because a port has obligations the prototype could not have:

- **The type and contrast floors, over real product text.** No text computes below 11px, body copy stays
  at or above 13px, and every text run meets WCAG AA (4.5:1) against the surface it is actually painted
  on — resolved from the browser's computed colours, not from a token. This is the one deliberate
  exception to the prototype's "no assertion depends on fonts or colours" rule: a floor **is** a font
  size and a contrast measurement **is** a colour pair, and neither can be asserted any other way.
- **The app is not the scaffold.** No starter route resolves to starter content, there is no site header
  or footer, no theme control and no `data-theme`, the body computes to the self-hosted IBM Plex Sans
  rather than a generic fallback, and the walk contacts no external host.

## Not carried across (2)

- **The prototype's `relayboard-demo-v3` storage key.** This app has no `localStorage` store; `spec L505`
  leaves `localStorage` holding only a remembered location. Its equivalent facts are that the workspace
  opens with the demo seed and that the store is in-memory for the process, both of which are asserted
  elsewhere. Asserting a storage key would assert the prototype's mechanism rather than the product's
  behaviour.
- **The prototype's People-row geometry** (full-width inside a fixed 335px list, `cursor: pointer`).
  That is a measurement of its own stylesheet with no requirement behind it in `DESIGN.md`, and these
  column widths are not the prototype's. The behavioural parts — the list, the row opening the panel,
  one activation — are asserted.

## Could not be met as written (2)

- **Checklist line 51** asks that the stream panel's rect be inside the viewport vertically at all six
  widths. The panel is **inline content in the conversation column**, not an overlay: it scrolls with its
  column, so a viewport-fitting vertical claim would force a panel the product does not want. The
  horizontal fit is asserted at every width, and the vertical claims that are true of it — the indicator
  inside it, no overlap with the composer — are asserted too.
- **Checklist line 52** asks that the panel be anchored to the right edge with a 25px gap on desktop and
  10px below 680px. There is no anchored panel to measure; the same decision as line 51. Wrapping the
  stream state in a fixed-position box to satisfy a geometry assertion would be building the prototype's
  chrome rather than this product.

Both are recorded in `e2e/helpers/parity.ts` as `blocked-by-the-app`, naming the tickets (11b, 13a) whose
decisions made them unmeetable, so a reviewer can disagree with those decisions rather than wonder at two
missing numbers.

## Not verified

Re-derived rather than copied, because the previous list described a prototype with different gaps. **The
two gaps that list recorded are closed in this app and are asserted as passing features:** the selected
board and thread survive a reload (the address names them), and in-thread message search is reachable at
every width including below 680px.

What still is not verified, stated so nothing here implies coverage it does not have:

- **Cross-browser.** Chromium only. Firefox, Safari and real iOS/Android browsers are untested, and no
  engine-specific CSS is asserted.
- **Real assistive technology.** Focus order, focus rings, live-region announcements and heading structure
  are asserted through the DOM and computed styles; no screen reader (NVDA, JAWS, VoiceOver, TalkBack) was
  run, and nothing here constitutes a WCAG audit or an accessibility certification.
- **Performance and load.** No measurement of time to interactive, bundle size beyond the client-asset
  string check, frame rate, or behaviour under many concurrent readers. No load test.
- **Security.** No penetration testing, no CSRF or XSS audit beyond the two structural rules the suite
  does assert (no server-only string reaches a client asset, and a resource link is `noopener`), and no
  review of the session cookie's handling. A credential here identifies rather than authenticates, by
  design, and that is a scope decision rather than a security claim.
- **Touch and gestures.** Viewports are set, but no touch interaction is dispatched.
- **Real multi-device sync.** Two browser contexts in one process are asserted (one workspace, two
  participants); two processes, two devices and reconnection across a restart are not.

**Limitations:** the store is **in-memory**, so a restart clears the workspace; the interface says so where
a destructive act is confirmed. A credential **identifies** rather than authenticates — anyone holding this
browser's cookie acts as that principal. The demo seed is **demo-origin and purgable**, and a purge is
reversible only until the process restarts. Authorship is recorded and never confers authority. None of
this is a production delivery guarantee: the stream demonstrates a delivery contract, not broker semantics.
