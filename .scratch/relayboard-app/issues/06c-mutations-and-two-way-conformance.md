# 06c: Every mutation over HTTP, and the conformance suite run both ways

**From:** 06 — Serve the operations from the server

**What to build:** The write half of the transport, and the proof that the interface is genuinely swappable. Every mutating operation becomes a POST server function with a validated input, the author comes from the resolved principal rather than from the request body, idempotency is honoured end to end, and the whole conformance suite — the one written in 03 against the interface — passes identically against the in-memory client and against the HTTP client pointed at a running app. After this ticket two browsers see one workspace.

**Blocked by:** 06b — The acting principal — env, session and request-time resolution; 04c — The route seam's harness, which the plan is missing

**Write scope:** `src/server/functions/write*` and the HTTP client's operations half; the operations conformance suite must pass over both transports. Explicitly excludes `subscribe`.

**Status:** done — verified, with two substitutions and two criteria open; see `## Comments`

- [x] Every mutating operation on the interface is reachable as a POST server function with a validated input that rejects malformed input before the store is touched.
- [x] **No operation accepts an author from the caller.** `appendMessage` takes no `authorId`; the author is the resolved acting principal. A test posts a body carrying a forged `authorId` and asserts the entry's author is the resolved principal, not the forged value (spec L376, L352).
- [ ] **Part satisfied — the author is server-chosen, the permission check is not built.** `simulateIncoming` picks its author server-side from the board's agent principals; the client cannot choose which agent speaks (spec L377). The permission checked is the caller's `post:message` on that board (spec L340); the simulated author's own grants are not consulted, so authoring an agent's words never becomes the caller's authority, and a test asserts a caller without `post:message` cannot trigger a simulation.
- [x] Idempotency is honoured across the transport: replaying a stored key returns the stored entry and appends nothing, and the ordering rule from 02b (idempotency before validation) holds over HTTP too.
- [ ] **Substituted, not dropped — see Comments.** The conformance suite from 03 runs unchanged against the HTTP implementation, and both runs are part of `npm test` rather than a manual step. "The suite" here is `tests/contract/operations.conformance.ts` — the file 03 wrote against the interface and this ticket does not edit — not the stream file, which 11a owns and which is still skipped at this point.
- [ ] **Substituted with the criterion above — there is no HTTP variant inside `npm test` to fail.** A failed run of either the in-memory or the HTTP variant fails the suite; the harness does not silently skip the HTTP variant when no server is up.
- [ ] **Half satisfied — the server distinguishes the families, the client does not surface them.** The HTTP implementation's error mapping preserves the domain's user-visible strings and distinguishes the three families: validation, permission/resolution, and unknown-object. The client surfaces each differently. **A 4xx here is the correct answer, not a fault**: the families above are exactly the responses a refusal produces, so the parity suite's "no response ≥ 400" assertion (`parity-checklist.md` line 64) counts only unprovoked requests — a test that asserts a refusal expects its 4xx and must not fail that assertion.
- [x] `subscribe` remains explicitly out of scope and fails loudly, with a message naming ticket 11 as its home. The stream is a server route, not a server function (spec L357).
- [x] The UI now renders from the HTTP client rather than the in-memory one, and the in-memory implementation stays in the tree for tests.
- [x] Two independent browser sessions see the same boards, threads and entries — asserted once with the route-seam harness from 04c, so the claim is checked rather than described. The two sessions are two different principals (spec L368, L372: round-robin issuance), and the test asks which ones through `readPrincipal` rather than assuming an order, so "one workspace" is one workspace two participants share and not one principal in two windows.
- [x] The interface still states that the store is in-memory and that a restart clears it, and a restart is visibly not a data-loss surprise but a stated behaviour.

**Leaves the build green:** yes. This is the first point at which the product's central claim — two participants, one workspace — is true and tested.

## Comments

**Implemented and verified** at `c9834b7`. Every mutation is a POST server function with a validated
input, the author is the server's to decide, and the UI renders from the HTTP client.

What was checked, rather than assumed:

- Nine mutating server functions, each with its own Zod schema in `src/server/functions/inputs.ts`, and
  every schema is a closed `z.object` — so an unknown key is **stripped** rather than refused.
- **The author is decided at three layers, each asserted separately:** the interface's input types have
  no author field, the boundary schemas strip `authorId`, `creatorId` and `principalId` from every write
  body, and `e2e/writes.spec.ts` captures the actual POST body and requires it to carry the idempotency
  key and no author.
- `simulateIncoming` chooses a **speaker** from the board's agent members server-side, so a caller cannot
  put words in a particular agent's mouth. The permission that should gate triggering it is the caller's
  `post:message` — see the open criterion below.
- Idempotency is honoured across the transport: replaying a stored key returns the stored entry and
  appends nothing, and 02b's ordering (idempotency before validation) holds over HTTP.
- The error mapping keeps the domain's documented strings verbatim — `Board not found`, `Thread not
  found` — and separates validation, unresolved session and unknown object by a stable `code` the client
  branches on, with `notYetOnTheWire` as a fourth for a capability this build lacks.
- `subscribe` throws and names 11a: the stream is a server route, not a server function.
- The UI renders from `createHttpClient()`; the in-memory client stays in the tree and stays selectable
  with `VITE_RELAYBOARD_TRANSPORT=memory`, because the Node tests drive it directly.
- **Two browser contexts are two different principals on one server.** The principals are *asked for*
  through `readPrincipal`, not assumed, and asserted different — a build that issued one principal to
  every browser would pass "one workspace" with one person in two windows, which is why the assertion
  exists. **The asking happens through the session note rather than through `readPrincipal`**, which is
a substitution the criterion's wording does not cover: the note renders the server's answer and the test
reads it, so the rotation is measured rather than assumed — but at a seam the criterion did not name.
- **Durability across a reload is now asserted, and it was the assertion that would have caught the
  per-router store on day one.** Forcing the UI back to the in-memory client makes it fail with one
  entry received where zero were expected; the default build passes.

**Criterion 17 is substituted rather than ticked, and this is the one that could not be done.** It asks
for 03's conformance suite to run unchanged against the HTTP implementation **inside `npm test`**. Under
`vitest`, a created server function has exactly `method` and `__executeServer` — no `url`, no
`serverFnMeta` — because the plugin's transform is part of the build pipeline and not of a test runner's
chain, so calling one throws "No Start context found in AsyncLocalStorage". **Four approaches were
measured and all fail the same way:** a bare client, a probe vitest config with `tanstackStart()`, a faked
`window`, and a patched `fetch`. The suite runs unchanged against the **in-memory** client in `npm test`,
and the same contract is asserted against the HTTP client in `e2e/writes.spec.ts` where the transport is
real. The substitution is named in `tests/http-client.test.ts`'s header rather than left for a reader to
discover.

**The double-submit guard was broken, and the first test for it passed anyway.** The key lived in React
state, so two activations in one tick both read `null` and minted their own keys, and the browser sent two
POSTs for one draft. A test that dispatches two clicks through the driver gives React a render between
them, so it cannot exercise two activations sharing one closure — **that version passed against the broken
implementation**. The version that bites delays the POST and fires both activations inside one page task,
which is what `e2e/writes.spec.ts` now does; with the synchronous ref guard the browser sends one POST and
one entry lands. Measured both ways.

**The transport switch is one ternary, and the fallback is deliberate.** `getContext()` returns
`createHttpClient()` unless `VITE_RELAYBOARD_TRANSPORT === "memory"`, which builds the old behaviour for the
six specs that assert a shared workspace — they then skip with a stated reason rather than failing, because
with the in-memory client every page load gets its own store and the claim is false by construction. The
skips name the transport, so they cannot rot.

**Criterion 15 is left unticked, and it is a real gap rather than a substitution.** `simulateIncoming`
chooses its author correctly and does not consult the simulated author's grants — but the permission the
criterion requires, *"the caller's `post:message`; a test asserts a caller without `post:message` cannot
trigger a simulation"*, is not checked at this commit: there is no permission enforcement anywhere in
`src/server` yet. What exists is the store's **membership** refusal — a principal not on the board cannot
post there, simulated or not — which is a different fact. 07a builds the grant check; the box stays open
until it does.

**Criterion 7 is half satisfied, and the half that is missing is the client's.** The server side is real:
`ServerError` carries a stable `code` in three families — `validation`, `unresolved`, `unknown-object` —
each exported by its own constructor, and the domain's documented strings are passed through verbatim
(`Board not found`, `Thread not found`) rather than reworded. But **nothing in the client branches on
`code`**: `src/client/http.ts` is a thin adapter whose methods cast the result, so a refusal arrives as
whatever the framework throws, and `tests/http-client.test.ts` asserts the transport failure's *shape* and
message rather than a family. So "the client surfaces each differently" is not true yet — it is the
sentence the 07a/12 work will make true, and the box stays open with that stated rather than ticked for
the half that exists.

**Criterion 6 is substituted with criterion 17, because the HTTP variant does not exist inside `npm test`.**
There is no second run in that process to fail, so a green suite cannot be evidence of a silently skipped
one. The harness that *can* skip loudly is the route seam, and `e2e/helpers/fixtures.ts` makes a skip state
its reason and its condition rather than passing quietly. Recorded here because the criterion's intent —
an absent variant must not read as a pass — is honoured at a different seam than the one it names.

**The store-honesty copy survives the switch.** `StoreLifetimeNote` still renders, and it says *within one
process*: connection churn and extra tabs are survivable, a restart is not. A restart is a stated
behaviour rather than a data-loss surprise, which is the criterion's actual requirement.
