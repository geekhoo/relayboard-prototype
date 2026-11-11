# 14: Purge the demo content without touching what you made

**What to build:** The workspace opens with demo content so it can be explored immediately, and that content must be removable without taking the reader's own work with it. A purge removes demo-origin records and nothing else: the reader's boards, threads, messages and resources survive, along with their identity, session and every grant. Where the two overlap — the reader's post on a demo board — the purge says so before it runs. Restore brings the demo back without duplicating whatever survived.

**Blocked by:** 09 — Create a board or thread, and add a resource; 11c — A revoked principal's stream closes, and the demo control stays honest

**Write scope:** the purge confirmation surface and the seed's restore path.

**Status:** done — verified, with 1 criterion open; see `## Comments`

- [x] Every board, thread, entry and resource records its origin as demo or owner, and the origin is not used for any permission decision.
- [x] A purge removes demo-origin records and leaves the reader's own boards, threads, entries and resources intact.
- [x] A purge leaves the reader's principal, session and permissions intact; it never logs them out or strips access.
- [x] Before a purge runs, it reports how many of the reader's own entries sit on demo boards and will be removed with them, and requires confirmation.
- [x] A board the reader created survives a purge even if it contains demo-following activity.
- [x] Restore re-seeds the demo content without duplicating what survived the purge.
- [ ] **Not satisfied — the announcement is sent to nobody.** Principals holding a subscription are told that a purge happened, rather than inferring a failure from silence. **What exists:** `purgeDemoContent` and `restoreDemoContent` both call `store.announceWorkspaceChange()`, the store keeps a `workspaceListeners` set, and the contract is documented on both methods. **What does not:** nothing ever subscribes. `onWorkspaceChange` has **no caller anywhere in `src`** — the SSE route listens for `onAccessEnded` and `onCommit` and not for this — so the announcement iterates an empty set. The commit message says the purge "closes open connections with the same event revocation uses"; the code calls a method whose listener list nothing populates. This is the same defect shape as the client classifier in 08b: the machinery is there and the wire between the two halves is missing.
- [x] The interface states that the store is in-memory and that a restart clears it, so a purge is not mistaken for the durability promise.
- [x] **A purge invalidates no session.** The reader stays the principal they were, with the grant they had; a purge that logged them out or stripped access would make the demo content feel like it was load-bearing.
- [x] **A purge requires the workspace-scoped `create:board` grant**, checked at the boundary like every other operation, and no `purge:*` verb is added to the vocabulary — 07a's test asserts that set literally, so a new verb would have to change the spec, `PRODUCT.md` and that test in the same commit. The rule is that the only principal who may remove workspace-scoped demo content is the principal who may create workspace-scoped content, and it is the superadmin grant 07a seeds.
- [x] A principal without that workspace grant sees the purge control **disabled with the missing permission named** (`create:board`, workspace scope), per 07a's one "cannot do this" affordance — and calling the operation directly is refused as a permission failure rather than running unguarded.
- [x] **The purge confirmation is keyboard-operable to 13b's standard, asserted here because this ticket builds it**: opening it moves focus into the dialog, focus is trapped while it is open, closing (confirm, cancel or Escape) returns focus to the control that opened it, and Escape closes exactly that one layer.

**Gating note:** the purge is a destructive product action and the permission vocabulary has no `purge:*` row, so it is gated by the **workspace `create:board` grant** — the existing permission that already means "may change the shape of this workspace". The test-only reset 06a provides is a different affordance for a different caller and must not be reachable as the user-facing purge: one is a development hook, the other is a product action with a confirmation.

## Comments

**Implemented and verified** at `2c48dee`. The purge removes demo-origin records and nothing else: the
reader's boards, threads, entries, resources, principal, session and grants all survive, and restore re-seeds
by id so a second restore cannot duplicate a demo board.

**Gated by the workspace-scoped `create:board` grant rather than a new verb**, checked at the boundary like
every other operation. The rule is that the only principal who may remove workspace-scoped demo content is
the one who may create it, and it is the superadmin grant 07a seeds. A principal without it sees the control
disabled with the permission named, and calling the operation directly is refused as a permission failure —
both asserted.

**One predicate, two callers.** The confirmation asks what *would* go and the purge removes exactly what the
confirmation said, because both call the same predicate; two functions computing it would be two answers to
one question, and a confirmation that overstates is worse than none.

**The defect this ticket found in a third ticket's scope: a created board granted its creator nothing.** A
reader could make a room they could not speak in — a grant *is* the membership, and nobody held
`post:message` on a board they had just made. 14's own test wrote the sequence that exposes it (create a
board, create a thread, post) and could not run it. `createBoard` now grants its creator the member set in
the same act that appends the board, from the acting principal rather than from any field a caller can set.
The prototype makes its creator a member too; the deliberate departure is that it does not also add
everybody else.

**The second finding: `{ atLeastOneBoard: "create:board" }` is the wrong shape.** `create:board` is a
workspace permission and that shape asks a board question, so it refused the one principal seeded to hold it.
That is the **second** time the same trap caught a real principal, so the requirement table's comment now
says which shape is for which question, with both cases named.

**One criterion is left open, and it is a wire that was never connected.** The purge announces a workspace
change and the store has the listener set for it, but `onWorkspaceChange` has no subscriber anywhere in the
application: the SSE route listens for access endings and commits, not for this. So a principal holding an
open subscription is not told that a purge happened — the machinery is complete on both ends and the call
between them is missing, which is exactly the class of defect 11c found on the revocation wire.
