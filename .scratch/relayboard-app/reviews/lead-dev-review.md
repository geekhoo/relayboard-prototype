# Lead-dev review of tickets 01–15

**Reviewer:** lead-dev-reviewer (delegated)
**Scope:** `.scratch/relayboard-app/issues/01-*.md` … `15-*.md`, sized against `.scratch/relayboard-app/spec.md` (revision 7) and the target codebase `apps/relayboard-web`.
**Not in scope:** whether the spec is right. This review only asks "can one engineer finish this in one focused session, and if not, where does it break?"

---

## 0. What I verified before sizing anything

Every claim in this document is traceable to a file I read. Nothing is assumed.

| Claim | Evidence |
| --- | --- |
| No test runner is installed | Checked each package's `package.json` under `apps/relayboard-web/node_modules`: `vitest`, `playwright`, `@playwright/test`, `jsdom`, `happy-dom`, `@testing-library/{react,dom,user-event}`, `@vitest/coverage-v8`, `vite-node` are all **absent**. Only `ws@8.22.2` was present, incidentally. |
| No test script exists | `package.json` L8–18: `dev`, `build`, `preview`, `format`, `lint`, `check`, `intent:list`, `intent:load`. No `test`, no `e2e`. |
| The repo root has no test tooling either | Root `package.json` L18–21: only `@tanstack/intent` and `typescript`. Root `node_modules` has no vitest/playwright. |
| No test config anywhere in the workspace | Glob for `*vitest*` and `playwright*` outside `node_modules` returns nothing. |
| `env.ts` is dead code | Grep for `from "…env"` across `src/` returns no matches; `NOTES.md` §5 records the same, plus the proof that a server-only var reads `null` through `import.meta.env`. |
| The scaffold is untouched | `src/routes/{index,about,demo/tanstack-query}.tsx`, `Header.tsx`, `Footer.tsx`, `ThemeToggle.tsx`, `THEME_INIT_SCRIPT` (`__root.tsx` L18, L48), devtools panels (L56–67), Google Fonts import (`src/styles.css` L2), `@theme` font override (L6–7). |
| The font exists in the repo but outside the app | `fonts/ibm-plex-sans-latin.woff2`, 45 712 bytes; `@font-face` at root `styles.css` L1–8. `apps/relayboard-web/public/` **does not exist**. |
| Biome would not lint new test directories | `apps/relayboard-web/biome.json` L10–17: `files.includes` is an allowlist of `**/src/**/*`, `**/.vscode/**/*`, `**/index.html`, `**/vite.config.ts` (minus `routeTree.gen.ts`, `styles.css`). Anything outside `src/` is unchecked. |
| `tsc` *would* type-check them | `tsconfig.json`: `include: ["**/*.ts", "**/*.tsx"]`, `types: ["vite/client"]`, `strict`, `noUnusedLocals`. |
| The deployment target is unresolved in config | `vite.config.ts` L12 uses bare `nitro()` (preset auto-detect); `vercel.json` names `tanstack-start`; spec L504–512 decides node-server only. |
| Three of ticket 15's doc criteria are already satisfied | `DESIGN.md` §239 *Act entries*, §248 *Admission surface*, §257 *Purge confirmation*; `.impeccable/design.json` `components` contains *Act Entry*, *Admission Request Row*, *Purge Confirmation*, each with `html` and `css`; `PRODUCT.md` L16 (permission model), L41–42 (admission cycle), L46 (purge boundary); `AGENTS.md` L61–65 already says "being admitted grants nothing". All landed in commit `f9b6d05`. |
| The prototype's behavioural surface | `app.js`: `seedState` L19–84 (7 principals, 3 boards, 10 threads, ~30 messages, `seen` map, stream cursors); thread intro L155; in-thread search L148 + L216–218; `relation`/jump L152 + L190; the resource dialog L167 has **no type field** and `addResource` hard-codes `type:'Link'` (L117); `createThread`/`createBoard` take positional arguments (L115–116). |
| `QA.md` is the parity source | 64 assertions across 12 scenarios (L9); overflow at six viewports (L20); stream-dialog geometry with measured gaps (L21); the two recorded gaps (L27–28). |

**The load-bearing finding:** the tickets are written as if a test suite already exists. It does not — not the runner, not the config, not the script, not the directories, not the lint or type wiring. That is the largest hidden cost in the set, and ticket 02 carries all of it.

---

## 1. Per-ticket verdict

| # | Ticket | Verdict | Why |
| --- | --- | --- | --- |
| 01 | Scaffold → Relayboard shell | **Tight** | Deleting the starter chrome is mechanical; transcribing the whole `DESIGN.md` token set into `@theme` and self-hosting the face with no `public/` directory is not, and the two "verification" criteria need a browser that does not exist yet. |
| 02 | Store + canonical sequence | **Split** (3) | Three unrelated jobs: bootstrapping Vitest from zero, the `seq`/lock rule, and transcribing the prototype's entire seed with a new `origin` field. |
| 03 | Client interface + in-memory client | **Tight** | ~16 operations of types plus a conformance suite that must be run twice (in-memory, then over HTTP) and widened to non-message entries twice (10, 11) without being rewritten. |
| 04 | Browse boards and threads at a URL | **Split** (3) | Route tree + validated search params + not-found boundary + the first decision about how a client reaches the UI, the thread pane itself, and the route seam's harness — which this ticket is the first to need and no ticket provides. |
| 05 | Read a thread and post a message | **Tight** | One coherent slice, but 11 criteria including idempotency, error-retention and reference jumps — and it silently owns three prototype behaviours no ticket names (§5-H, §5-I, §5-J). |
| 06 | Serve the operations from the server | **Split** (3) | ~16 `createServerFn`s + validators + the store-singleton lifetime decision + a second harness that points the conformance suite at a live server — plus the acting-principal session the ticket needs and does not mention. |
| 07 | Named, scoped permissions | **Split** (2) | The vocabulary, scoping, implication rule and server-side enforcement are one job; the two grant-administration rules are another, and the second has no call site until 08 exists. |
| 08 | Admission and the gate | **Split** (3) | A state machine with a bearer credential, a polling secret, a decision surface and a lifecycle. The spec itself (L627) names the natural cut. |
| 09 | Create board / thread / resource | **Fits** | One dialog with three field sets lifted from `app.js` L164–176, one URL validator, one empty state. The only surprise is that the prototype has no resource *type* field (`app.js` L117) though the criterion demands one. |
| 10 | Authored acts in the chronology | **Split** (2) | Widening `Entry` from "message" to a four-member union ripples through domain, store, client interface, HTTP validators and the conformance suite; act *rendering* per `DESIGN.md` §239 is a separate job on top. |
| 11 | Live / pause / replay over SSE | **Split** (3) | A transport no other ticket builds (the stream is explicitly *not* a server function, spec L341), the pause/replay/persistence UI, and two lifecycle edges (revocation drop, simulation control). |
| 12 | Participant identity and progress | **Tight** | One drawer, three watermark numbers and a copy commitment — but it needs a current-principal read the client interface does not have (§5-D), which is the sort of surprise that eats the session. |
| 13 | Responsive and keyboard | **Split** (2) | Layout across six widths (rail→drawer, phone two-level, truncation, overflow) is one job; shortcuts, Escape, focus capture/return and focus rings are another. |
| 14 | Demo purge and restore | **Tight** | Purge algorithm, overlap count, idempotent restore and a bespoke dialog — one session, but one criterion presumes ticket 11's stream while 14 is blocked only by 09 (hazard H5). |
| 15 | Parity, proven and documented | **Split** (3) | A 64-assertion, 12-scenario Playwright suite is a ticket on its own; the documentation catch-up is another; the skills rewrite plus the retirement record is a third. Three of its criteria are already true today (§0). |

**Totals:** 1 Fits, 5 Tight, 9 Split. The 9 splits become **24 sub-issue files** in `proposed-splits/`.

---

## 2. The nine splits

| Parent | Sub-issues | The seam |
| --- | --- | --- |
| 02 | 02a, 02b, 02c | harness + domain types → the `seq`/lock rule on fixtures → the demo seed with `origin` |
| 04 | 04a, 04b, 04c | route tree + URL/search-param validation + rail + not-found → thread pane → the route seam's Playwright harness |
| 06 | 06a, 06b, 06c | reads over HTTP + store singleton + reset → the acting principal (env, session, resolution) → mutations + idempotency + full two-way conformance |
| 07 | 07a, 07b | vocabulary + scoping + implication + boundary enforcement → grant-administration rules |
| 08 | 08a, 08b, 08c | knock/poll/decide (server, admission seam) → the gatekeeper surface → expiry, revocation, renewal, derived identity |
| 10 | 10a, 10b | entry kinds in domain/store/contract → act rendering in the chronology |
| 11 | 11a, 11b, 11c | SSE transport + event contract + replay → pause/replay/indicator/persistence UI → revocation drop + simulation control |
| 13 | 13a, 13b | geometry across six widths → keyboard and focus |
| 15 | 15a, 15b, 15c | the parity scenarios → documentation and design-system catch-up → skills rewrite and the retirement record |

Each file carries `**From:** <NN> — <parent title>`, is blocked by its predecessor, and the chain is linear so the frontier stays unambiguous.

**Two of these are proposed *extra* tickets rather than cuts of the parent's stated scope, and are labelled as such in their files:**

- **04c — the route seam's Playwright harness.** Parent 04 never mentions it, but 04 is the first ticket whose criteria are browser assertions ("back and forward work", "reachable and activatable from the keyboard") and no ticket in the set stands up the harness. Without it, 13's overflow and focus criteria and 06's two-browser criterion are unverifiable (hazard H7).
- **06b — the acting principal.** Parent 06 never mentions it, but spec L352–356 makes the signed session cookie a precondition for "the caller no longer names its author" (L336), and 07, 08, 12 all assume it exists. Detail in §5-A.

Everything else in `proposed-splits/` is a genuine cut of work the parent already names.

---

## 3. Test tooling: where a ticket's criteria quietly need another ticket's setup

This is the failure mode the brief asks about specifically, so it gets its own section.

| Ticket | Criterion | Needs | Who provides it |
| --- | --- | --- | --- |
| 02 | "Vitest is configured and runs a suite in Node with no DOM and no network" | runner + config + `test` script + biome allowlist widened | **02a only.** Nobody else does this; every later ticket assumes it |
| 03, 06, 07, 10, 14 | "the conformance suite passes against …" | the suite from 03 *plus* a way to run it twice | 03 (in-memory) and 06c (HTTP) |
| 06 | "Two independent browser sessions see the same boards, threads and messages" | Playwright | **04c** — 06 cannot verify its own claim |
| 07 | "A client that bypasses the interface is still refused" | an HTTP-level client, not a browser | 06c — fine, but 06c must land before 07a's proof |
| 13 | "No horizontal scrolling at 320, 390, 680, 980, 1200 or 1440 pixels" | Playwright + `scrollWidth === clientWidth` (the method `QA.md` L20 used) | **04c** |
| 13 | "focus enters a dialog on open and returns on close" | Playwright `toBeFocused()` | **04c** |
| 15 | "Every route-seam test starts from a reset store" | a reset hook that exists on the server | 06a — see §5-B |
| 11 | "A dropped connection recovers without the reader noticing" | a way to terminate the SSE response deterministically | nothing — 11a must build it |
| 01 | "the body computes to the self-hosted face" | a browser | **04c** |
| 01 | "no functional text below 11px, no body text below 13px, AA against the actual background" | a browser + computed styles | **04c** |

Four of these rows point at the same missing piece, and one of them is circular in the current plan: 13's overflow and focus criteria need Playwright, Playwright lives in ticket 15, and 15 is blocked by 13. 01's font and type-floor criteria and 06's two-browser criterion have the same shape one ticket earlier and one ticket later respectively. Either the harness moves to 04c (§2) or these criteria degrade to "measured by hand", which is exactly the standard `QA.md` was written to replace (`QA.md` L5 records the method it used; L30 records what it could not).

---

## 4. Acceptance criteria that are not checkable

Each entry gives the criterion, why a reviewer cannot verify it, and the fix. Criteria that are merely terse are not listed.

1. **01 — "no component hard-codes a hex value."** At the end of 01 there are no components; the criterion is vacuously true. *Fix:* "`src/styles.css` `@theme` declares every token in `DESIGN.md` §Colors/§Shapes/§Elevation under the same names, and a grep for `#rrggbb` literals over `src/**/*.tsx` returns nothing."
2. **01 — "The document issues no request to any external font host, and the body computes to the self-hosted face rather than a fallback."** There is no browser in the toolchain at this point, so "computes to" cannot be evaluated. *Fix:* split — (a) `src/styles.css` contains no `fonts.googleapis.com` or `fonts.gstatic.com` reference and the `@font-face` `src` resolves to a bundled asset byte-identical to `fonts/ibm-plex-sans-latin.woff2`; (b) the computed-font assertion moves to 04c.
3. **01 — "Type and contrast still meet the floors `DESIGN.md` records."** There is nothing on screen to measure and "functional text" is undefined. *Fix:* name the surfaces, the method (`getComputedStyle` font-size per text node; contrast computed from resolved colour pairs against the element's actual background) and the ticket that measures them (04c).
4. **02 — "Sequence assignment and insertion are one atomic step under a per-store lock, demonstrated by a test that interleaves concurrent appends."** In a single-threaded runtime a no-op lock passes, because interleaving only happens at `await` points. *Fix (applied in 02b):* "every mutation awaits `store.lock`; a test injects a delay inside `append`, starts 50 appends across two threads, and asserts both sequences are gapless and equal to their entry counts."
5. **03 — "A single `RelayboardClient` interface exists and is the only thing the UI is allowed to depend on for data."** Unfalsifiable at 03 (no UI) and unenforced thereafter. *Fix:* make it mechanical — "no module under `src/routes/**` or `src/components/**` imports a store module, and a Biome `noRestrictedImports` rule fails `npm run check` if one does."
6. **03 — "The interface carries the prototype's nine operations plus the operations the model requires."** "the operations the model requires" is not a list. *Fix:* paste spec L282–308 as the criterion.
7. **04 — "Thread rows … ordered by most recent activity."** It does not say by what, and it collides with `AGENTS.md` L72 ("Order by `seq`, never by `createdAt`"). *Fix:* "threads are ordered by the `createdAt` of their latest entry, descending — the one place a timestamp orders anything, because a thread has no `seq`; entries are always ordered by `seq`." Stated in the ticket, or a reviewer cannot tell a bug from the rule.
8. **04 — "the active row is distinguishable without relying on colour alone."** *Fix:* "the active row carries `aria-current` **and** the 1px inset edge from `DESIGN.md` §200/§223; both are asserted."
9. **05 — "Repeated submission of the same draft appends exactly one message."** Ambiguous between "a send in flight ignores further activations" (what the prototype does — `app.js` L177–178 mints a fresh key per send and relies on a `sending` flag) and "the same idempotency key returns the same entry and appends nothing" (what spec L491 requires). Both satisfy the sentence. *Fix:* two criteria — "a second activation while a send is in flight is ignored" and "a retry carrying the same idempotency key returns the same entry and appends nothing".
10. **05 — "Agent-authored entries are marked as agent-authored without that marking implying lower status."** The second clause is unverifiable. *Fix:* "the AGENT chip per `DESIGN.md` §217 is the only difference between an agent's and a human's entry — no other class, surface, weight or colour differs."
11. **07 — "The permission vocabulary covers every permissible action on every object."** "every" needs a reference. *Fix:* "the exported vocabulary equals the four rows of spec L396–400 exactly, asserted as a literal set."
12. **08 — "The participant's fingerprint and issuer are derived by the server from the credential it issued."** A hard-coded string satisfies the sentence. *Fix (applied in 08c):* "two credentials for one principal yield the same fingerprint; two principals yield different ones; renewal preserves it; a `fingerprint` field supplied by the knocker is ignored."
13. **10 — "An act renders distinguishably from a message without becoming louder than one."** *Fix:* cite the numbers — 28px rounded-square marker instead of the 35px avatar, one 13px line, Ink-muted rather than Ink-body, detail inline (`DESIGN.md` §242–244) — and assert those computed properties.
14. **10 — "An acknowledgement can never substitute for a status move, and never counts as agreement with what it acknowledged."** The second clause has no assertion attached. *Fix:* "`acknowledge()` without `acknowledge:thread` is refused naming that permission; after an acknowledgement the thread's status is unchanged and no status-move entry exists."
15. **11 — "A dropped connection recovers without the reader noticing or intervening."** *Fix:* "after the SSE response is terminated server-side, the client reconnects carrying `Last-Event-ID`, the entries committed during the gap render, and the indicator never reads Live while the connection is down."
16. **13 — "The details drawer and the stream panel open fully inside the viewport at every width, anchored as `DESIGN.md` describes."** `DESIGN.md` describes the *board rail* drawer (§233) and says nothing about the stream panel's anchoring; the measured numbers live in `QA.md` L21 (25px desktop, 10px at ≤680px). *Fix:* put the numbers in the criterion or cite `QA.md` L21 explicitly.
17. **13 — "No horizontal scrolling at 320, 390, 680, 980, 1200 or 1440 pixels."** Unmeasurable until 04c exists (§3). *Fix:* name the tool — "measured with the route-seam harness: `documentElement.scrollWidth === clientWidth` at each width."
18. **14 — "A purge leaves the reader's principal, session and permissions intact."** Needs a session that no ticket builds (§5-A). *Fix:* name the prerequisite and assert through the client (an authorised post still succeeds; `readPositions` still resolves) rather than by inspecting the store.
19. **15 — "covers every behaviour in `QA.md`'s verified list."** That list is twelve prose bullets holding roughly sixty-four distinct assertions; a reviewer cannot count coverage. *Fix:* enumerate them as the suite's test names in 15a, or cite the recorded 64 and list them.
20. **15 — three criteria are satisfied already** and so test nothing: *"`DESIGN.md` and its sidecar document … the admission decision surface, an act entry, and the purge confirmation"*, *"`PRODUCT.md` records the permission model, the admission cycle and the demo-purge boundary"*, *"The root `AGENTS.md` convention about authorship is updated to cover 'being admitted grants nothing'"*. All three are true as of `f9b6d05` (§0). *Fix:* replace them with the outstanding work — see §5-M — or 15 claims credit for a landed commit and skips the `QA.md` and skills rewrite that has *not* landed.
21. **06 — "described as in-memory and volatile in the interface."** "the interface" means UI copy here and the TS interface two lines earlier. *Fix:* "the exact sentence appears in the stream status surface and in the participant's own view."
22. **06 — "A server restart clears the store."** Testing a restart is an end-to-end operation with no harness. *Fix:* "constructing a second server context starts from the seed again, and the UI states the restart behaviour."
23. **12 — "Silence is distinguishable from unread, because a principal behind the thread is visibly behind rather than merely quiet."** *Fix:* "the panel shows three numeric watermarks (`cursor`, `seen`, `acknowledged`) per principal on the current thread, and a principal whose `seen` is below the thread's latest `seq` is rendered in the not-caught-up state."

---

## 5. Missing work

Ordered by how badly each blocks a ticket that is already `ready-for-agent`.

**A. The acting principal: session cookie, signing secret, `env.ts` wiring, request-time resolution.** *No ticket owns it.* Everything in the design needs it: spec L352–356 ("a browser receives a signed `HttpOnly`, `SameSite=Lax` workspace session cookie"), L494 (unresolved session → unauthenticated, and "the one case where the client must not retry silently"), L456–461 (a **required** server-only secret; `runtimeEnv` must include `process.env` because `NOTES.md` §5(d) measured that a server-only var read through `import.meta.env` comes back `null`, and `env.ts` is imported by nothing at all). Ticket 06 cannot satisfy spec L336 ("the caller no longer names its author") without it, and 07, 08, 12 all assume it. **Proposal: an extra ticket `06b`, inserted inside 06 between the reads and the mutations** — *"The acting principal: env hardening, session issuance and request-time resolution"*. Make `SESSION_SECRET` required, change `runtimeEnv` to `{ ...import.meta.env, ...process.env }`, import `env` from the server entry so a missing secret is a boot error (spec L355, story 151), issue the cookie on first request, resolve principal+grant on every server function. Without it, 06 ships `authorId` in the input and 07 has to remove a field the conformance suite has already frozen.

**B. A reset operation for the route seam.** 15 requires "Every route-seam test starts from a reset store" (spec L558), but nothing provides the operation, and it must be gated — a public reset would be a denial-of-service on the workspace. **Proposal: add to 06a** — a documented reset reachable only in a test/dev mode, plus a fresh-store path for the contract seam. It is also what the "restart clears the store" criterion needs.

**C. A members read, and what `read:member` actually gates.** Spec L402 makes `read:member` its own permission, "because who is on a board is information a principal may legitimately be denied". But the client interface (spec L282–308) has no "list the board's principals" operation, and the prototype reads `board.members` straight off the board payload (`app.js` L32, L144) — so `listBoards` would leak exactly what `read:member` withholds. Ticket 04's third board view cannot be built honestly without resolving this. **Proposal: add `listMembers(boardId): Promise<PrincipalSummary[]>` (requires `read:member`) to ticket 03's interface, its server function to 06a, its enforcement to 07a, the People view to 04b; state in 06a that `listBoards` carries member *counts* only; and add an admission-seam test that `read:board` does not yield `read:member`.**

**D. A current-principal read.** 12 requires "The reader can see which principal they are acting as, and what they themselves may do here", and spec L441 says the app "will have one" (`getPrincipal`) — but the interface listing has no such member. The shipped `relayboard-identity` skill is excluded *because* the prototype lacks this read (`apps/relayboard-web/package.json` L48–50, plus the app's `AGENTS.md`). **Proposal: add `getPrincipal(): Promise<{ principal, permissions }>` to ticket 03, its server function to 06a, and consume it in 12.** It is also the precondition for 15c's "remove the `relayboard-identity` exclusion".

**E. The deployment preset, pinned in config.** Spec L504–512 decides one long-running Node process and declares the Vercel config inert. The code disagrees: `vite.config.ts` L12 is bare `nitro()` with `vercel.json` present, and `NOTES.md` §9 only ever measured the `node-server` output locally. Under a Vercel build the preset flips, and neither the in-process store nor a long-lived SSE connection survives. **Proposal: add to 06a's "single in-process instance" criteria** — pin `nitro({ preset: 'node-server' })` and add the "serverless deploy is unsupported" line to the honesty surface. Cheap here, expensive to discover during 11.

**F. Anything at all about `SESSION_SECRET` in `.env`/docs.** `NOTES.md` §5 records that the CLI generated no `.env` or `.env.example`, that `README.md` mentions files that do not exist, and that both declared vars are `.optional()`. A required secret with no `.env.example` means the first `npm run dev` on a fresh clone fails at boot with a t3env error. **Proposal: add to 06b** — an `.env.example` (gitignored `.env`, as `NOTES.md` §5(b) describes) and the README correction.

**G. The People view's data source.** Covered by C, but called out separately because it is a *product* decision: the prototype's People tab lists `board.members` (`app.js` L144), which under the new model is "principals holding a grant on this board". Ticket 04 lists the tab; no ticket says where its rows come from. **Proposal: add to 04b** — People renders `listMembers`, and an empty state for a principal without `read:member` (spec L446: a control the reader cannot use is disabled *with a reason*).

**H. In-thread message search — the filter itself.** 13 requires it "reachable at every width", and `QA.md` L22 verifies it filters, reports zero results and restores. No ticket *builds* it; the prototype's implementation is `app.js` L148 + L216–218. **Proposal: add to ticket 05** — the search bar, the filter over entry text and author name, and the zero-result copy ("No matching messages" / "Try a different search term, or clear the filter."). 13 then owns reachability only.

**I. The thread intro.** Story 24 ("the thread intro to name who started it and when") and `app.js` L155 exist; no ticket mentions them. **Proposal: add to ticket 05** — one line, but it is the thread's provenance and is currently nobody's.

**J. The `relation` / correction model.** 05 requires a referencing entry to be jumpable, and spec L549 requires corrections to be "new messages whose target's `seq` is unchanged". The seed carries `relation` (`app.js` L152) but 02's domain types do not mention it and no ticket owns correction semantics. **Proposal: add `relation` to 02a's record types, and jump-to-target plus the "referenced entry is outside this view" case to 05.**

**K. The SSE event contract as a written artefact.** Story 155 ("the SSE contract to have a documented event shape, so that a non-browser client can consume the stream") has no owner. **Proposal: add to 11a** — the eight event names and payload shapes in one place, with a test that the emitted set equals that literal set.

**L. Lint and type wiring for the new directories.** `biome.json`'s allowlist excludes everything outside `src/`, `.vscode/`, `index.html` and `vite.config.ts`, so `tests/`, `e2e/`, `vitest.config.ts` and `playwright.config.ts` would pass `npm run check` without ever being checked, while `tsc` does check them (`include: ["**/*.ts"]`). **Proposal: add to 02a** — widen `files.includes`; and decide globals explicitly (import `describe`/`it`/`expect` rather than adding `vitest/globals` to `tsconfig.types`, which keeps 02a's tsconfig footprint at zero).

**M. The three document criteria that 15 believes are outstanding.** 15 asks for `DESIGN.md` + sidecar entries for the act entry, the admission surface and the purge confirmation; for `PRODUCT.md` to record the permission model, admission cycle and purge boundary; and for the root `AGENTS.md` authorship convention to cover "being admitted grants nothing". All three are already true (`DESIGN.md` §239/§248/§257; `.impeccable/design.json` `components`; `PRODUCT.md` L16/L41–42/L46; `AGENTS.md` L61–65). **Proposal: retire those three criteria and let 15b carry only what is genuinely outstanding** — `QA.md` rewritten against the app, the design system re-verified against what the app renders, `PRODUCT.md`'s "Technical state" paragraph — **and let 15c carry the rest** — the skills rewritten against the app rather than `window.RelayboardMockAPI` (whose contract `docs/mock-api.md` L22 still documents as `appendMessage({ authorId, … })`), the `relayboard-identity` exclusion removed once `getPrincipal` exists (§5-D), and the one-page carry-across record.

**N. The "disabled control with a reason" rule.** Spec L446 makes it normative and `DESIGN.md` §213 defines the disabled appearance, but no ticket requires it anywhere. **Proposal: add to 07a** — one rule, applied by 09, 10 and 12's surfaces.

**O. Whose pending requests a workspace-scoped gate holder sees.** 08 says a human holding `admit:agent` sees pending requests; spec L376 says the grant may be workspace-scoped. 08 does not say whether that means every board's requests or one board's. **Proposal: add to 08b** — workspace scope shows every board's pending requests grouped by board; board scope shows that board's only.

---

## 6. Sequencing hazards

**H1. 06 and 11 would make incompatible transport choices.** 06 makes every operation a `createServerFn`; 11 needs a *server route* returning `text/event-stream`, and spec L341 says explicitly "The stream is **not** a server function." Someone doing 06 alone will very reasonably either model `subscribe` as an RPC or leave it throwing. Either way 06's "the existing conformance suite passes against it unchanged" is false, and 11 inherits a green that means nothing. **Mitigation:** 06a and 06c must name `subscribe` as explicitly out of scope until 11a, and the HTTP implementation must fail loudly rather than return an empty subscription.

**H2. 06 and 07 disagree about where the author comes from.** If 06 ships `appendMessage({ authorId })` to honour the prototype's signature, 07 removes a field the 03/06 conformance suite has already frozen. **Mitigation:** land `06b` (§5-A) before 07, so the only change in 07 is *which* permission is checked, not the request shape.

**H3. 01 and 02a both edit the same config files, and both can start immediately.** Both touch `vite.config.ts`; 02a adds `vitest.config.ts`, a `test` script in `package.json` and a biome allowlist change; 01 adds a font asset, possibly a `public/` directory, and rewrites `styles.css`. `tsconfig.json` and `biome.json` are candidates for both. Two agents editing `vite.config.ts` in parallel is the likeliest merge conflict in the plan. **Mitigation:** record write scopes on the shared tasks — 01 owns `vite.config.ts`, `tsconfig.json`, `biome.json`, `styles.css`, `src/routes/**`; 02a owns `vitest.config.ts`, the `test` script line, `tests/**`, `src/domain/**`. If both are claimed the same day, order 02a after 01.

**H4. 10 widens the entry type after 03, 05 and 06 have frozen it as `Message`.** `readMessages`, the conformance suite, the HTTP validators and the SSE payloads all say `Message`. 10's "there is no separate audit log to reconcile" cannot be retrofitted by addition. **Mitigation:** a one-line decision in 02a — define `Entry` as a discriminated union with one member today — and 03's conformance suite written against an `Entry`-shaped result from the start. That removes a five-file refactor in 10.

**H5. 14's purge-notification criterion presumes 11, which does not block it.** 14 is blocked only by 09 and 11 is blocked by 10, so 14 is startable before a stream exists, and "Principals holding a subscription are told that a purge happened" cannot be met. **Mitigation:** add 11 to 14's `Blocked by`, or move that criterion into 11b.

**H6. 13 constrains surfaces that 11 and 12 create.** 13 requires the details drawer and the stream panel to open fully inside the viewport, but the stream panel is 11's and the participant panel is 12's, and neither blocks 13 (blocked by 05 and 09 only). 13 can close its geometry criteria against a workspace that does not have the two panels it names. **Mitigation:** add 11 and 12 to 13's `Blocked by`, or move the panel-geometry criteria into 11b and 12.

**H7. 13 and 01 need a browser harness that only exists three tickets later, and that ticket depends on 13.** 01's font and type-floor criteria, 13's overflow and focus criteria and 06's two-browser criterion are all browser assertions; the plan's only browser harness is inside 15, which is blocked by 13. **Mitigation:** extract the harness as `04c` (it needs only 01 and 04b), and leave 15a the parity scenarios and the scaffold assertions. Without this, 01/06/13's most expensive criteria are either unverified or verified by hand.

**H8. 07's last criterion has no call site until 08 exists.** "A human cannot grant a permission it does not itself hold" is a rule about the granting path, which is 08's admit call — and the superadmin grant surface is explicitly out of scope (spec L595). 07 cannot prove it inside 07. **Mitigation:** 07b asserts it against the store-level `grant` operation that 07b itself introduces; 08a then asserts it end to end through admission.

**H9. 11's revocation criterion presumes 08c.** "A permission revocation drops the affected principal's open stream" needs revocation, which is 08c, while 11 is blocked only by 10. **Mitigation:** 11c is blocked by 08c as well as 11b (recorded in its file), or the criterion moves into 08c.

**H10. 09 and 10, worked in parallel, will invent two versions of the "cannot do this" affordance.** Both are blocked by 07 and both render grant-dependent controls; the rule in §5-N must be decided once in 07a before either starts.

**H11. 12's "what I myself may do here" needs 07's vocabulary rendered, not just enforced.** 12 is blocked by 08 and 10 but not by 07 — and the only reason it does not need 07 explicitly is that 08 implies it. If 08 is ever re-sliced, that transitive dependency disappears silently. **Mitigation:** add 07a to 12's `Blocked by` explicitly.

---

## 7. Tickets that are too small

None of the fifteen is below a session's worth once the splits land — every one carries at least five substantive criteria. The two nearest the floor:

- **12 (participant identity and progress)** — one drawer, three numbers, one copy commitment. What makes it a session rather than an hour is §5-D (the missing `getPrincipal` read), not the panel. If a lower ticket count matters, fold its "which principal am I acting as, and what may I do here" criterion into 07a (where the permission-rendering rule lands) and leave 12 owning the participant view. I would not merge it wholesale: it is the ticket that makes the declared/derived distinction visible, and that is a product claim rather than a screen.
- **09 (create board / thread / resource)** — the most mechanical ticket in the set, because `app.js` L164–176 is a working reference for all three dialogs. Marked **Fits**. If the frontier is ever crowded it is the better candidate to *absorb* a small neighbour (the resource type field, the two empty states) than to be absorbed.

Nothing in this set should be folded into a neighbour wholesale; the dependency chain is too tight for a merge to save a round trip.

---

## 8. Write boundary

Files created, all under `.scratch/relayboard-app/reviews/`:

- `lead-dev-review.md` (this file)
- `proposed-splits/` — 24 sub-issue files for tickets 02, 04, 06, 07, 08, 10, 11, 13, 15

Nothing else was touched: no ticket, no spec, no doc, nothing under `apps/` or `packages/`; no `git add`, no `git commit`, no package install, no build.

`git status --short --untracked-files=all` at the end of this work lists exactly 25 added paths — this file and the 24 sub-issues — and nothing modified or deleted.
