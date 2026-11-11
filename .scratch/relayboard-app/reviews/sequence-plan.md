# Sequence plan — the 30-ticket Relayboard port

**Purpose:** the order the work is built in, what can run side by side without colliding, and
what is still broken before anyone starts. Not an implementation.

**Status of the two prior reviews.** Both were read in full. Where the restructure fixed a
finding I say so in §5.0; where it only half-fixed one, that is usually the top of the ranked
list in §5. **The single most important finding in this document is not in either review**: the
two participant reads added by spec revision 8 were wired into tickets 03, 04b and 12 but never
into 06a's read list, so the HTTP implementation cannot satisfy the contract suite that 06c
schedules (§5.1).

---

## 0. What was verified, and how

Read in this session, in full: all 30 ticket files in `.scratch/relayboard-app/issues/`;
`.scratch/relayboard-app/spec.md` (all 642 lines); both reviews; `GLOSSARY.md`, `AGENTS.md`,
`PRODUCT.md`, `DESIGN.md`, `QA.md`, `app.js` (all 229 lines); `apps/relayboard-web`'s
`package.json`, `vite.config.ts`, `tsconfig.json`, `biome.json`, `vercel.json`, `tsr.config.json`,
`.gitignore`, `src/routes/__root.tsx`, `src/env.ts`, `src/router.tsx`, `src/routeTree.gen.ts`,
`src/integrations/**`, `src/styles.css` (structure and line count), `NOTES.md` §5, §6, §7, §9,
§11–12; root `styles.css` token block; `packages/relayboard-skills/docs/mock-api.md` L18–28;
`.impeccable/design.json` component names.

Measured, not assumed:

| Claim | How it was checked | Result |
| --- | --- | --- |
| 30 ticket files | directory listing | 30 |
| ticket count by kind | parse | **6 unsplit + 24 sub-issues** (the brief says "12 unsplit plus 18 sub-issues"; it is 6 + 24) |
| acceptance criteria | `grep -c '^- \[ \]'` per file | **317** |
| dangling ticket references | parse of every `**Blocked by:**` | none |
| cycles | Kahn's algorithm over the parsed graph | none — 30 of 30 topologically ordered |
| `vitest` installed | `node_modules/vitest/package.json` | **absent**, and no `vitest` entry in `package-lock.json` |
| `@playwright/test` installed | `node_modules/@playwright/test/package.json` | **absent**, none in the lockfile |
| `apps/relayboard-web/public/` | `Test-Path` | **does not exist** |
| font asset | `Get-ChildItem fonts` | `ibm-plex-sans-latin.woff2`, 45,712 bytes |
| CI workflows | `.github/**` | only `check-skills.yml` |
| `src/styles.css` | line count | 464 lines |
| root `styles.css` | line count | 2,316 lines |
| `DESIGN.md` | line count + frontmatter keys | 288 lines, 23 colour keys |
| `biome.json` `files.includes` | read | `**/src/**/*`, `**/.vscode/**/*`, `**/index.html`, `**/vite.config.ts`, minus `routeTree.gen.ts` and `styles.css` |
| `env.ts` imported anywhere | grep over `src/` | **no importer** — matches `NOTES.md` L231–232 |
| server entry point | `Test-Path` for `src/server.ts`, `start.ts`, `entry-server.tsx`, `app.config.ts` | **none exists** |
| skills are consumed from a tarball | `package.json` L20 | `"@relayboard/skills": "file:vendor/relayboard-skills-0.1.0.tgz"` |

Every citation below is `file:line` within `.scratch/relayboard-app/issues/` unless prefixed
`spec`, `DESIGN`, `QA`, `app.js`, `NOTES` or `styles.css` (which is always the repo-root one).

---

## 1. The graph, verified

Parsed from the tickets' own `**Blocked by:**` lines with a script, not by reading.

**Totals.** 30 tickets (6 unsplit: `01`, `03`, `05`, `09`, `12`, `14`; 24 sub-issues: `02a–c`,
`04a–c`, `06a–c`, `07a–b`, `08a–c`, `10a–b`, `11a–c`, `13a–b`, `15a–c`). **317 acceptance
criteria.** The nine parent ids the sub-issues carry in `**From:**` (`02`, `04`, `06`, `07`,
`08`, `10`, `11`, `13`, `15`) have no file and are not references — no `Blocked by` line names
one.

**Missing references:** none. Every id in every `Blocked by` line exists as a file.

**Cycles:** none. The graph is a forest with two roots (`01`, `02a`) and one sink (`15c`).

**Complete topological order** (ties broken by filename order; this is one valid order of many):

```
01  02a  02b  02c  03  04a  04b  04c  05  06a  06b  06c  07a  07b
08a  08b  08c  09  10a  10b  11a  11b  11c  12  13a  13b  14  15a  15b  15c
```

The graph, as verified:

```
01 ─────────────────┐
                    ├─→ 04a → 04b → 04c → 05 ────────────────┐
02a → 02b → 02c → 03 ┤                                        │
                    ├─→ 06a → 06b → 06c → 07a → 07b ─┬─→ 09 ──┼──→ 13a → 13b ──┐
                    │                                ├─→ 10a → 10b ─┬─→ 11a → 11b → 11c ─┬─→ 13a
                    │                                │              │        ┌────→ 12 ────┘
                    │                                └─→ 08a → 08b → 08c ─┬─→ 11c
                    │                                                     └─→ 12
                    │                                           09 ─┬─→ 13a
                    │                                               └─→ 14 ─┐
                    └───────────────────────────────────────────────────────┴─→ 15a → 15b → 15c
```

(Read the diagram for shape only; the parse in the table below is authoritative.)

| Ticket | Blocked by | Ticket | Blocked by |
| --- | --- | --- | --- |
| 01 | — | 08b | 08a |
| 02a | — | 08c | 08b |
| 02b | 02a | 09 | 07b |
| 02c | 02b | 10a | 07b |
| 03 | 02c | 10b | 10a |
| 04a | 01, 03 | 11a | 10b |
| 04b | 04a | 11b | 11a |
| 04c | 04b | 11c | 11b, 08c |
| 05 | 04c | 12 | 08c, 10b, 07a |
| 06a | 03 | 13a | 05, 09, 04c, 11c, 12 |
| 06b | 06a | 13b | 13a |
| 06c | 06b | 14 | 09, 11c |
| 07a | 03, 06c | 15a | 11c, 12, 13b, 14 |
| 07b | 07a | 15b | 15a |
| 08a | 07b | 15c | 15b |

### Defects in the graph

**Two edges are missing. Both are the "a criterion needs something a later ticket builds, or a
same-wave sibling builds" shape.**

**D1 — `06c ← 04c` is missing.** `06c:20` reads: *"Two independent browser sessions see the same
boards, threads and entries — asserted once with the route-seam harness from 04c, so the claim is
checked rather than described."* `04c` is the ticket that builds that harness (`04c:11`), and
nothing else in the plan does. Both sit at graph depth 7 (`04a` is blocked by `03` as well as
`01`, so `04c` = `01/03 → 04a → 04b → 04c`; `06c` = `03 → 06a → 06b → 06c`), so **06c and 04c are
same-wave siblings and the engineer on 06c cannot write its eleventh criterion until 04c lands.**

Correct edge: `06c ← 04c`. Cost of adding it: 06c becomes depth 8, 07a depth 9, and **the whole
downstream tail moves one wave** — 06c is on the critical path (§4). Recommendation in §2: treat
it as a *soft* edge inside one wave (04c first, then 06c's last criterion) rather than a hard one,
because the other ten of 06c's criteria need nothing from 04c.

**D2 — `13b ← 14` is missing.** `13b:18` requires the new surfaces to trap and restore focus:
*"the admission decision surface (08b), the purge confirmation (14) and the act controls (10b)"*.
08b is depth 11 and 10b is depth 11, both safely behind 13b (depth 16). **14 is depth 15 — the
same wave as 13a, one wave ahead of 13b in a strictly levelled schedule, but with no edge.**
Nothing stops 13b being marked green while the purge confirmation does not exist. Adding the edge
costs nothing in schedule (14 < 13b at every depth computation I ran) and makes the criterion
gradable.

Correct edge: `13b ← 14`.

### Edges that look missing but are not defects

- `09 ← 04b` — 09's dialogs ("a newly created board opens immediately", `09:12`) need the board
  route from 04a and the thread pane from 04b, but 09 resolves at depth 10 and 04b at depth 6, so
  under any sensible schedule 04b is done four waves earlier. Timing saves it; a strict
  read-the-blockers scheduler would not. Worth recording, not worth an edge.
- `10a ← 03`/`06c` — 10a widens `RelayboardClient`, which 03 declares and 06c implements, but
  `07b` (which 10a is blocked by) is downstream of both. Transitive and safe.
- `11a ← 06b` — the SSE route authenticates through 06b's resolver (`11a:11`); 06b is depth 6,
  11a depth 12. Safe.
- `04c ← 06a` — `04c:13` wants "the reset hook, once 06a provides one". 06a is depth 5, 04c
  depth 7: the hook exists first. The parenthetical is over-cautious, not wrong.

---

## 2. Sequence of work, in waves

A wave below is a set of tickets I would put in flight together **after** both the graph and the
write scopes are reconciled. Where I have had to break a same-depth group apart, or merge a
readiness-serial pair, the reason is given.

The `npm test` and `npm run e2e` commands referenced in the gates **do not exist today** (verified:
neither `vitest` nor `@playwright/test` is in `node_modules` or the lockfile). `npm test` arrives
in 02a, `npm run e2e` in 04c. Gates before those waves use `npm run build`, `npx tsc --noEmit` and
`npm run check` only, which run today (`NOTES.md` §9, L397).

### W0 — Decisions (no code)
Not a ticket. §7 of this document. Cannot be skipped: two of the four decisions are rewrites if
deferred.

**Gate:** the four decisions in §7 are written into the spec or the affected ticket, not into a
chat.

### W1 — `01`, `02a` (two engineers, shared-file handoff)
- **01** produces the Relayboard shell: starter chrome, devtools packages, theme toggle, gradient
  wash and `overflow-x` gone; `DESIGN.md` tokens in `@theme`; the self-hosted face; the Nitro
  preset pinned. Files: `vite.config.ts`, `tsconfig.json`, `biome.json`, `src/styles.css`,
  `src/routes/**`, `src/components/**`, `package.json`, `public/`.
- **02a** produces the test floor: `vitest.config.ts`, a `test` script, the widened Biome globs,
  and `src/domain` types (`Principal`, `Board`, `Thread`, `Entry` as a one-member union,
  `Resource`, `Origin`, `Seq`, the watermark triple). Files: `vitest.config.ts`, `src/domain/**`,
  `tests/**`, plus two edits to `package.json` and `biome.json`.

**Collision:** `package.json`, `biome.json`, `package-lock.json` — see §3.1.
**Handoff:** 01 lands its `package.json` + `biome.json` edits in its first commit; 02a works on
`src/domain` and `vitest.config.ts` until then and appends its `test` script line and Biome globs
afterwards. No two `npm install` runs may overlap.

**Gate:** from `apps/relayboard-web`, `npm run build && npx tsc --noEmit && npm run check` all
exit 0; `npm test` runs a trivial Vitest suite in Node with no DOM and no network and exits 0;
`/about` and `/demo/tanstack-query` do not resolve; `document.title` is not "TanStack Start
Starter"; `grep -r 'fonts.googleapis.com' src/` is empty; `vercel.json`'s fate matches the §7
decision; `vite.config.ts` contains an explicit `node-server` preset; all 12 of 01's criteria and
all 11 of 02a's are ticked against that evidence.

### W2 — `02b`
The store factory, per-thread gapless `seq`, the documented error strings, idempotent replay,
independent `cursor`/`seen`, origin on every entry — **but see §5.4: 02b:15's lock criterion
contradicts spec L512 and must be replaced before this ticket is worked.**

**Gate:** `npm test` green; 02b's eleven criteria ticked, with the lock criterion replaced by the
explicit synchronous-ordering assertion (single synchronous `seq`-and-insert step, no `await`
between them).

### W3 — `02c`
The demo seed transcribed from `app.js` L19–84 with `origin: "demo"` on everything, non-monotonic
`createdAt`, the provisional membership predicate, the seeded superadmin, the seeded watermarks.

**Gate:** `npm test` green including 02b's suite run **against the seeded workspace**, not only
against fixtures; the counts in `QA.md` L11–18 are asserted (9 entries in `seed-delivery…`,
7 principals, 3 boards, 10 threads, 7 resources, 31 entries total); a test asserts one thread
where `createdAt` order ≠ `seq` order.

### W4 — `03`
The `RelayboardClient` interface, the two participant reads, `listBoards` returning member
counts, `Entry`-typed thread contents, and the conformance suite written against the interface.

**Gate:** `npm test` green: the suite passes against the in-memory client; `npx tsc --noEmit`
green; **and §5.5's suite-split decision is applied** so the file that will run at 06c does not
contain a `subscribe` assertion.

### W5 — `04a`, `06a` (parallel, disjoint)
- **04a**: route tree, board-in-URL, three validated search params, not-found inside the frame,
  the dark rail with unread counts, the `noRestrictedImports` guard.
- **06a**: read operations as server functions, one store per process, the HTTP read
  implementation, the test/dev-only reset, the in-memory honesty copy, and the deployment pin.

**Collision:** none on files (04a owns `src/routes/**`, `src/components/**`, `src/styles.css`;
06a owns server modules, the HTTP client and `vite.config.ts`). **06a:14 also pins the Nitro
preset that 01:21 already pins** — see §5.3.

**Gate:** `npm run build`, `npx tsc --noEmit`, `npm run check`, `npm test` all green; the read
half of the conformance suite passes against the HTTP implementation; the HTTP implementation
throws a named error on every write and on `subscribe`; the reset returns a fresh seed and is
unreachable when the app is not in test/dev mode; a second server context starts from the seed.

### W6 — `04b`, `06b` (parallel, disjoint)
- **04b**: thread pane with five data points per row, thread-in-URL, deep link, not-found,
  truncation, resources view, people view.
- **06b**: `SESSION_SECRET` required and non-optional, `runtimeEnv` including the process
  environment, `env.ts` imported by the server entry, `.env.example`, the signed `HttpOnly`
  cookie, one request-time resolver, the distinguishable unauthenticated refusal.

**Collision:** none. 04b writes `src/components/**` + `src/styles.css`; 06b writes `src/env.ts`,
the server entry, `.env.example`, `README.md`.
**Risk:** 06b's "server entry point" does not exist in this scaffold — see §5.9.

**Gate:** as W5, plus: 04b's twelve criteria; the app **fails to start** with `SESSION_SECRET`
unset (a startup failure, captured in the ticket, not a first-request failure); a first request
without a cookie gets one, and a second request resolves to the same principal; a request with an
unresolvable session gets a refusal distinguishable from a permission refusal and from a
validation failure.

### W7 — `04c`, `06c` (04c first inside the wave)
- **04c**: the Playwright harness, `npm run e2e`, Chromium, trace on failure, viewport helper,
  computed-style helper, clean state per test, and the scaffold-reconciliation assertions.
- **06c**: every mutation over HTTP with the author from the resolved principal, idempotency over
  the transport, the two-way conformance run wired into `npm test`, error-family mapping, the UI
  switched to the HTTP client, and the two-browser claim.

**Collision:** `package.json`/`package-lock.json`/`biome.json` (04c adds Playwright and the `e2e`
script and widens the globs). **06c's last criterion needs 04c's harness** (§1, D1).

**Gate:** `npm run e2e` green from a clean checkout with no manual server; `npm test` runs both
conformance variants and fails if either is skipped; a forged `authorId` in the request body is
ignored and the entry's author is the resolved principal; replaying a stored idempotency key
appends nothing; 06c's two-browser test passes **only after** 04c's harness has landed.

> **This is the first wave where the product's central claim is testable.** Everything before it
> is infrastructure or a single-browser illusion.

### W8 — `05`, `07a` (parallel, disjoint)
- **05**: the conversation — `seq` ordering, byline, date dividers, reference jump, thread intro,
  thread-details panel, in-thread search, composer, the two idempotency guards.
- **07a**: the permission vocabulary as one module, scoping, the `read:board` implication, the
  single declaration per operation, server-side enforcement before the handler, the refusal copy,
  the seeded grant matrix, the `kind`-occurrence guard, and the disabled-control rule.

**Collision:** 05 writes components + `styles.css`; 07a writes the permission module and the
server functions. Both touch nothing shared except the server-function files 06a/06c created
(07a only). **Decision 07a makes here binds 09, 10b and 12** (the "cannot do this" affordance) —
which is why they are all downstream of 07a and not of each other.

**Gate:** `npm test` + `npm run e2e` green; 05's fourteen criteria (see §5.16: 05 names no seam);
07a's twelve criteria including the literal-set vocabulary assertion and the four
independence pairs; a direct server-function call with no UI touch is still refused.

### W9 — `07b`
The two grant rules, the store-level `grant` operation, the scope-breadth rule, and the
single `kind` branch.

**Gate:** `npm test` green; each of 07b's nine criteria; the refusal shapes are distinguishable
from a missing-permission refusal. **See §5.12: 07b:19 asserts at the admission seam, which 08a
stands up one ticket later.**

### W10 — `08a`, `09`, `10a` (parallel **only with an arbitration on the store module**)
- **08a**: the knock surface (`knock`, `pollAdmission`, `listPending`, `admit`, `deny`), the
  polling secret's non-disclosure, per-board admission, the hashed bearer credential, the
  declared-vs-derived payload split, and the admission seam.
- **09**: create board / create thread / add resource, the URL validator, safe external links,
  error retention, and the shared disabled-control affordance from 07a.
- **10a**: `Entry` widened to four kinds through domain, store, client interface, HTTP validators
  and the conformance suite.

**Collision:** **08a and 10a both extend the store module** (§3.2). Everything else is disjoint:
09 is all components, 08a is a new surface + the resolver, 10a is domain/contract.
**Arbitration:** 10a owns the entry-writing path in the store; 08a owns a separate admissions
module and may only *append* principal records and grant records. Neither edits the other's
functions.

**Gate:** `npm test` + `npm run e2e` green; 08a's thirteen criteria including "the polling secret
appears in no other payload"; 09's nine; 10a's ten including "one resource record after two
threads attach it" and "a refused act consumes no `seq`".

### W11 — `08b`, `10b` (parallel, disjoint)
- **08b**: the gatekeeper's decision surface to `DESIGN.md` §248.
- **10b**: act rendering to `DESIGN.md` §239–246 as computed style.

**Collision:** both add to `src/styles.css` (append-only, disjoint selector blocks) and both touch
`src/components/**` (different files). 08b owns nothing 10b reads.

**Gate:** `npm run e2e` green; 08b's eleven (including "the rendered page contains no credential
or secret"); 10b's ten asserted as computed style (28px marker, one 13px line, Ink-muted, no
accent tokens on an acknowledgement).

### W12 — `08c`, `11a` (parallel, disjoint)
- **08c**: expiry, revocation, renewal, the derived issuer and fingerprint.
- **11a**: the SSE route, the eight-name event vocabulary written down, `Last-Event-ID`,
  cursor replay with a floor-verified count, `subscribe` on both clients, the deterministic
  terminate mechanism.

**Collision:** none on files. **Semantic collision: 11a still specifies a server-held queue that
spec L348 deleted** (§5.2), and 11b:14 computes the pending count from the cursor. 11a must be
corrected before it starts, or 11a and 11b will disagree about where replay comes from.

**Gate:** `npm test` (including the stream contract file) + `npm run e2e` green; 08c's eleven
(including "two credentials for one principal yield the same fingerprint" and "a supplied
`fingerprint` is ignored"); 11a's eleven (including "the emitted set equals the eight literal
names", "no client-side sequence arithmetic", "a paused subscriber receives no events").

### W13 — `11b`, `12` (parallel, disjoint)
- **11b**: live entries, the indicator, pause/resume with the replayed count in the prototype's
  wording, reload persistence, unavailable-stream rendering, the simulation control's honesty
  copy.
- **12**: the participant panel — kind, board permissions, derived vs declared, the three
  watermarks, revoked authorship, "authorship is not permission", self-principal.

**Collision:** both add to `src/styles.css` (append-only) and both render a side panel — 11b owns
the stream panel component, 12 owns the participant drawer component, and **12 owns
`src/components/participant-drawer` exclusively** (the same drawer 05:17 put counts into).
**Blocker for 12:** §5.7 — the "permission read" 12:19 requires does not exist.

**Gate:** `npm run e2e` green; 11b's eleven (including "pause → commit two → the view still shows
the pre-pause last entry while the entry count has risen"); 12's nine.

### W14 — `11c`
Revocation closes an open stream; the simulation control commits through the same path.

**Gate:** `npm run e2e` green including revocation-drops-the-stream; the contract seam covers the
revoked subscriber for both implementations.

### W15 — `13a`, `14` (parallel, arbitrated CSS)
- **13a**: the six-width geometry, rail→drawer at 980, phone two-level navigation, truncation,
  panel geometry, composer reachability, the in-thread search entry point at every width.
- **14**: origin-based purge, the overlap count and confirmation, additive idempotent restore,
  subscriber notification, session survival.

**Collision:** both change `src/styles.css` and both change the app frame. **13a owns the frame,
the grid and every media query. 14 owns exactly one new component file (the purge confirmation)
and may append a single namespaced selector block.** Neither edits the other's rules.
**Blockers for 14:** §5.10 (no permission to gate the purge on) and §5.11 (13b needs 14).

**Gate:** `npm run e2e` at all six widths — 320, 390, 680, 980, 1200, 1440 — green, measured with
the *corrected* overflow method (§5.6); 14's nine criteria; a purge leaves a post-payload
authorised post succeeding and the same grants resolving.

### W16 — `13b`
Keyboard operation and focus management.

**Gate:** `npm run e2e` at desktop and phone widths: `/` and `Ctrl/Cmd+K`, Escape closing exactly
one layer, real `toBeFocused()` assertions, a stated outline width, no positive `tabindex`, the
message region announced, focus not stolen from the composer.

### W17 — `15a`
The parity suite: twelve scenarios, ~64 assertions enumerated, the two former gaps as passing
tests, the scaffold assertions re-run, reset per test, order independence.

**Gate:** `npm test` + `npm run e2e` green, in a different order and individually; removing any
one behaviour fails the suite; a failure names behaviour, viewport and expectation.
**Blocker:** §5.17 — no frozen assertion list exists, so this ticket still grades its own
homework and can be satisfied by enumerating a shorter list.

### W18 — `15b`, `15c` (recommend parallel; the graph serialises them)
- **15b**: `QA.md` rewritten, `DESIGN.md`/sidecar re-verified, `PRODUCT.md`'s technical-state
  paragraph and users section, the permission table as capabilities, root `AGENTS.md` commands.
- **15c**: the two skills rewritten, the `relayboard-identity` exclusion removed, the skills gate
  passing, the one-page retirement record.

**Write scopes are disjoint** (`QA.md`, `DESIGN.md`, `.impeccable/design.json`, `PRODUCT.md`, root
`AGENTS.md` versus `packages/relayboard-skills/**`, `apps/relayboard-web/package.json`,
`INTENT.md`) and **both need only 15a**. Re-slice `15c ← 15a` instead of `15c ← 15b`: it removes
one wave from the tail with no collision. (15c's "blocking reason recorded in the file" clause
means it does not depend on 15b's `DESIGN.md` work either way.)

**Gate:** `npm run skills:check` and `npm run skills:validate` at the repo root both exit 0;
`npx intent list --json` shows `relayboard-identity` and not the exclusion; **the vendored tarball
is repacked and reinstalled** (§5.18); 15b's eight and 15c's ten criteria.

---

## 3. Write-scope collision analysis

Only **two of the 30 tickets carry a write scope** (`01:26`, and 14's `**Write note:**` at
`14:19`). For the other 28 the scope below is inferred from the criteria and from what
`apps/relayboard-web` contains today (13 files under `src/`: 3 components, 4 route files,
2 integration files, `router.tsx`, `routeTree.gen.ts`, `env.ts`, a 464-line `styles.css`;
no `tests/`, no `e2e/`, no `public/`).

### 3.1 The three build-config writers — `W1` and `W7`

| Surface | Today | Writers | Same wave? | Who owns | What the other must do |
| --- | --- | --- | --- | --- | --- |
| `vite.config.ts` | 15 lines, bare `nitro()` (L7, L12), `devtools()` (L2) | **01** (delete `devtools()`, pin `node-server`), **06a** (`06a:14` pins the same preset) | no (W1 vs W5) | **01** | 06a must **delete its own preset criterion** and instead verify 01's pin still holds and that a `VERCEL=1` build now fails. Two tickets asserting the same one-line edit means the second is vacuous (§5.3). |
| `package.json` | 62 lines; four devtools packages to remove, no `test`/`e2e` script | **01** (remove 4 deps + `@tailwindcss/typography`), **02a** (add `test`), **04c** (add Playwright + `e2e`), **15c** (edit `intent.exclude` L48–50) | **01 and 02a both W1** | **01** for the dependency block; **02a** appends only its one `test` script line; **04c** only after W1; **15c** only at W18 | 02a must not run `npm install` while 01 is mid-edit. 01's `01:26` names `vite.config.ts` as a 02a surface — **it is wrong**: no 02a criterion touches `vite.config.ts` (`02a:12` adds a *separate* `vitest.config.ts`). The real shared surfaces are `package.json` and `biome.json`, and `01:26` should say so. |
| `package-lock.json` + `node_modules` | 173,009-byte lock, no `vitest`, no `@playwright/test` | 01, 02a, 04c | 01+02a in W1 | **whoever installs first** | Serialise: exactly one `npm install` at a time, and never during another ticket's `npm run check`/`tsc`. Cheapest rule: 01 does its removals, commits, runs the install; 02a installs after that commit lands. |
| `biome.json` | `files.includes` = `**/src/**/*`, `.vscode`, `index.html`, `vite.config.ts` (L10–17) | **01** (scope for `src/components/**`, which is already covered), **02a** (`02a:13` must add `tests/**` + `vitest.config.ts`), **04c** (`04c:18` must add `e2e/**` + `playwright.config.ts`) | **01 and 02a both W1** | **02a owns the array** | 01 needs no change here at all (it only edits files already inside `**/src/**/*`). 02a appends `**/tests/**/*`, `**/vitest.config.ts`; 04c later appends `**/e2e/**/*`, `**/playwright.config.ts`. Each ticket adds only its own globs, in one line, so the array stays append-only and mergeable. |
| `tsconfig.json` | `include: ["**/*.ts","**/*.tsx"]`, `types: ["vite/client"]`, `noUnusedLocals`/`noUnusedParameters` on | **01** (owns, per `01:26`), **04c** (may need `node`/`playwright` types), **02a** (should need nothing) | 01+02a in W1 | **01** | 02a must not touch it: `**/*.ts` already covers `tests/**` and `vitest.config.ts`, and explicit imports (`02a:12`, no `vitest/globals`) mean no `types` entry is needed. If 04c needs Playwright types, that is a W7 edit on a file 01 stopped touching in W1. |

**The `biome.json` trap is real and worth stating plainly:** with the current `files.includes`,
`tests/`, `e2e/`, `vitest.config.ts` and `playwright.config.ts` are **inside `tsc`'s `include` but
outside Biome's**, so `npm run check` would pass while linting none of the new code. Both 02a:13
and 04c:18 name this; the collision is that they name it for the same array.

### 3.2 The store module — five consumers, one same-wave pair

The store is extended by 02b (creates it), 02c (seeds it), 06a (pins its lifetime), 07a (adds
`grant`, replaces the membership predicate), 08a (admission records, credential hashes), 10a (three
new entry kinds), 11a (subscription management), 14 (purge/restore).

Wave placement makes all but one pair sequential: 02b (W2) → 02c (W3) → 07a (W8) → 08a (W10) →
10a (W10) → 11a (W12) → 14 (W15). **The only same-wave pair is 08a + 10a (W10).**

| Pair | Shared surface | Why it collides | Recommendation |
| --- | --- | --- | --- |
| **08a ↔ 10a** | the store module | 08a adds a pending-request collection, denial records, credential hashes and expiry; 10a rewrites `append`'s entry-writing path for four kinds and adds three write operations with their own `seq` consumption. Both touch the append/insert primitive and the error contract. | **10a owns the entry-writing path and the error contract.** 08a owns a new `src/store/admissions` module and may append principals/grants only. 08a must not edit `append`; 10a must not edit the admissions module. If that split is refused, serialise 08a before 10a and accept one wave on the critical path. |

Two further store hazards that are not collisions but belong here because they are file-level:

- **`06a:13`** requires the store be "created once per server process, not per request and **not at
  module scope of a client-reachable module**" — but no ticket names *where* it lives, and there is
  no server-only module directory today (verified: `src/` has `routes/`, `components/`,
  `integrations/`, `router.tsx`, `env.ts`, `styles.css`). **Recommendation: 06a declares the
  boundary** (`src/server/**` is server-only; nothing under `src/routes`/`src/components` may
  import it, enforced by the `noRestrictedImports` rule 04a:20 adds).
- **PM R12, still unfixed:** in the Vite dev server a module-scope singleton is re-created on HMR,
  which makes "two browsers see one workspace" intermittently false in exactly the environment the
  route seam runs in. No ticket has a criterion for pinning the instance on `globalThis`. **Add to
  06a** — it is the ticket that owns the store's lifetime.

### 3.3 `src/styles.css` — nine writers, two same-wave pairs

Current file: 464 lines, of which L158–464 (307 lines) are starter-only rules — the 200-line
`.demo-*` block at L190–389 plus `.page-wrap` (L158), `.display-title` (L163), `.island-shell`
(L167), `.feature-card` (L177), `.nav-link` (L408–437), `.site-footer` (L445), `.rise-in` (L450)
and its keyframes. Only L1–157 (fonts, `@theme`, `:root`, the dark block, `prefers-color-scheme`,
`body` and the gradient wash) are the shell 01 replaces. **01 rewrites the file from the
prototype's 2,316-line sheet's token set**; almost none of the current 464 lines survive.

Writers: 01 (rewrite, W1), 04a (W5), 04b (W6), 05 (W8), 09 (W10), 10b (W11), 11b + 12 (W13),
13a + 14 (W15), 13b (W16). Same-wave pairs: **11b ↔ 12** and **13a ↔ 14**.

| Pair | Recommendation |
| --- | --- |
| **11b ↔ 12** | Disjoint component files, append-only CSS. 11b owns the stream-panel block; 12 owns the participant-drawer block. Both must namespace (`[data-panel="stream"] …`, `[data-panel="participant"] …`) so neither rewrites a shared rule. **No ticket should edit an existing rule**; if one must, it goes to whoever owns the component (§3.4). |
| **13a ↔ 14** | **13a owns the frame, the grid, the media queries and every existing rule.** 14 may add exactly one namespaced block for the purge confirmation and one component file. A purge dialog's geometry at six widths is 13a's criterion (`13a:15`), so 13a must not be blocked on 14's markup — which is why 13a's note at `13a:27` offers to *move* the panel criteria out rather than wait. |

**Recommendation for all nine:** add an explicit `Write scope` line to every ticket that names
`src/styles.css`, with the words "append only; do not edit an existing rule; namespace by
component".

### 3.4 `src/routes/__root.tsx`

01 rewrites the shell (removes `Header`, `Footer`, the devtools panel, the theme script,
`suppressHydrationWarning`, the title, the `selection:bg-[rgba(79,184,178,0.24)]` literal at L52).
04a then makes it the app frame (`04a:12` "a full-bleed frame with no site chrome … the board rail
on the left, and the thread pane and conversation regions present as labelled placeholders").

Different waves (W1, W5) so no collision — **but only if 01 truly finishes the shell.** If 01
leaves the `body` class list or a provider wrapper for 04a, then two tickets own the file's shape
and 04a inherits a rewrite. **Recommendation: 01 owns `__root.tsx` outright and must leave it as
the finished frame with a single `{children}` slot; 04a adds route files and must not restructure
the shell.**

### 3.5 The client interface — six writers, no same-wave collision

03 declares it (W4); 06a/06b/06c implement it (W5–W7); 07a adds enforcement metadata (W8); 10a
widens the entry type and adds three operations (W10); 11a implements `subscribe` on both
implementations (W12). All sequential. **The hazard is not file collision but freeze order**, and
it is the hazard the restructure got right: `Entry` is a one-member union from 03:19 and 02a:16, so
10a widens rather than replaces (lead-dev H4, fixed).

Three residual freeze problems:

1. **07a:14** requires "the declaration is a single value on the operation's definition" — the
   shape 03:25 froze. But the *scope* is per-input (`read:board` on which board?), and neither
   ticket says how scope is derived from the input. PM R9's `{ permission, scopeOf(input) }` is
   still only in a review. **07a must not need to change the declaration shape 03 froze.**
2. **10a:19** adds three operations to "both implementations" — the HTTP implementation is a file
   06a created and 06c completed, so 10a is its third writer. Fine sequentially; it means 10a
   cannot be pulled earlier than W10 without re-writing 06a's HTTP client.
3. **11a:17** implements `subscribe` on both clients. `subscribe`'s *event vocabulary* is declared
   in 03:21 and decided in 11a:12 (eight names, spec L346). 03 is four waves earlier and will
   plausibly declare the prototype's four names. **Recommendation: 03 declares `subscribe` with an
   opaque `StreamEvent` typed by an open union and defers the eight names to 11a**, or 11a
   becomes a contract-seam rewrite.

### 3.6 Everything else: clean

Checked pairs in the same wave with no shared surface: `04a ↔ 06a` (routes/components/styles vs
server/HTTP client), `04b ↔ 06b` (components vs env/session), `05 ↔ 07a` (components vs permission
module), `08b ↔ 10b` (two different component files), `08c ↔ 11a` (credential lifecycle vs SSE
route), `11b ↔ 12` (different panels), `13a ↔ 14` (see §3.3), `15b ↔ 15c` (docs vs package).

---

## 4. The critical path

Longest chain, computed from the parsed graph: **19 tickets, and it is unique.**

```
02a → 02b → 02c → 03 → 06a → 06b → 06c → 07a → 07b → 10a → 10b
    → 11a → 11b → 11c → 13a → 13b → 15a → 15b → 15c
```

**Zero slack on all 19.** Slack per ticket, as `longest path through this node` against the
maximum of 19:

| Slack | Tickets |
| --- | --- |
| **0 (critical)** | 02a, 02b, 02c, 03, 06a, 06b, 06c, 07a, 07b, 10a, 10b, 11a, 11b, 11c, 13a, 13b, 15a, 15b, 15c |
| **1** | 08a, 08b, 08c, 12, 14 |
| **4** | 09 |
| **6** | 04a, 04b, 04c, 05 |
| **9** | 01 |

Read that table carefully, because it says something counter-intuitive: **the entire admission
feature (08a/08b/08c) has one wave of slack, and it is only on the critical path at all because
12 consumes 08c and 13a consumes 12.** One slip in 08c → 12 → 13a and the tail moves. The `14`
chain has the same one-wave slack via 15a.

**Which ticket most damages the schedule if it slips.** Not the biggest ticket — the one with the
most downstream and the least replaceability. Ranked:

1. **`10a`** — eight tickets are behind it (10a → 10b → 11a → 11b → 11c → 13a → 13b → 15a) and it
   is also the wave in which the store gains three write paths under a shared arbitration with
   08a. A slip here is a slip to the end.
2. **`06c`** — the hinge of the whole plan: it is where the interface becomes genuinely swappable
   and where the product's central claim is first true. It is also the ticket carrying a missing
   edge (§1, D1) and the contract-suite ambiguity (§5.5). If 06c is not clean, 07a's enforcement
   proof (`07a:15`, "a test calls the server function directly") is unverifiable and W8 has no
   gate.
3. **`07a`** — six tickets behind it (09, 10a, 12, and transitively 13a, 14, 15a) and it freezes
   the declaration shape the whole transport uses.

`02a` is the most *replaceable* of the early chain (a stalled 02a can be worked around by any
engineer opening `vitest.config.ts`), but it is also the ticket whose absence stops everything.

**Can the critical path be shortened by re-slicing?** Three ways, in order of value:

1. **`13a`'s blocker set is over-broad.** `13a` is blocked by `05, 09, 04c, 11c, 12`. Its own note
   (`13a:27`) offers exactly the right cut: the two panel-geometry criteria (details drawer, stream
   panel) belong to 11b and 12, not to 13a. Take that offer and 13a's blockers drop to
   `05, 09, 04c` — the geometry work (rail→drawer at 980, phone two-level, truncation, composer,
   the six widths) needs none of 11c or 12. **Saves up to two waves on the critical path** and
   removes the tail's dependency on the admission feature entirely.
2. **`15b` and `15c` are serialised for no reason.** Disjoint write scopes, disjoint content, both
   need only 15a. **`15c ← 15a` saves one wave.**
3. **`02b` and `02c` could merge.** Both are store-internal, both are the same engineer's next two
   sessions, and 02c's criteria are mostly assertions over 02b's factory. Merging them does not
   shorten the chain (they are consecutive on it) but removes a handoff. Not recommended: 02c is
   already a full session of transcription (31 entries, 7 principals, 3 boards, 10 threads, 7
   resources).

Combined, 1 + 2 take the graph from **19 levels to 17** and the schedule from the **18 waves
listed above to 17**; the longest chain goes from 19 tickets to 17. Without dropping a criterion.
(Verified by re-running the level computation with `13a ← 05, 09, 04c` and `15c ← 15a`: the
critical chain becomes `02a → 02b → 02c → 03 → 06a → 06b → 06c → 07a → 07b → 10a → 10b → 11a →
11b → 11c → 14 → 15a → 15b`, and 13a/13b move to levels 11–12 where they overlap the admission
branch.)

**And the counter-move:** adding 06c's missing edge (D1) as a *hard* edge puts one wave back on.
That is why §2 schedules it as a soft edge inside W7 — the other ten of 06c's criteria are
independent of 04c's harness, so the wave holds.

Note also that D2 interacts with the re-slice, and the cheaper fix changes. With `13a` shed of its
panel criteria, `13b` sits at level 12 and `14` at level 15. Adding `13b ← 14` as a hard edge
pushes `13b` to level 16 and **grows the chain back to 18** — it *costs* a level. So do not add the
edge: instead **move the purge-focus clause out of `13b:18` and into `14`'s own criteria**, where
it belongs anyway (the ticket that builds the dialog asserts its focus behaviour), and leave `13b`
asserting focus in the surfaces that exist when it runs — 08b's decision surface and 10b's act
controls. That keeps 17 levels and drops nothing. If the edge is preferred for ownership reasons,
accept 18 levels and say so.

---

## 5. Conflicts and holes, ranked by damage

> **Status: every item below was fixed in the ticket pass that followed this review.** The ten
> ranked defects — the missing server functions for the two participant reads, `11a`'s queue,
> `01`/`06a` disagreeing about `vercel.json`, the async lock in `02b`/`07b`, the unsplit
> conformance suite, `13a`'s vacuous overflow assertion, `readPrincipal` taking no board, `08c`'s
> renewal matching declared values, `06b`'s non-existent server entry, and `14`'s ungated purge —
> are corrected at the ticket that owned each one, the two missing edges (`06c ← 04c`,
> `13b → 14`) are added, and all 30 tickets now carry a `Write scope`. What follows is retained
> as the evidence for those changes, not as a list of open defects.

### 5.0 First: what the restructure actually fixed

Credit where due, verified by reading both the finding and the current ticket text.

| Prior finding | Status | Evidence |
| --- | --- | --- |
| H1 — 06/11 incompatible transports | **partly** | `06a:17`, `06c:18` make `subscribe` fail loudly ✅; the suite scope is still ambiguous ❌ (§5.5) |
| H2 — the author's origin | **fixed** | `06b` exists, `06c:12` asserts a forged `authorId` is ignored |
| H3 — 01/02a config collision | **partly** | `01:26` records a scope; 02a has none and `01:26` names the wrong surface (§3.1) |
| H4 — `Entry` frozen as `Message` | **fixed** | `02a:16`, `03:19` |
| H5 — 14 needs 11 | **fixed** | `14:5` now `09, 11c` |
| H6 — 13 needs the panels | **partly** | `13a:7` has `11c, 12` ✅; `13b:18` needs 14 with no edge ❌ (§1, D2) |
| H7 — the browser harness | **fixed** | `04c` exists and `13a:7` lists it |
| H8 — 07's grant rule has no call site | **fixed** | `07b` proves it against the store-level `grant`; `08a:17` re-asserts it through admission |
| H9 — 11's revocation needs 08c | **fixed** | `11c:7` |
| H10 — two "cannot do this" affordances | **fixed** | `07a:21` declares it; `09:19`, `10b:18` reuse it |
| H11 — 12 needs 07 explicitly | **fixed** | `12:7` |
| PM M1–M8 (scaffold items) | **fixed** | `01:11`–`01:21` cover all eight, each tagged *(M1)*–*(M8)* |
| R2 — the two participant reads | **interface fixed, transport not** | `03:17` ✅, `06a:11` ❌ (§5.1) |
| R7 — three missing edges | **fixed, two others missed** | §1 |
| R11 — conformance suite 06/11 split | **unfixed** | §5.5 |
| R16 — intro / details / in-thread search | **fixed** | `05:16`, `05:17`, `05:18` |

### 5.1 **[BLOCKER] The two participant reads have no server function and no HTTP implementation**

- **What.** Spec revision 8 added `listMembers(boardId)` and `readPrincipal(principalId)` to the
  interface (spec L305–306) with `read:member` (spec L319–320). `03:17` requires both on the
  interface. `04b:21` renders the People view from them. `12:19` requires the participant panel to
  read "through `readPrincipal` and the grant through the permission read". **`06a:11` — the
  ticket that enumerates which reads become server functions — lists: boards, a board's threads, a
  thread's entries, a board's resources, positions, and "the acting principal's own record if that
  member exists". Neither `listMembers` nor `readPrincipal` is there.** `06c:15` then requires the
  whole conformance suite to pass against the HTTP implementation.
- **Evidence.** `03:17`; spec L305–306; `06a:11`; `06c:15`; `04b:21`; `12:19`.
- **Consequence.** The HTTP client is missing two members of the interface it claims to satisfy,
  so the conformance suite cannot pass at 06c unless the suite excludes them — which silently
  exempts the one permission the whole `read:member` design exists for (spec L413). 04b's People
  view and 12's panel then read off whatever payload they can reach, which is exactly the leak
  `03:18` closes for `listBoards`.
- **Fix.** Add both to `06a:11`'s read list as server functions with validated input, and add to
  `06a` the note that `readPrincipal` returns the principal **plus its grant at the scope implied
  by the request**. If 06a cannot carry them, add a `06d` immediately after 06a — not after 06c,
  because 06c's suite criterion depends on it.

### 5.2 **[BLOCKER] 11a still requires the paused-subscriber queue that spec revision 8 deleted**

- **What.** Spec L348 is explicit: *"A paused subscriber receives no events. **There is no
  server-side queue** … resuming replays from the subscriber's `cursor`."* `11a:5` nevertheless
  specifies "a server-held queue keyed by thread while a subscriber is paused", and `11a:14`
  makes it a criterion: *"the server holds the queue keyed by thread rather than dropping the
  entries (spec L344)"*. It even cites the wrong line — L344 is the `createServerFn` bullet; the
  no-queue decision is L348, and it says the opposite. `11b:14` then requires the pending count be
  "derived from the cursor rather than from a separate counter."
- **Evidence.** `11a:5`, `11a:14`, `11b:14`, spec L348, spec L344.
- **Consequence.** Two sources of truth for what a subscriber missed. The queue must then be
  reconciled with the cursor across purge (14), revocation (11c) and restart — the exact argument
  the revision-8 commit message makes for deleting it. Worse, 11a and 11b are consecutive tickets
  by one engineer, so the disagreement surfaces *after* the transport is built.
- **Fix.** Replace `11a:14` with: *"A paused subscriber receives no events; the server holds no
  per-subscriber queue, and the entries remain in the thread's history. Resuming replays
  everything after that subscriber's `cursor`."* Cite L348. Correct `11a:5` to drop "a server-held
  queue keyed by thread". This is the same class as §5.4 — a decision that landed in the spec but
  not in the sub-issue drafted from the older text.

### 5.3 **[BLOCKER] 01 deletes `vercel.json`; 06a requires it to stay**

- **What.** `01:21`: "the Nitro preset is pinned to `node-server` and **the Vercel deployment
  configuration is deleted** rather than left to be discovered. *(M7)*" `06a:14`: "`vite.config.ts`
  pins Nitro's preset to `node-server` … **`vercel.json` stays as the scaffold left it and is
  documented as inert**."
- **Evidence.** `01:21`, `06a:14`, spec L523 ("The Vercel deployment configuration is **deleted,
  not annotated**"), spec L521–524. Verified the file exists today with
  `{"$schema": …, "framework": "tanstack-start"}`.
- **Consequence.** Two tickets disagree about whether a file exists, and 06a is the ticket whose
  build gate would discover it. If 01 deletes it and 06a's criterion says it stays, 06a is
  ungradeable; if 06a restores it, the app ships the configuration spec L523 forbids. And the
  preset pin itself gets asserted twice, so whichever ticket is second is vacuously green.
- **Fix.** `06a:14` becomes: *"`vite.config.ts` still pins the `node-server` preset (verified, not
  re-added), a build with `VERCEL=1` set now fails rather than emitting `.vercel/output`, and
  `vercel.json`'s deletion recorded by 01 is confirmed still absent."* Then the *only* ticket
  adding the pin is 01, and 06a proves it by attempting the wrong build.

### 5.4 **[BLOCKER] Three tickets still demand the per-store async lock that spec L512 rejected**

- **What.** Spec L512: *"**The store is synchronous** … an async lock here would protect nothing,
  and a test of it would pass against a no-op. The correctness rule is … **`seq` assignment and
  insertion are a single synchronous step**, and no `await` may appear between computing a
  thread's next `seq` and appending the entry."* But: `02b`'s title is "the store, the per-thread
  sequence **and the lock**"; `02b:15` requires "one atomic step under a per-store async lock" and
  a test that "asserts the lock is held rather than that a serial queue happens to work";
  `07b:17` requires granting to be "a mutation under the same per-store lock as `seq`
  assignment"; `10a:5` says "the store writes them under the same lock".
- **Evidence.** `02b:1`, `02b:15`, `07b:17`, `10a:5`, spec L512.
- **Consequence.** `02b:15`'s test cannot fail in a synchronous store — "assert the lock is held"
  in a single-threaded runtime is either a tautology or a test of a mock. A ticket that lands
  proving a lock that protects nothing will be cited later as evidence the store is safe under
  concurrency, which is the opposite of what it proves. `07b:17` and `10a:5` then inherit the
  phantom.
- **Fix.** In `02b`, delete the lock: the criterion becomes *"`seq` assignment and insertion are
  one synchronous step with no `await` between them, asserted by a test that interleaves 50
  `appendEntry` calls from two client wrappers and finds both sequences gapless and equal to their
  entry counts; a test also asserts the append path's source contains no `await` between the
  `seq` computation and the insert"* — which *can* fail against a real regression. In `07b:17` and
  `10a:5`, s/under the same per-store lock/as part of the same synchronous critical section/.
  **This is the clearest case of a revision-8 decision landing in the spec but not in the
  sub-issue:** the restructure's own commit message claims the lock was replaced, and three
  ticket files still say otherwise.

### 5.5 **[BLOCKER] The contract suite's scope is still split ambiguously between 03, 06c and 11a**

- **What.** `03:21` puts `subscribe` in the interface *and* says "the in-memory implementation
  drives it from the store"; `03:23` says the conformance suite is "written against the
  interface". `06c:15` requires "the conformance suite from 03 runs unchanged against the HTTP
  implementation". `06c:18` requires `subscribe` to "remain explicitly out of scope and fail
  loudly". A suite that contains a `subscribe` assertion cannot pass against a client whose
  `subscribe` throws.
- **Evidence.** `03:21`, `03:23`, `06c:15`, `06c:18`, `11a:17`. PM R11, unfixed.
- **Consequence.** Either 06c's engineer deletes the `subscribe` assertions from 03's suite (which
  makes `06c:15`'s "unchanged" false and leaves 11a nothing to inherit), or 06c's suite fails and
  the wave does not close. Worst case, 06c returns a green that means nothing for the stream, and
  11a's own contract test is written from scratch and proves only itself.
- **Fix.** Split it in 03, explicitly: two files, `tests/contract/operations.conformance.ts` and
  `tests/contract/stream.conformance.ts`. 03 runs the operations file against the in-memory client
  and the stream file is marked *skipped pending 11a* (skipped, not absent, so its existence is
  visible from W4 onward). `06c:15` names the operations file. `11a:17` names the stream file and
  makes the skip a run. One sentence in each of three tickets.

### 5.6 **[HIGH] 13a's overflow criterion stays vacuously true if `html, body` keep `overflow: hidden`**

- **What.** `13a:11` requires "`documentElement.scrollWidth === clientWidth` at each width,
  measured by the harness in 04c", and `13a:19` adds "No content is hidden off-screen to make an
  overflow assertion pass". But `documentElement.scrollWidth === clientWidth` **is true whenever
  overflow is clipped**, and the app is being built from a reference that clips it: the prototype's
  `styles.css` L89–96 is `html, body { … overflow: hidden }`, and `DESIGN.md` L178 specifies "a
  fixed three-column grid" with `DESIGN.md` L180 "the composer never leaves the bottom". A
  full-bleed frame with pinned panes will almost certainly set `overflow: hidden` on `html, body`
  for its own reasons. `01:16` removes `overflow-x: hidden` from `body` only — it does not forbid
  `overflow: hidden` on both axes, and it is removing the *scaffold's* rule, not the prototype's.
- **Evidence.** `13a:11`, `13a:19`, `01:16`, `04c:14`, root `styles.css` L89–96, `DESIGN.md` L178,
  L180. (Both reviews flagged the *scaffold's* `body{overflow-x:hidden}`, `src/styles.css:98` —
  neither flagged the rule the app will add for its own frame.)
- **Consequence.** The headline responsive criterion of the whole ticket cannot fail. A real
  overflow bug — a long board name, a wide resource URL — ships green, and 15a's parity suite
  re-asserts the same vacuous check because `QA.md` L20 used the same method on a document that
  also had `overflow: hidden`.
- **Fix.** Assert on the *scrollable content*, not the document: `13a:11` becomes
  *"for each of the six widths, for each visible scroll container (rail, pane, conversation), 
  `scrollWidth <= clientWidth + 1`; and, with `overflow` temporarily unset on `html`/`body` by the
  harness, `documentElement.scrollWidth === clientWidth`"*, plus a hard criterion: *"no element has
  `overflow-x: hidden` or `overflow: hidden` on `html`, `body` or any pane that contains text"*.
  Add the same wording to `04c:14` so the harness helper measures the right thing.

### 5.7 **[HIGH] 12 requires a "permission read" that exists nowhere, and `readPrincipal` cannot return a scoped grant**

- **What.** `12:19`: "The panel reads the participant through `readPrincipal` and **the grant
  through the permission read**". The interface (spec L282–308) has no operation that returns a
  grant; `03:17` describes the read as "one participant **with the grant it holds here**", which
  requires a board scope that `readPrincipal(principalId)` (spec L306) does not take. `06a:11`
  provides neither.
- **Evidence.** `12:19`, `03:17`, spec L306, spec L282–308.
- **Consequence.** 12 is a `[BLOCKER]` for its own wave: the panel's central claim — "the
  permissions they hold on this board" — has no source. The engineer will either add a fifth
  operation nobody reviewed (silently widening the interface three waves after it was frozen) or
  read grants off a board payload, which is the leak `03:18` exists to prevent.
- **Fix.** One operation, decided once: `readPrincipal(input: { principalId; boardId })` returning
  `{ principal, grant, remote }`, gated by `read:member` on `boardId`. Put it in spec L306, `03:17`,
  `06a:11` and `12:19` with the same signature. Do **not** add a separate "permission read": it
  would be a second way to learn the same fact and a second thing to permission-check.

### 5.8 **[HIGH] A renewal after expiry has no identity key, so history can be claimed by name**

- **What.** `08c:16` requires "Renewal after expiry resolves to the **same principal id**" and a
  test that "renews and asserts the entry's author id is unchanged". It does not say **what the
  renewing caller presents.** An expired principal holds nothing (spec L378), so the only facts it
  can offer are its *declared* name and operator — and matching on those means any caller can
  inherit an existing principal's history.
- **Evidence.** `08c:16`, spec L378, spec L393 ("what the agent *declared* … is never styled or
  labelled as verified"), spec L419 ("authorship is a statement about who"). PM R4, unfixed.
- **Consequence.** The one thing the whole identity design exists to prevent — unverifiable
  authorship — is reintroduced on a path a ticket requires. Ten minutes of a reviewer's time makes
  this a red flag on the most security-shaped surface in the product.
- **Fix.** State the mechanism: **renewal presents the expired credential**, which the server can
  verify because it stored a hash (spec L396), and the server reissues against the same principal
  id with a new expiry. Add to `08c:16`: *"a renewal that presents a name and operator but no
  credential is refused, and a renewal that presents an expired credential for principal P
  reissues for P with a fresh expiry and a different credential hash."* The negative half is what
  makes the criterion gradable.

### 5.9 **[HIGH] 06b requires an import from a "server entry point" that does not exist, and nothing names where server-only code lives**

- **What.** `06b:13`: "`env.ts` is imported by the server entry point, so validation actually
  runs." Verified: the scaffold has **no** `src/server.ts`, `src/start.ts`, `src/entry-server.tsx`
  or `app.config.ts`; `src/` contains `router.tsx`, `routeTree.gen.ts`, `env.ts`, `styles.css`,
  `components/`, `integrations/`, `routes/`. **`env.ts` is imported by nothing** (grep over `src/`:
  no importer, matching `NOTES.md` L231–232).
- **Evidence.** `06b:13`, the file listing above, `NOTES.md` §5 (L210–232).
- **Consequence.** The criterion is ungradeable as written — a reviewer must ask the author which
  file counts. And because "the server entry point" is undefined, different engineers will pick
  `router.tsx` (client-reachable, which defeats the point), a new `src/server.ts` (which may not be
  loaded by `@tanstack/react-start` 1.169.5's plugin), or a middleware file. A boot-time failure
  needs a module that is unambiguously loaded by the server and not by the client.
- **Fix.** Decide the layout in the ticket: `src/server/env.ts` wrapper (or `src/env.server.ts`)
  that imports `env` and asserts the secret, imported from a `createServerFn` middleware module
  that every server function already goes through — i.e. **assert the secret where the resolver is
  built**, which 06b already requires (`06b:17`). Restate `06b:13` as *"importing the resolver
  module with `SESSION_SECRET` unset throws at import time, asserted by a test that spawns the
  server process and expects a non-zero exit"*, and add the same rule to `06a:13` for where the
  store lives.

### 5.10 **[HIGH] 14's purge has no permission to gate on**

- **What.** `14:19`: "the purge is a destructive operation, so it is gated by the same grant
  machinery as everything else rather than by an unauthenticated route — see the reset-operation
  rule 06a records, and use one affordance for both." But the permission vocabulary is fixed at
  four rows (spec L408–411: workspace `read:board, create:board, admit:agent, revoke:agent,
  grant:permission`; board; thread; resource) and **`07a:11` requires a test that the exported set
  equals that literal list.** There is no `purge:*` verb. And 06a's reset is explicitly *not* a
  participant operation and is unreachable outside test/dev mode (`06a:18`), so it cannot be "one
  affordance" with a user-facing purge.
- **Evidence.** `14:19`, `07a:11`, spec L408–411, `06a:18`.
- **Consequence.** Three incompatible options, chosen silently by whoever gets there first: add a
  permission (breaking `07a:11`'s literal assertion and the `PRODUCT.md` capability table 15b
  must publish), gate on `grant:permission` or `create:board` (semantically wrong but cheap), or
  ship an ungated destructive route (which `14:19` forbids). "Same grant machinery" is not
  specific enough to be built.
- **Fix.** Decide now: **purge requires `create:board` at workspace scope** — i.e. the superadmin
  grant — and say why in the ticket (the only principal who may remove workspace-scoped demo
  content is the principal who may create workspace-scoped content). Restate `14:19` accordingly
  and add a negative criterion: a principal without the workspace grant sees the purge control
  disabled with the missing permission named, per `07a:21`. If a new verb is preferred instead,
  `07a:11`'s literal list, spec L408 and `PRODUCT.md` L46 all change in the same commit — which
  means this decision cannot wait for 14.

### 5.11 **[HIGH] 13b needs 14's purge dialog; there is no edge and 13b can close green first**

See §1, D2. `13b:18` requires the purge confirmation to trap and restore focus; `13b` is blocked
only by `13a`. **Fix: move the purge-confirmation clause out of `13b:18` into `14`'s own criteria**
— the ticket that builds the dialog asserts its focus trap, restore and Escape dismissal, and `13b`
then covers only the surfaces that exist when it runs (08b's decision surface, 10b's act controls).
Do **not** add `13b ← 14`: §4 shows that edge adds a level to the critical path once 13a's
over-broad blocker set is fixed, and it buys nothing the clause move does not.

### 5.12 **[HIGH] The admission seam is stood up one ticket after the first ticket that asserts at it**

- **What.** `07b:19`: "Every one of the rules above is asserted at the **admission seam** (spec
  L560–575), so 08 can reuse the assertions rather than restate them." The seam itself — "once
  against the in-memory store, once against the running server" — is built in `08a:22`: "Every
  whole-file criterion above is asserted in the admission seam (spec L560–575), **and the seam
  drives both the store and the running server**." 07b is 08a's blocker.
- **Evidence.** `07b:19`, `08a:22`, spec L572 ("Admission seam … drives the same way the contract
  seam does — once against the in-memory store, once against the running server"). Also: both cite
  L560–575, but the admission seam's assertions are at **L572–587**; L560–575 covers only its
  first two bullets.
- **Consequence.** 07b's criterion is unsatisfiable at 07b unless 07b builds the seam, and if 07b
  builds it 08a's "drives both the store and the running server" is either already true (vacuous)
  or a second harness. Nobody owns the seam at the moment its first consumer needs it.
- **Fix.** Name the seam's home: **08a builds it** (it is the ticket with an admission surface to
  drive), and `07b:19` becomes *"asserted at the store seam today and re-asserted at the admission
  seam by 08a, so the assertion is written once and re-used rather than restated"*. Also correct
  both citations to L572–587.

### 5.13 **[MEDIUM] The type and contrast floors are asserted by no ticket at all**

- **What.** `01:22` defers: "The type and contrast floors are asserted later, not here … the
  criterion that belongs here is that the token set carries the right sizes and colours, **and that
  a browser assertion exists by the time text does**". Nothing makes that assertion. `04c:16`
  provides the *helper*; no ticket calls it for the floors. Grep across all 30 tickets for
  `11px|13px|contrast|WCAG|AA|floor` returns only `01:22`, `04c:16`, `08b:13` (a label size),
  `10b:12` (an act line size) and `11a:15` (an unrelated "floor-verified"). `DESIGN.md` L172 (the
  11px Floor Rule) and L196 make them normative, and `15a`'s parity suite cannot check them because
  `QA.md` L5 deliberately states "no assertion depends on fonts, colours".
- **Evidence.** `01:22`, `04c:16`, `DESIGN.md` L172, `QA.md` L5. PM R14, half-fixed (the ARIA half
  landed at `13b:16`; the floors half did not).
- **Consequence.** Two normative design-system rules have no verification after the port, in a
  ticket set whose stated standard is "asserted, not described".
- **Fix.** Add one criterion to **13a** (first ticket with real text at every width): *"at 1440 and
  390, no rendered text with a functional role computes below 11px and no body copy below 13px,
  measured with 04c's computed-style helper; and every text/background pair on the conversation,
  pane and rail meets WCAG AA, computed from resolved colours against the element's actual
  background."* Delete the deferral sentence from `01:22`.

### 5.14 **[MEDIUM] 09's resource-type criterion asks the ticket to make a decision it does not make**

- **What.** `09:14`: "A resource carries a name, URL, type and description — **including the type,
  which the prototype hard-codes to a single value and the spec treats as a field**, so *the ticket
  states which types exist* rather than inventing a free-text field." The ticket states no types.
- **Evidence.** `09:14`; `app.js` L117 hard-codes `type:'Link'`; the seed uses three literals —
  `'Document'`, `'Repository'`, `'Design'` (`app.js` L30–32).
- **Consequence.** A reviewer cannot grade it: the criterion's subject is absent from its own text.
  Two engineers would choose differently (a closed enum vs free text), and the seed already
  implies the answer.
- **Fix.** Paste the closed set into the criterion: `type ∈ { Document, Repository, Design, Link }`
  — the three the seed uses plus the prototype's default — as a validated enum rejected at the
  boundary like the URL, with the seed's three values reproducing exactly.

### 5.15 **[MEDIUM] 28 of 30 tickets have no write scope, and the one that does names the wrong file**

- **What.** Grep for `^\*\*Write` finds exactly two: `01:26` and 14's `**Write note:**` at
  `14:19`. `01:26` says "Ticket 02a also touches `vite.config.ts` and `package.json`". No 02a
  criterion touches `vite.config.ts`; `02a:12` adds a separate `vitest.config.ts`. The real shared
  surfaces are `package.json` **and `biome.json`**, and `biome.json` is the one where being wrong
  is silent (`npm run check` skips unchecked files rather than failing).
- **Evidence.** `01:26`, `02a:12`, `02a:13`, `apps/relayboard-web/biome.json` L10–17.
- **Consequence.** The only collision-management artefact in the plan points at the wrong file, in
  the wave with two tickets in flight.
- **Fix.** Correct `01:26` to name `package.json`, `package-lock.json` and `biome.json`, and add a
  `Write scope` line to each of these tickets at minimum: 02a, 04a, 04b, 04c, 05, 06a, 06b, 06c,
  07a, 08a, 09, 10a, 10b, 11a, 11b, 12, 13a, 13b, 14, 15a, 15b, 15c. The scopes are already
  derivable from §3 of this document; one line each.
- **Retired.** Verified on 2026-11-11: `grep -l '^\*\*Write' .scratch/relayboard-app/issues/*.md`
  returns all 30 files, so every ticket carries a write scope. `01`'s scope now names
  `package.json`, `package-lock.json` and `biome.json` (the one-line append is conditional on the
  components directory needing a glob, and that condition is stated), and it no longer claims 02a
  touches `vite.config.ts` — it says 02a appends to `biome.json` and `package.json`. Both halves of
  this finding are closed; nothing here needs doing again.

### 5.16 **[MEDIUM] 05 holds 14 criteria and names no seam**

- **What.** Every other UI ticket names where it is asserted: `10b:20`, `11b:21`, `11c:18`,
  `13a:21`, `13b:19`, `15a` (wholly). `05` mentions neither "route seam" nor "e2e" anywhere. Its
  fourteen criteria include the densest behaviours in the set (05:24's two idempotency guards, the
  composer's disabled state, date dividers, the reference jump, the thread intro, the details
  panel, in-thread search).
- **Evidence.** `05:1`–`05:24`; grep for `route seam|route-seam|e2e` across tickets returns matches
  in 04c, 05's *blocker line only*, 06c, 10b, 11b, 11c, 13a, 13b, 15a, 15b — not in 05's criteria.
- **Consequence.** The ticket with the most to get wrong is the one ticket whose verification venue
  is unstated, so a reviewer grades it by reading the diff — which is what "asserted, not
  described" exists to avoid.
- **Fix.** Add a closing criterion: *"Each of the criteria above is asserted in the route seam,
  except the two send-guard criteria which are asserted at the contract seam."* Ten words per
  criterion, one line.

### 5.17 **[MEDIUM] The definition of done still grades its own homework**

- **What.** PM R7/§6.2 required the ~64 `QA.md` assertions to be frozen into a version-pinned list
  *before* ticket 06, and specifically before 15b is allowed to rewrite `QA.md`. No such list
  exists: `.scratch/relayboard-app/` contains only `spec.md`, `issues/` (30 files) and `reviews/`
  (2 files + 24 proposed splits) — verified by listing. `15a:11` asks the implementer to produce the
  enumeration ("each of the roughly sixty-four assertions in them is either covered or explicitly
  listed as not carried across with a one-line reason"), and `15b:11` rewrites `QA.md` one ticket
  later. `QA.md` L3 confirms the same file is both the measuring stick and the thing being
  replaced.
- **Evidence.** directory listing of `.scratch/relayboard-app/`; `15a:11`; `15b:11`; `QA.md` L3,
  L9.
- **Consequence.** A weaker rewritten `QA.md` is a passing 15a. The port can be declared at parity
  with fewer behaviours than the prototype was verified to have, and `spec L633` ("the parity
  checklist is the definition of done") becomes unfalsifiable.
- **Fix.** Before W8, copy `QA.md` L11–23's twelve bullets into
  `.scratch/relayboard-app/parity-checklist.md`, one assertion per line, numbered, each marked
  with its reinterpretation as an *observable* claim (because `QA.md` L11 and L14 assert store
  internals, which spec L536 forbids at the route seam). `15a` then satisfies the frozen list
  rather than writing it, and `15b` may rewrite `QA.md` freely because the list lives elsewhere.

### 5.18 **[MEDIUM] 15c updates the skills but never repacks the tarball the app actually loads**

- **What.** `apps/relayboard-web/package.json` L20 depends on
  `"@relayboard/skills": "file:vendor/relayboard-skills-0.1.0.tgz"` (verified present, 23,967
  bytes, and `NOTES.md` §11.1 L463–534 records the pack-and-copy ritual). `15c`'s criteria rewrite
  the skills, remove the `intent.exclude`, and run `npm run skills:check` / `npm run skills:validate`
  — **none of which touches `vendor/`.** The gate passes against the source tree while the app
  keeps serving the old, prototype-describing guidance from the tarball.
- **Evidence.** `15c:11`–`15c:17`; `apps/relayboard-web/package.json` L20;
  `apps/relayboard-web/vendor/relayboard-skills-0.1.0.tgz`;
  `packages/relayboard-skills/docs/mock-api.md` L22 (still documents
  `appendMessage({ authorId, … })`). PM §4.7 flagged the ritual; the ticket did not absorb it.
- **Consequence.** `spec L542` ("the shipped skills must describe the app") is false after 15c as
  written, and the failure is invisible because the gate is green. `npx intent load` in this
  session would still refuse `relayboard-identity` or serve it from the stale tarball.
- **Fix.** Add to `15c`: *"the package is repacked and the vendored tarball replaced
  (`npm pack ./packages/relayboard-skills` → copy into `apps/relayboard-web/vendor/` →
  `npm install` in the app), and `npx intent list --json` in the app no longer lists
  `@relayboard/skills#relayboard-identity` under exclusions while `npx intent load
  @relayboard/skills#relayboard-identity` succeeds."* That last assertion is what makes the
  removal checkable rather than described.

### 5.19 **[LOW-MEDIUM] The seed assumes one acting human, but sessions are round-robin**

- **What.** Spec L356: the session names "**a seeded principal** selected round-robin from those
  the seed marks as browser-selectable", with L360 requiring the seed to mark at least one such
  principal and to make selection "cyclic and stable within one store instance". `02c:18` says the
  prototype's `seen` map "becomes the seeded `seen` watermark per `(principal, thread)` **for the
  acting human**" — as if there were one. No ticket adds a browser-selectable mark to the seed, and
  `06b`'s criteria never say which principal a first request gets or that two browsers get two
  different principals.
- **Evidence.** `02c:18`, spec L356, spec L360, `06b:15`, `06c:20`; `app.js` L83 (`seen` is one
  map, for the hard-coded self `alex`).
- **Consequence.** The seeded unread badges reproduce only for whichever principal the prototype
  hard-coded. If browser #2 gets a different principal, every entry is unread for it and 15a's
  "the unread badges the prototype shows are the ones the app shows" fails on the second browser.
  06c's two-browser test is also ambiguous: it does not say whether the two sessions are the same
  principal (in which case "one workspace" is really one principal in two windows and proves much
  less) or two.
- **Fix.** Add to `02c`: *"each principal carries `browserSelectable: boolean`; the seed marks
  `alex` and `maya` selectable, in that order; `alex` carries the prototype's `seen` map and `maya`
  carries the same map shifted by one, so the badge counts differ and a test can tell the two
  browsers apart."* Add to `06b:15`: *"the first request receives the first selectable principal,
  the second a different one, and the third wraps to the first — stable within one store instance."*
  Add to `06c:20`: *"the two sessions are two different principals, and the test asks which ones
  through the participant read rather than assuming an order."*

### 5.20 **[LOW] `setConnection` has no owner once the stream becomes real, and `simulateIncoming`'s caller permission is unstated**

- `setConnection` is on the interface (spec L292) and in the permission table (spec L328) and is
  named by no ticket after 03. Pause becomes a client-side/stream state (11b:13–15) with no
  server queue and no server-side connection flag. **Fix:** state in `11b` that `setConnection`
  becomes a no-op returning the current `StreamState`, or delete it from the interface in 11a and
  say why. Either is fine; silence is not, because 06c must implement "every mutating operation"
  and will guess.
- `simulateIncoming` may author as an agent (spec L329, L365), which is a standing exception to
  "no operation accepts an author from the caller". `06c:13` and `11c:17` both require the author
  be chosen server-side, but **neither says which permission the caller must hold** (spec L329
  says `post:message`). **Fix:** add to `06c:13`: *"the permission checked is the caller's
  `post:message` on that board; the simulated author's own grants are not consulted, and a test
  asserts a caller without `post:message` cannot trigger a simulation."*

### 5.21 **[LOW] Citation rot: 15 dangling references and 6 pointing at the wrong content**

Parsed every `spec L<n>` / `§<n>` / `app.js L<n>` / `QA.md L<n>` across all 30 tickets (87
citations) and compared each to the cited line's content.

**Dangling — the cited line is blank or out of range** (13 in `spec.md`, and `DESIGN.md` §615 is
`undefined` because the file has 288 lines): `06a:17`, `06b:11`, `06c:18`, `08a:18`, `08b:12`,
`08b:16`, `08c:11`, `08c:13`, `11a:5`, `13a:11`, `15c:12`, `15c:15`, `15c:19` (all `spec L…`),
plus `06b:21` and `13a:16` (bare `§615`, `§123`).

**Wrong target — the line exists but does not say that:**

| Ticket | Cites | What L<n> actually is | Where the claim is |
| --- | --- | --- | --- |
| `11a:12` | spec L342 | `### Server functions and the stream` (heading) | L346 — the eight event names |
| `11a:14` | spec L344 | the `createServerFn` bullet | L348 — the no-queue decision, which says the opposite |
| `07a:19` | spec L566 | "This seam is new…" (contract seam prose) | L402 / L578 — the human/agent asymmetry |
| `07b:19`, `08a:22` | spec L560–575 | the store seam's bullets + the admission seam's first two | L572–587 — the whole admission seam list |
| `15b:15` | spec L444 | the `acknowledged` rung | L455 — the "supervises" correction |
| `13a:11` | `spec L9` | blank (a separator line) | the six widths are only in `QA.md` L5 and L20 |

**Consequence.** Low per item, but this set is the only cross-check a reviewer has that a criterion
is rooted in a decision, and 21% of the citations cannot be resolved. Two of them (`11a:14`,
`15b:15`) hide a substantive contradiction rather than a typo.
**Fix.** A single pass before W1, correcting each to the line named above. Worth doing before 01
because three tickets at W1 rely on citations (`01`'s criteria quote `spec L581` and `DESIGN.md`
sections) and a reviewer who cannot resolve a citation stops resolving all of them.
**Resolved, with counts.** Done on 2026-11-11, by indexing both files at every commit and comparing
each cited line's text. The audit above is wrong in three ways, and recording that matters as much as the
corrections: this section is the record a reviewer trusts.

*The counts do not match the files.* Recounting the four families in the 30 tickets **at the commit this
review was written against (`c386f97`)** gives **88** references, not 87 — 58 `spec L…`, 17 `DESIGN.md
§…`, 4 `QA.md L…`, 9 `app.js L…`. The total is the review's to within one; its family split is not
stated, and the "87 citations" it reports is therefore not reproducible as written. The dangling list is
**15**, exactly as claimed, but three of the fifteen are not a citation to the file named: `06b:21`
writes *"spec L352, §615"*, where `§615` names a **spec** section (the spec had 641 lines at that commit),
so *"`DESIGN.md` §615 is `undefined` because the file has 288 lines"* diagnoses the wrong file; `13a:16`'s
`§123` is disambiguated by the ticket itself as `§123/story 123`, a story number; and `13a:11`'s `spec L9`
is prose — "the six widths are the ones `QA.md` L20 and spec L9 record" — a provenance note, not a
reference. Checked one by one at `b457613`: **14 of the 15 were still cited and still pointed at a blank
line**, and one — `13a:11`'s `spec L9` — had already been repaired by the ticket pass that followed this
review (`b04f4f8` rewrote the sentence, because the reference was prose rather than a citation). So the
review was right about the existence of 15 dangling references and wrong only about what two of them
point at.

*The real defect was a shift, and the review did not see it.* Commit `a94aa92` inserted **10 lines into
`spec.md`** (a new `### Styling` section at L262–273) and **8 into `DESIGN.md`** (eight colour tokens at
L10–17), and every citation above the insert moved with it. Measured at `b457613`, the tip of the ticket
set this pass inherited: of its **87** `spec`+`DESIGN.md` references, **24 pointed at a blank line** (18
newly blank, 6 blank since they were written), **51 resolved to a real line that said something else**
because their content had moved down by the insert, and **12 pointed at content unrelated to their claim**.
None of the 87 still pointed at the content it was written for. The 51 are the dangerous class, because a
reviewer checking one sees a plausible line: `06a:20` and `06c:20` cite `spec L341` for "the stream is not a server function" and landed on
*"Two operations are deliberately not members of this interface"*; `08b:18` and `08c:13` cite `L370` for
the expiry default and landed on the seed's superadmin; `13b:16` cited `DESIGN.md §229` for the focus ring
and landed on the `### Cards / Containers` heading.

*What is now true.* All **101** references in the 30 tickets resolve to a non-blank line, and each was
checked against its criterion's claim rather than against the table above — including the ones this
session's own §5.5, §5.7, §5.8 and §5.13 edits made stale again. Counted by diffing the reference multiset
per ticket between `b457613` and the corrected set: **72 references re-pointed and 4 added, across 22 of
the 30 tickets** — 55 `spec` and 17 `DESIGN.md` re-pointed, plus 3 new `app.js` references where a
criterion's claim turned out to live in the prototype rather than in the spec. The `DESIGN.md` half
touches 10 tickets (`02c`, `04a`, `07a`, `08b`, `08c`, `10b`, `11b`, `13a`, `13b`, `15b`) and every one of
them is the same +8. Where a claim had no correct line to cite — `13a`'s truncation rule cited a
`DESIGN.md` section that never existed, and `09`'s resource types were absent from the ticket — the
criterion now cites the story (`story 123`, spec L184) or states the decision itself, rather than inventing
a line to point at.

*And it happened again, which is the point.* Adding `readActingPrincipal` to the spec's interface block
and permission table inserted two lines at L317 and L342, and **70 ticket citations at or above that
point moved again** — every `spec L` reference in 19 of the 30 tickets. They were re-pointed in the same
change, and the mapping was verified by comparing each old line's text at the new number rather than by
trusting the arithmetic: **70 of 70 resolve to byte-identical content**. The lesson is not that the
references rot easily — it is that a line-number citation into a living document is only correct until
the next insert, so any change above L300 in `spec.md` owes the same re-point in the same commit. This
paragraph is here so the next person to insert a paragraph into `spec.md` knows the bill.

**The bill is not confined to `.scratch`.** The same insert left **50 stale `spec L` citations under
`apps/relayboard-web`** — 35 in source comments, 15 in tests — because the app cites the spec from its
comments the way the tickets do. Each one's correct new number was computed and verified the same way
(old line's text at the new number, byte-identical in 50 of 50 cases), and the re-point is **Track A's
to apply**, since `apps/` is that track's write scope and this one did not edit it. Two further app
citations, `src/client/index.ts` L323 and `src/domain/errors.ts` L494, were already pointing at blank
lines before this change and are unrelated to it. Recorded here so the debt is dated rather than
discovered later.

---

## 6. The first three days

Assumptions: one engineer per ticket, fresh context window per ticket, no ticket worked by two
people at once, and the §7 decisions made before `day 1` starts. "A day" is three working
sessions, so **three days ≈ 6–8 completed tickets at the small end and 3–4 at the large end.**
Realistically the first three days is `01`, `02a`, `02b`, `02c` and the start of `03`.

### If one engineer starts

| | Ticket | Why this and not something else |
| --- | --- | --- |
| Day 1 | **01** | Nothing else can run in the same tree without a `package.json`/`biome.json` collision, it is the *only* ticket that can start with zero information, and it is the ticket whose decisions (token set, font destination, preset) every later UI ticket inherits. |
| Day 2 | **02a** | Unblocked from the start, and it is the floor for eleven later tickets. Doing it after 01 means the Biome globs can be added once, correctly, against a settled `src/` tree. |
| Day 3 | **02b** | The first real product rule (`seq`), on fixtures, with the lock criterion corrected per §5.4. |

**First demonstrable thing at one engineer:** end of day 1 — a browser showing an empty Relayboard
frame in IBM Plex Sans over the forest token set, with no starter chrome and no theme toggle. That
is a real demo because it is the thing the PM review said would otherwise be discovered halfway
through the port.

### If two engineers start

**Take `01` and `02a`. They are the safest pair, but only with one explicit rule.**

Why they are the safest pair, given §3:

- both are roots with zero information needed (`01:7`, `02a:7`), so neither waits on the other's
  output;
- their *product* surfaces are disjoint — 01 rewrites `src/styles.css`, `src/routes/**`,
  `src/components/**` and adds `public/`; 02a adds `src/domain/**`, `tests/**`, `vitest.config.ts`
  and touches nothing under `src/routes` or `src/components`;
- no other pair of same-wave tickets exists, so the alternative is one engineer, and the
  alternative *pairs at W5* (`04a`+`06a`) require `03` first.

The rule: **01 owns `package.json`, `package-lock.json` and `biome.json` until its commit lands;
02a works on `src/domain/**` and `vitest.config.ts` (no shared file) until that commit, then
appends its `test` script line and its Biome globs.** Neither runs `npm install` while the other is
mid-edit, and neither runs `npx tsc --noEmit`/`npm run check` expecting a clean tree while the
other's files are half-written. This is PM §2.3's option 2 (split the gate) plus an ownership
order, and it costs nothing because 02a's type work is a full session on its own.

**Day-by-day for two engineers:**

| | Engineer A (shell) | Engineer B (floor) |
| --- | --- | --- |
| Day 1 | `01`: deletions first (routes, components, devtools, theme script, gradient wash), then tokens, font, preset. Commits `package.json`/`biome.json` early. | `02a` part 1: `src/domain` types — `Principal`, `Board`, `Thread`, `Entry` (one-member union), `Resource`, `Origin`, `Seq`, watermarks. No shared file yet. |
| Day 2 | `01`: finish tokens against `DESIGN.md`, run the build/tsc/check gate, verify `/about` 404s and the title. | `02a` part 2: `vitest.config.ts`, append the `test` script and the Biome globs **after** A's commit, run `npm test`. |
| Day 3 | `02b`: store factory + `seq` (the corrected §5.4 criterion). | `02c`: the seed transcription — 7 principals, 3 boards, 10 threads, 7 resources, 31 entries, `origin` everywhere, non-monotonic `createdAt`. |

Day 3's pair is the safest same-wave pair available at that point (`02b` and `02c` are strictly
sequential on the graph, so this is only possible if `02c` starts from `02b`'s *committed* factory
— which is the normal "start when the blocker's commit lands" frontier). If that ordering is
uncomfortable, engineer B takes `04a` preparation instead — no, it cannot: `04a` needs `03`. **At
day 3 the honest second choice is pairing on `02b`'s tests while A writes `02b`'s store**, which
the brief's rules forbid. So day 3 for two engineers is `02b` + the frozen parity checklist
(§5.17), which is unblocked, unowned, and must exist before W8.

**First demonstrable thing at two engineers:** end of day 2 — the empty Relayboard frame, plus a
green `npm test` running Vitest in Node with the domain vocabulary compiled. End of day 3, if the
seed lands: the store contains the whole prototype workspace and a test can assert its 31 entries
and gapless per-thread sequences, even though nothing renders it yet. The first thing a stakeholder
can *click* is 04b (W6) — a URL-addressed workspace with the demo seed, the dark board rail and the
thread pane. That is day ~8–10, not day 3, and the plan should be honest about it.

---

## 7. What must be decided before ticket 01 starts

> **Status after the decisions below were taken (spec revision 8 and the ticket pass):**
> **1. Styling method — DECIDED.** Utilities for layout, co-located stylesheets for component
> anatomy; the global sheet holds only tokens, `@font-face`, resets, base typography and the
> reduced-motion block. Recorded in the spec under *Styling* and in `01`'s write scope.
> **2. Missing tokens — DONE.** The eight colours the prototype used and the design system never
> carried are now in `DESIGN.md`'s frontmatter and the sidecar, and `DESIGN.md`'s focus prose names
> the token instead of a stray hex. The prototype's own one-off focus colour was unified too, so
> there is now one focus ring.
> **3. Where the `woff2` lands — DECIDED.** `public/fonts/`, referenced as an absolute
> `/fonts/…` URL.
> **4. `vercel.json` — DECIDED.** Deleted; `01` owns the Nitro preset and `06a` verifies it.
> **Nothing in this section still blocks `01`.**

Ranked. Only decisions that become a rewrite if deferred. Each names the ticket that would have to
be redone.

**1. The styling method: Tailwind v4 utilities over an `@theme` token block, or a port of the
prototype's 2,316-line stylesheet.** `01:18` commits to "tokens declared once and named after
`DESIGN.md`" and stops there; spec L262 says the natural home is `@theme`; `DESIGN.md` is 288 lines
of normative prose about a system the prototype implements in 2,316 lines of CSS. If this is
decided inside 01, 01 becomes an L spent discovering it, and then **04a, 04b, 05, 09, 10b, 11b, 12,
13a, 13b are each 1–3 sessions more expensive** — because every one of them adds to
`src/styles.css` (§3.3). Deferring it is not a risk, it is a cost already incurred. *(PM §2.2.1;
unchanged by the restructure.)*

**2. The 14 missing and 3 renamed tokens must be added to `DESIGN.md`'s frontmatter and
`.impeccable/design.json` before 01 reproduces them.** Verified: `DESIGN.md` frontmatter has 23
colour keys and no entry for `--ink-placeholder`, `--line-soft`, `--accent-chip`, `--rail-well`,
`--live-ring`, `--paused-line`, `--focus`, `--focus-on-rail` or any of the six `--shadow-*`
tokens — all 14 of which the prototype uses (root `styles.css` L28, L40, L47, L54, L58, L61, L64,
L65, L68–73) — and `DESIGN.md`'s `surface`/`surface-panel`/`surface-tint` appear as
`--white`/`--panel`/`--panel-tint` (root `styles.css` L36–38). `01:18` requires the missing ones be
added to `DESIGN.md` **and** the sidecar in the same change; spec L605 says `DESIGN.md` is normative
and this work "consumes them; it does not revisit them". Those two cannot both hold unless the
`DESIGN.md` change is made first, deliberately, as its own act. Deferring it means 01 either
hard-codes 14 values (violating `01:17`) or silently drifts the design system (violating spec
L605). *(PM §2.2.2; unchanged.)*

**3. Where the `woff2` lands.** `01:19` requires the self-hosted face to have "a stated home" and
the production build to resolve it. There is **no `public/` directory today** (verified) and the
face is at repo-root `fonts/ibm-plex-sans-latin.woff2` (45,712 bytes), referenced by a
repo-root-relative URL in the prototype's sheet. The choice — `public/fonts/` + `url('/fonts/…')`
versus a `src/assets` import — is one line to make now and a build failure discovered at `01`'s own
gate if not made. Deferring it means 01 fails `01:21`. *(PM M8; the ticket records it as "to be
stated", which is the decision being deferred to the implementer.)*

**4. `vercel.json`: delete it (spec L523, `01:21`) or keep it and document it as inert
(`06a:14`).** This is a decision, not a task: the two live tickets say opposite things (§5.3), and
the spec sides with deletion explicitly and with a reason. It blocks 01 because 01 is the ticket
that touches the build configuration, and it becomes a rewrite at 06b if the answer changes there.
Decide: **delete**, and amend `06a:14` to verify the deletion plus prove a `VERCEL=1` build now
fails. *(PM R6 called for the preset pin; the restructure put the pin in 01 ✅ and left 06a
contradicting it ❌.)*

That is the whole blocking list for 01. Three of the four are documentation-shaped and were already
identified by the PM review; the fourth (`vercel.json`) is newly broken by the restructure.

**Not blocking 01, but blocking `03`, and therefore due before `day 4`** — listed so they are not
discovered inside a ticket:

- **The contract suite's split into an operations file and a stream file** (§5.5) — decides what
  03 writes.
- **The signature of the participant reads** (§5.1, §5.7): `listMembers(boardId)` and
  `readPrincipal({ principalId, boardId })`, with the latter returning principal + grant +
  provenance. Decide once; 03 freezes it.
- **Which principal a browser is, concretely** (§5.19): the seed's `browserSelectable` mark, the
  selection order, and that two browsers get two different principals. `02c` must seed it and
  `06b` must implement it, and 02c starts at day 3.
- **Where server-only code lives** (§5.9): the module that imports `env.ts`, holds the store
  singleton on `globalThis`, and is unreachable from `src/routes`/`src/components`. `06a` cannot
  write `06a:13` without it.

---

## Verdict

**Is the plan startable today? With §7's four decisions made, yes — 01 and 02a are genuinely
ready.** Without them, 01 will spend its session discovering its own token set, its font
destination and a contradiction with 06a.

**Is the plan buildable to the end as written? No — five tickets cannot be graded as written**
(§5.1, §5.2, §5.3, §5.4, §5.5), and two of those five would produce a *green* build that means
nothing: the HTTP client that cannot satisfy its own conformance suite, and the preset criterion
that two tickets both claim. A third (§5.6) is a criterion that cannot fail.

**The single decision that unblocks the most** is **§5.1 — give `listMembers` and `readPrincipal`
their server functions in 06a.** It is one line in one ticket, it makes the revision-8 interface
addition actually reachable, and without it the wave that proves the transport is swappable (W7)
either fails or is quietly weakened. The styling decision (§7.1) is the one that saves the most
*work*, but it unblocks nothing that is currently stuck.
