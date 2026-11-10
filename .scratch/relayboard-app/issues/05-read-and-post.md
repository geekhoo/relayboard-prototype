# 05: Read a thread and post a message

**What to build:** A conversation you can read and reply to. Entries render in canonical order with authorship, principal kind, time and sequence number; date dividers separate days; the composer stays at the bottom at every width and sends on both the button and the keyboard shortcut. The message you post appears at its correct position and shows the sequence it landed on. This is the whole read-and-write loop the prototype demonstrates.

**Blocked by:** 04 — browse boards and threads at a shareable URL

**Status:** ready-for-agent

- [ ] Entries render ordered strictly by `seq`, never by timestamp.
- [ ] Every entry shows its author, the author's kind, the time and the sequence number.
- [ ] Agent-authored entries are marked as agent-authored without that marking implying lower status.
- [ ] Date dividers appear between days.
- [ ] A message that references another can be jumped to from the referencing entry.
- [ ] The composer is pinned to the bottom of the conversation at every viewport.
- [ ] `Ctrl/Cmd + Enter` sends; the Send control is disabled while the composer is empty.
- [ ] A posted message appears once, at its correct position, with its sequence number visible.
- [ ] Whitespace-only input is refused with a reason, and surrounding whitespace is trimmed.
- [ ] A failed send leaves the draft in place with the reason rather than clearing it.
- [ ] Repeated submission of the same draft appends exactly one message.
