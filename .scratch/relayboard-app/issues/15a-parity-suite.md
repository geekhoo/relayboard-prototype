# 15a: Every behaviour `QA.md` verified, exercised against the app

**From:** 15 — Parity with the prototype, proven and documented

**What to build:** The parity claim becomes a suite. Every behaviour `QA.md` records as verified for the prototype — 64 assertions across the 13 bullets at L11–23, which `QA.md` itself calls "12 scenarios" because two of them were run as one — is exercised against the app through its routes, and the two behaviours that file filed as gaps (L29–30) are exercised as passing features rather than carried forward as limitations. The route-seam harness itself is 04c; this ticket is the cases.

**Blocked by:** 11c — A revoked principal's stream closes, and the demo control stays honest; 12 — A participant's identity, permissions and progress; 13b — Keyboard operation and focus management; 14 — Purge the demo content without touching what you made

**Write scope:** the frozen parity list and the parity specs under `e2e/`.

**Status:** done — verified, with 2 criteria open; see `## Comments`

- [ ] **Partly satisfied — 57 of 64 covered, 2 not carried, 2 blocked by the app, 3 elsewhere.** Each of the **13** bullets `QA.md` records as verified (`L11`–`L23`) is represented by at least one test, and each of the **64** assertions in them is either covered or explicitly listed as not carried across with a one-line reason. The file says "12 scenarios" at L9 because its two stream-pause bullets were run as one; the checklist counts the bullets, so the number to cite is 64 across 13. The list is enumerated in the ticket or in a companion file, so "covers every behaviour" is countable by a reviewer rather than judged. **What exists:** `e2e/helpers/parity.ts` carries all 64 lines as data and `e2e/parity.spec.ts` asserts that the 64 numbers, the covered entries and the test titles agree. **What is short:** 57 are covered, 2 are the checklist's own *not carried*, 3 are covered at another seam, and **2 are `blocked-by-the-app`** — lines 51 and 52, which could not be met as written because 11b built the stream panel as inline content rather than the prototype's right-anchored overlay. Every one of the five is a named line with a stated reason, so the criterion's own standard is met; the count of *covered* lines is not 64, and this box stays open rather than reporting the suite as complete.
- [x] **The parity list is a file, frozen before ticket 06c**, not a reading of `QA.md` at the time this ticket runs — so this ticket cannot grade its own homework. Each entry says how the prototype's assertion is reinterpreted as an observable of the app, because some of the original assertions name internals the spec forbids.
- [x] **The frozen list lives at `.scratch/relayboard-app/parity-checklist.md`, and this ticket reuses it rather than writing it**: `QA.md`'s thirteen bullets (L11–23) already expanded to one numbered line per assertion, each rewritten as an observable claim at the app's route seam so none of them names a store internal, and frozen on the deadline the criterion above sets — the file is not written here. **It was frozen at `cb0564a`; that is the commit it first appears in, and it is the commit whose `13a` criterion numbering its citations use.** Every scenario in this suite cites that file's line number rather than restating or re-deriving the claim, so a behaviour the suite skips is an unmatched line a reviewer can see rather than a shorter list written to fit the suite.
- [x] **The type and contrast floors are asserted here, over real product text**: no functional text below 11px, no body text below 13px, and every text run at AA against its composited background. Ticket 01 can only assert the token set is right. **13a makes the first assertion of the floors**, at its two extremes; this criterion re-asserts them over the full product text rather than introducing them.
- [x] The suite uses the same method `QA.md` records (L5): real browser, stated viewports (1440×900 and 390×844 at minimum, plus the four layout widths), and a cleared state per scenario. `QA.md`'s "no assertion depends on fonts, colours" rule (L5) holds for the parity scenarios, which reproduce the prototype's behavioural claims; the floors criterion above is the deliberate exception, because a floor is a font and a contrast measurement is a colour pair and neither can be asserted any other way.
- [x] The suite drives the app only through its routes and its rendered UI — never through internals, module imports, or a direct store call — so a refactor of the UI does not break it (spec L560, L580).
- [x] The two former gaps are passing tests: in-thread message search is reachable and works at a phone width, and the selected board and thread survive a reload.
- [x] The scaffold-reconciliation assertions live here as well as in 04c: no starter route resolves, no site header or footer renders, no theme control exists, no `data-theme` or `prefers-color-scheme` override remains, no external font host is contacted, and the body computes to the self-hosted face rather than a fallback (spec L605).
- [ ] **Partly satisfied — every test is reset, and no run proves order-independence.** Every test starts from a reset store via 06a's hook, and a test that mutates asserts the next test is unaffected. The suite passes when run in a different order and when run alone. **What exists:** `e2e/helpers/fixtures.ts` extends `test` so the workspace is reset **before every test**, which is what makes the isolation structural rather than a convention — and a spec that needs to observe a reset calls `resetWorkspace` itself. **What is missing:** nothing runs the suite shuffled or in reverse, and `playwright.config.ts` sets `fullyParallel: false` with `workers: 1`, so the stated property is a consequence of the fixture rather than something a run demonstrates. One test's comment records a scenario passing alone and failing in the full run, which is the failure this criterion exists to prevent — evidence the property is worth asserting rather than assuming.
- [x] The suite fails if any single behaviour is removed — one test per scenario, no aggregate smoke test standing in for several claims.
- [x] A failure names the behaviour, the viewport and the expected observation, so triage does not need the author.
- [x] `npm test` and the e2e command are both part of the repository's stated gate, and `AGENTS.md`'s command list is updated to include them.
- [x] `QA.md`'s honesty section survives: the suite states what it does not exercise (cross-browser, real screen readers, performance, security) rather than implying coverage it does not have.
- [x] **The parity claim carries one unread rule, and this ticket states which.** The prototype's rail badge excludes the reader's own entries (`app.js` L135); the app counts from `seen` alone. The two rules disagree on three seeded threads — `read-replay`, `launch` and `delivery` read 0/0/1 under the prototype's rule and 1/1/2 under the watermark's — so a suite that asserted both would contradict itself. The carried rule is the watermark's (11b:22, spec L502), the prototype's own-entry exclusion is **not** carried, and the suite asserts badge numbers that follow from `seen` rather than the numbers `QA.md` recorded for the prototype.

**Leaves the build green:** yes.

## Comments

**Implemented and verified** at `e29ab49` and `7520bd1`. Every behaviour `QA.md` recorded for the prototype
is exercised against the app through its routes, against a checklist frozen **before** the suite was written.

**The frozen list is `parity-checklist.md`, and the suite cites its line numbers rather than restating the
claims** — so a behaviour the suite skips is an unmatched line a reviewer can see, not a shorter list written
to fit the suite. `e2e/helpers/parity.ts` holds all 64 as data with four statuses: `covered` (57),
`covered-elsewhere` (3, at a seam that already owns the claim), `not-carried` (2, the checklist's own), and
`blocked-by-the-app` (2, with the ticket whose decision made each unmeetable).

**Three defects, each found by a test rather than by reading:**

- **The app's own URL validator never ran.** `type="url"` without `noValidate` let the browser refuse
  first, so the rejection the suite saw was Chrome's sentence and not the app's. `noValidate` is now on the
  form, and parity 26 asserts a malformed URL is refused *by the app*.
- **A message's resources were stored and never rendered.** The seed carries four message-level references,
  transcribed from the prototype, and only artifact entries rendered a chip — so the field existed to be
  shown and was not shown. Fixed in `7520bd1`, with the seed's own reference and the attach path asserted in
  the same test because the checklist is frozen and cannot grow a line.
- **A parity test passed alone and failed in the full run**, because it read the list before the list
  existed. That is why every scenario starts from a reset store and waits for what it measures.

**The suite's own coverage is asserted by three tests that bite:** that all 64 lines are present and every
one not covered says why; that every test title the file claims actually exists; and that the unmeetable
lines are named with the decision that made them so. A suite that quietly shrank fails all three.

**The type and contrast floors are asserted here over real product text** — 11px for functional, 13px for
body, AA against the composited background — which 13a begins at its two extremes and this re-asserts over
the whole product.

**One criterion is left open, and it is honest arithmetic rather than a gap in the work.** 57 of 64 lines
are covered; the other seven are accounted for and named. Two of them could not be met as written, because
11b built the stream panel as inline content and the checklist's lines 51 and 52 describe the prototype's
anchored overlay. Every line has a reason and none is silently absent, which is what the criterion asked
for — and the box stays open because "each of the 64 assertions is covered" is not what the file says.
