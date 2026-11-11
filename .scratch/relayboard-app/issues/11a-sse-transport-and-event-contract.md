# 11a: The stream as an SSE server route, with a written event contract

**From:** 11 — Live delivery, pause and replay over SSE

**What to build:** A real transport. The stream is a server route returning `text/event-stream` — not a server function, because a server function returns one response and closes (spec L357) — with a documented event vocabulary, `Last-Event-ID` reconnects, a pause that withholds delivery without accumulating a backlog, and replay from the subscriber's cursor reporting how many entries it replayed. Replay comes from that cursor and from nothing else, so the stream keeps one source of truth for what a subscriber has missed. `subscribe` on the client interface is implemented over it, and the in-memory implementation implements the same contract so both deliver the same events in the same situations.

**Blocked by:** 10b — An act reads as an event without becoming louder than a message

**Write scope:** the SSE server route, the event contract and the stream half of the conformance suite.

**Status:** done — verified, with 1 criterion open; see `## Comments`

- [x] A server route returns `text/event-stream` on the same origin as the server functions, authenticating through 06b's resolver rather than a second mechanism.
- [x] The event vocabulary is exactly the eight names in spec L358 — `message-committed`, `thread-created`, `board-created`, `resource-created`, `artifact-attached`, `status-moved`, `acknowledged`, `connection-changed` — and a test asserts the emitted set equals that literal set. The names and payload shapes are written down in one place, so a non-browser client can consume the stream without reading the UI source (story 155).
- [x] Every entry-bearing event carries the entry's `seq`, and the client uses that `seq` as its cursor. There is no client-side sequence arithmetic anywhere in the transport path.
- [x] A paused subscriber receives no events, and **no queue is held for it**. The store keeps no per-subscriber backlog: resuming replays from that subscriber's cursor, which is what the model already supports and what keeps one source of truth for what has been missed (spec: "There is no server-side queue"). A queue built here would disagree with 11b, which derives the pending count from the cursor.
- [x] Resuming replays from that subscriber's cursor and reports the replayed count in `connection-changed`, floor-verified: replaying zero reports zero rather than omitting the field.
- [x] Reconnect uses the standard `Last-Event-ID` header so the cursor survives a dropped connection without bespoke client bookkeeping (spec L361).
- [ ] **Partly satisfied — both implementations have `subscribe`, and the contract test drives one of them.** `subscribe` is implemented on `RelayboardClient` by both the in-memory client and the HTTP client, and a contract test drives both implementations through the same scenario — subscribe, commit, pause, commit, resume — asserting identical observed events. The contract test is `tests/contract/stream.conformance.ts`, the file 03 marked skipped pending this ticket: this ticket removes the skip and the file runs, rather than 11a getting a contract test of its own that proves only itself. **What is missing:** the suite is mounted **once**, against the in-memory client (`tests/client.test.ts`), because a server function cannot be driven under `vitest run` — 06c measured that four ways. The HTTP transport's half is asserted at the route seam (`e2e/stream.spec.ts`), which is a different file proving different claims: that the route exists, authenticates through the resolver, and shares the one store. The same narrowing 06c:17 records, at the stream instead of the operations.
- [x] A subscriber that cannot reach the stream receives a stream-error event rather than silence, so the interface can distinguish a disconnected stream from an empty thread (spec L518).
- [x] The harness can terminate the SSE response deterministically, so "a dropped connection recovers" is a test rather than a hope. The mechanism is part of this ticket, not of the test that needs it.
- [x] A subscription is per principal: two principals subscribed to one thread each receive their own cursor's replay, and neither advances the other's watermark.
- [x] The stream adds no second data layer to the UI: it updates the Query cache rather than bypassing it (spec L550).

**Leaves the build green:** yes. Events flow and are testable from the contract seam; the pause control, indicator and reload-persistence are the next sub-issue, so the UI shows live entries but offers no pause affordance yet.

## Comments

**Implemented and verified** at `07e6551`. The stream is a server route returning `text/event-stream`, with
a written event vocabulary, `Last-Event-ID` reconnects, a pause the store knows about, and replay from the
subscriber's own cursor.

**The vocabulary is eight names, asserted as a literal set and never widened.** 11c later needed a ninth
concept — this connection is ending, and why — and did not add one: the cause rides inside
`connection-changed`, because a closed connection with a reason *is* that event saying more.

**`setConnection` was a no-op over the wire, and that is the defect this ticket left behind.** 11b's
criterion asked for the opposite of what the spec requires, and the no-op survived until the pause's own
ticket. Related and worse: **the pause's wire path is asserted by nothing** — a server function cannot be
driven under `vitest run`, and this ticket built no pause affordance for the route seam to click. The gap is
written into the code where the line lives, and 11b is the ticket with the control.

**The admissions clock was half-injected, and this ticket's full run is what found it.** The expiry was
*checked* against the injected clock and *written* against the system one, and the clocked tests passed by
luck because the fake instant happened to be in the past relative to the machine. Five tests that had passed
when reported now failed. All four sites read the injected clock, and the rule recorded is stronger than
"inject the clock": in the module it governs, the system clock should be a lint error.

**One criterion is left open and it is a mounting question, not a behaviour.** The contract test drives
both implementations through the same scenario *in principle* — the suite takes its two clients as a subject
and every case is written against that subject. It is mounted against the in-memory client only, because the
HTTP half cannot run inside `npm test`; the HTTP transport is asserted at the route seam instead. That is the
same substitution 06c:17 records for the operations suite, and recording it twice is the point: two tickets
now claim a two-transport conformance suite and neither runs it twice in one process.
