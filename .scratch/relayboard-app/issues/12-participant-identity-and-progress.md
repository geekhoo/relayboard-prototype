# 12: A participant's identity, permissions and progress

**What to build:** Opening a participant shows what you need in order to judge what they wrote: their kind, the permissions they hold on this board, the issuer and fingerprint this workspace derived, their declared description — labelled as declared — and how far they have got on the current thread. Authorship stays attached to them after their access ends, and the interface states plainly that authorship is not authority.

This ticket is where the workspace first shows a permission grant rather than enforcing one, so it consumes two things built earlier: the grant read (07a) and the derived-versus-declared split (08c). Both are named as blockers rather than left transitive, so a re-slicing of 08 cannot quietly remove what this ticket needs.

**Blocked by:** 08c — Expiry, revocation, renewal and a fingerprint the workspace derived; 10b — An act reads as an event without becoming louder than a message; 07a — The permission vocabulary, its scopes, and enforcement at the boundary

**Write scope:** the participant panel **and** the details drawer that 05 renders into — **this ticket owns both**, each with a co-located stylesheet; layout as utilities.

**Status:** ready-for-agent

- [ ] A participant panel shows kind, board permissions, issuer, derived fingerprint and declared description.
- [ ] Derived values and declared values are visually distinguishable, and nothing declared is ever labelled verified.
- [ ] The panel distinguishes **derived** (this workspace issued and computed it) from **declared** (the principal asserted it) by more than a caption — see `DESIGN.md`'s admission-surface rules, which this panel reuses rather than re-invents.
- [ ] The panel shows how far the participant has got on the current thread: received, seen, acknowledged.
- [ ] Silence is distinguishable from unread, because a principal behind the thread is visibly behind rather than merely quiet.
- [ ] A revoked principal's panel still shows its authorship, marked as access-ended rather than erased.
- [ ] The interface states that authorship is not permission, so no reader infers authority from who wrote something.
- [ ] The reader can see which principal they are acting as, and what they themselves may do here.
- [ ] **The panel reads the participant and its grant through the one board-scoped principal read**, not off a board payload and not through a second undocumented call — so a caller without `read:member` cannot obtain a participant by opening a panel, and "what may this participant do here" is answerable. The call is `readPrincipal({ principalId, boardId })`, and the panel takes all three of its fields from it: `principal` for the record and the derived issuer and fingerprint, `grant` for the permissions it holds on this board, and `declared` for the operator and reason to render as declared — no second read, and no field read off a board payload.
- [ ] **The fingerprint shown here is the derived one, and there is nothing to compare it to.** The prototype's identity drawer displayed a hard-coded demo string under "Verified identity" (`parity-checklist.md` line 57); the app derives the value from the credential it issued (08c:21) and never renders a literal. Nobody — not a test, not a reviewer — may assert this string equals the prototype's, because the prototype had no derivation and the two are different kinds of value.
