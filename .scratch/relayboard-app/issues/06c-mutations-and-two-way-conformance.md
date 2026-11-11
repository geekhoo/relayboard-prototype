# 06c: Every mutation over HTTP, and the conformance suite run both ways

**From:** 06 — Serve the operations from the server

**What to build:** The write half of the transport, and the proof that the interface is genuinely swappable. Every mutating operation becomes a POST server function with a validated input, the author comes from the resolved principal rather than from the request body, idempotency is honoured end to end, and the whole conformance suite — the one written in 03 against the interface — passes identically against the in-memory client and against the HTTP client pointed at a running app. After this ticket two browsers see one workspace.

**Blocked by:** 06b — The acting principal — env, session and request-time resolution; 04c — The route seam's harness, which the plan is missing

**Write scope:** `src/server/functions/write*` and the HTTP client's operations half; the operations conformance suite must pass over both transports. Explicitly excludes `subscribe`.

**Status:** ready-for-agent

- [ ] Every mutating operation on the interface is reachable as a POST server function with a validated input that rejects malformed input before the store is touched.
- [ ] **No operation accepts an author from the caller.** `appendMessage` takes no `authorId`; the author is the resolved acting principal. A test posts a body carrying a forged `authorId` and asserts the entry's author is the resolved principal, not the forged value (spec L374, L350).
- [ ] `simulateIncoming` picks its author server-side from the board's agent principals; the client cannot choose which agent speaks (spec L375). The permission checked is the caller's `post:message` on that board (spec L339); the simulated author's own grants are not consulted, so authoring an agent's words never becomes the caller's authority, and a test asserts a caller without `post:message` cannot trigger a simulation.
- [ ] Idempotency is honoured across the transport: replaying a stored key returns the stored entry and appends nothing, and the ordering rule from 02b (idempotency before validation) holds over HTTP too.
- [ ] The conformance suite from 03 runs unchanged against the HTTP implementation, and both runs are part of `npm test` rather than a manual step. "The suite" here is `tests/contract/operations.conformance.ts` — the file 03 wrote against the interface and this ticket does not edit — not the stream file, which 11a owns and which is still skipped at this point.
- [ ] A failed run of either the in-memory or the HTTP variant fails the suite; the harness does not silently skip the HTTP variant when no server is up.
- [ ] The HTTP implementation's error mapping preserves the domain's user-visible strings and distinguishes the three families: validation, permission/resolution, and unknown-object. The client surfaces each differently.
- [ ] `subscribe` remains explicitly out of scope and fails loudly, with a message naming ticket 11 as its home. The stream is a server route, not a server function (spec L355).
- [ ] The UI now renders from the HTTP client rather than the in-memory one, and the in-memory implementation stays in the tree for tests.
- [ ] Two independent browser sessions see the same boards, threads and entries — asserted once with the route-seam harness from 04c, so the claim is checked rather than described. The two sessions are two different principals (spec L366, L370: round-robin issuance), and the test asks which ones through `readPrincipal` rather than assuming an order, so "one workspace" is one workspace two participants share and not one principal in two windows.
- [ ] The interface still states that the store is in-memory and that a restart clears it, and a restart is visibly not a data-loss surprise but a stated behaviour.

**Leaves the build green:** yes. This is the first point at which the product's central claim — two participants, one workspace — is true and tested.
