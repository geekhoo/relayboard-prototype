# 14: Purge the demo content without touching what you made

**What to build:** The workspace opens with demo content so it can be explored immediately, and that content must be removable without taking the reader's own work with it. A purge removes demo-origin records and nothing else: the reader's boards, threads, messages and resources survive, along with their identity, session and every grant. Where the two overlap — the reader's post on a demo board — the purge says so before it runs. Restore brings the demo back without duplicating whatever survived.

**Blocked by:** 09 — Create a board or thread, and add a resource; 11c — A revoked principal's stream closes, and the demo control stays honest

**Write scope:** the purge confirmation surface and the seed's restore path.

**Status:** ready-for-agent

- [ ] Every board, thread, entry and resource records its origin as demo or owner, and the origin is not used for any permission decision.
- [ ] A purge removes demo-origin records and leaves the reader's own boards, threads, entries and resources intact.
- [ ] A purge leaves the reader's principal, session and permissions intact; it never logs them out or strips access.
- [ ] Before a purge runs, it reports how many of the reader's own entries sit on demo boards and will be removed with them, and requires confirmation.
- [ ] A board the reader created survives a purge even if it contains demo-following activity.
- [ ] Restore re-seeds the demo content without duplicating what survived the purge.
- [ ] Principals holding a subscription are told that a purge happened, rather than inferring a failure from silence.
- [ ] The interface states that the store is in-memory and that a restart clears it, so a purge is not mistaken for the durability promise.
- [ ] **A purge invalidates no session.** The reader stays the principal they were, with the grant they had; a purge that logged them out or stripped access would make the demo content feel like it was load-bearing.
- [ ] **A purge requires the workspace-scoped `create:board` grant**, checked at the boundary like every other operation, and no `purge:*` verb is added to the vocabulary — 07a's test asserts that set literally, so a new verb would have to change the spec, `PRODUCT.md` and that test in the same commit. The rule is that the only principal who may remove workspace-scoped demo content is the principal who may create workspace-scoped content, and it is the superadmin grant 07a seeds.
- [ ] A principal without that workspace grant sees the purge control **disabled with the missing permission named** (`create:board`, workspace scope), per 07a's one "cannot do this" affordance — and calling the operation directly is refused as a permission failure rather than running unguarded.
- [ ] **The purge confirmation is keyboard-operable to 13b's standard, asserted here because this ticket builds it**: opening it moves focus into the dialog, focus is trapped while it is open, closing (confirm, cancel or Escape) returns focus to the control that opened it, and Escape closes exactly that one layer.

**Gating note:** the purge is a destructive product action and the permission vocabulary has no `purge:*` row, so it is gated by the **workspace `create:board` grant** — the existing permission that already means "may change the shape of this workspace". The test-only reset 06a provides is a different affordance for a different caller and must not be reachable as the user-facing purge: one is a development hook, the other is a product action with a confirmation.
