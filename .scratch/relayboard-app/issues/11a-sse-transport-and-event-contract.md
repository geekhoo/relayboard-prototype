# 11a: The stream as an SSE server route, with a written event contract

**From:** 11 — Live delivery, pause and replay over SSE

**What to build:** A real transport. The stream is a server route returning `text/event-stream` — not a server function, because a server function returns one response and closes (spec L355) — with a documented event vocabulary, `Last-Event-ID` reconnects, a pause that withholds delivery without accumulating a backlog, and replay from the subscriber's cursor reporting how many entries it replayed. Replay comes from that cursor and from nothing else, so the stream keeps one source of truth for what a subscriber has missed. `subscribe` on the client interface is implemented over it, and the in-memory implementation implements the same contract so both deliver the same events in the same situations.

**Blocked by:** 10b — An act reads as an event without becoming louder than a message

**Write scope:** the SSE server route, the event contract and the stream half of the conformance suite.

**Status:** ready-for-agent

- [ ] A server route returns `text/event-stream` on the same origin as the server functions, authenticating through 06b's resolver rather than a second mechanism.
- [ ] The event vocabulary is exactly the eight names in spec L356 — `message-committed`, `thread-created`, `board-created`, `resource-created`, `artifact-attached`, `status-moved`, `acknowledged`, `connection-changed` — and a test asserts the emitted set equals that literal set. The names and payload shapes are written down in one place, so a non-browser client can consume the stream without reading the UI source (story 155).
- [ ] Every entry-bearing event carries the entry's `seq`, and the client uses that `seq` as its cursor. There is no client-side sequence arithmetic anywhere in the transport path.
- [ ] A paused subscriber receives no events, and **no queue is held for it**. The store keeps no per-subscriber backlog: resuming replays from that subscriber's cursor, which is what the model already supports and what keeps one source of truth for what has been missed (spec: "There is no server-side queue"). A queue built here would disagree with 11b, which derives the pending count from the cursor.
- [ ] Resuming replays from that subscriber's cursor and reports the replayed count in `connection-changed`, floor-verified: replaying zero reports zero rather than omitting the field.
- [ ] Reconnect uses the standard `Last-Event-ID` header so the cursor survives a dropped connection without bespoke client bookkeeping (spec L359).
- [ ] `subscribe` is implemented on `RelayboardClient` by both the in-memory client and the HTTP client, and a contract test drives both implementations through the same scenario — subscribe, commit, pause, commit, resume — asserting identical observed events. The contract test is `tests/contract/stream.conformance.ts`, the file 03 marked skipped pending this ticket: this ticket removes the skip and the file runs, rather than 11a getting a contract test of its own that proves only itself.
- [ ] A subscriber that cannot reach the stream receives a stream-error event rather than silence, so the interface can distinguish a disconnected stream from an empty thread (spec L516).
- [ ] The harness can terminate the SSE response deterministically, so "a dropped connection recovers" is a test rather than a hope. The mechanism is part of this ticket, not of the test that needs it.
- [ ] A subscription is per principal: two principals subscribed to one thread each receive their own cursor's replay, and neither advances the other's watermark.
- [ ] The stream adds no second data layer to the UI: it updates the Query cache rather than bypassing it (spec L548).

**Leaves the build green:** yes. Events flow and are testable from the contract seam; the pause control, indicator and reload-persistence are the next sub-issue, so the UI shows live entries but offers no pause affordance yet.
