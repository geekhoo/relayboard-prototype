# 04c: The route seam's harness, which the plan is missing

**From:** 04 — Browse boards and threads at a shareable URL

**What to build:** A Playwright harness that starts the app, drives it through its routes in a real browser, and can assert what a participant sees. This is the third of the spec's four seams (spec L556–558) and **no ticket in the current fifteen stands it up** — yet tickets 01, 06, 13 and 15 all have criteria that cannot be evaluated without it (review §3, hazard H7). It is proposed as a sub-issue of 04 because 04 is the first ticket whose criteria are browser assertions, and because the harness needs nothing 04a and 04b do not already provide.

**Blocked by:** 04b — The thread pane and the rest of the address

**Write scope:** `playwright.config.ts`, `e2e/**`, and **append-only** additions to `biome.json` (its own globs) and `package.json` (its own dependency and script).

**Status:** ready-for-agent

- [ ] Playwright is installed and `npm run e2e` (or equivalent) starts the app on a fixed port, waits for it to be ready, and shuts it down; the suite runs from a clean checkout without a manual server.
- [ ] The harness is configured for one browser project (Chromium), with a trace-on-failure artefact, and a run that fails leaves evidence a developer can read without re-running.
- [ ] The browser context for each test starts from a clean state — no persisted `localStorage` and a fresh server context (or the reset hook, once 06a provides one). Runs do not depend on each other or on their order.
- [ ] Assertions on text use the domain's vocabulary, and assertions on layout use measured overflow (`documentElement.scrollWidth === clientWidth`) rather than pixel snapshots, so a legitimate design change does not fail the suite (spec L558).
- [ ] A helper exists for setting the viewport to an arbitrary width, so the six widths in 13a and the two in `QA.md` L5 are one call each.
- [ ] A helper exists for measuring computed style (font family, font size, contrast pair), so 01's type and contrast floors and 15b's font assertion are expressible.
- [ ] The suite contains at least one passing test that asserts the app renders Relayboard's frame and not the scaffold: the document title is not "TanStack Start Starter", no site header or footer element is present, and `/about` and `/demo/tanstack-query` do not resolve to a starter page. These are the scaffold-reconciliation assertions spec L581 places at this seam; laying them down here means 15a inherits them rather than writing them from scratch.
- [ ] The harness is inside the lint boundary — `biome.json`'s `files.includes` covers the new directory — and `npx tsc --noEmit` passes over it.
- [ ] The route seam's test files are separate from the store and contract seams: no test in this directory imports the store.

**Leaves the build green:** yes. The app is not modified; the addition is tooling and one scaffold assertion that already passes.
