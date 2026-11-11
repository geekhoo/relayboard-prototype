# 04c: The route seam's harness, which the plan is missing

**From:** 04 — Browse boards and threads at a shareable URL

**What to build:** A Playwright harness that starts the app, drives it through its routes in a real browser, and can assert what a participant sees. This is the third of the spec's four seams (spec L564–582) and **no ticket in the current fifteen stands it up** — yet tickets 01, 06, 13 and 15 all have criteria that cannot be evaluated without it (review §3, hazard H7). It is proposed as a sub-issue of 04 because 04 is the first ticket whose criteria are browser assertions, and because the harness needs nothing 04a and 04b do not already provide.

**Blocked by:** 04b — The thread pane and the rest of the address

**Write scope:** `playwright.config.ts`, `e2e/**`, and **append-only** additions to `biome.json` (its own globs) and `package.json` (its own dependency and script).

**Status:** done — verified, see `## Comments`

- [x] Playwright is installed and `npm run e2e` (or equivalent) starts the app on a fixed port, waits for it to be ready, and shuts it down; the suite runs from a clean checkout without a manual server.
- [x] The harness is configured for one browser project (Chromium), with a trace-on-failure artefact, and a run that fails leaves evidence a developer can read without re-running.
- [x] The browser context for each test starts from a clean state — no persisted `localStorage` and a fresh server context (or the reset hook, once 06a provides one). Runs do not depend on each other or on their order.
- [x] Assertions on text use the domain's vocabulary, and assertions on layout use measured overflow on each visible scroll container (`scrollWidth <= clientWidth + 1`) rather than pixel snapshots, so a legitimate design change does not fail the suite (spec L582). The helper must not measure `documentElement.scrollWidth === clientWidth`: that is true under `overflow: hidden`, which the frame may set, so a document-level measurement would make 13a's headline criterion vacuous. **The helper measures extent as well as overflow, and the two are separate calls**: `measureOverflow(container)` returns the scroll dimensions that prove content fits, and `measureExtent(surface)` returns the surface's rect and its computed background so a caller can assert that a painted surface covers its own track. Both are needed because they fail differently — a rail 221px tall in a 900px column passes every overflow assertion and fails extent.
- [x] A helper exists for setting the viewport to an arbitrary width, so the six widths in 13a and the two in `QA.md` L5 are one call each.
- [x] A helper exists for measuring computed style (font family, font size, contrast pair), so 01's type and contrast floors and 15b's font assertion are expressible.
- [x] The suite contains at least one passing test that asserts the app renders Relayboard's frame and not the scaffold: the document title is not "TanStack Start Starter", no site header or footer element is present, and `/about` and `/demo/tanstack-query` do not resolve to a starter page. These are the scaffold-reconciliation assertions spec L605 places at this seam; laying them down here means 15a inherits them rather than writing them from scratch.
- [x] The harness is inside the lint boundary — `biome.json`'s `files.includes` covers the new directory — and `npx tsc --noEmit` passes over it.
- [x] The route seam's test files are separate from the store and contract seams: no test in this directory imports the store.

**Leaves the build green:** yes. The app is not modified; the addition is tooling and one scaffold assertion that already passes.
## Comments

**Implemented and verified** at `232160c`. Playwright drives the built server in Chromium, and every
assertion in the suite is a browser measurement rather than a snapshot.

**The harness exists because it was hand-written five times.** Spawn Chrome, poll `/json/version`, open a
WebSocket, correlate requests by id, set device metrics, dispatch key events — a throwaway each time, and
the same four things wrong each time, all of which are Playwright's defaults: waiting for the app to be
interactive rather than sleeping, a keystroke that reaches a focused control, a readable trace after a
failure, and a fresh browser context per test. The strongest evidence a harness should exist is that it
kept being rewritten.

**`measureOverflow` and `measureExtent` are separate calls, and the reason is a defect this repo shipped.**
The board rail's `<nav>` rendered 240×221 inside a 240×900 column: the dark surface stopped a third of the
way down and the rest of the column was white. It passed **every** overflow assertion, because content
that fits its own box overflows nothing. A single `assertFits()` checking both would have passed it and
reported the failure against the wrong property. So overflow answers "does the content fit", extent
answers "does the painted surface cover the track", and each failure message says which one broke.
`e2e/layout.spec.ts` proves both instruments can fail by injecting each defect and requiring the
measurement to notice — the positive controls are the point, not decoration.

**Extent needed an axis, and finding that out changed the helper.** The first version measured the pane
against the frame and reported a 1104px shortfall, which is not a defect: columns divide a frame
horizontally. Below 980px the pane and conversation are rows by design, where the correct assertion is
that the rows sum to the frame's height rather than that either one matches it. Both are expressed, as
`ExtentAxis`.

**The document element is refused, not discouraged.** `measureOverflow(body)` throws and names what to
pass instead, because `documentElement.scrollWidth === clientWidth` is satisfied **by** `overflow: hidden`
— the vacuity `QA.md` recorded about the prototype, and the reason 13a's headline criterion needs
per-container measurement.

**The reset hook's id is read from the build, never written down.** It is 64 hex characters; the first
version of `helpers/workspace.ts` carried a truncated copy, and the server's answer was
`Server function info not found for <id>` with HTTP 500 — which reads exactly like "the reset function is
not in this build" and blames the app rather than the harness. The id is now read from the built server's
function manifest, requiring exactly one match and throwing with the count otherwise.

**The seam-boundary guard passed a deliberate violation twice before it bit.** One version's regex escapes
collapsed; the next compared `#/server/store` exactly, so the realistic `#/server/store/instance` passed;
the version after that failed on a clean tree by matching its own explanatory comment. It now strips
comments, extracts every specifier and compares by path root — and it asserts the same rule 04a's Biome
override enforces, at a different seam.

**What is deliberately not here.** `e2e` is not in `npm test` and not in `app:check`: the first is the
hermetic Node suite, the second the fast gate run constantly, and a browser download inside either makes
every iteration worse. Both scripts state that. In CI the harness runs against the build earlier steps
already asserted (`RELAYBOARD_E2E_REUSE_BUILD=1`), fails loudly if that build is absent rather than
quietly rebuilding, and never adopts a stale server on the port.
