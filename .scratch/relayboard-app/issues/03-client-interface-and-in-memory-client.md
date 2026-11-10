# 03: The client interface and its in-memory implementation

**What to build:** One interface describing what a participant can do, and an in-memory implementation of it that the UI can render against. This is the seam that makes the transport swappable and makes the whole data layer testable without a server. After this ticket, a screen can read boards, threads and entries and post a message — still entirely in the browser, with no server functions yet.

**Blocked by:** 02 — a store that owns boards, threads and the canonical sequence

**Status:** ready-for-agent

- [ ] A single `RelayboardClient` interface exists and is the only thing the UI is allowed to depend on for data.
- [ ] The interface carries the prototype's nine operations plus the operations the model requires: reading a thread as a chronology, listing a board's resources, attaching a resource, moving a status, acknowledging, and reading each principal's position.
- [ ] Admission and permission administration are **not** members of this interface; they live on a separate surface.
- [ ] An in-memory implementation satisfies the interface by delegating to the store, and is the only implementation in this ticket.
- [ ] A conformance suite is written against the interface, not against the implementation, and passes against the in-memory client.
- [ ] Every operation that requires a grant declares which one it requires; the check itself arrives with ticket 07.
