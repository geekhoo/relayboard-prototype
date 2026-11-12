# Architecture & data-integrity — review of the Relayboard app implementation

**Verdict:** ship with fixes (two of them before anyone calls this durable: a colliding resource id and an idempotency map that crosses principals)

**Scope:** the module graph, the store, sequencing, the stream transport, the client seam and test-contract integrity of `apps/relayboard-web` at `c9304d6`. Read line by line: `src/server/store/index.ts` (1,392 lines), `store/demo-seed.ts` (829), `store/instance.ts` (78), `src/domain/{types,entries,forms,index,errors,permissions,grants}.ts` (307/96/154/47/96/79/199), `src/client/{index,http,in-memory,context}.ts` (606/468/454/124), `src/server/{stream,session,principal,permissions,grants,env,admissions,credential}.ts` (243/117/271/118/198/56/761/102), `src/server/functions/{read,write,inputs,errors,admission}.ts` (236/323/150/92/215), `src/routes/api/stream.ts` (230), `src/routes/{index,boards.$boardId}.tsx` (81/408), `src/routes/{-conversation,-thread-list}.ts` (222/129), `src/components/{-conversation-queries,-thread-queries,-rail-queries,-unread}.ts`, `src/integrations/.../root-provider.tsx` (108), `src/routes/__root.tsx`, `src/{env,start}.ts`, `biome.json`, `scripts/{check-boot,check-client-bundle}.mjs`, `tests/store-contract.ts` (515), `tests/contract/operations.conformance.ts` (818), `tests/contract/stream.conformance.ts` (396), `tests/{client,http-client,stream-contract,demo-seed,purge,store-instance,error-families}.test.ts`, and the e2e harness helpers/fixtures. 129 lint-clean source files reviewed; ~7,600 lines of source and ~3,100 lines of test read in full.

**Method:** read `AGENTS.md` (root and app), `spec.md` (all 653 lines), `biome.json`, `vitest.config.ts`, `package.json`, and the two check scripts. Import-graph grep over `src/**` for `#/server`, `#/server/store`, `#/client/in-memory`. String-grepped the **built** client bundle at `.output/public/assets/*.js` (the current build) for server-only needles. Ran targeted probes against the store, the admissions surface and the client through `jiti` (the app's own module instance, absolute `#/` alias), plus one probe through `createInMemoryClient` — every quoted probe output below is real. Did **not** run `npm run build`, `app:check`, `e2e` or the full `vitest` run, per the brief.

## Ranked findings

| # | Severity | Where | Finding |
| --- | --- | --- | --- |
| F1 | Critical | `src/server/store/index.ts:660-665,1192-1194` | A created resource's id is minted from a store-wide counter and collides with the seed's `res-1…res-7`, so two resources share an id; an artifact then resolves to the wrong canonical record or is refused. |
| F2 | Critical | `src/server/store/index.ts:684-685,1336-1343` | The idempotency map is one global map keyed by a caller-chosen string, checked before any permission or membership check — a principal can replay another principal's key and receive an entry from a board it cannot read. |
| F3 | High | `src/routes/api/stream.ts:110-122,187-198` | Both the SSE replay and the live commit listener iterate **every** board and thread with no `read:board` check, so a principal confined to one board receives every other board's entries. |
| F4 | High | `src/client/http.ts:408,420` + `src/server/stream.ts:60-63` | The resume cursor is a single scalar compared against each thread's own `seq`, so a cursor from one long thread silently suppresses the replay of every shorter thread. |
| F5 | High | `src/server/functions/read.ts:97-106` vs `src/client/in-memory.ts:206-213` | Over HTTP, `readThread` never advances `seen` (only the in-memory client calls `store.markRead`), so in the shipped app opening a thread never clears its unread badge. |
| F6 | Medium | `src/server/store/index.ts:983-1024` | `restoreDemoContent` re-inserts the seed snapshot by reference and unfrozen, so a caller can mutate live store state through a record it was handed. |
| F7 | Medium | `src/server/store/index.ts:949-972,1340-1343` | The idempotency map is not cleared by a purge: a replay after purge/restore returns a phantom entry that claims a `seq` the restored chronology now assigns to a different entry. |
| F8 | Medium | `src/server/store/index.ts:770-783` | `purgeImpact.ownEntriesOnDemoBoards` counts only entries by `browserSelectable` principals, so owner entries by an agent or the superadmin are deleted with no warning — the number the confirmation promises to be honest about. |
| F9 | Medium | `src/server/functions/inputs.ts:69-77,89-95` | Boundary schemas accept whitespace-only names/titles; the store then trims to `""`, so a non-browser caller can create permanently blank boards, threads and resources. |
| F10 | Medium | `src/integrations/tanstack-query/root-provider.tsx:7-8,89-98` + `scripts/check-client-bundle.mjs:39-52` | The store, the whole demo seed and the grant-rule messages ship inside the browser bundle because the router context imports the in-memory client statically; the four-module rule holds for `routes/` and `components/` only, and `check:bundle` scans three needles so it cannot see this. |
| F11 | Medium | `tests/contract/operations.conformance.ts:104-128` + `tests/http-client.test.ts:24-30` | The conformance suite runs against the in-memory client only, and three interface members (`purgeImpact`, `purgeDemoContent`, `restoreDemoContent`) appear in it as names with no behavioural assertion anywhere. |
| F12 | Medium | `src/server/admissions.ts:695-739,601-621` | A renewal rotates the stored hash but leaves the old token in `issued`, so the old credential resolves again once the record's new expiry is in the future. |
| F13 | Low | `src/routes/api/stream.ts:217-226` | No heartbeat frame is ever sent on the SSE route; `stream.ts:107` names a keep-alive the implementation does not produce. |
| F14 | Low | `src/client/index.ts:596-603` + `src/client/in-memory.ts:23` | `NotYetImplementedError` and its "three acts arrive with 10a" docstring outlive the acts' implementation. |
| F15 | Low | `src/server/store/index.ts:1079-1088` | `createBoard` writes the creator's member grant by pushing into `grants` directly, bypassing `checkGrant` — the one place `src/server/grants.ts:157` says grant rules live. |

## F1 — Resource ids collide across boards (Critical)

```ts
// src/server/store/index.ts:660-665
let sequence = 0;
/** Ids for records a caller created. The prefix matches the prototype's `uid('thread')` reading. */
const nextId = (prefix: string): string => {
	sequence += 1;
	return `${prefix}-${sequence}`;
};
// src/server/store/index.ts:1192-1200
const resource: Resource = Object.freeze({
	id: nextId("res"),
	boardId: input.boardId,
```

The seed already occupies that namespace: `/src/server/store/demo-seed.ts:549` `id: "res-1"` … `res-7` (`:601-610`). The counter starts at 0 per store, and the seed is loaded as data, so the **first** resource anyone adds gets `res-1`. Measured on the demo seed:

```
created resource: res-1 My own doc
platform resources now: res-1:Messaging architecture notes | res-2:Event envelope specification | res-3:Identity and provenance | res-1:My own doc
artifact points at: res-1
what a reader resolves that id to: Messaging architecture notes | on board platform
```

and for a resource created on a *new* board, attaching it to a thread on that board is refused outright:

```
board board-1 | thread thread-2 | new resource res-3 on board-1
seeded resource ids: res-1,res-2,res-3
my board resource ids: res-3
attach REFUSED: No such resource on this board
```

**Why it matters:** this breaks the one rule the resource model exists for — "a resource is canonical; an artifact points at it" (spec L437-448, `AGENTS.md`). Two live resources share an id, `listResources` returns duplicate ids, and `attachResource`'s `resources.find(id)` (`store/index.ts:1218-1222`) resolves whichever came first in the array. Adding a resource is a first-class product action (`addResource` is on the interface and reachable from the create dialog), so a reader hits this on their first resource. Note the ids are minted per *store*, so the collision also survives a restart in the same shape.

## F2 — One global idempotency map, checked before any authorization (Critical)

```ts
// src/server/store/index.ts:684-685
/** Keys to the entry they already committed, so a replay finds the record rather than the text. */
const committed = new Map<string, Entry>();
// src/server/store/index.ts:1336-1343
appendMessage: (input) => {
	// Idempotency is checked before validation: a retry must be safe, so a stored
	// key returns the stored entry even when the retry's own payload would now be
	// refused.
	if (input.idempotencyKey !== undefined) {
		const replay = committed.get(input.idempotencyKey);
		if (replay) return replay;
	}
```

The spec does require "idempotency is checked **before** validation" (L514) — but it says nothing about a *namespace*. Here the map is keyed by a caller-supplied string with no thread, principal or board component, and the lookup happens before `threadOf`, before `holds(…, "post:message", …)`, and before the text check. Measured:

```
alex: msg-delivery-10 seq 10 | maya got: msg-delivery-10 seq 10 author alex | same obj: true
non-member replay: msg-delivery-10 author alex text from alex
sim-1 stored by orion on delivery: msg-delivery-11
quill permits post:message on delivery: false
quill replay of sim-1 -> msg-delivery-11 | author orion | text: delivery secret prose
launch entries after: 3
```

**Why it matters:** three separate consequences, all reachable from a client that can choose `idempotencyKey` (the composer mints its own, but the wire accepts any string, `inputs.ts:65`):

1. **Cross-principal content disclosure.** `quill` holds grants on `campaign` and `design` only; it reads `delivery`'s prose by replaying a key it guessed or observed. The permission check it should have met is never reached.
2. **A replay can be used to make someone else's act appear in your thread.** Any caller can send `{threadId: <any thread>, idempotencyKey: "sim-1"}` and get a success back for an entry that does not belong to that thread — the composer clears the draft and the reader loses what they wrote, because the returned `Entry` is a real record and the UI treats a resolved append as a commit (`Conversation.tsx:232-236`).
3. **Simulation collides across principals.** `simulateIncoming` uses `idempotencyKey: \`sim-${simulation}\`` (`client/in-memory.ts:326`, `functions/write.ts:260`) from a process-level counter. Two clients simulating concurrently over one store produce the same key, so the second "simulation" appends nothing:

```
A sim: msg-delivery-10 B sim: msg-delivery-10 | same entry: true | length before/after B: 10 10
```

The conformance suite's "appends exactly one entry when two calls are in flight with the same key" (`operations.conformance.ts:450-482`) passes precisely *because* the namespace is global — it asserts the mechanism that causes this.

## F3 — The stream replays and delivers across boards without a permission check (High)

```ts
// src/routes/api/stream.ts:110-122
let pending = 0;
for (const board of store.listBoards()) {
	for (const thread of store.listThreads(board.id)) {
		for (const entry of store.readEntries(thread.id)) {
			if (entry.seq <= from) continue;
			// The reader's own entries are not a replay of something it missed.
			pending += 1;
			send(frameOf(entryCommitted(thread.id, entry, true), entry.seq));
// src/routes/api/stream.ts:187-198
unsubscribe = store.onCommit((commit) => {
	if (store.isPaused(principal.id)) return;
	send(frameOf(entryCommitted(commit.threadId, commit.entry, true), commit.entry.seq));
});
```

The route resolves a principal and checks `accessEndedFor`, then iterates and forwards **every** entry in the workspace. `store.permits`, `readView` and `grantsFor` are never consulted — compare `store.readView` (`index.ts:863-868`), the visibility primitive the store does provide. Measured for the seed's principals:

```
quill   boards: campaign,design | readable threads: 5 / 10
sara    boards: campaign,design | readable threads: 5 / 10
beacon  boards: platform,design | readable threads: 7 / 10
orion   boards: platform | readable threads: 5 / 10
total entries the route iterates for ANY session: 31
```

and the store's own commit path advances **every** connected principal's cursor for every commit, regardless of grant (`index.ts:829-835`).

**Why it matters:** "the server refuses a forbidden act even if the interface would have offered it" (story 75) and "permissions are enforced at the operation boundary" (spec L401) are both true of the RPC surface and false of the stream. `read:board` is the product's containment mechanism; a principal refused `readThread` over RPC receives the same entries over SSE, including their text, on a connection the page opens for any reader with one board (`operationPermissions.subscribe = { atLeastOneBoard: "read:board" }`, `client/index.ts:583`). This is the same class of leak as F2 but reachable without guessing anything.

## F4 — One scalar cursor cannot resume several threads (High)

```ts
// src/client/http.ts:408,420
let cursor = 0;
...
const url = cursor > 0 ? `${STREAM_PATH}?after=${cursor}` : STREAM_PATH;
// src/routes/api/stream.ts:60-63
const from = Math.max(
	cursorFromHeader(request.headers.get("last-event-id")),
	cursorFromHeader(new URL(request.url).searchParams.get("after")),
);
// src/routes/api/stream.ts:114 — one comparison per thread, against a per-thread seq
if (entry.seq <= from) continue;
```

`seq` is per thread (spec L499-501) but `from` is one number for the whole workspace, and the client's `cursor` is the max `seq` it has seen anywhere (`advanceCursor`, `stream.ts:150-151`). Worse, resuming sets *every* thread's cursor to its last seq (`index.ts:891-893`), but the SSE replay uses `readEntries`'s `seq`, not the reader's per-thread deltas. Measured over the seeded workspace:

```
total entries: 31 | replayed from cursor 9: 0 | skipped: 31
skipped threads: delivery,identity,read-replay,retention,api,launch,assets,review,components,accessibility
```

**Why it matters:** the product's central claim is that a returning participant can reconstruct what happened while absent. A reader who was last in `delivery` (last seq 9) reconnects and is replayed **nothing** — every shorter thread's missed entries are filtered out by a comparison against another thread's numbering. The conformance case "replays from the subscriber cursor on resume and reports the count" (`stream.conformance.ts:182-234`) only checks that `pending` is a number and that a second subscribe reports zero; it never asserts that a missed entry is actually re-delivered across threads.

## F5 — Reading a thread over HTTP never advances `seen` (High)

```ts
// src/server/functions/read.ts:101-106
const thread = store().readThread(data.threadId);
if (!thread) throw unknownObject("thread", data.threadId);
// The board comes from the **thread**, not from the request: a caller cannot name a board it
// holds a grant on and read a thread in one it does not.
authorizeAs("readThread", { boardId: thread.boardId });
return { thread, entries: store().readEntries(data.threadId) };
```

No `markRead`. The only caller of `store.markRead` in the whole source tree is `src/client/in-memory.ts:211`; grep over `src/server` returns the declaration (`index.ts:318`) and the implementation (`index.ts:896`) and nothing else. The two transports therefore disagree on the one behaviour the unread model rests on, and the conformance case that pins it —

```ts
// tests/contract/operations.conformance.ts:779-784
await api.readThread(threadId);
const after = await api.readPositions(threadId);
const mine = after.find((position) => position.principalId === actor);
expect(mine?.watermarks.seen).toBe(
	(await api.readThread(threadId)).entries.length,
);
```

— runs only against the in-memory client (`tests/client.test.ts:30-39`); the HTTP run does not exist (F11).

**Why it matters:** the shipped app uses the HTTP client (`root-provider.tsx:80-98`). `seen` never moves, so `unreadInThread` (`components/-unread.ts:20-26`) always reports the full seeded backlog: the rail's counts, the thread rows' badges and the unread filter (spec L502, story 13) are all permanently wrong after the first read, which contradicts the comments in `Conversation.tsx:47-53` and `-conversation-queries.ts:19-35` and story 27's per-thread read position. The e2e suite cannot see it: isolation asserts a *reset* restores the seed counts (`e2e/isolation.spec.ts:25-38`), and parity 38 asserts counts *derived from the seed* (`e2e/parity.spec.ts:948-971`), never that a badge clears after opening a thread.

## F6 — `restoreDemoContent` hands out unfrozen seed records (Medium)

```ts
// src/server/store/index.ts:989-1011
const missingBoards = demoBoards.filter(
	(seed) => !boards.some((board) => board.id === seed.id),
);
if (missingBoards.length > 0) {
	boards = Object.freeze([...boards, ...missingBoards]);
```

The array is frozen; its **elements are not**, and they are `seedSnapshot`'s own objects rather than copies. Compare `collection()` (`:553-554`), `ordered()` (`:560-563`) and `frozen()` (`:538-544`), which copy and freeze on the way in, and the module's own promise at `:75-79`: "Everything handed out is frozen, so a caller holding an entry cannot rewrite the position it was given." Measured:

```
frozen board after restore? false
read back: mutated by a caller
```

**Why it matters:** after any purge/restore cycle — the documented demo workflow — `listBoards()`/`readThread()` return records whose mutation is reflected in the store and in every other reader's next render. A caller that sorts or annotates a board in place (a plausible component bug) corrupts the workspace. The same holds for threads and resources restored at `:997-1011`.

## F7 — A stale idempotency key survives a purge and returns a phantom entry (Medium)

```ts
// src/server/store/index.ts:949-972
purgeDemoContent: () => {
	const impact = purgeImpact();
	...
	for (const threadId of demoThreadIds) {
		entriesByThread.delete(threadId);
	}
```

`committed` is never touched. Measured:

```
posted: msg-delivery-10 seq 10
after restore, delivery length: 9 last seq: 9
replay returned: msg-delivery-10 seq 10 | in chronology? false
```

**Why it matters:** the replay returns an `Entry` with `seq: 10` in a thread whose last position is 9 — a record that exists only in the map. A composer holding that key (it keeps keys across failures, `Conversation.tsx:246-251`) treats the append as committed and clears the draft, while nothing was written; and the returned `seq` is a number the thread will hand to a different entry later. The store's own idempotency contract ("returns the stored message") is satisfied only while the stored entry is still in the chronology.

## F8 — The purge's own-entries count is narrower than its own sentence (Medium)

```ts
// src/server/store/index.ts:770-783
const ownEntriesOnDemoBoards = demoEntries.reduce(
	(total, [, entries]) =>
		total +
		entries.filter(
			(entry) =>
				entry.origin === "owner" &&
				principals.some(
					(principal) =>
						principal.id === entry.authorId &&
						principal.browserSelectable === true,
				),
		).length,
	0,
);
```

Measured:

```
owner-origin entries on demo board: 1 | impact.ownEntriesOnDemoBoards: 0 | impact.entries: 33
```

**Why it matters:** the comment above the predicate (`:764-769`) justifies excluding *seeded* authorship — correct — but `browserSelectable` is a session-issuance fact, not an authorship fact. An owner entry written by an agent, by `nadia`, or by any principal a future session can act as is deleted with the board and reported as "None of your entries are in demo boards" (`PurgeDialog.tsx:162-165`). Story 162 and spec L492 make that count the whole justification for the confirmation; `tests/purge.test.ts:29-40` only exercises the `alex` case, so the narrower predicate is pinned as correct.

## F9 — Boundary schemas accept names that trim to empty (Medium)

```ts
// src/server/functions/inputs.ts:69-77
export const createThreadInput = z.object({
	boardId: z.string().min(1),
	title: z.string().min(1),
});
export const createBoardInput = z.object({
	name: z.string().min(1),
```

The domain forms do trim (`forms.ts:70-73`, `:85-92`), but the server functions do not use them — they use these schemas — and the store trims after receiving (`index.ts:1054,1099`). Measured through the real schema and store:

```
board name after trim: "" | short: B
thread title after trim: ""
```

**Why it matters:** spec L154 and story 38 make "validated at the boundary, refused before the store" a claim. A whitespace name is accepted, stored as `""`, and becomes a permanent record (the store has no delete). The create dialog is not the only caller — the server functions are the published surface for agents (same schema module, `inputs.ts:5-13`).

## F10 — The store and the demo seed ship in the browser bundle (Medium)

```ts
// src/integrations/tanstack-query/root-provider.tsx:7-8
import { createStore } from "#/server/store";
import { demoOptions, demoSeed } from "#/server/store/demo-seed";
// :92-98
: createInMemoryClient({
		store: createStore(demoSeed(), demoOptions()),
		principalId,
	});
```

`createInMemoryClient` statically imports `#/server/store` and `#/server/store/demo-seed` (`client/in-memory.ts:32-34`), so the whole store — including `checkGrant`'s refusal sentences — is in the client graph whenever the context module is. Confirmed in the current build:

```
Durable message delivery      => index-ITa5joQ5.js
gate-is-human-only            => index-ITa5joQ5.js
The demo seed marks no browser-selectable => index-ITa5joQ5.js
index-ITa5joQ5.js = 319,531 bytes
```

The biome rule that is supposed to keep the seam (`biome.json:36-48`) applies its `noRestrictedImports` override only to `**/src/routes/**/*` and `**/src/components/**/*`; `src/integrations/` and `src/client/` are exempt, and the file's own comment (`store/instance.ts:14-17`) claims the boundary is general. `scripts/check-client-bundle.mjs:39-52` scans exactly three needles (`SESSION_SECRET`, `requireSessionSecret`, `node:crypto`) and no module identity, so it passes while the store is in the bundle.

**Why it matters:** spec L283 states the rule as a module rule ("the UI depends only on the domain types and the client interface"), and the reason is stated too — the seam is what lets a real backend replace this one. The shipped app carries the demo seed and the permission rules to the browser; more practically, any future secret or server-only capability added to `store/` will be one static import away from the client while both gates stay green.

## F11 — The conformance suite proves one transport, and three members have no behavioural test (Medium)

```ts
// tests/http-client.test.ts:24-30
* ## The criterion this file cannot satisfy, stated plainly
*
* 06c:17 asks for 03's conformance suite to run unchanged against the HTTP client as part of
* `npm test`. It does not, because the transport does not exist in that process.
```

The honesty is exemplary and the gap is real: `describeOperationsConformance` is called once (`tests/client.test.ts:30`) and `describeStreamConformance` once (`:148`), both over `createInMemoryClient`. The suite's own header (`operations.conformance.ts:33-45`) explains that it cannot test a refusal — fair — but F5 above is exactly the drift the suite is supposed to catch, and it sits in a member the suite *does* exercise, undetected because only one implementation runs it.

Coverage of the members, by assertion rather than by name: the shape test lists all 23 names (`operations.conformance.ts:104-128`), and the permission table is asserted exhaustively (`:148-219`), but `purgeImpact`, `purgeDemoContent` and `restoreDemoContent` are **never called** in that file or in `stream.conformance.ts` — grep finds them only in the name list and the table. Their only coverage is the store-level `tests/purge.test.ts`, which does not go through the interface, plus the e2e purge spec. `readHeldPermissions` is likewise asserted only as a table row, never called. Spec L292-321 lists 16 members; the interface ships 23 (`client/index.ts:462-486`). The seven additions — `purgeImpact`, `purgeDemoContent`, `restoreDemoContent`, `readActingPrincipal`, `readHeldPermissions`, `readPrincipal`'s `derived` field, and returning `Entry` rather than `Message` — are the app's own decisions, not the spec's, and the conformance suite asserts its own hard-coded list (`:104-128`), so a later removal or renaming of one is checked against the implementation's current shape rather than against the spec.

**Why it matters:** "two implementations, one interface" is the claim that makes the transport swappable and the route seam trustworthy (spec L576-578). Today the in-memory client is the only implementation under conformance, and it is the one that *does* advance `seen`; the divergence in F5 is the exact failure mode the seam exists to prevent.

## F12 — Renewal leaves the previous credential live (Medium)

```ts
// src/server/admissions.ts:727-734
const token = mint();
record.credentialHash = hash(token);
record.expiresAt = ...;
record.expiry = input.expiry;
issued.set(record.credentialHash, record.principalId as PrincipalId);
```

The old hash stays in `issued`; `resolveCredential` (`:601-621`) looks the hash up and then checks the **record's** expiry, which has just been moved into the future. Measured with an injected clock:

```
cred1 resolves: agent-vogbsgVGaKsG
cred1 after expiry: REFUSED
renewed, new cred differs: true
old cred1 resolves after renewal: agent-vogbsgVGaKsG
new cred resolves: agent-vogbsgVGaKsG
```

**Why it matters:** the design's stated reason for refusing a renewal of a live credential (`admissions.ts:688-694`) is that "a caller cannot rotate a working credential to launder a compromised one." The same reasoning applied one step later fails: the *expired* credential — the one whose compromise prompted the renewal — becomes usable again and stays usable for the life of the renewed record. The suite's renewal cases assert identity preservation (`admissions.test.ts`), not that the old token is dead.

## F13 — No SSE heartbeat, though the contract names one (Low)

```ts
// src/routes/api/stream.ts:217-226
return new Response(body, {
	headers: {
		"content-type": "text/event-stream; charset=utf-8",
		"cache-control": "no-cache, no-transform",
		connection: "keep-alive",
```

No interval, no comment frame, no `:` line: grep for `setInterval` over `src/` returns nothing, and the only "keep-alive" mentions are the header above and `stream.ts:107`'s docstring, which says `eventOf` returns `null` for "a comment or a keep-alive" that is never produced. **Why it matters:** a load balancer or proxy with an idle timeout drops a quiet connection; the browser reports that as `error` and the client emits `stream-error`, so the failure is at least visible — but story 49 ("recover on its own") is served by `EventSource`'s retry, not by a heartbeat the implementation claims to have.

## F14 — Dead error class and stale docstrings around the three acts (Low)

```ts
// src/client/index.ts:596-603
export class NotYetImplementedError extends Error {
	constructor(operation: ClientOperation, ticket: string) {
		super(`${operation} is not implemented in this build; it arrives with ${ticket}`);
```

Imported at `client/in-memory.ts:23` and referenced nowhere but the docstring at `:55-56` ("They throw NotYetImplementedError naming 10a") — which the same file contradicts at `:369-394`, where all three acts call the store. **Why it matters:** the documented state of the interface disagrees with its behaviour in both directions, which is the same claim-vs-implementation defect class the brief asks about, at low blast radius.

## F15 — `createBoard` writes a grant outside the rule module (Low)

```ts
// src/server/store/index.ts:1079-1088
grants = Object.freeze([
	...grants,
	{
		granterId: input.creatorId,
		principalId: input.creatorId,
		scope: "board" as const,
		boardId: board.id,
		permissions: BOARD_MEMBER_PERMISSIONS,
	},
]);
```

`store.grant` (`:1144-1186`) is the operation `src/server/grants.ts:8-14` says exists so "a grant can be written by any path that reaches the store" is covered by one set of rules; `checkGrant` is never called here. Measured: the seeded superadmin holds `create:board` and no `post:message` anywhere (`demo-seed.ts:656-662`), yet creating a board gives it `post:message`, `move:status`, `add:artifact`, `acknowledge:thread` on that board:

```
nadia permits post:message on the board she made: true
nadia grant on it: read:board,create:thread,add:resource,read:member,post:message,move:status,add:artifact,acknowledge:thread
```

**Why it matters:** this is defensible product behaviour (a creator should be able to use what it made, and `tests/purge.test.ts:181-206` asserts it), but it is a grant that could not have been written through `grant` by the principal that wrote it — so the invariant "no grant exceeds its granter's permissions" (spec L398, story 92) is true only of the path that enforces it. Recording it here because the code says the rule lives in one place.

## What I checked and found sound

- **`seq` is per-thread, gapless and the only entry ordering.** `lastSeq` is a max over the thread's entries (`store/index.ts:556-557`), assignment and insertion are one synchronous step in both `appendMessage` (`:1354-1370`) and `commitEntry` (`:824-827`), refusals happen before the number is taken (`:813-823`), and `entriesByThread` is ordered by `seq` at seed time (`:560-563,668-674`). The seed's non-monotonic thread is present and asserted: `retention`'s two entries are 2820 and 3200 minutes old (`demo-seed.ts:417-430`), `tests/demo-seed.test.ts:346-365` asserts seq `[1,2]` with `createdAt` running the other way, and the UI path sorts by `seq` (`routes/-conversation.ts:31-32`). The one timestamp sort is *across* threads in the thread list (`routes/-thread-list.ts:36-37,69-74`), documented at `:39-51` and permitted by spec L501 — entries never sort by it (`Conversation.tsx:41-45`, `-conversation.ts:18-30`).
- **One chronology for four kinds.** `commitEntry` is the only entry-writing path for artifacts, status moves and acknowledgements (all three call it: `:1224`, `:1262`, `:1317`), and each refusal precedes it, so a refused act leaves the thread untouched. `tests/store-contract.ts:339-458` asserts seq preservation and no-consumption for all three, and `operations.conformance.ts:715-742` asserts a message, artifact and move interleave `n, n+1, n+2`. `moveStatus` writes the thread's status only *after* the entry exists (`:1277-1286`).
- **The SSE frame vocabulary is exactly the spec's eight** (`server/stream.ts:34-43`, spec L358), `stream-error` is deliberately out of it, every entry-bearing event carries its `seq` as the SSE `id` (`:98-104,76-86`), a frame with no seq gets no `id` so a cursor cannot go backwards, and the in-memory client and the route both build events through the same `entryCommitted`/WIRE_EVENT_NAMES` (`client/in-memory.ts:35,168`; `routes/api/stream.ts:8`).
- **No server-side queue.** `store` holds no withheld events; a paused principal's `cursor` does not move (`:829-835`) and resume sets it to the thread's last seq (`:883-894`); the route skips sending while paused (`routes/api/stream.ts:191`) rather than buffering.
- **`seq` assignment is honoured as a single synchronous step**, and `appendMessage` returns `Entry`, not a promise, with a type-level assertion that a later async store cannot slip in (`store-contract.ts:497-513`).
- **The store factory does not alias its seed** for principals/boards/threads/resources at construction (`collection()`, `store/index.ts:553-554,584,657-659`) and the demo seed returns fresh copies each call (`demo-seed.ts:809-829`, asserted `demo-seed.test.ts:247-275`).
- **Purge removes demo-origin records only**, leaves principals, grants and watermarks untouched (`store/index.ts:949-972`; asserted `tests/purge.test.ts:59-114`), and restore is additive by id and idempotent (`:983-1024`; `purge.test.ts:155-164`).
- **Validation is at the boundary for every server function.** Every write has a closed `z.object` validator (`functions/inputs.ts`), all imports of input schemas are exhaustive per function, and `appendMessageInput` strips a forged `authorId` rather than storing it (`tests/http-client.test.ts:98-127`). `authorize()` reads the declared table and the table is exhaustive by type over `ClientOperation` (`client/index.ts:584`, `server/permissions.ts:98-118`); `kind` is consulted in exactly one place (`server/grants.ts:54-60`), as `AGENTS.md` requires.
- **The single store instance** is a `globalThis` singleton with a getter (`store/instance.ts:26-46`), asserted identity-stable and reset-capable (`tests/store-instance.test.ts:28-108`), and the test/dev reset is gated by `resetAllowed` (`instance.ts:75-78`, `functions/read.ts:232-236`).
- **Module boundaries in `routes/` and `components/`.** No file under either imports `#/server`, `#/server/store`, the demo seed or `#/client/in-memory` (grep returns only the `integrations/` hits reported in F10), which the biome override enforces and `e2e/isolation.spec.ts:60-70` asserts for the route seam. The store never imports anything from the UI.
- **The client's write payloads carry no author**, built field by field rather than spread (`client/http.ts:263-289`), and the boundary strips a forged one.
- **Error strings live once in the domain** (`domain/errors.ts`) and the append refusal order matches spec L513 (`store/index.ts:1345-1352`, asserted `store-contract.ts:105-138` against `errorMessageList`).
- **`check:bundle` and `check:boot` are real gates**, not no-ops: boot spawns the built entry three ways and checks all three outcomes (`scripts/check-boot.mjs:69-119`), bundle fails on an empty asset list rather than passing vacuously (`check-client-bundle.mjs:77-82`) and none of its three needles reaches the client (verified against the live build).

## Not checked

- **The full gate.** I did not run `app:check`, `npm test`, `build`, `e2e`, `check:boot` or `check:bundle`; the Lead's baseline at `c9304d6` is taken as given, and every bundle statement above was made against the build already on disk, which may not be byte-identical to a fresh one.
- **Whether the e2e suite catches F5.** I read `isolation.spec.ts`, `parity.spec.ts` §S7, `purge.spec.ts`, `writes.spec.ts` and the harness helpers but not all ~20 spec files; a badge-clearing assertion may exist somewhere I did not open. It was not in the four I read.
- **The admission surface's full state machine.** I read `admissions.ts` (761 lines) and probed renewal, revocation and the gate rule, but did not exercise deny→poll, double-collect, expiry-at-open, or the SSE ending path end to end; those are reviewer-2's or reviewer-3's domain.
- **Concurrency beyond the synchronous argument.** The store is synchronous, so no interleaving exists to test; I verified there is no `await` between the seq read and the write, but I did not simulate multiple processes against one store (there is no persistence, so "a second process" is a second workspace by construction, and spec L529-536 pins one process).
- **React render correctness, styling, accessibility, keyboard behaviour** — out of scope for this panel seat.
- **`src/server/functions/admission.ts`'s `permissions: data.permissions as never`** (`:139`) — a cast that erases the permission type at the one boundary where a caller-chosen set enters; I noted it but did not trace whether `checkGrant` is the only thing standing between an arbitrary string and a stored grant (`store.grant`'s `unknownPermission` check suggests not), so I am recording it as an unverified suspicion rather than a finding.
