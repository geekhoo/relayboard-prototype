# 03: The client interface and its in-memory implementation

**What to build:** One interface describing what a participant can do, and an in-memory implementation of it that the UI can render against. This is the seam that makes the transport swappable and makes the whole data layer testable without a server. After this ticket, a screen can read boards, threads and entries and post a message — still entirely in the browser, with no server functions yet.

Three things a reviewer found missing here are load-bearing, and fixing them after ticket 06 means a seam rewrite:

- **The two participant reads.** `read:member` is its own permission, so a board's participants must be a read of their own — and the prototype leaks `board.members` off the board payload, which would hand every caller exactly what that permission withholds. Both reads belong in the interface now.
- **The entry shape.** Ticket 10a widens a thread's contents from messages to four kinds of entry. If the interface freezes `Message` here, that widening is a five-file refactor; if `Entry` is a union of one member today, it is an addition later.
- **`subscribe`'s transport.** The stream is a server route, not a server function (ticket 11a). The interface declares `subscribe`; the HTTP implementation cannot honour it until 11a and must say so loudly rather than return an empty subscription.

**Blocked by:** 02c — The demo seed, with an origin on everything

**Write scope:** `src/client/**` — the interface, the in-memory implementation, and the two conformance suites. Later tickets add operations to this interface; this ticket establishes its shape and the two-file suite split.

**Status:** ready-for-agent

- [ ] A single `RelayboardClient` interface exists and is the only thing the UI is allowed to depend on for data.
- [ ] The interface carries the prototype's nine operations plus the operations the model requires: reading a thread as a chronology, listing a board's resources, attaching a resource, moving a status, acknowledging, and reading each principal's position.
- [ ] **The interface carries the two participant reads**: a board's participants, and one participant **with the grant it holds on that board** — so the second read takes both a principal and a board, because a grant is per board and a read that took only an id could not answer "what may this participant do here". Gated by `read:member`.
- [ ] **`listBoards` returns a member *count* per board and not a member list**, so the permission that withholds a board's participants is not defeated by the call that lists boards.
- [ ] **A thread's contents are typed as a union with one member today**, so ticket 10a adds kinds rather than replacing a type that three later tickets have already frozen.
- [ ] Admission and permission administration are **not** members of this interface; they live on a separate surface.
- [ ] `subscribe` is declared with its event vocabulary, and the in-memory implementation drives it from the store.
- [ ] An in-memory implementation satisfies the interface by delegating to the store, and is the only implementation in this ticket.
- [ ] A conformance suite is written against the interface, not against the implementation, and passes against the in-memory client.
- [ ] **The suite is two files, not one**: an operations suite covering everything except the stream, and a stream suite covering `subscribe` and its event vocabulary. The two transports arrive at different tickets — operations over HTTP in 06c, the stream over SSE in 11a — so 06c must be able to skip the stream suite explicitly rather than weaken the operations suite to accommodate a transport that does not exist yet.
- [ ] The conformance suite asserts only caller-observable behaviour: no assertion names a store field, a `cursors` object, or any internal. Where a criterion needs one progress position, it asks through `readPositions`.
- [ ] Every operation that requires a grant declares which one it requires; the check itself arrives in 07a.
