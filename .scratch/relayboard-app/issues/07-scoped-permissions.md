# 07: Named, scoped permissions enforced at the boundary

**What to build:** What a principal may do stops being implied by what kind of principal it is and becomes an explicit, named, scoped grant. A permission is `<verb>:<object>`, held either at workspace scope or on one board, and it is checked before the handler runs rather than in the interface. Two principals holding the same grant behave identically regardless of kind; a human can hold less than an agent and an agent more than a human. A refused act names the permission it was missing.

**Blocked by:** 03 — the client interface; 06 — operations served from the server

**Status:** ready-for-agent

- [ ] The permission vocabulary covers every permissible action on every object, and is recorded in one place.
- [ ] Each permission is scoped to the workspace or to a single board; nothing is implicitly workspace-wide.
- [ ] `read:board` yields that board's threads and resources; every other permission stands alone, and `read:member` is separate.
- [ ] Every participant operation declares and enforces the one permission it requires, in the server function rather than in the UI.
- [ ] A refusal names the missing permission in a message a caller can act on.
- [ ] A principal holding the same grant as another succeeds identically, proven for a human-with-less-than-an-agent pair and an agent-with-more-than-a-human pair.
- [ ] A client that bypasses the interface is still refused, because the check is not in the client.
- [ ] `admit:agent` and `revoke:agent` can only be granted to a human principal, and an attempt to grant them to an agent is refused.
- [ ] A human cannot grant a permission it does not itself hold.
