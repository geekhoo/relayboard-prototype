# 10a: Entry kinds in the domain, the store and the contract

**From:** 10 — Authored acts share the thread chronology

**What to build:** A thread stops being a list of messages and becomes a chronology of authored acts, from the domain outwards. Attaching a resource to a thread, moving a thread's status and acknowledging up to a position each produce an entry with an author and a `seq` from the same counter as messages. The client interface gains the three operations, the store writes them under the same lock, the HTTP layer validates them, and the conformance suite is extended to prove that acts and messages interleave in one order with no separate log to reconcile. No rendering — this ticket is the model and the contract.

**Blocked by:** 07b — The two rules that keep the gate human and the grant unlaunderable

**Status:** ready-for-agent

- [ ] `Entry` widens from a single-member union to four kinds — message, artifact, status move, acknowledgement — and every existing consumer (`readMessages`, the store's reads, the HTTP validators, the conformance suite) is typed against `Entry` rather than a bare `Message`.
- [ ] Attaching a resource to a thread produces an artifact entry that names the resource by id, with an author and a `seq`. It holds no copy of the resource's content: two threads attaching one resource produce two entries and one resource, and a test asserts there is still exactly one resource record.
- [ ] A status move produces an entry with an author, a from-status and a to-status, and a `seq`. A move from a status the thread is not in is refused.
- [ ] An acknowledgement produces an entry covering a position range (up to a `seq`), with an author and a `seq`. It advances only the acknowledging principal's `acknowledged` watermark, and a test asserts a second principal's watermark is untouched.
- [ ] Acts and messages take numbers from one counter and interleave in one order by `seq`; there is no separate audit log, no second table, and no client-side reconciliation.
- [ ] A refused act leaves the thread unchanged and consumes no `seq` — asserted for each of the three acts, the same way 02b asserts it for a message.
- [ ] An acknowledgement can never substitute for a status move: acknowledging without `move:status` is not a move, the thread's status is unchanged, and a status-move entry does not exist afterwards. An acknowledgement never records agreement with what it acknowledged.
- [ ] The three new operations each declare and enforce one permission — `add:artifact`, `move:status`, `acknowledge:thread` — in the server function, per 07a's rule.
- [ ] The three operations are on `RelayboardClient` and on both implementations; the conformance suite's new assertions pass against the in-memory client and the HTTP client unchanged.
- [ ] The interface renders an acknowledgement as a report about the acknowledger, never as approval: the copy and the data model agree, and a test asserts an acknowledgement entry carries no field that could read as a verdict.

**Leaves the build green:** yes. The model holds four kinds; the UI still renders messages, so an act is present in history and invisible in the thread until 10b.
