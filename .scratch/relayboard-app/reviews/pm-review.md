# Delivery review — the Relayboard port

**Reviewer:** pm-reviewer (technical PM, delivery review only — nothing implemented)
**Date:** 2026-11-10
**Scope:** `.scratch/relayboard-app/spec.md` (629 lines, rev 7), `.scratch/relayboard-app/issues/01…15`, `PRODUCT.md`, `GLOSSARY.md`, `AGENTS.md`, `QA.md`, `apps/relayboard-web` (scaffold + `NOTES.md`), repo-root prototype (`index.html`, `app.js`, `styles.css`, `fonts/`).

**Verdict: deliverable with changes.**

The dependency spine is sound, the tickets are unusually well-grounded in evidence, and every ticket has checkable acceptance criteria. Three omissions sit *on the critical path* and are not ticket-quality problems — they are undecided product decisions that ticket 03, 06, 07, 08, 12 and 14 would each silently invent a different answer to. Three dependency edges are simply missing, leaving checklist items unsatisfiable when their tickets are startable. Two verified prototype features have no ticket at all. One ticket (01) is asked to make a styling decision that the spec leaves open and that determines the cost of four later tickets; its own checklist also misses eight things that are in the scaffold.

None of this needs re-architecting. It needs a short list of decisions — enumerated in §2.2 and ranked in §9 — and a page of checklist amendments. All of it is cheap **now** and expensive after ticket 06.

---

## 1. What I actually read

| Source | Read |
| --- | --- |
| `spec.md` | all 629 lines |
| Issues 01–15 | all, with line numbers |
| `PRODUCT.md`, `GLOSSARY.md`, `AGENTS.md`, `QA.md` | all |
| `apps/relayboard-web` | `package.json`, `vite.config.ts`, `vercel.json`, `tsconfig.json`, `biome.json`, `.cta.json`, `.gitignore`, `src/env.ts`, `src/router.tsx`, `src/routes/{__root,index,about,demo/tanstack-query}.tsx`, `src/styles.css`, all three `src/components/*`, both `src/integrations/tanstack-query/*`, `NOTES.md` §§2, 3, 5–12, `.output/nitro.json` |
| Prototype | `app.js` (228 lines, all), `styles.css` (2,316 lines — token block, breakpoints, font-face), `index.html` head, `fonts/` |
| Sidecar | `.impeccable/design.json` (`components`, `narrative`) |
| Skills package | `packages/relayboard-skills/skills/*/SKILL.md` (headers + `authorId`/`MockAPI` references), `docs/mock-api.md` |

Two measurements I re-ran rather than trusted: the seed inventory (3 boards, 10 threads, **31 entries**, 7 principals — `app.js:19–84`) and the absence of a `public/` directory in the app (`Test-Path apps/relayboard-web/public` → `False`).

**Citation convention used throughout.** `spec:NNN` = file line in `spec.md`. `NN:MM` = line `MM` of ticket `NN` (e.g. `01:16` is the last checklist item of ticket 01). `story N` = numbered user story in `spec.md` (`spec:38–242`). Bare paths are repository-relative; `styles.css`/`app.js`/`index.html` are the repo-root prototype, and `src/…` is under `apps/relayboard-web/`.

---

## 2. Sequencing and the critical path

### 2.1 The graph

```
01 ─────────────────────────┐
                            ├─→ 04 ─→ 05 ──────────┐
02 ─→ 03 ─→ 06 ─→ 07 ─┬─→ 08 ─→ 12 ←(10) ─────────┤
                      ├─→ 09 ─┬─→ 13 ←(05) ──────┤
                      │      └─→ 14 ──────────────┤
                      └─→ 10 ─→ 11 ───────────────┴─→ 15
```

(The graph as the tickets state it. R7 recommends adding `14 ← 11`, `13 ← 11` and `13 ← 12`; the `←(10)`/`←(05)` markers show blockers already recorded.)

Four paths of the same length (seven tickets each) reach 15:

- `02 → 03 → 06 → 07 → 09 → 13 → 15`
- `02 → 03 → 06 → 07 → 09 → 14 → 15`
- `02 → 03 → 06 → 07 → 10 → 11 → 15`
- `02 → 03 → 06 → 07 → 08 → 12 → 15`

Every one of the four passes through `02 → 03 → 06 → 07`, which is why that chain, not the length of any single path, is the schedule. **07 is the choke point**: every ticket except 01–06 is downstream of it (directly 08, 09, 10; transitively 11, 12, 13, 14, 15). 06 is the choke behind the choke, and 02 behind that.

The real critical path is therefore `02 → 03 → 06 → 07`, and it has **zero slack**: no parallel work can cover a slip in it. Compare the ticket sizes in §7 — 02 (L), 06 (L), 07 (M). A slip in 02 or 06 is a slip to the whole project, and both of them currently absorb undecided product questions (R1, R3, R5, R8).

**Recommendation:** treat 02 and 06 as the two tickets deserving the most senior attention and the most care about *what gets decided inside them*, because both currently absorb undecided product questions (see §4.1, §4.2).

### 2.2 Must be true *before* ticket 01 starts

Ticket 01 is the only ticket that can start with no information from anywhere, so it must not also be the place where open decisions get made. Four things must be settled first:

1. **The styling method.** Ticket 01:13 commits to tokens "declared once and named after `DESIGN.md`" and nothing else. It does not say whether the app is styled with Tailwind utilities (making the tokens `@theme` entries, per spec:262) or by porting the prototype's **2,316-line `styles.css`** into component-scoped CSS. The prototype's stylesheet is the visual reference story 136 asks for ("look like the prototype I have been reviewing"), and it is the largest single artefact in the repo. This is not a 5-minute choice: it determines whether tickets 04, 05, 09, 12 and 13 are one session or three each, and whether 15's parity claim is about *behaviour* or *behaviour and appearance*. Deciding it inside an M ticket is how a project discovers at ticket 13 that it has to re-do the CSS.
2. **The authority for token names — really the authority for which tokens exist.** Ticket 01:13 says tokens are "named after `DESIGN.md`"; spec:262 says the `DESIGN.md` "token names" are "preserved **verbatim**". Radius names do line up (`DESIGN.md:59–64` `xs…xl` ↔ `styles.css:76–80` `--radius-xs…xl`), and colours align once Tailwind's `--color-` prefix is added (`spec:262`'s `--color-ink-muted` ↔ `DESIGN.md:8`'s `ink-muted` ↔ `styles.css:26`'s `--ink-muted`). But **14 tokens the prototype actually uses exist in no `DESIGN.md` front-matter key at all**:

   `--ink-placeholder` (`styles.css:28`), `--line-soft` (40), `--accent-chip` (47), `--rail-well` (54), `--live-ring` (58), `--paused-line` (61), `--focus` (64), `--focus-on-rail` (65), and all six shadow tokens `--shadow-float/drawer/popover/toast/rail/rest` (68–73). And three that do exist are **renamed** in the prototype: `DESIGN.md`'s `surface` / `surface-panel` / `surface-tint` (`DESIGN.md:16–18`) appear as `--white` / `--panel` / `--panel-tint` (`styles.css:36–38`).

   `DESIGN.md` names the shadows only in prose (`DESIGN.md:184–196`) and names no focus colour at all, yet spec:262 requires shadows "declared once" and 01:13 forbids a hard-coded hex — and the prototype's focus ring colours (`--focus`, `--focus-on-rail`) are load-bearing for the accessibility work in 13:16–17. So 01 either hard-codes 14 values (violating 01:13) or inverts the drift onto `DESIGN.md` (violating spec:605's "`DESIGN.md` and its sidecar are normative … this work consumes them"). Fix: add these 14 tokens to `DESIGN.md`'s front matter + sidecar first, then let 01 reproduce them verbatim.
3. **Where the font lives.** Ticket 01:12 requires "no request to any external font host" and "the body computes to the self-hosted face". The face is at repo-root `fonts/ibm-plex-sans-latin.woff2` (45,712 bytes), referenced as a *repo-root-relative* URL in `styles.css:6`. The app has **no `public/` directory**, so "copies that same file" (spec:258) has no defined destination and Vite has no configured static path for it. Ticket 01 is where this is discovered as a build failure rather than decided as a directory.
4. **A decision on `vercel.json` and the Nitro preset.** See R6 and §8.1 — this is cheap at 01 and expensive at 11.

### 2.3 Are 01 and 02 genuinely parallelisable? — Mostly, but they collide on four shared surfaces

They touch disjoint *product* code: 01 edits `src/styles.css`, `src/routes/__root.tsx`, `src/routes/index.tsx`, deletes `src/components/*` and two routes; 02 adds a store and a test suite. That part is clean.

They collide on:

| Shared surface | Why it bites |
| --- | --- |
| `package.json` | 02 must add `vitest` (and a `test` script); 01 must remove the four devtools packages (`@tanstack/react-devtools`, `@tanstack/react-query-devtools`, `@tanstack/react-router-devtools`, `@tanstack/devtools-vite` — all four become consumers-less once the panel goes). Four-line file, two writers. |
| `package-lock.json` + `node_modules` | `npm install` by either ticket rewrites the lockfile the other is reading. Concurrent `npm install` in one tree is the classic way to corrupt a review. |
| `npx tsc --noEmit` | `tsconfig.json` has `"include": ["**/*.ts", "**/*.tsx"]` and `noUnusedLocals`/`noUnusedParameters` on. 02's `vitest.config.ts` and `src/store/*.test.ts` are inside that include. 01:16 asserts the *whole repo* typechecks. A half-written test file in 02 makes 01 uncompletable. |
| `npm run check` (Biome) | `biome.json` `files.includes` is `**/src/**/*` — 02's tests are inside it. Same problem, worse: Biome also owns import sorting. |

This is not a reason to serialise them, but 01:16 is a *shared global assertion* and both tickets are being graded on it. Fix one of three ways, cheapest first:

- **Scope the gate:** 01:16 becomes "`npm run build`, `npx tsc --noEmit` and `npm run check` pass **with no uncommitted test scaffolding present**", or
- **Split the tsconfig:** 02 adds `tsconfig.test.json` and excludes `**/*.test.ts` from the app tsconfig, or
- **Add the edge:** make 01 blocked-by nothing, 02 blocked-by 01 — costs one session of the schedule but removes an entire class of confusion.

I'd take option 2 plus a note on 01:16, and keep them parallel.

---

## 3. Risk register, ranked by exposure

Ranked by (likelihood × impact) on the critical path. "Exposed at" is the first ticket that *cannot* proceed cleanly without the risk being resolved.

| # | Risk | Likelihood | Impact | Exposed at | Mitigation |
| --- | --- | --- | --- | --- | --- |
| **R1** | **Nobody has decided who a browser session is.** Spec:352 says a browser receives a cookie "naming the principal it acts as" — it does not say whether the server **mints** a principal or **names a seeded one**. Spec:602 ("a session is per browser; there is no account to sign into from a second device") implies mint-per-browser; spec:360 ("a human arrives already provisioned") and spec:406 (superadmin seeded out of band) imply name-an-existing-one. Ticket 06:13 then requires "two independent browser sessions see the same boards", which only works if each minted principal is pre-granted on all three demo boards. **No ticket defines it**: grep finds `cookie` → 0 hits, `superadmin` → 0 hits, `principal resolution`/`getPrincipal` → 0 hits, and `session` only as an undefined noun in 06:13, 09:14 (`rel="noopener"` safety) and 14:3/14:11 (a purge must not log you out). | Very high | Very high | **06** | Decide in writing before 03: what a first request creates, what grant it holds, whether the two demo browsers are the same principal (browser identity is then shared, and `cursor`/`seen` stomp each other) or two principals (and then what stops unbounded principal creation). Add a checklist item to 06. |
| **R2** | **The principal read that the whole identity feature depends on is missing from the decided interface.** Spec:441 states plainly "It is excluded because its guidance needs a principal read (`getPrincipal`)… **The app will have one**". The interface at spec:282–307 has no such method, and ticket 03:10 enumerates the additions and omits it. The prototype's People view is driven by `board.members` (`app.js:144`) and the identity drawer by a `principal` record (`app.js:181`) — both disappear when spec:377/`GLOSSARY.md:60` abolishes membership-as-a-separate-concept. So ticket 04 (People view, 04:11), ticket 12 (participant panel, 12:9) and ticket 07 (`read:member` enforcement, 07:11) each need a read that "the decision" (spec:280) does not contain. | Very high | High | **03** | Amend the interface (and spec:282–307) to add `listMembers(boardId)` and `readPrincipal(principalId)` gated by `read:member`, before 03 starts. Note this is a *spec* change, not a ticket change — a ticket that silently widens the interface is how "the shape is the decision" stops being true. |
| **R3** | **Nothing owns the environment surface.** Spec:454–461 decides that `env.ts` gains a required server-only secret and that `runtimeEnv` must include the process environment, because "`import.meta.env` … comes back undefined even when it is exported into the process environment" — a finding `NOTES.md:292–305` measured, not guessed. Story 151 requires the app to refuse to start without it. **No ticket mentions `env.ts`, env, or a secret** (grep: `env.ts` → 0 hits; `secret` → only 08's *polling* secret). Ticket 06 is where a server function first needs to sign a cookie, and it will read `undefined`. | Very high | High | **06** | Add the env work explicitly — either a small new ticket between 02 and 06, or two checklist items on 06 ("the app refuses to start without the session secret" / "`runtimeEnv` reads the server process environment, proven by a test"). Without it, R1's cookie cannot be signed. |
| **R4** | **Admission renewal has no identity key.** Ticket 08:16 requires "Renewal after expiry resolves to the same principal identity, so history does not split" (story 100, spec:381, 574). But an expired agent holds nothing — the only facts it can present on a *second* knock are its **declared** name and operator (spec:366). Matching on declared values means any caller can claim an existing principal id and inherit its history: precisely the authorship forgery that spec:353 exists to prevent. Matching on nothing means every renewal splits history, contradicting the story. | High | High | **08** | Either (a) make the first credential's *renewal* the only path that preserves identity — i.e. the agent presents its expired credential, which the server can verify because it stored a hash (spec:385) — and say so; or (b) cut story 100/59 from the first slice, which spec:627 already authorises ("the natural cut is between knock-and-be-admitted and expiry-and-revocation"). Decide which before 08, because it changes the credential record. |
| **R5** | **"Reset the store" has no owner and no parallel-safety story.** Spec:558 and 15:12 both require every route-seam test to start from a reset store, while 06:12 requires **one in-process store shared by all requests**. Playwright runs workers in parallel by default. Nobody has decided: a test-only reset route (which is then an unauthenticated state-wipe in the shipped product — a direct conflict with spec:378's "the grant is the boundary"), a per-worker server instance (possible because the target is node-server, but the harness does not exist), or serial execution (slow, and 15 is already the largest ticket). **No ticket delivers a reset.** | High | High | **15** (but decided at **06**) | Decide the seam at 06: e.g. reset exposed only when `NODE_ENV !== 'production'`, or `scripts`-level server-per-worker. Add a checklist item to 06 so 15 inherits it instead of inventing it. |
| **R6** | **The Vercel/serverless build still looks like it works.** `vercel.json` still declares `"framework": "tanstack-start"`, and `vite.config.ts:7,12` runs `nitro()` with auto-preset detection. `NOTES.md:308–346` measured that a `VERCEL=1` build **succeeds** and emits `.vercel/output/functions/…`. Spec:511 says that config "stays as the scaffold left it and is documented as inert" — documenting it is the *only* mechanism, and **no ticket mentions deploy, nitro or preset** (grep: 0 hits). Ticket 11 ships a long-lived `text/event-stream` plus an in-process store: the first Vercel deploy will hold a connection against a frozen function and appear to work until a second instance exists. | High | High (silent) | **11** | Cheapest fix is mechanical, not documentary: pin the preset (`nitro({ preset: 'node-server' })`) so the wrong deployment is *unbuildable*, and add that plus a `vercel.json` disposition note to ticket 01:16. A README claim competing with a passing `npm run build` loses. |
| **R7** | **Three dependency edges are missing, making criteria unsatisfiable.** (a) 14:15 requires "Principals holding a subscription are told that a purge happened" — subscriptions are ticket 11's, but 14 is blocked only by 09 (14:5). 14 can therefore be marked done before its own criterion can be met. (b) 13:13 requires "the details drawer and the stream panel open fully inside the viewport" and 13:16 requires Escape to close "the open drawer, panel or dialog" — the stream panel is 11's UI and the details drawer is 12's, while 13 is blocked only by 05 and 09 (13:5). | Certain | Medium | **13, 14** | Add `14 ← 11`, `13 ← 11`, `13 ← 12`. Alternatively move the panel criteria out of 13 into 11/12 and leave 13 the pure layout work. Do not leave them where they are. |
| **R8** | **The seed is a transcription job with an uncheckable acceptance criterion.** 02:10 says the store "seeds the prototype's demo content" — but that is **31 entries, 10 threads, 3 boards, 7 principals** (`app.js:19–84`), and `QA.md:11–18` grades parity against its *exact* content ("exactly 9 message elements, stored sequence 1–9", search "replay" matching "Reconnect and replay behavior", 5 people including 2 agent tags). "Seeds the demo content" cannot be verified by inspection and drifts silently. Compounding it: the prototype's boards carry a `members` array (`app.js:29–33`) that the spec abolishes, so 02 must **invent the whole grant matrix** (who holds which `<verb>:<object>` on which board, and on which the reader principal holds what) — the single most consequential data in the system, and no ticket or spec section defines it. | High | Medium | **02** | Make the seed a checkable artefact: a fixture file whose entries are diffs against `app.js:47–83`, with the count assertions from `QA.md` as the test. And add an explicit checklist item for the seeded grant matrix, listing each principal and its scopes. |
| **R9** | **Permission-check placement is contradicted three ways.** Spec:270 puts it in "the middleware that resolves the acting principal and its grant for everything else"; 07:12 says "in the server function rather than in the UI"; 03:14 says each operation "declares which one it requires" on the interface. Meanwhile the check needs per-operation knowledge the middleware cannot guess: the target board id must be parsed out of the input, `read:board` must be *expanded* to `read:thread`/`read:resource` (spec:402), and admission/permission-administration must be reachable **without** a participant grant (spec:329–330). Whoever implements 07 decides which of the three readings wins, and may have to rewrite 03's declaration shape. | High | Medium | **07** | Pick middleware-with-declared-metadata *and* say what the declaration contains (permission name + scope extractor), in spec or in 03/07. Otherwise 03 invents a declaration that 07 cannot enforce. |
| **R10** | **`simulateIncoming` is a standing exception to a stated invariant.** Spec:353 says the server derives the author and "a browser cannot post as another participant"; spec:325/354 then gives `simulateIncoming` the right to post **as an agent member**. So a client *can* cause an entry to be authored by a principal other than itself — by design, for the demo. Ticket 11:18 requires the control to keep working and to say it is a demonstration. Nothing says what permission the *simulated* author must hold, or how the demo path is prevented from becoming a forgery vector for the honesty claim in `PRODUCT.md:30`. | Medium | Medium | **11** | State it: the simulated author is a demo-only construct, the control is visibly a demonstration (11:18 already says so), and the permission checked is the caller's `post:message` — not the agent's. One sentence in the spec removes the ambiguity. |
| **R11** | **The conformance suite's scope is split ambiguously between 06 and 11.** 03:13 delivers a conformance suite against the full interface, which includes `subscribe` (spec:306). 06:11 requires "the existing conformance suite passes against it unchanged" — but the stream is a server route, not a server function (spec:341), so `subscribe` cannot pass at 06. 11 then has to run the same half. Nothing says which half each owns. | High | Medium | **06** | Say it in 03: the conformance suite is two files — request/response and stream — and 06 runs the first, 11 the second, with the second skipped (not deleted) until 11. |
| **R12** | **Store-instance identity across dev reloads.** 06:12 requires a single in-process instance "shared by all requests". A module-scope singleton in a Vite dev server is re-created on HMR, so "two browsers see one workspace" becomes intermittently false in exactly the environment the route seam will run in, and the reset-store story (R5) becomes unreproducible. Nothing in 02 or 06 addresses instance identity. | Medium | Medium | **06** | One line: the store is pinned on `globalThis` (or equivalent) so reloads keep identity, with a dev-mode assertion. |
| **R13** | **Three vocabulary rows have no operation, and one permission combination is unusable.** `update:board` exists in the vocabulary (`spec:398`) with no operation, no ticket and no UI. `read:member` likewise has no read behind it (§4.2) — and because no ticket owns it, 07:11 can only test the *refusal* half ("`read:member` is separate"), never the grant half. And `readPositions` requires `read:thread` (`spec:316`) while the only way to reach a thread's entries is `read:board` (`spec:314`), so a principal granted `read:thread` alone can read every principal's progress but not a single entry — a combination the vocabulary permits and no ticket reasons about. | Medium | Low | **07** | Either implement `update:board`/`read:member` or remove them from this spec revision, and state which permission combination `readPositions` is actually for. |
| **R14** | **The accessibility criteria are asserted where there is nothing to check, and never re-asserted.** 01:15 asserts the 11px/13px floors and AA contrast against the real background — at a point when the app "shows nothing but a placeholder" (01:3). No later ticket re-asserts them at the route seam, and 15's list does not include them. `DESIGN.md:172` (the 11px Floor Rule) and `DESIGN.md:270` ("both floors are tested") make them load-bearing. Same for story 135 (screen-reader announcement of arriving entries): grep finds no `aria-live`/announce in any ticket. | Medium | Medium | **13 / 15** | Move the floors-and-contrast check to 13 (first ticket with real text at every width) and add the announcement region to 11 or 13. Delete the assertion from 01 or restate it as "the token set carries the type scale". |
| **R15** | **Nothing gates on tests, ever.** 01:16 gates on `build`/`tsc`/`check`; no ticket's acceptance includes `npm test` (grep across all 15: `npm test` → 0 hits); the only CI workflow is `.github/workflows/check-skills.yml` (skills only). A test suite that nothing runs is documentation with a maintenance cost. | High | Medium (slow) | **02** | Add `npm test` to 02's and 06's gates, and one app job to CI (build + tsc + biome + vitest). Playwright can stay manual/nightly. |
| **R16** | **Two parity features have no owning ticket.** Story 17 (thread details side panel: creation date, message count, last sequence, participants) and story 24 (the thread intro naming who started it and when) are both verified in the prototype — `app.js:180` renders the thread drawer with "Messages"/"Last sequence"/"Created"/participants, `app.js:155` renders the intro, and `QA.md:22` records "the thread details drawer reports 'Messages 9' / 'Last sequence #9' and closes on `Escape`" as a **pass**. Grep across all 15 tickets finds no `creator`, `started`, `side panel`, `details panel` or `participants` (except 04:11's People tab, a different surface). Ticket 15:9 requires parity with `QA.md`'s verified list, so 15 inherits two unimplemented features and no ticket to blame. | Certain | High | **15** (silently) | Add the thread-details panel to ticket 12 (it is the natural home — it already owns "how far each principal has got") or to 05, and add the intro to 05. One checklist line each. |

### The four I would escalate today

**R1 (who the browser is), R2 (the missing principal read) and R16 (two parity features with no ticket) are spec-level.** They are not "the ticket was vague" — each is a contradiction between two things the plan asserts. Fixing R1 after 06 is a rewrite of the session seam; fixing them now is three paragraphs and four checklist items.

**R6 (Vercel) is the one I would fix in code rather than prose.** The spec chose documentation over mechanism (spec:511), and the repo has no ticket to even write that documentation. `NOTES.md:308–346` proves the trap is live: a serverless build of this app *succeeds today*.

---

## 4. Gaps and contradictions

### 4.1 Identity of the human session — undecided, load-bearing (R1)

The four things the spec says, and how they fail to compose:

- spec:352 — "A browser receives a signed, `HttpOnly`, `SameSite=Lax` workspace session cookie on first request, naming the principal it acts as."
- spec:360 — "A human arrives already provisioned; an agent arrives as a stranger and waits."
- spec:406 — "Provisioning the first superadmin is an out-of-band act — the store is seeded with one."
- spec:602 — "A session is per browser; there is no account to sign into from a second device."

If the cookie names a **seeded** principal, every browser in the world is the same human: `cursor`/`seen`/`acknowledged` are per-principal (spec:479), so two browsers fight over one read position, and 06:13's "two independent browser sessions" is really "one principal in two windows" — which is fine as a demo but is not what 06:13 claims to prove, and it breaks 11:14's "read position survives a page reload" for the second window.

If the server **mints** a principal per browser, then: what grant does it hold (R8's matrix), is it a member of the demo boards (06:13 needs yes), and is `read:board` on all demo boards the *default for an unauthenticated stranger* — which sits badly beside spec:469's care about who may touch what, and beside the honesty rule that the UI must not overclaim.

Third possibility, which the spec never names: the reader is `alex`, the prototype's hard-coded self — 25 lines of `app.js` reference that literal (e.g. `app.js:96` pending/visibility filter, `:130` `visibleMessages`, `:135` unread count, `:152` `is-mine`, `:178` `authorId:'alex'`, `:197` the self drawer) — and every browser is Alex. That is what the prototype does, it is the cheapest port, and it makes 14:11's "a purge leaves the reader's principal … intact" trivial. But it is a decision, and it must be written down, because 06/07/08/12/14 all read it.

### 4.2 The principal read (R2)

Spec:441 promises it; spec:282–307 does not contain it; 03:10 does not list it; 04, 07 and 12 all need it. This is the single clearest defect in the plan: a promise in one section, absent from the decision that supersedes it.

### 4.3 How the permission check is reached (R9)

Three readings, all in the documents:

| Where | Says |
| --- | --- |
| spec:270 | module 3 is "the middleware that resolves the acting principal and its grant for everything else" |
| 07:12 | "Every participant operation declares and enforces the one permission it requires, **in the server function** rather than in the UI" |
| 03:14 | "Every operation that requires a grant **declares** which one it requires; the check itself arrives with ticket 07" |

These can be reconciled — operations declare `{ permission, scopeOf(input) }`, middleware enforces — but only if someone says so, and 03 is where the declaration's *shape* is frozen. Middleware alone cannot work: the scope is per-input (a board id inside the payload), `read:board` implies two other permissions (spec:402), and the admission and grant surfaces must run *without* a participant grant (spec:329–330). Say all three of those things in 03 and the ambiguity disappears.

### 4.4 "Reset the store" for a shared in-process store (R5)

Spec:558: "Every route-seam test starts from a reset store so runs do not depend on each other." 15:12 repeats it as acceptance. 06:12: "The store is a single in-process instance shared by all requests."

Three questions nobody answers: *what* resets it (an operation? a route? a process restart?), *who may* reset it (anyone? — then the product ships an unauthenticated wipe), and *how* reset composes with parallel Playwright workers. Note the interaction with 14: restore re-seeds demo content; a reset is not a purge (`spec:468`) and the two must not be confused in the harness.

### 4.5 The demo-purge story vs an in-memory store

The purge/restore model is coherent (spec:463–472), with two loose ends:

- **Restore idempotency needs stable seed ids.** Spec:470 requires restore to be "additive and idempotent — without duplicating whatever survived", and 14:14 repeats it. That is only possible if the seed's board/thread/entry/principal ids are **deterministic**. The prototype generates ids at runtime (`uid()` at `app.js:11`, used at `app.js:115–117`) and the seed uses literals (`'platform'`, `seed-delivery-3`, `app.js:30, 50`). Ticket 02 is the only ticket that can pin this, and it does not mention ids. If it generates them, 14's restore duplicates silently.
- **Principals are demo-origin but must never be purged.** Spec:467 lists origins for "boards, threads, entries and resources" and deliberately omits principals — correct, because purging an author would make history anonymous (spec:380). 14:9 matches. Good. But this means after purge+restore the demo principals must be matched, not re-created — again stable ids.
- **Purge tells subscribers** (14:15) needs 11. See R7.

One thing worth saying louder in 14's *copy* criteria: the purge removes the reader's own entries on demo boards (spec:469). 14:12 requires a count and a confirmation, which is right. But `AGENTS.md`'s honesty convention ("Never claim a guarantee the implementation does not make") is also about the reverse: the store is in-memory (spec:502), so the reader's surviving work is not durable either. 14:16 covers it. Fine — but the confirmation dialog must not imply that the *kept* work is safe, only that it is not purged. That is a copy decision worth one line in `DESIGN.md:257`'s purge entry.

### 4.6 Admission polling without a queue or scheduler

Polling itself is fine and needs no scheduler: expiry is evaluated lazily on the next request (spec:370, 08:15), so a bounded admission expires without a timer. Two things to note:

- **Unbounded pending state.** A knock is unauthenticated (spec:366) and the store is in-memory with no eviction. Nothing caps pending requests, nothing rate-limits them, and nothing says what happens when a knock is never decided. For a demo this is fine; it must be *stated* as fine, because `PRODUCT.md:72` forbids overclaiming and the interface will show a pending list.
- **The gate's reachability.** Spec:376 says a board with no active gate holder is still joinable because a superadmin holds `admit:agent` at workspace scope. That depends entirely on the seeded superadmin (R1/R8) existing and holding it. If the seed's grant matrix does not include a workspace-scope gate holder, 08's "A human holding `admit:agent` sees pending requests" (08:11) has no possible actor in a fresh workspace.

### 4.7 Smaller gaps worth naming

- **Two prototype features have no ticket** (R16): the thread details side panel (story 17, verified by `QA.md:22`) and the thread intro (story 24, `app.js:155`). Both are parity-relevant, so 15 is on the hook for them.
- **In-thread search has no earlier home.** It is a 13:14 requirement and a `QA.md:27` gap; ticket 05 builds the conversation and does not include it, so 13 carries both the feature and the responsive entry point. Acceptable, but 13 is already L.
- **Story 144 (tokens traceable to `DESIGN.md`) has no verification.** 01:13 asserts tokens are "named after `DESIGN.md`"; nothing asserts the reverse direction (DESIGN ≠ stylesheet drift), which is the property that matters.
- **The read position's client half.** Spec:482 says `localStorage` retains "exactly one thing on the client: a remembered last location". Ticket 04 puts location in the URL (correct, and better) — so nothing is left for `localStorage` to hold, and story 145 is satisfied by the URL. Worth one line so a later implementer does not add a redundant persisted location.
- **`QA.md:5`'s harness is `%TEMP%\relayboard-qa\run-qa.js`** — outside the repo, not reproducible. 15 must not inherit that: the route seam has to live in the repository (spec:585 asks for "a re-runnable harness", and a `%TEMP%` script is not one).
- **Skills packaging.** 15:16 requires the skills to describe the app and the review gate to pass. The app consumes the skills from a **vendored tarball** (`apps/relayboard-web/package.json`: `"@relayboard/skills": "file:vendor/relayboard-skills-0.1.0.tgz"`, and `NOTES.md:460–534` records the pack-and-copy ritual). Updating the guidance therefore requires: rewrite 3 `SKILL.md` + 3 `docs/*.md` → regenerate `skills/_artifacts` → `npm run skills:check` → **`npm pack` → copy into `vendor/` → `npm install`**. That is four extra mechanical steps no ticket names, and it does not fit in the ticket as written.

---

## 5. Scaffold reconciliation — auditing ticket 01 against `apps/relayboard-web`

Ticket 01 has eight acceptance criteria (01:9–16). I checked each against the actual tree. **The ticket is right about everything it names, and misses eight things that are present in the scaffold and conflict with something normative.**

### 5.1 What 01 covers correctly

| 01 criterion | Verified present | Where |
| --- | --- | --- |
| Starter routes gone | `/about`, `/demo/tanstack-query` | `src/routes/about.tsx`, `src/routes/demo/tanstack-query.tsx` |
| Header/footer/devtools gone | `Header`, `Footer`, `TanStackDevtools` + two devtools panels | `src/routes/__root.tsx:1, 9–10, 53, 55, 56–65` |
| No theme toggle, no dark block, no `prefers-color-scheme` | `ThemeToggle`, `THEME_INIT_SCRIPT`, `:root[data-theme="dark"]`, `@media (prefers-color-scheme: dark)` | `src/components/ThemeToggle.tsx` (whole file), `__root.tsx:18, 48–49`, `src/styles.css:32, 54–55` |
| No external font host | Google Fonts `@import` for Fraunces + Manrope | `src/styles.css:2` |
| Tokens named after the design system | `@theme { --font-sans: "Manrope" … }` must be replaced | `src/styles.css:6–8` |
| `prefers-reduced-motion` | Absent entirely — must be added | (none) |
| Build/tsc/biome pass | All three currently pass on a clean tree | `NOTES.md:397–405` |

### 5.2 What 01 misses

| # | Missed item | Evidence | Why it conflicts |
| --- | --- | --- | --- |
| **M1** | **The body's radial-gradient wash, fixed `body::before` glow and `body::after` grid.** | `src/styles.css:88–101` (the four-layer `background` at 93–97), `:103–114` (`body::before`), `:116–128` (`body::after`) | `DESIGN.md:283` ("Don't add a colored glow, gradient wash, or radial halo to any surface") and `DESIGN.md:130` ("Flat at rest"). This is not chrome you can leave; it is the scaffold's *world*, layered behind every screen. 01:9–14 does not mention it. |
| **M2** | **`overflow-x: hidden` on `body`.** | `src/styles.css:98` | It makes 13:9 and 15's "no horizontal scrolling" assertion **vacuously true** — `documentElement.scrollWidth === clientWidth` holds when overflow is clipped. The prototype has the same property (`styles.css` html/body `overflow: hidden`), so `QA.md:20`'s "No horizontal overflow" result is also weaker than it reads. If the scaffold's `overflow-x: hidden` survives into the app, ticket 13's headline criterion cannot fail, and a real overflow bug ships green. Delete it, and make 13 assert on the scrollable content box, not `documentElement`. |
| **M3** | **The teal hard-coded at the body call site.** | `src/routes/__root.tsx:52`: `selection:bg-[rgba(79,184,178,0.24)]` | 01:13 requires "no component hard-codes a hex value". An rgba literal in the root shell is exactly that, in the one file 01 must rewrite. |
| **M4** | **The devtools Vite plugin, the devtools integration module, and four dependencies.** | `vite.config.ts:2, 12` (`devtools()`); `src/integrations/tanstack-query/devtools.tsx` (its only consumer is the panel); `package.json` deps `@tanstack/react-devtools`, `@tanstack/react-query-devtools`, `@tanstack/react-router-devtools`, `@tanstack/devtools-vite` | 01:10 removes the *panel*. The plugin injects instrumentation in dev and stays wired; the integration file exists only to render the panel; four packages become unconsumed. Also `@tailwindcss/typography` (`src/styles.css:4`, `package.json`) exists for the marketing prose on the starter pages. Leaving dead wiring contradicts story 140 ("nothing in the application is scaffolding"). |
| **M5** | **`<html suppressHydrationWarning>` and `title: "TanStack Start Starter"`.** | `src/routes/__root.tsx:31, 46` | `suppressHydrationWarning` exists *only* because the pre-paint theme script mutates `documentElement`; once the script goes (01:11) the suppression is a workaround for a problem that no longer exists — exactly the argument spec:257 uses for deleting the script itself. The page title is scaffold identity. |
| **M6** | **The remainder of the starter's CSS vocabulary.** | `src/styles.css` (464 lines total): `.page-wrap` (158–161), `.display-title` + `Fraunces` (163–165), `.island-shell` (167–175), `.demo-*` (190–391, ~200 lines), the shared `button/.island-shell/a` transition (393–398), `.island-kicker` (400–406), `.nav-link` and its pseudo-elements plus a 640px media query (408–443), `.site-footer` (445–448), `.rise-in` + `@keyframes` (450–463) | 01:9 says "the starter routes **and their styles** are gone". The `.demo-*` block is ~200 of the file's ~450 content lines and is only reachable from the two deleted routes; `.island-shell` carries `backdrop-filter: blur(4px)`, which `DESIGN.md:130` rules out. Naming the deletion explicitly costs one line and prevents a 464-line file being "edited" into 400 lines of orphaned rules. |
| **M7** | **`vercel.json` and the unpinned Nitro preset.** | `vercel.json:1–4`; `vite.config.ts:7, 12`; contradiction resolved at spec:504–512; trap measured at `NOTES.md:308–346` | Not strictly "scaffold identity", but it is the one scaffold artefact that *contradicts a spec decision*, it is inert only if someone remembers, and 01 is the only ticket that touches build configuration. See R6. |
| **M8** | **No `public/` directory, so "the font is self-hosted" has no destination.** | `apps/relayboard-web/public` does not exist; font at repo-root `fonts/ibm-plex-sans-latin.woff2`, referenced `styles.css:6` | 01:12 requires the body to compute to the self-hosted face in a production build. Where the file lands (`public/fonts/` + `url('/fonts/…')` vs a `src/assets` import) is a decision the ticket must state, or 01 fails its own criterion at `npm run build`. |

**Verdict on 01:** correct in intent, incomplete as a checklist. M1–M6 must be added to the ticket; M8 is a decision the ticket must state; M7 belongs here because no other ticket will take it. Note also that 01:15 (the type/contrast floors) is being asserted at the one moment in the project when there is no product text on screen to assert them against — see R14.

---

## 6. Definition of done

**Is completion defined?** Partially, and not in a way that survives contact with ticket 15.

Spec:621 says: "The parity checklist is the definition of done for the port. It is the `Verified` list in `QA.md` plus the behaviours that file filed under `Not verified`." 15:9–18 then elaborates it into ten checklist items.

Four problems, plus one of scope:

1. **The parity list contains assertions the route seam forbids.** `QA.md:11` asserts "state seeded under `relayboard-demo-v3` (version 3)" and `QA.md:14` asserts "delivery cursor 9, 9 bubbles rendered". Spec:536 explicitly forbids exactly that shape of assertion ("not 'the store's `cursors` object has key `delivery` set to 10'"). So 15:9's "covers every behaviour in `QA.md`'s verified list" is **literally unsatisfiable** while honouring spec:536. 15 must reinterpret each of the 64 assertions (`QA.md:9`) into an observable one — a real, substantial analysis task, not a copy-paste, and it is not in the ticket.
2. **The DoD grades its own homework.** `QA.md:3` says "ticket 15 … replaces this file". So the ticket that is judged against `QA.md` is also the ticket that rewrites `QA.md`. A weaker rewritten `QA.md` is a passing 15. **Freeze the list now**: copy the 64 assertions into a version-pinned checklist (in the issues directory, or as 15's appendix) *before* ticket 06, and make 15 "satisfy the frozen list" rather than "cover the list".
3. **Parity does not cover the new product at all.** The port's headline features — named scoped permissions (07), admission (08), authored acts (10), purge (14) — have **no prototype counterpart** and therefore no place in `QA.md`'s verified list. Their acceptance lives only in their own checklists, plus the API-level Admission seam list (spec:560–575). Nothing provides an end-to-end proof of admission *through its UI*, even though the admission decision surface is a `DESIGN.md` component (`DESIGN.md:248–256`) and its wrongness is the spec's stated worst failure (`spec:625`: "If those two sides ever look alike, the honesty commitment is broken in the one screen built to enforce it"). Spec:621's claim that parity *is* the definition of done is therefore wrong for this project; the DoD is **parity + new-surface acceptance**, and no ticket collects the second half.
4. **Three of 15's own criteria are already true.** 15:14 requires `DESIGN.md` and its sidecar to document the admission surface, an act entry and the purge confirmation — they already do (`DESIGN.md:239–263`; `.impeccable/design.json:512` Act Entry, `:520` Admission Request Row, `:528` Purge Confirmation, each with HTML + CSS). 15:15 requires `PRODUCT.md` to record the permission model, admission cycle and purge boundary — it already does (`PRODUCT.md:16, 41, 46`). 15:17 requires the root `AGENTS.md` authorship convention to cover "being admitted grants nothing" — it already says "This holds twice over for agents: **being admitted grants nothing**". These are not defects, but they mean 15's checklist was written against an older doc state, and 15 must *verify* them (a diff check) rather than *write* them. As written, an agent could claim 15:14/15/17 complete without reading anything.

**Is it achievable by the time 15 unblocks?** Yes in principle — 15 is blocked by 11, 12, 13, 14, so the app exists — but not at the size the ticket implies. See §7. And note the skills side (4.7): the vendored-tarball ritual means "the shipped agent skills describe the app" is a rewrite-plus-repackage-plus-gate job, not a doc edit. Add R16's two orphaned features and the parity target grows again.

**Verdict on the DoD:** it is defined, but it is defined *against a document ticket 15 is allowed to rewrite*, and it measures only the half of the product that existed before the port. Freeze the list, add a new-surface acceptance list, and the DoD becomes usable.

---

## 7. Estimation sanity

S (well under a session) · M (one session) · L (more than one session — should be split). No hours invented.

| # | Ticket | Size | Why |
| --- | --- | --- | --- |
| 01 | Scaffold shell | **M** | Delete + font + token block + reduced motion. M *provided* the styling method and font destination are decided first (§2.2); otherwise it is an L spent discovering them. |
| 02 | Store + canonical seq | **L** | Vitest from zero (no test tooling exists — `npm ls vitest` → empty), 7 principals + 3 boards + 10 threads + **31 entries** transcribed from `app.js:19–84`, an invented grant matrix (R8), origin tagging, a lock, plus the seq/idempotency/error-order tests. Two sessions minimum. **Split:** 02a store + seq + lock + tests against fixtures; 02b the demo seed as a fixture with count assertions. |
| 03 | Client interface + in-memory | **M** | Interface (~16 operations), delegating implementation, conformance suite. M — but only if R2's missing member/principal reads are added first, else it is an M plus a rewrite. |
| 04 | Navigation, boards, threads | **L** | First real UI: three-column grid, router with board + thread + three tab params + two validated search params, not-found state, thread rows with five data points and keyboard operation. Depends on the styling decision (§2.2) — utilities make it L; ported CSS makes it M. |
| 05 | Read and post | **L** | Chronology rendering with byline (author, kind, time, `#seq`), date dividers, reference jump, the thread intro (R16), composer at every width, keyboard send, disabled states, trim/empty rules, error retention, single-append guarantee. This is the densest behavioural ticket in the project. |
| 06 | Operations over HTTP | **L** | ~16 server functions with validators, the HTTP client, the conformance run against a live server, the store singleton (R12), and — undecided — session/principal resolution (R1), the env secret (R3) and the reset seam (R5). As written it is two tickets wearing one hat. **Split:** 06a server functions + HTTP client + conformance; 06b session, principal resolution, env, fail-fast start. |
| 07 | Scoped permissions | **M** | Vocabulary in one place, declaration shape, enforcement, refusal copy, the human/agent symmetric pairs, the gate rules, `read:member` separation. M — contingent on R9 and R13 being decided. |
| 08 | Admission and the gate | **L** | Knock, poll-with-secret, pending list UI, admit + permission-set chooser + expiry chooser, deny, revoke, credential hashing and constant-time compare, lazy expiry, derived fingerprint/issuer, the admission seam suite. Spec:627 itself says this is "the largest new surface". **Split** along the cut the spec already blesses: knock-and-be-admitted vs expiry-and-revocation. |
| 09 | Create board/thread/resource | **M** | Three dialogs, three permissions, URL validation, external-link safety, error retention, open-on-create. |
| 10 | Authored acts in chronology | **M** | Three entry kinds through one counter, act rendering distinct-but-quieter, artifact→resource pointer, refused-act atomicity, ack-is-not-approval. |
| 11 | Live, pause, replay over SSE | **L** | A server route, a subscription manager, per-subscriber pause state, replay from cursor with a count, `Last-Event-ID` reconnect, disconnected rendering, revocation drop, the demo control. This is where R6 and R10 both land. |
| 12 | Participant identity and progress | **M** | Drawer/panel with declared-vs-derived separation, three-watermark progress, revoked-authorship state, "authorship is not permission" copy, self-principal — plus (if R16 is taken here) the thread-details panel. Depends on R2's principal read. |
| 13 | Responsive and keyboard | **L** | Six viewport widths, three collapse stages, rail drawer + scrim, phone two-level navigation, in-thread search at every width (a gap the prototype never closed), truncation, four keyboard shortcuts, focus enter/return. |
| 14 | Demo purge and restore | **M** | Origin filtering, overlap count + confirmation, restore idempotency (needs stable seed ids — R8), subscription notice (needs 11 — R7), in-memory copy. |
| 15 | Parity and documentation | **L** | Playwright from zero, the reset strategy (R5), 64 assertions reinterpreted out of `QA.md` internals, the two former gaps, the scaffold assertions, plus rewriting `QA.md`, `DESIGN.md` + sidecar, `PRODUCT.md`, root `AGENTS.md`, three skills + three source docs, regenerating `_artifacts`, repacking the vendor tarball and passing the skills gate. **Should be split into at least 15a (suite + fixtures + reset) and 15b (docs + skills + repack).** |

**Tickets sized L: 02, 04, 05, 06, 08, 11, 13, 15 — eight of fifteen.**

That ratio is the finding. The slicing is at *feature* granularity, not at *session* granularity, so the 15-item list reads like 15 sessions of work and behaves like roughly twice that. Four of the eight (02, 06, 08, 15) can be split cleanly along seams the spec already draws — 08's split is spec:627's own proposal, and 15's second half is the skills repack — and three of those four sit on the critical path.

---

## 8. Where I disagree with the spec's own reasoning

**8.1 spec:504–512 — "leave `vercel.json` in place and document it as inert" is the weaker option.** `NOTES.md:308–346` measured that setting `VERCEL=1` makes the same `npm run build` succeed with the Vercel preset and emit `.vercel/output/functions/__server.func/…`. So the spec leaves a configuration whose *only* guard is a sentence in a document that no ticket is assigned to write. The failure mode the spec names — "it would appear to work until a second instance existed" (spec:512) — is exactly the failure mode a passing build produces. Pin the preset so the wrong target cannot be built. Documentation is not a mechanism, and here the mechanism costs one argument.

**8.2 spec:344 — the paused-subscriber queue is redundant state.** "A paused subscriber receives no events and the server holds the queue keyed by thread." But the store already holds every entry and the subscriber already has a `cursor` (spec:479), and the prototype replays *without any queue*: `setConnection` recomputes cursors from the last entry (app.js:118) and visibility is a filter on `seq <= cursor` (app.js:130). Replay is therefore "everything after my cursor", which cannot disagree with history. A queue is a *second* source of truth that must be kept consistent with the first across purge (14), revocation (11:17) and restart. Ticket 11 will implement the queue as described, then discover it must be reconciled. I'd delete the queue from the spec and implement replay from the cursor — the reference implementation already proves it works.

**8.3 spec:501 — the per-store async lock is probably machinery for a race that cannot exist.** Spec:269 says the store is "Synchronous internally; the transport layer adds asynchrony". If mutations are synchronous, Node's single thread already serialises them and `seq` cannot race. If they *can* race, the module boundary is wrong and an async lock is the symptom rather than the fix. Ticket 02:14 demands "a test that interleaves concurrent appends" — against a synchronous mutation, that test either passes trivially (proving nothing) or is flaky by construction. Better: assert atomicity *by construction* (one synchronous critical section) and test the observable property — two interleaved `appendMessage` awaits from separate client wrappers produce a gapless `1..n`. Same coverage, no lock, no flaky test.

**8.4 spec:621 — parity is the wrong definition of done, and the spec half-admits it.** "The parity checklist is the definition of done for the port." Four of the port's five headline features — permissions, admission, acts, purge — have no prototype counterpart, so they are invisible to a parity checklist; and the spec's own risk note (spec:625) says the admission surface is where the honesty commitment fails if it fails. A definition of done that cannot see the most dangerous screen is not a definition of done. Define it as parity **plus** an acceptance list for the new surfaces, and assign that list to a ticket (15, or a 15b).

**8.5 spec:469 — right decision, under-stated consequence.** Removing the reader's posts along with the demo board they sit on is correct (the alternative converts demo into permanent content). But combined with the in-memory store, the honest statement is not "your data survives a purge" but "your data is not purged; it is not saved either". `DESIGN.md:257`'s purge copy should carry that second clause, or the confirmation dialog will overclaim in the one place the product promised not to.

---

## 9. What a PM would demand before greenlighting

Ranked. The first five are blocking; the rest are conditions I would attach.

1. **Decide who a browser session is, in writing** (R1): minted per browser or a named seeded principal; its default grant; the seeded superadmin; whether the reader is `alex`. Add it to ticket 06. Without this, 06/07/12/14 each invent it and at least one will be wrong.
2. **Add the missing reads to `RelayboardClient`** (R2): a member list and a principal read, gated by `read:member`. This is a spec amendment (spec:282–307), not a ticket tweak, because spec:280 calls the interface "the decision". Do it before 03.
3. **Create the environment/secret work** (R3): a ticket or two checklist items on 06, carrying the measured `runtimeEnv` fix (`NOTES.md:292–305`) and story 151's fail-fast start.
4. **Pin the deployment target in `vite.config.ts`** (R6) and give `vercel.json` an owner in ticket 01. A passing serverless build is the trap; remove the build, don't annotate it.
5. **Decide the route seam's reset and parallelism story, and the conformance suite's 06/11 split** (R5, R11), recording both on tickets 06 and 03.
6. **Fix the three missing dependency edges** (R7): `14 ← 11`, `13 ← 11`, and `13 ← 12` — or move the panel criteria into 11/12.
7. **Decide admission renewal's identity key** (R4), or cut expiry/renewal from the first slice as spec:627 already permits. Do not ship story 100 with declared-value matching.
8. **Freeze the parity checklist now**, before 06: copy `QA.md`'s 64 assertions into a version-pinned list, marked with how each is reinterpreted as observable (spec:536 forbids the internals they currently assert). Otherwise 15 grades its own homework.
9. **Amend ticket 01** with M1–M8 from §5.2, and settle the styling method and token authority before it starts (§2.2). Give the two orphaned parity features (R16) an owner at the same time.
10. **Sequence 01 and 02's shared surfaces** (package/lockfile/tsconfig/biome): scope 01:16's gate or add the dependency; do not let two tickets run `npm install` in one tree.
11. **Add a test gate** to 02 and 06 (`npm test`), and one CI job for the app. Today the only workflow in the repo is `check-skills.yml`; a suite nothing runs is not verification.
12. **Adopt the two spec corrections in §8.2 and §8.3** — drop the paused-subscriber queue in favour of cursor replay, and drop the async lock (or say what it protects) — before 02 and 11 implement them as written.

---

## 10. Closing assessment

This is a strong plan with three holes in its floor. The tickets are small enough to hold in one head each, the acceptance criteria are observational rather than implementation-shaped (mostly), the reference implementation is present and measured, and the riskiest surface (admission) is the one the spec reasons about most carefully.

What it lacks is not rigour — it is **three decisions that were left to the tickets to make**: who the session is, how a principal is read, and whether the app's own configuration can boot. Each is a paragraph now. Each is a seam rewrite after ticket 06. And one ticket (01) is carrying a styling decision that determines the cost of four more.

Fix those, add the eight missed scaffold items and the three missing dependency edges, and the plan is deliverable. As it stands it will produce a working app that nobody has agreed is the same app.
