# 15a: Every behaviour `QA.md` verified, exercised against the app

**From:** 15 — Parity with the prototype, proven and documented

**What to build:** The parity claim becomes a suite. Every behaviour `QA.md` records as verified for the prototype — 64 assertions across 12 scenarios (L9–23) — is exercised against the app through its routes, and the two behaviours that file filed as gaps (L27–28) are exercised as passing features rather than carried forward as limitations. The route-seam harness itself is 04c; this ticket is the cases.

**Blocked by:** 11c — A revoked principal's stream closes, and the demo control stays honest; 12 — A participant's identity, permissions and progress; 13b — Keyboard operation and focus management; 14 — Purge the demo content without touching what you made

**Write scope:** the frozen parity list and the parity specs under `e2e/`.

**Status:** ready-for-agent

- [ ] Each of `QA.md`'s twelve verified scenarios is represented by at least one test, and each of the roughly sixty-four assertions in them is either covered or explicitly listed as not carried across with a one-line reason. The list is enumerated in the ticket or in a companion file, so "covers every behaviour" is countable by a reviewer rather than judged.
- [ ] **The parity list is a file, frozen before ticket 06c**, not a reading of `QA.md` at the time this ticket runs — so this ticket cannot grade its own homework. Each entry says how the prototype's assertion is reinterpreted as an observable of the app, because some of the original assertions name internals the spec forbids.
- [ ] **The frozen list lives at `.scratch/relayboard-app/parity-checklist.md`, and this ticket reuses it rather than writing it**: `QA.md`'s twelve bullets (L11–23) already expanded to one numbered line per assertion, each rewritten as an observable claim at the app's route seam so none of them names a store internal, and frozen on the deadline the criterion above sets — the file is not written here, and every scenario in this suite cites its line in it, so a behaviour the suite skips is an unmatched line a reviewer can see rather than a shorter list written to fit the suite.
- [ ] **The type and contrast floors are asserted here, over real product text**: no functional text below 11px, no body text below 13px, and every text run at AA against its composited background. Ticket 01 can only assert the token set is right. **13a makes the first assertion of the floors**, at its two extremes; this criterion re-asserts them over the full product text rather than introducing them.
- [ ] The suite uses the same method `QA.md` records (L5): real browser, stated viewports (1440×900 and 390×844 at minimum, plus the four layout widths), and a cleared state per scenario. `QA.md`'s "no assertion depends on fonts, colours" rule (L5) holds for the parity scenarios, which reproduce the prototype's behavioural claims; the floors criterion above is the deliberate exception, because a floor is a font and a contrast measurement is a colour pair and neither can be asserted any other way.
- [ ] The suite drives the app only through its routes and its rendered UI — never through internals, module imports, or a direct store call — so a refactor of the UI does not break it (spec L558, L578).
- [ ] The two former gaps are passing tests: in-thread message search is reachable and works at a phone width, and the selected board and thread survive a reload.
- [ ] The scaffold-reconciliation assertions live here as well as in 04c: no starter route resolves, no site header or footer renders, no theme control exists, no `data-theme` or `prefers-color-scheme` override remains, no external font host is contacted, and the body computes to the self-hosted face rather than a fallback (spec L603).
- [ ] Every test starts from a reset store via 06a's hook, and a test that mutates asserts the next test is unaffected. The suite passes when run in a different order and when run alone.
- [ ] The suite fails if any single behaviour is removed — one test per scenario, no aggregate smoke test standing in for several claims.
- [ ] A failure names the behaviour, the viewport and the expected observation, so triage does not need the author.
- [ ] `npm test` and the e2e command are both part of the repository's stated gate, and `AGENTS.md`'s command list is updated to include them.
- [ ] `QA.md`'s honesty section survives: the suite states what it does not exercise (cross-browser, real screen readers, performance, security) rather than implying coverage it does not have.

**Leaves the build green:** yes.
