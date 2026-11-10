# 10: Authored acts share the thread chronology

**What to build:** A thread stops being a list of messages and becomes a chronology of authored acts. Attaching a resource to a thread, moving a thread's status, and acknowledging up to a position each produce an entry with an author and a `seq` from the same counter as messages. An act reads as a recorded event rather than as prose, and a refused act leaves the thread unchanged rather than half-recorded.

**Blocked by:** 07 — named, scoped permissions

**Status:** ready-for-agent

- [ ] Attaching a resource produces an artifact entry naming the resource, with an author and a `seq`.
- [ ] A status move produces an entry with an author, a from-status, a to-status and a `seq`.
- [ ] An acknowledgement produces an entry covering a position range, with an author and a `seq`.
- [ ] An artifact points at its resource rather than copying it: two threads attaching one resource produce two entries and one resource.
- [ ] Acts and messages interleave in one order by `seq`; there is no separate audit log to reconcile.
- [ ] An act renders distinguishably from a message without becoming louder than one.
- [ ] A refused act leaves the thread unchanged, and consumes no `seq`.
- [ ] An acknowledgement can never substitute for a status move, and never counts as agreement with what it acknowledged.
