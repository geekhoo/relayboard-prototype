# Implementation review — the panel's synthesis

**Status:** the three reviews are in, and the Lead has verified their headline findings independently.
**Subject:** `apps/relayboard-web` at `c9304d6` ("app: tell an open stream that the workspace changed…"), working tree clean.
**Verdict: do not ship.** Three Critical findings reproduce under the Lead's own probes, each breaks a claim the product makes about itself, and each is reachable by a reader who does nothing unusual.

| Reviewer | Report | Verdict | Findings |
| --- | --- | --- | --- |
| Security, identity, admission | [`implementation-security-review.md`](implementation-security-review.md) | do not ship | 15 — 1 Critical, 4 High, 7 Medium, 3 Low |
| Architecture, store, transport, contract tests | [`implementation-architecture-review.md`](implementation-architecture-review.md) | ship with fixes | 15 — 2 Critical, 3 High, 7 Medium, 3 Low |
| Product, UX, DESIGN, parity | [`implementation-product-ux-review.md`](implementation-product-ux-review.md) | do not ship | 16 — 3 Critical, 3 High, 7 Medium, 3 Low |

The three seats disagreed on *verdict*, not on *facts*: the architecture reviewer hedged because its two Criticals are store-internal and it read the stream scoping as one High among several; the other two each found a Critical that the product's own rules single out. Taken together there is no reading under which this ships.

## The baseline the panel inherited, and why green gates prove little

The Lead ran the full gate before dispatching anyone, and ran it again at the same commit:

| Gate | Result |
| --- | --- |
| `npm run check` (biome) | clean, 129 files |
| `npm run check:styles` | clean |
| `npm run typecheck` | clean |
| `npm test` | **25 files, 369 tests pass** |
| `npm run build` | succeeds |
| `npm run check:boot` / `check:bundle` | pass |
| `npm run e2e` | **176 passed, 2.3 min** |

Every Critical finding below survives that. That is the report's most important single sentence: the four Criticals are each invisible to at least one of the gates that were built to catch them, and three of them are invisible to *all* of them.

## The Criticals, deduplicated and verified

The panel's 46 findings overlap; these are the ones that decide the verdict, with what the Lead reproduced itself.

### C1 — The SSE stream authorizes nothing and discloses every board (security F1, architecture F3)

`src/routes/api/stream.ts` resolves a principal, then replays and live-delivers **every** entry in the workspace with no `authorize()` and no per-board filter. `operationPermissions.subscribe = { atLeastOneBoard: "read:board" }` (`src/client/index.ts:583`) is declared and never read for this route.

Reproduced by the Lead against the built server: a validly signed cookie for **`sara`** (member of `campaign` and `design`, no grant on `platform`) and for **`nadia`** (workspace `read:board`, no board grants) each received all **31** seeded entries across all **10** threads, `connection-changed {"pending":31}`. Over RPC the same principal is refused: `/boards/platform` for `sara` renders the not-found state and 0 entries.

This falsifies spec L401 — "permissions are enforced at the operation boundary … a client that ignores the UI cannot exceed its grant" — which is the product's central security claim. The stream is a superset of what `readThread` will answer for the same caller.

### C2 — A created resource id collides with the seed (architecture F1)

`store/index.ts:660-665` mints ids from a per-store counter starting at 0 while the seed already occupies `res-1 … res-7`, so the **first** resource anyone adds is `res-1`. Reproduced by the Lead:

```
seeded platform resource ids: res-1,res-2,res-3
created id: res-1
platform resources now: res-1:Messaging architecture notes | res-2:Event envelope specification | res-3:Identity and provenance | res-1:My own doc
duplicate ids: ["res-1"]
```

`attachResource` resolves by `find(id)`, so the artifact points at the seeded record instead of the new one. This breaks the one invariant the resource model exists for — "a resource is canonical; an artifact points at it" — on a first-class action (`addResource` is on the interface).

### C3 — The idempotency map is global and checked before authorization (architecture F2)

`store/index.ts:684-685, 1336-1343`: one `Map<string, Entry>` keyed by the caller's own string, looked up before the thread, membership and permission checks. Reproduced by the Lead:

```
alex-authored: msg-delivery-10 alex | from alex, private
quill replay -> msg-delivery-10 alex | from alex, private | same object: true
quill holds post:message on delivery? false
sim a: msg-delivery-10  sim b: msg-delivery-10  same: true
```

So: a principal confined to other boards reads `delivery`'s prose by replaying a key; and two concurrent `simulateIncoming` calls from a process-level counter collapse to one entry. The conformance test "appends exactly one entry when two calls are in flight with the same key" passes *because* the namespace is global.

### C4 — Opening a thread never clears its unread badge in the shipped app (architecture F5, product F3)

`markRead` has exactly one caller in `src/`: `src/client/in-memory.ts:211`. The HTTP `readThread` (`src/server/functions/read.ts:97-106`) does not call it, and the shipped transport is HTTP (`root-provider.tsx:80-98`). Reproduced by the Lead in a real browser at `/boards/platform` as `alex`:

```
entries rendered in delivery: 9
after opening it — "Durable message delivery" row meta: "2 unread"
```

Spec L502 makes `seen` "advanced only when that principal has actually read the thread"; story 146 and ticket 03's recorded decision rest on it. It is asserted only by `operations.conformance.ts:772-792`, which runs only against the in-memory client — the divergence is exactly what the two-implementation seam exists to prevent.

### C5 (product) — Two sentences the interface says that the implementation does not keep

Both are the defect class `PRODUCT.md` principle 5 names outright, and both were verified by the Lead in source:

- `StreamPanel.tsx:235`: "Every entry stays in **durable history**" — over an in-memory store whose own sibling note says "A restart clears it".
- `PurgeDialog.tsx:213`: "Purged N boards and M entries. **Your own work is untouched**" — false precisely when `ownEntriesOnDemoBoards > 0`, the case the dialog's own overlap warning one click earlier announced.

## Highs, deduplicated

| Finding | Where | Reviewers | Lead-verified |
| --- | --- | --- | --- |
| One scalar resume cursor compared against per-thread `seq`; reconnecting at 9 replays **0 of 22** missed entries | `client/http.ts:408,420` + `routes/api/stream.ts:60-63,114` | arch F4 | yes — probe: `last-event-id: 9` → 0 entries, `pending: 0` |
| `revoke` is guarded by `admit:agent` via `isGateHolder`, not `revoke:agent`; the seed gives ordinary `alex` board-scoped `admit:agent` | `server/admissions.ts:393-395,651` | sec F2 | yes — read; message names `revoke:agent`, guard does not |
| A bearer token is examined **before** the cookie, inverting the module's own stated precedence | `server/principal.ts:154-155` vs `:192-207` | sec F3 | yes — read; no test presents both |
| Renewal sets a new credential hash but never `issued.delete`s the old, so a superseded token keeps resolving under the renewed expiry | `server/admissions.ts:727-734,381-390,601-621` | sec F5, arch F12 | yes — read |
| A refused admission leaves an orphan `agent-…` principal behind (no rollback) | `server/admissions.ts:547-559` | sec F4 | yes — read |
| `stream-error` is emitted and consumed by nobody, so a disconnected stream still reads "Live" | `client/http.ts:453` → `-conversation-queries.ts:139` | product F4 | yes — grep: no consumer outside the commentary |
| Escape's drawer branch omits the `dialogOpen()` guard the same file applies to `/`; the test named for the contract never opens a dialog | `components/-keyboard.ts:81` vs `:64` | product F5 | yes — read |
| The store and the whole demo seed ship in the client bundle; `check:bundle` scans three needles and `noRestrictedImports` exempts `integrations/` | `integrations/…/root-provider.tsx:7-8`, `client/in-memory.ts:32-34`, `biome.json:36-48` | arch F10 | yes — `Platform workspace`, `Nadia Rahman`, `browserSelectable` all in `index-ITa5joQ5.js` |

## The pattern worth naming

Nine of the High findings and three of the Criticals share one shape: **a comment, a test name or a status field asserts a protection the code does not implement.**

- `tests/admissions.test.ts:747` revokes as `alex` and passes — the defect encoded as a test.
- `e2e/parity.spec.ts:1274` is titled "…and close on Escape" and never presses Escape (`<details>` has no Escape behaviour).
- `e2e/keyboard.spec.ts:296` is titled "…leaves nothing else closed" and never opens anything else.
- `e2e/isolation.spec.ts:25` says "Read a thread, which advances this reader's `seen` watermark" and then only compares counts across a reset, which is equal either way.
- `helpers/parity.ts` marks lines 17, 50 and 57 `covered` where the covering test asserts an adjacent fact.
- `store/instance.ts:14-17` says the UI boundary is enforced by `biome`; it is enforced only for `routes/` and `components/`.
- `server/stream.ts:107` names a keep-alive frame the route never sends.

This matters more than any single finding: the repository's quality mechanism is "the gate decides", and these are the places where a green gate is a comment that has not been read.

## Cross-cutting: what the panel confirms is sound

All three reviewers independently verified, and the Lead re-checked the load-bearing ones:

- `seq` is per-thread, gapless, immutable, and the only entry ordering; the deliberately non-monotonic `retention` thread survives and is asserted, and nothing in the entry path sorts by `createdAt`.
- One chronology for four entry kinds, with refusals preceding the write so a refused act leaves no partial entry.
- No server-side queue; pause withholds by holding the cursor; the eight-name wire vocabulary is exactly spec L358 and `stream-error` is deliberately off the wire.
- Authorship never comes from input: the boundary strips a forged `authorId` rather than rejecting it, and no participant-facing operation can mint or widen a grant.
- `kind` is consulted in six places, five of them labels; the one load-bearing comparison is the gate rule.
- The cookie is HMAC-signed with a constant-time compare, `HttpOnly`/`SameSite=Lax`/production-`Secure`, and boot refuses without `SESSION_SECRET`.
- The visual system: one light world with no dark-mode residue, the self-hosted IBM Plex Sans with the specified `@font-face`, no colour literal outside the token block, and the honesty copy in `StoreLifetimeNote`, `ParticipantPanel` and `Gatekeeper` doing exactly what the product rules demand.

## Lead-only measurements not in the three reports

- **`npm run e2e` passes 176/176** against the built server at `c9304d6`. The suite is real and it exercises the route seam; it simply does not assert the six behaviours above.
- **A validly signed cookie naming a principal the store no longer holds returns an unhandled HTTP 500** on `/api/stream` (`{"status":500,"unhandled":true,"message":"HTTPError"}`) rather than the documented `unresolved` family. Spec L373's refusal happens; its message and family are lost at the route boundary. Low severity, easy to fix, worth a test.
- **The session round-robin is observable and manipulable**: three unauthenticated `GET /api/stream` requests issued `alex`, `maya`, `alex`. That is 06b's design working as documented (cyclic, stable per store) and simultaneously the reason security F9 is fair: any unauthenticated request to that route shifts which principal the next browser becomes.
- **`tests/contract/stream.conformance.ts` contains the same test twice**, verbatim title and body, at `:301` and `:322`. Harmless at runtime, but it means the file's own count overstates what is asserted — the same class as the parity-status finding.

## What the panel did not check

Each report has its own "Not checked" section and they are honest. In sum: no reviewer ran the gate (the Lead did); none exercised the admission state machine end to end over the wire; none re-measured contrast or ran a screen reader; none verified the `woff2` is byte-identical to the prototype's copy. The seven interface members added beyond spec L292-321 are unreviewed as *additions* — they are implemented and typed, but no document argues for them.

## What to do next

Ranked by what unblocks the most:

1. `/api/stream`: filter by `permits(principal.id, "read:board", board.id)` on both the replay walk and the live listener, and `authorize("subscribe")` at the top. One function, two loops, closes C1.
2. `markRead` in the HTTP `readThread` handler, plus a route-seam assertion that a badge clears. Closes C4 and makes parity line 146 real.
3. Namespace the idempotency map by `(principalId, idempotencyKey)` (or `(threadId, key)`), and keep the lookup before validation. Closes C3.
4. Mint resource ids outside the seed's namespace — the seed is data, so derive the counter's floor from it or prefix owner records. Closes C2.
5. Replace per-thread replay cursors with per-thread watermarks (or key the cursor by thread), and assert a cross-thread resume. Closes the first High.
6. Fix the six untrue sentences and the four tests that overstate their names; those are cheap and they are what makes the next review trustworthy.
7. Then re-run both reviews' evidence against the fixes: several findings are one-line changes whose *tests* are the work.
