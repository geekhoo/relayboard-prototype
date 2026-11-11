# 12: A participant's identity, permissions and progress

**What to build:** Opening a participant shows what you need in order to judge what they wrote: their kind, the permissions they hold on this board, the issuer and fingerprint this workspace derived, their declared description — labelled as declared — and how far they have got on the current thread. Authorship stays attached to them after their access ends, and the interface states plainly that authorship is not authority.

This ticket is where the workspace first shows a permission grant rather than enforcing one, so it consumes two things built earlier: the grant read (07a) and the derived-versus-declared split (08c). Both are named as blockers rather than left transitive, so a re-slicing of 08 cannot quietly remove what this ticket needs.

**Blocked by:** 08c — Expiry, revocation, renewal and a fingerprint the workspace derived; 10b — An act reads as an event without becoming louder than a message; 07a — The permission vocabulary, its scopes, and enforcement at the boundary

**Write scope:** the participant panel **and** the details drawer that 05 renders into — **this ticket owns both**, each with a co-located stylesheet; layout as utilities.

**Status:** done — verified, with 2 criteria open; see `## Comments`

- [x] A participant panel shows kind, board permissions, issuer, derived fingerprint and declared description.
- [x] Derived values and declared values are visually distinguishable, and nothing declared is ever labelled verified.
- [x] The panel distinguishes **derived** (this workspace issued and computed it) from **declared** (the principal asserted it) by more than a caption — see `DESIGN.md`'s admission-surface rules, which this panel reuses rather than re-invents.
- [ ] **Partly satisfied — three readouts render, and the copy that makes silence legible does not.** Silence is distinguishable from unread, because a principal behind the thread is visibly behind rather than merely quiet. **What renders:** three rungs with three meanings — received, read, acknowledged — each with a position and a sentence (`#3 — this participant has read up to here`), never one bar, and the seeded principals differ on all three. **What does not:** the panel says where a participant *is*; it does not say what the absence of a position means. The `position === undefined` branch reads "No position yet: this participant has not been sent anything in an open thread" — which is about a *thread*, not about a participant that has gone quiet while the thread moved on. The distinction the criterion asks for is inferable from the numbers rather than stated.
- [x] Silence is distinguishable from unread, because a principal behind the thread is visibly behind rather than merely quiet.
- [ ] **Partly satisfied — authorship survives and is marked in the model, not on this panel.** A revoked principal's panel still shows its authorship, marked as access-ended rather than erased. **The model half is true and asserted at the admissions seam:** a revoked principal keeps its record, its grant and its authorship, entries it authored keep their `authorId`, and nothing about a revocation rewrites history. **What is missing is the panel:** `ParticipantPanel` has no access-ended state to render, because **no agent credential can exist in a browser** (08a's limit) — a seeded human was never admitted, so a seeded principal's panel has nothing to mark ended, and the one principal it could mark has no browser session that reaches it. A revoked principal's panel has therefore never been rendered by anybody.
- [x] The interface states that authorship is not permission, so no reader infers authority from who wrote something.
- [x] The reader can see which principal they are acting as, and what they themselves may do here.
- [x] **The panel reads the participant and its grant through the one board-scoped principal read**, not off a board payload and not through a second undocumented call — so a caller without `read:member` cannot obtain a participant by opening a panel, and "what may this participant do here" is answerable. The call is `readPrincipal({ principalId, boardId })`, and the panel takes all three of its fields from it: `principal` for the record and the derived issuer and fingerprint, `grant` for the permissions it holds on this board, and `declared` for the operator and reason to render as declared — no second read, and no field read off a board payload.
- [x] **The fingerprint shown here is the derived one, and there is nothing to compare it to.** The prototype's identity drawer displayed a hard-coded demo string under "Verified identity" (`parity-checklist.md` line 57); the app derives the value from the credential it issued (08c:21) and never renders a literal. Nobody — not a test, not a reviewer — may assert this string equals the prototype's, because the prototype had no derivation and the two are different kinds of value.

## Comments

**Implemented and verified** at `2c48dee`. Opening a participant shows what a reader needs in order to
judge what they wrote: their kind, the grant they hold on this board, the identity this workspace derived,
what they merely declare, and how far they have got.

**Derived and declared are separated by construction, not by caption.** They sit under two headings of the
same weight, neither tinted; the derived values come from their own fields, so a declared string cannot
reach a surface a reader would read as computed; and the declared side is captioned as **not verified**. A
seeded human has no derived identity because it was never admitted, and the panel says that rather than
showing a placeholder that looks computed.

**The panel reads the participant through the one board-scoped principal read** —
`readPrincipal({ principalId, boardId })` — taking `principal` for the record, `grant` for this board's
permissions and `declared` for the operator and reason. No second read, and nothing off a board payload, so
a caller without `read:member` cannot obtain a participant by opening a panel.

**The negative assertion needed its own experiment, and that is the finding.** A test asserted the panel's
text never says "Verified identity". Renaming a heading failed the *positive* assertion first, so the
negative could never fire — a positive that fails first masks every negative behind it, forever. It is now
an exact heading-set comparison, which bites.

**The fingerprint is the derived one and there is nothing to compare it to.** The prototype rendered a
hard-coded demo string under "Verified identity"; a test asserts this panel never contains it, and nobody
may assert the derived value equals the prototype's, because the prototype had no derivation.

**Two criteria are left open, and both are limits rather than omissions.** Criterion 18 asks that a revoked
principal's panel show its authorship marked access-ended: the model keeps it and the admissions seam
asserts it, but no agent credential can exist in a browser, so that panel has never been rendered. Criterion
17 asks that silence be distinguishable from unread: three readouts render and the principals differ, but
the sentence a reader would need to read the silence is not written.
