# 06a: The read operations over HTTP, and one store for the process

**From:** 06 — Serve the operations from the server

**What to build:** The reading half of the transport. Every read on the client interface becomes a server function with a validated input, the server holds a single store instance for the life of the process, and the HTTP implementation of the interface exists and answers the reads. The conformance suite's read assertions pass against it. This ticket also pins the deployment assumption the whole design rests on, and adds the one operation the route seam needs in order to be reproducible.

**Blocked by:** 03 — The client interface and its in-memory implementation

**Write scope:** `src/server/functions/read*`, the store singleton (`src/server/store/instance.ts`) and its lifetime notes. Verifies the Nitro preset without re-pinning it. Server-only modules here and in 06b are unreachable from `src/routes` and `src/components`.

**Status:** done — verified, with one substitution and one criterion open; see `## Comments`

- [x] Each read operation — listing boards, listing a board's threads, reading a thread's entries, listing a board's resources, reading positions, and reading the acting principal's own record if that member exists — is reachable as a server function with a GET-shaped, validated input.
- [ ] **Not satisfied as worded — both reads exist, one is not gated.** Both participant reads: listing a board's participants, and reading one participant with the grant it holds on that board. Ticket 03 adds them to the interface and nothing else makes them reachable; without them the conformance suite cannot run over HTTP (06c) and ticket 12 has nothing to render. The second is `readPrincipal({ principalId, boardId })` returning `{ principal, grant, declared }` — derived values on `principal`, the board-scoped `grant`, and the unverified `declared` values kept apart — so the server function's validator requires both ids and the handler checks `read:member` on the board it was given.
- [x] Each operation validates its input at the boundary and rejects malformed input before the store is touched, with an identifiable error rather than a thrown string.
- [x] The store is a single in-process instance shared by all requests, created once per server process, not per request and not at module scope of a client-reachable module. Its home is `src/server/store/instance.ts`, reachable only from `src/server/**` and held on `globalThis` so a dev-server reload does not hand each request a fresh store; this is the server-only boundary the rest of `src/server/**` shares, and nothing under `src/routes` or `src/components` may import it.
- [x] **The deployment target stays pinned by ticket 01 and is verified here**: the Nitro preset is `node-server` in config rather than auto-detected, `vercel.json` is absent, and a build with the Vercel environment variable set either fails or still produces the node-server preset. Spec makes the serverless target unsupported, and a green serverless build that cannot hold an SSE connection is the trap this criterion catches. Do not re-pin the preset — 01 owns it.
- [ ] **Substituted, not dropped — see Comments.** An HTTP implementation of `RelayboardClient` exists covering the read operations, and the conformance suite's read assertions — written once, against the interface — pass against it unchanged.
- [x] The conformance suite's **write** assertions are explicitly out of scope here and the HTTP implementation fails loudly on them rather than returning `undefined` or an empty result. It must be impossible for 06b's absence to read as a pass.
- [x] `subscribe` is explicitly out of scope and fails loudly. The stream is a server route, not a server function (spec L357), and it arrives in 11a; an RPC-shaped `subscribe` written here would be the wrong transport and would have to be removed.
- [x] A reset operation exists for test/dev mode only: it returns the store to a fresh seed, it is not reachable when the app is not in a test/dev mode, and the harness in 04c can call it between tests. It is not part of the participant interface.
- [x] The interface states, in copy a participant actually sees, that the store is in-memory and that a restart clears it — the exact sentence, not a README note.
- [x] Constructing a second server context starts from the seed again, asserted at the store level rather than by killing a process.

**Leaves the build green:** yes — but the app still shows its in-memory-backed screens, and the HTTP client is not yet the one the UI uses.

## Comments

**Implemented and verified** at `915687b`. Every read on the interface is a server function with a
validated input, one store instance serves the process, and the HTTP client answers the reads and
refuses the writes loudly.

What was checked, rather than assumed:

- Each read is a `createServerFn` with a Zod validator: `listBoards`, `listThreads`, `readThread`,
  `readMessages`, `listResources`, `readPositions`, `listMembers`, `readPrincipal`,
  `readActingPrincipal`. The schemas strip unknown keys, refuse non-objects, refuse an empty id and
  refuse a non-integer position, so a refusal means the store was never touched.
- The store is `src/server/store/instance.ts`, held on `globalThis` under
  `Symbol.for("relayboard:store")` rather than in a module-scope const, because a dev-server reload
  replaces modules and a module-scope store would hand every reload a fresh workspace. A getter
  rather than an exported value, so importing the module has no side effect and a test can reset it.
- **The server-only boundary is enforced twice.** `biome.json`'s `noRestrictedImports` override fails
  the lint for `#/server`, `#/server/store` and `#/server/store/demo-seed` under `src/routes/**` and
  `src/components/**`; and `e2e/isolation.spec.ts` scans every file in the route seam for the same
  specifiers, comparing by path root so `#/server/store/instance` cannot slip through.
- The Nitro preset is still `node-server` in `vite.config.ts` rather than auto-detected, `vercel.json`
  is absent at both the app and the repository root, and a `VERCEL=1` build still writes
  `preset: node-server`. This ticket verified that; 01 owns it.
- The reset hook is `resetTestStore`, a POST server function gated by `resetAllowed()`, which refuses
  unless `NODE_ENV` is not production or `RELAYBOARD_TEST_MODE=1`. It is not on `RelayboardClient` and
  never will be, and it is deliberately not the product's purge: 14's is permission-checked, names
  what it removes and requires confirmation.
- **`getStore()` twice is the same store, and a second context starts from the seed.** Asserted at the
  store seam in `tests/store-instance.test.ts`, which is exactly the "at the store level rather than by
  killing a process" the criterion asks for.
- **The in-memory honesty copy is participant-visible text, not a README note.** `StoreLifetimeNote`
  renders "This workspace is held in memory. A restart clears it, including everything you post." at
  token sizes, so 13a's floors measure something real when they land. It says **within one process**,
  not "forever": connection churn and extra tabs are survivable, a restart is not, and the sentence is
  written to be true of both.

**Criterion 14 is left unticked.** Both participant reads are server functions and require both ids,
and `readPrincipal` returns `{ principal, grant, declared }` with the derived values on `principal` and
the unverified ones kept apart — but the criterion's last clause, "the handler checks `read:member` on
the board it was given", **is not true at this commit**. There is no permission check anywhere in
`src/server` yet: `read.ts` calls `session.actingPrincipal()` and discards it, and its own comment says
the gate is 07a's. The grant it returns is built from board *membership*, which is a stand-in. 07a is
the ticket that makes the clause true, so the box stays open with the reason rather than being ticked
because the read exists.

**Criterion 18 is substituted rather than dropped.** It requires the conformance suite's read
assertions to pass against the HTTP implementation **unchanged**. They cannot, for the reason 06c's
own substitution records: under `vitest`, `createServerFn` has only `method` and `__executeServer`,
because the plugin's transform belongs to the build pipeline and not to a test runner's chain. The
suite runs unchanged against the in-memory client; the same contract is asserted against the HTTP
client in `e2e/**`, where the transport is real. `tests/http-client.test.ts` names the substitution in
its own header rather than leaving it to be discovered.

**What the boundary evidence does not prove, stated here rather than implied.** Criterion 3's perfect form
would call a server function directly with a malformed request. It cannot be done: `createServerFn`'s client
half resolves through a request-scoped Start context and throws "No Start context found in
AsyncLocalStorage" under `vitest run`, and an ALS shim would test the shim. The evidence is therefore the
route-level one — the schemas exercised in Node (`tests/server-inputs.test.ts`), and a **served production
build exercised over HTTP** with the page's own server-function requests replayed — plus the framework's
own ordering, which runs the validator before the handler body so a schema that rejects guarantees the
store was never reached. **The half that is left unproven is an unknown-object refusal at the transport:**
it was not produced by hand, because the framework's request payload is a seroval frame and the two
attempts never reached the validator. 06c's conformance suite is where that gets driven properly, and
until it does, "malformed input is refused at the boundary" is proven for the schemas and for the served
build's refusals, not for every family of malformed request.

**Criterion 19 — the writes fail loudly — is true and was needed.** The three acts throw
`notYetOnTheWire` naming 10a after resolving the record they name, so an absent capability cannot read
as a pass, and `tests/http-client.test.ts` asserts the failure is the transport's rather than the old
client-side `NotYetImplementedError`.
