# 10a: Entry kinds in the domain, the store and the contract

**From:** 10 — Authored acts share the thread chronology

**What to build:** A thread stops being a list of messages and becomes a chronology of authored acts, from the domain outwards. Attaching a resource to a thread, moving a thread's status and acknowledging up to a position each produce an entry with an author and a `seq` from the same counter as messages. The client interface gains the three operations, the store writes them by the rule a message already follows — one synchronous step, with no `await` between computing the next `seq` and appending, because a synchronous store has no interleaving to guard against — the HTTP layer validates them, and the conformance suite is extended to prove that acts and messages interleave in one order with no separate log to reconcile. No rendering — this ticket is the model and the contract.

**Blocked by:** 07b — The two rules that keep the gate human and the grant unlaunderable

**Write scope:** the entry union in the domain, the store's entry-writing path (including its error strings), and the contract's entry shape. This ticket owns the entry-writing path outright — 08a appends to the store but not here.

**Status:** done — verified, with 1 criterion open; see `## Comments`

- [x] `Entry` widens from a single-member union to four kinds — message, artifact, status move, acknowledgement — and every existing consumer (`readMessages`, the store's reads, the HTTP validators, the conformance suite) is typed against `Entry` rather than a bare `Message`.
- [x] Attaching a resource to a thread produces an artifact entry that names the resource by id, with an author and a `seq`. It holds no copy of the resource's content: two threads attaching one resource produce two entries and one resource, and a test asserts there is still exactly one resource record.
- [x] A status move produces an entry with an author, a from-status and a to-status, and a `seq`. A move from a status the thread is not in is refused.
- [x] An acknowledgement produces an entry covering a position range (up to a `seq`), with an author and a `seq`. It advances only the acknowledging principal's `acknowledged` watermark, and a test asserts a second principal's watermark is untouched.
- [x] Acts and messages take numbers from one counter and interleave in one order by `seq`; there is no separate audit log, no second table, and no client-side reconciliation.
- [x] A refused act leaves the thread unchanged and consumes no `seq` — asserted for each of the three acts, the same way 02b asserts it for a message.
- [ ] **Partly satisfied — the code cannot substitute one for the other, and one assertion is missing.** An acknowledgement can never substitute for a status move: acknowledging without `move:status` is not a move, the thread's status is unchanged, and a status-move entry does not exist afterwards. An acknowledgement never records agreement with what it acknowledged. **What is asserted:** that `acknowledge:thread` does not imply `move:status` (`tests/grants.test.ts`), that an acknowledgement entry carries no field that could read as a verdict (`tests/entries.test.ts`), and that the acknowledgement's kind is `acknowledgement` rather than a status move. **What is not:** no test reads the thread's status *after* an acknowledgement and asserts it is unchanged. The implementation does not touch it — `store.acknowledge` writes the entry and the acknowledging principal's watermark and nothing else — so the sentence is true and unasserted. Left open rather than ticked for a behaviour the suite would not notice changing.
- [x] The three new operations each declare and enforce one permission — `add:artifact`, `move:status`, `acknowledge:thread` — in the server function, per 07a's rule.
- [x] The three operations are on `RelayboardClient` and on both implementations; the conformance suite's new assertions pass against the in-memory client and the HTTP client unchanged.
- [x] The interface renders an acknowledgement as a report about the acknowledger, never as approval: the copy and the data model agree, and a test asserts an acknowledgement entry carries no field that could read as a verdict.

**Leaves the build green:** yes. The model holds four kinds; the UI still renders messages, so an act is present in history and invisible in the thread until 10b.

## Comments

**Implemented and verified** at `07a3eef`. A thread stopped being a list of messages: four kinds of entry
now take positions in one chronology, from the domain outwards.

**An act is an entry with a kind, and every kind takes a `seq` from one counter.** That is only true
because there is **one entry-writing path** — `commitEntry` does the seq, the permission check, the append,
the cursor updates and the notification once, for all four kinds. Four copies of read-the-last-seq-and-add-
one would have been four places for the counter to stop being one, and the contiguous-sequence assertion
would have caught it only by luck. Widening the union produced **forty-four type errors, every one fixed by
narrowing rather than casting**, which is the property the domain type was declared for.

**A conformance suite with one fixed actor cannot test a refusal, and that is the finding worth carrying.**
The first version of the refusal test passed with the store's permission check **deleted**: the suite's
subject always acts as one principal who holds every permission, so the outsider it looked up could never be
the caller, and the invariant held trivially. Moved to the store contract, which has a real stranger, it
fails under the same experiment. That also exposed a fixture whose member grant was narrower than a real
member's, so four acts had been refused for the wrong reason.

**One of my own tests asserted the opposite of the model.** The acknowledgement test first compared the whole
watermark record of every other principal and failed — because an act is an entry, so it advances their
**`cursor`**: delivery is a consequence of the commit. Comparing the whole record asserted that an act is
not delivered. It now compares only the third rung, and the narrowing is written where the assertion is.

The status set is closed at `open` and `resolved`, because that is the repository's only status vocabulary
and no ticket defines a third; it lives beside the type so widening it is one edit.

**One criterion is left open and it is a missing assertion, not a missing behaviour.** Criterion 19 asks that
an acknowledgement can never substitute for a status move. The implication is asserted, the entry's shape is
asserted, and the implementation provably does not touch the thread's status — but no test reads the status
after an acknowledgement to say so. Ticking it would claim a check the suite does not make.
