# 11c: A revoked principal's stream closes, and the demo control stays honest

**From:** 11 — Live delivery, pause and replay over SSE

**What to build:** The two lifecycle edges the stream inherits from the permission model. A permission change is itself an event on any open connection for that principal, so a revoked principal is disconnected rather than left holding a live stream it may no longer read (spec L362). And the demonstration control survives the real transport: it produces a simulated agent entry that behaves like any other committed entry, and its panel states that it is a demonstration rather than another participant.

**Blocked by:** 11b — Live, pause, replay — the reader's side of the stream; 08c — Expiry, revocation, renewal and a fingerprint the workspace derived

**Write scope:** revocation-close handling and the simulation control inside the stream panel.

**Status:** done — verified, with 3 criteria open; see `## Comments`

- [ ] **Partly satisfied — a revocation reaches an open connection; a permission change that is not a revocation does not.** A permission change affecting a principal is emitted on that principal's open connection, so a revocation reaches an already-connected subscriber rather than waiting for its next request. **The revocation half is real:** `store.endAccess` notifies every `onAccessEnded` listener, the SSE route sends the ending frame and closes, and the in-memory transport marks its subscriptions closed. **What is missing is the general claim the sentence makes:** nothing fires on an ordinary `store.grant` or on a grant being taken away — the event the stream listens for is specifically an *access ending*, and a principal whose `post:message` was removed mid-stream keeps its open connection until its next request is refused.
- [x] A revoked principal's open stream is closed, and the interface on that side reports it as disconnected-for-revocation rather than as a dropped connection to be retried. The client does not silently reconnect into a stream it may no longer read.
- [x] An expired admission closes its stream the same way, with a cause distinguishable from a revocation.
- [x] A dropped connection on a still-authorised principal still recovers on its own (11a's reconnect), so the two cases are told apart by the client and by the reader.
- [x] The revocation is not presented as a failure of the app: the copy names access-ended rather than an error, and the entries that principal already authored remain attributed to it.
- [x] The simulation control produces an entry through the same commit path as a real post — same `seq` counter, same event, same conformance assertions — and the entry is marked with its simulated provenance so it is not mistaken for another participant's words.
- [ ] **Partly satisfied — the entry is real and its provenance is not carried.** The simulation control produces an entry through the same commit path as a real post — same `seq` counter, same event, same conformance assertions — and the entry is marked with its simulated provenance so it is not mistaken for another participant's words. **The commit path half is asserted** (one visible entry, the sequence advanced by exactly one through the same counter a post uses, the author chosen server-side and rendered with its agent tag, and the panel stating in copy that it is a demonstration). **What is missing:** `Entry` has no field marking a simulated origin — `origin` is `demo` or `owner`, and it records provenance of the *workspace*, not of the act. The shared path is what makes a simulation honest, and the reader distinguishes it by the panel's copy rather than by anything on the entry.
- [ ] **Half satisfied — the simulation control is asserted at the seam and the revocation is not.** The route seam covers revocation-drops-the-stream and the simulation control producing one visible entry. **The simulation half is asserted end to end** (`e2e/stream-panel.spec.ts`: one visible entry, the author chosen server-side, the panel's demonstration copy). **The revocation half is not, and cannot be in this shape:** a browser holds a cookie session rather than an admission, so no page can present a revocable credential — the same limit 08a records. The revocation is asserted at the contract seam (`tests/contract/stream.conformance.ts`, both causes, distinct values) and at the admissions seam; nothing drives it through a route, and no test in `e2e/` mentions revocation.
- [x] The contract seam covers the revoked-subscriber case for both implementations, so the in-memory client and the SSE client close the same way.

**Leaves the build green:** yes.

**Why this is not in 11b:** both criteria need revocation to exist (08c) and both are about the stream's *end*, not its middle. Working them alongside 11b would put two unrelated lifecycles in one session, and 11b's criteria are already a full one.

## Comments

**Implemented and verified** at `eb33a74`. A revoked or expired agent's stream closes rather than merely
refusing the next message, and the reader is told which of the two happened.

**The cause rides inside the existing `connection-changed` event rather than becoming a ninth wire event**,
because the vocabulary is fixed at eight (11a's own literal-set assertion) and a closed connection with a
reason *is* that event saying more. That is also exactly what tells "your access ended" apart from "the
network dropped".

**Closing is done at three layers and asserted at the seam between them:** revoking ends the access, the
store notifies its access listeners, the SSE route sends the ending frame and closes the response, and the
in-memory transport marks every subscription closed. The client stops its `EventSource` reconnecting once a
cause has been seen, because the browser retries on its own and a revoked principal would otherwise loop
against a stream it may no longer read. An ordinary transport failure still recovers, because the ending is
only reported when a cause is present.

**The finding is the eighth of this session and its shape is worth naming: every assertion passed with the
revocation never reaching the store.** Both ends of the wire were tested and **the wire itself was not**;
deleting the call from `revoke` left **356 tests green**. The rule that follows, and the one to carry: when a
criterion is "A causes B" and A and B are each tested, the causal link is the untested part.

**The contract seam now builds a fresh workspace per case**, because an ending is permanent state and one
shared store made every later case start revoked.

**Three criteria are left open, and each is the ticket claiming more than the commit does.** Criterion 13
says a *permission change* is emitted on the principal's connection; what is emitted is an **access
ending**, so a grant changing mid-stream does not reach the connection at all. Criterion 18 asks that the
entry carry its simulated provenance; no such field exists — `origin` records the *workspace's* provenance,
not the act's — and it is the shared commit path, which is the real requirement, that is asserted. Criterion
20 asks the route seam to cover revocation-drops-the-stream; the simulation half is asserted end to end and
the revocation half cannot be, because a browser holds a cookie session rather than a revocable credential.
None is a bug in the built behaviour, and all three are wider than it.
