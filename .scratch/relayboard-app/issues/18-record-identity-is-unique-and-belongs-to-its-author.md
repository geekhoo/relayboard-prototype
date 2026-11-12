# 18: A store record's identity is unique, and belongs to the principal that asked for it

**What to build:** Two Criticals with one shape: an identity the store mints or resolves is not the record's own. A created `Resource` gets an id no other `Resource` holds, so an `Artifact` always resolves to the thing the reader attached — including on a board the seed never touched. And an idempotency key belongs to the principal and thread that used it, so a replay by anyone else is refused rather than answered, while a genuine retry still returns the stored entry; and a key whose entry a purge removed cannot answer with a record that is no longer in the chronology.

**Blocked by:** None (can start immediately)

**Status:** ready-for-agent

**Found by:** architecture F1 at `src/server/store/index.ts:660-665,1192-1194`; architecture F2 at `src/server/store/index.ts:684-685,1336-1343`; architecture F7 at `src/server/store/index.ts:949-972`.

- [ ] **Store seam.** On a board that already carries the seed's resources, the created resource's id is held by no other resource, `listResources` returns distinct ids, and the `Artifact` attached to it resolves to that resource — asserted by reading the resource the artifact names, not by counting ids.
- [ ] **Store seam.** On a board the reader created, where the seed has no resources at all, the attach is accepted and resolves. This is the case a prefix-only change that still starts the counter at one fails.
- [ ] **Store seam.** The id space is derived from the data it must not collide with: a seed already holding the id the counter would mint next still yields a fresh id, asserted with a seed chosen to sit exactly on the counter's floor.
- [ ] **Store seam.** A principal holding no `post:message` on a board replays another principal's key and is refused with the board-membership refusal; it receives no entry, and the chronology is unchanged. The assertion is that the refusal happens *before* the stored record is returned.
- [ ] **Store seam.** The same principal replaying its own key on the same thread still receives the identical entry and appends nothing. Asserted in the same test as the refusal above, so a fix that deletes idempotency cannot pass.
- [ ] **Store seam.** Two principals simulating into one thread each get their own entry; neither simulation is swallowed by the other's key. The existing case that passes *because* the namespace is global is rewritten alongside.
- [ ] **Store seam.** A key whose entry a purge removed is refused on replay rather than answered with an entry absent from the chronology, and a later restore does not resurrect it. The returned `seq` must be proved present in the thread, not merely well formed.
- [ ] **Contract seam.** The conformance case "two calls with one key append exactly one entry" is restated for one principal and one thread, and a companion case asserts the cross-principal refusal against both implementations.

**Leaves the build green:** yes.
