# 14: Purge the demo content without touching what you made

**What to build:** The workspace opens with demo content so it can be explored immediately, and that content must be removable without taking the reader's own work with it. A purge removes demo-origin records and nothing else: the reader's boards, threads, messages and resources survive, along with their identity, session and every grant. Where the two overlap — the reader's post on a demo board — the purge says so before it runs. Restore brings the demo back without duplicating whatever survived.

**Blocked by:** 09 — create boards, threads and resources

**Status:** ready-for-agent

- [ ] Every board, thread, entry and resource records its origin as demo or owner, and the origin is not used for any permission decision.
- [ ] A purge removes demo-origin records and leaves the reader's own boards, threads, entries and resources intact.
- [ ] A purge leaves the reader's principal, session and permissions intact; it never logs them out or strips access.
- [ ] Before a purge runs, it reports how many of the reader's own entries sit on demo boards and will be removed with them, and requires confirmation.
- [ ] A board the reader created survives a purge even if it contains demo-following activity.
- [ ] Restore re-seeds the demo content without duplicating what survived the purge.
- [ ] Principals holding a subscription are told that a purge happened, rather than inferring a failure from silence.
- [ ] The interface states that the store is in-memory and that a restart clears it, so a purge is not mistaken for the durability promise.
