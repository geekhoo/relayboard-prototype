# 06a: The read operations over HTTP, and one store for the process

**From:** 06 — Serve the operations from the server

**What to build:** The reading half of the transport. Every read on the client interface becomes a server function with a validated input, the server holds a single store instance for the life of the process, and the HTTP implementation of the interface exists and answers the reads. The conformance suite's read assertions pass against it. This ticket also pins the deployment assumption the whole design rests on, and adds the one operation the route seam needs in order to be reproducible.

**Blocked by:** 03 — The client interface and its in-memory implementation

**Write scope:** `src/server/functions/read*`, the store singleton (`src/server/store/instance.ts`) and its lifetime notes. Verifies the Nitro preset without re-pinning it. Server-only modules here and in 06b are unreachable from `src/routes` and `src/components`.

**Status:** ready-for-agent

- [ ] Each read operation — listing boards, listing a board's threads, reading a thread's entries, listing a board's resources, reading positions, and reading the acting principal's own record if that member exists — is reachable as a server function with a GET-shaped, validated input.
- [ ] **Both participant reads are server functions here**: listing a board's participants, and reading one participant with the grant it holds on that board. Ticket 03 adds them to the interface and nothing else makes them reachable; without them the conformance suite cannot run over HTTP (06c) and ticket 12 has nothing to render. The second is `readPrincipal({ principalId, boardId })` returning `{ principal, grant, declared }` — derived values on `principal`, the board-scoped `grant`, and the unverified `declared` values kept apart — so the server function's validator requires both ids and the handler checks `read:member` on the board it was given.
- [ ] Each operation validates its input at the boundary and rejects malformed input before the store is touched, with an identifiable error rather than a thrown string.
- [ ] The store is a single in-process instance shared by all requests, created once per server process, not per request and not at module scope of a client-reachable module. Its home is `src/server/store/instance.ts`, reachable only from `src/server/**` and held on `globalThis` so a dev-server reload does not hand each request a fresh store; this is the server-only boundary the rest of `src/server/**` shares, and nothing under `src/routes` or `src/components` may import it.
- [ ] **The deployment target stays pinned by ticket 01 and is verified here**: the Nitro preset is `node-server` in config rather than auto-detected, `vercel.json` is absent, and a build with the Vercel environment variable set either fails or still produces the node-server preset. Spec makes the serverless target unsupported, and a green serverless build that cannot hold an SSE connection is the trap this criterion catches. Do not re-pin the preset — 01 owns it.
- [ ] An HTTP implementation of `RelayboardClient` exists covering the read operations, and the conformance suite's read assertions — written once, against the interface — pass against it unchanged.
- [ ] The conformance suite's **write** assertions are explicitly out of scope here and the HTTP implementation fails loudly on them rather than returning `undefined` or an empty result. It must be impossible for 06b's absence to read as a pass.
- [ ] `subscribe` is explicitly out of scope and fails loudly. The stream is a server route, not a server function (spec L355), and it arrives in 11a; an RPC-shaped `subscribe` written here would be the wrong transport and would have to be removed.
- [ ] A reset operation exists for test/dev mode only: it returns the store to a fresh seed, it is not reachable when the app is not in a test/dev mode, and the harness in 04c can call it between tests. It is not part of the participant interface.
- [ ] The interface states, in copy a participant actually sees, that the store is in-memory and that a restart clears it — the exact sentence, not a README note.
- [ ] Constructing a second server context starts from the seed again, asserted at the store level rather than by killing a process.

**Leaves the build green:** yes — but the app still shows its in-memory-backed screens, and the HTTP client is not yet the one the UI uses.
