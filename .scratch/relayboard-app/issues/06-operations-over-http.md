# 06: Serve the operations from the server

**What to build:** The same screens, but the data now comes from the server. Every participant operation is a server function with validated input and a real store behind it, and the same conformance suite that passes against the in-memory client also passes against the HTTP client pointed at the running app. After this ticket, two browsers see one workspace — which is the first time the product's central claim is testable at all.

**Blocked by:** 03 — the client interface

**Status:** ready-for-agent

- [ ] Every participant operation is reachable as a server function, with mutating operations as POST and pure reads as GET.
- [ ] Each operation validates its input at the boundary and rejects malformed input before the store is touched.
- [ ] An HTTP implementation of the client satisfies the same interface, and the existing conformance suite passes against it unchanged.
- [ ] The store is a single in-process instance shared by all requests, and it is described as in-memory and volatile in the interface.
- [ ] Two independent browser sessions see the same boards, threads and messages.
- [ ] A server restart clears the store, and the interface says so rather than showing a broken screen.
