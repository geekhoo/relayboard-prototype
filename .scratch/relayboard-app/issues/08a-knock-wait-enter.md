# 08a: Knock, wait, enter — the admission cycle on the server

**From:** 08 — An agent knocks, a gate holder admits it

**What to build:** The pre-participant surface, as its own small API beside `RelayboardClient` rather than a member of it. An unauthenticated caller submits an admission request for a board, stating a display name, a declared operator and a reason, and receives back a request identifier and a private polling secret — and nothing else. It holds no access while pending. A human holding `admit:agent` admits or denies it, choosing the permission set; the credential is issued only in answer to the knocker's own poll. This sub-issue delivers the whole claim "an agent can be a peer with an identity a human vouched for" (spec L647) and the admission seam's test suite.

**Blocked by:** 07b — The two rules that keep the gate human and the grant unlaunderable

**Write scope:** a **new** admissions module and append-only additions to the store for principals and grants. Does not touch the entry-writing path, which 10a owns.

**Status:** done — verified, with 2 criteria open; see `## Comments`

- [x] A knock surface exists, distinct from `RelayboardClient`, reachable by a caller with no credential at all. It exposes `knock`, `pollAdmission`, `listPending`, `admit` and `deny`, and none of them appears on the participant interface (spec L343–346).
- [x] `knock` takes a board, a declared display name, a declared operator and a stated reason; it returns a request id and a polling secret, and no credential.
- [x] The polling secret is returned only to the knocker. It never appears in the pending list a human sees, never in a thread, never in the stream, and never in an error message. A test asserts its absence from every other payload that can be produced.
- [ ] **Partly satisfied — the refusal is asserted at the store and the seam, not end to end.** While pending, the caller holds nothing: it cannot read a thread, post, or subscribe, and each attempt is refused as unauthenticated rather than as a permission failure (spec L390, L586).
- [x] `pollAdmission` with the right request id and secret returns one of: pending, denied with its reason, or admitted with a credential. With a wrong secret it returns the same refusal as an unknown request, so the secret cannot be probed.
- [x] Admitting issues a credential only in answer to that poll. It is never included in the pending list, is never displayed to a human, and is never logged (spec L392).
- [x] The admitting human chooses the permission set the agent receives, and the set is bounded by what that human itself holds — enforced through 07b's rule, re-asserted here end to end through the admission path.
- [x] Admission is per board: admitting an agent to one board admits it to no other and to nothing at the workspace scope (spec L595).
- [x] A denial is recorded rather than silently dropped; a later poll returns the denial and its reason, and no credential is ever issued for that request.
- [x] The credential is an opaque, high-entropy bearer token stored server-side only as a hash, compared in constant time, and revocable by deleting the record. It is not a JWT (spec L408).
- [x] The knocker's credential resolves through the same request-time resolver 06b built, yielding the same principal-and-grant shape a cookie yields. No operation asks which of the two it was.
- [ ] **Partly satisfied — one criterion above is the gap just named, and that is what keeps this open.** Every whole-file criterion above is asserted in the admission seam (spec L584–599), and the seam drives both the store and the running server. **This ticket builds that seam** — 07b asserts its rules against the store now and hands them here — so the seam is one harness that both tickets' assertions go through, not two.
- [x] The response distinguishes declared values from derived ones in the payload: the name and operator the agent asserted are carried as declared, and the issuer and fingerprint fields are absent until the workspace has actually derived them (08c completes them).

**Leaves the build green:** yes. All API, no UI: no human can yet see or decide a request, so the feature is reachable only by a test client — which is exactly what the seam exercises.

## Comments

**Implemented and verified** at `19076be`. An agent knocks with a name, an operator and a reason — all
declared, none verified — polls with a secret it is given once, and is admitted or denied by whoever holds
the gate on that board.

What was checked, rather than assumed:

- The knock surface is five operations on their own module, none of them a member of `RelayboardClient`,
  and a test asserts both halves: the five exist and none appears on the participant interface.
- **`knock` and `pollAdmission` never resolve a session**, and calling `actingPrincipal()` there would
  issue a browser session to an entity that has not been admitted — making an agent a participant by
  knocking. The module says so where the omission is, rather than leaving it as a missing line.
- The polling secret is returned once and collectable once. Without that guard a knocker could poll in a
  loop and hold unlimited bearer tokens; disabling the guard fails the test.
- The credential is an opaque bearer token, stored only as a hash, compared in constant time, and
  revocable by deleting the record. It is not a JWT.
- **A knock lives outside the store, keyed by the store.** It is not workspace content, so it is not in
  the store's collections; but keying it by the process let a knock outlive the boards it named, and a
  caller could then be admitted into a workspace that had reseeded and forgotten the request. Keying it
  by the store makes its lifetime the workspace's, which is the only lifetime that means anything.
- Admission goes through the store's `grant` rather than restating 07b's rule, so a decision bounded by
  the decider's own holdings is enforced by the same mechanism as every other grant; bypassing it fails
  two named assertions.
- Declared values are carried under a key literally called `declared`, and a test compares the
  principal's key list to prove the derived issuer and fingerprint are **absent** rather than empty — an
  `undefined` check would pass for a record carrying the keys with nothing in them, which is the merge
  08c exists to prevent.

**One finding from measuring rather than reading.** A gate holder who holds nothing on a board can decide
an admission and then be unable to give the agent anything, because a grant cannot exceed the granter's
own. The seed now gives the demo's human a board-scoped gate grant, and the comment says why that is a
finding about the design rather than fixture convenience: **a gate holder is a board member who also holds
the gate.**

**One refusal was written three times before it bit.** The first two versions asserted a refusal for a
permission the principal actually held, so the assertion passed because nothing was refused. It now
checks the permission is not held before asserting the refusal, and pairs it with the control that
succeeds.

**Two criteria are left open, and they are the same gap seen twice.** *"While pending, the caller holds
nothing: it cannot read a thread, post, or subscribe, and each attempt is refused as unauthenticated"* is
true and asserted at the store and the seam — but **not end to end, because no browser can reach an
admission at all**: a knock is an unauthenticated caller's act, and the only credential this app issues
is issued **on** admission. There is nothing a browser could present to knock with, so there is no
transport-level refusal to observe. The criterion that every whole-file assertion is proved in the
admission seam is open for the same reason: the seam exists and drives the store, and the one claim it
cannot drive end to end is this one.
