# 05: Read a thread and post a message

**What to build:** A conversation you can read and reply to. Entries render in canonical order with authorship, principal kind, time and sequence number; date dividers separate days; the composer stays at the bottom at every width and sends on both the button and the keyboard shortcut. The message you post appears at its correct position and shows the sequence it landed on. This is the whole read-and-write loop the prototype demonstrates.

Three behaviours the prototype has and `QA.md` grades as passing belong to no other ticket, so they land here: the thread intro, the thread-details panel, and filtering the entries of a thread by a search term. Leaving them out would let ticket 15's parity claim pass while those three features are absent.

**Blocked by:** 04c — The route seam's harness, which the plan is missing

**Status:** ready-for-agent

- [ ] Entries render ordered strictly by `seq`, never by timestamp.
- [ ] Every entry shows its author, the author's kind, the time and the sequence number.
- [ ] Agent-authored entries are marked as agent-authored without that marking implying lower status.
- [ ] Date dividers appear between days.
- [ ] A message that references another can be jumped to from the referencing entry.
- [ ] **A thread opens with an intro naming who created it and when**, and how many entries it holds.
- [ ] **A thread-details panel shows creation date, entry count, last sequence and the thread's participants**, and is dismissable from the keyboard.
- [ ] **A search within the open thread filters its entries by term and reports a zero-match state**, distinguishing "no match" from "empty thread".
- [ ] The composer is pinned to the bottom of the conversation at every viewport.
- [ ] `Ctrl/Cmd + Enter` sends; the Send control is disabled while the composer is empty.
- [ ] A posted message appears once, at its correct position, with its sequence number visible.
- [ ] Whitespace-only input is refused with a reason, and surrounding whitespace is trimmed.
- [ ] A failed send leaves the draft in place with the reason rather than clearing it.
- [ ] **Submitting the same draft twice while the first is in flight appends one message**, and **retrying a committed post with its original idempotency key appends nothing** — these are two different guards and both are asserted separately, because one sentence cannot describe both.
