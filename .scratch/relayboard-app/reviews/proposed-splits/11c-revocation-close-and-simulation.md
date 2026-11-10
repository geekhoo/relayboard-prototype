# 11c: A revoked principal's stream closes, and the demo control stays honest

**From:** 11 — Live delivery, pause and replay over SSE

**What to build:** The two lifecycle edges the stream inherits from the permission model. A permission change is itself an event on any open connection for that principal, so a revoked principal is disconnected rather than left holding a live stream it may no longer read (spec L346). And the demonstration control survives the real transport: it produces a simulated agent entry that behaves like any other committed entry, and its panel states that it is a demonstration rather than another participant.

**Blocked by:** 11b — Live, pause, replay — the reader's side of the stream; 08c — Expiry, revocation, renewal and a fingerprint the workspace derived

**Status:** ready-for-agent

- [ ] A permission change affecting a principal is emitted on that principal's open connection, so a revocation reaches an already-connected subscriber rather than waiting for its next request.
- [ ] A revoked principal's open stream is closed, and the interface on that side reports it as disconnected-for-revocation rather than as a dropped connection to be retried. The client does not silently reconnect into a stream it may no longer read.
- [ ] An expired admission closes its stream the same way, with a cause distinguishable from a revocation.
- [ ] A dropped connection on a still-authorised principal still recovers on its own (11a's reconnect), so the two cases are told apart by the client and by the reader.
- [ ] The revocation is not presented as a failure of the app: the copy names access-ended rather than an error, and the entries that principal already authored remain attributed to it.
- [ ] The simulation control produces an entry through the same commit path as a real post — same `seq` counter, same event, same conformance assertions — and the entry is marked with its simulated provenance so it is not mistaken for another participant's words.
- [ ] The simulation panel states in copy that it is a demonstration (story 52), and its author is chosen server-side from the board's agent principals, never by the client (spec L354).
- [ ] The route seam covers revocation-drops-the-stream and the simulation control producing one visible entry.
- [ ] The contract seam covers the revoked-subscriber case for both implementations, so the in-memory client and the SSE client close the same way.

**Leaves the build green:** yes.

**Why this is not in 11b:** both criteria need revocation to exist (08c) and both are about the stream's *end*, not its middle. Working them alongside 11b would put two unrelated lifecycles in one session, and 11b's criteria are already a full one.
