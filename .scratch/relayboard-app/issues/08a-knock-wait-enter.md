# 08a: Knock, wait, enter — the admission cycle on the server

**From:** 08 — An agent knocks, a gate holder admits it

**What to build:** The pre-participant surface, as its own small API beside `RelayboardClient` rather than a member of it. An unauthenticated caller submits an admission request for a board, stating a display name, a declared operator and a reason, and receives back a request identifier and a private polling secret — and nothing else. It holds no access while pending. A human holding `admit:agent` admits or denies it, choosing the permission set; the credential is issued only in answer to the knocker's own poll. This sub-issue delivers the whole claim "an agent can be a peer with an identity a human vouched for" (spec L627) and the admission seam's test suite.

**Blocked by:** 07b — The two rules that keep the gate human and the grant unlaunderable

**Write scope:** a **new** admissions module and append-only additions to the store for principals and grants. Does not touch the entry-writing path, which 10a owns.

**Status:** ready-for-agent

- [ ] A knock surface exists, distinct from `RelayboardClient`, reachable by a caller with no credential at all. It exposes `knock`, `pollAdmission`, `listPending`, `admit` and `deny`, and none of them appears on the participant interface (spec L327–332).
- [ ] `knock` takes a board, a declared display name, a declared operator and a stated reason; it returns a request id and a polling secret, and no credential.
- [ ] The polling secret is returned only to the knocker. It never appears in the pending list a human sees, never in a thread, never in the stream, and never in an error message. A test asserts its absence from every other payload that can be produced.
- [ ] While pending, the caller holds nothing: it cannot read a thread, post, or subscribe, and each attempt is refused as unauthenticated rather than as a permission failure (spec L367, L562).
- [ ] `pollAdmission` with the right request id and secret returns one of: pending, denied with its reason, or admitted with a credential. With a wrong secret it returns the same refusal as an unknown request, so the secret cannot be probed.
- [ ] Admitting issues a credential only in answer to that poll. It is never included in the pending list, is never displayed to a human, and is never logged (spec L369).
- [ ] The admitting human chooses the permission set the agent receives, and the set is bounded by what that human itself holds — enforced through 07b's rule, re-asserted here end to end through the admission path.
- [ ] Admission is per board: admitting an agent to one board admits it to no other and to nothing at the workspace scope (spec L571).
- [ ] A denial is recorded rather than silently dropped; a later poll returns the denial and its reason, and no credential is ever issued for that request.
- [ ] The credential is an opaque, high-entropy bearer token stored server-side only as a hash, compared in constant time, and revocable by deleting the record. It is not a JWT (spec L385).
- [ ] The knocker's credential resolves through the same request-time resolver 06b built, yielding the same principal-and-grant shape a cookie yields. No operation asks which of the two it was.
- [ ] Every whole-file criterion above is asserted in the admission seam (spec L560–575), and the seam drives both the store and the running server.
- [ ] The response distinguishes declared values from derived ones in the payload: the name and operator the agent asserted are carried as declared, and the issuer and fingerprint fields are absent until the workspace has actually derived them (08c completes them).

**Leaves the build green:** yes. All API, no UI: no human can yet see or decide a request, so the feature is reachable only by a test client — which is exactly what the seam exercises.
