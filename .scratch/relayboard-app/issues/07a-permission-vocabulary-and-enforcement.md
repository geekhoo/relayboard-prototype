# 07a: The permission vocabulary, its scopes, and enforcement at the boundary

**From:** 07 — Named, scoped permissions enforced at the boundary

**What to build:** What a principal may do stops being implied by what kind of principal it is and becomes an explicit, named, scoped grant. The vocabulary lives in one place, every permission is scoped either to the workspace or to one board, every participant operation declares and enforces exactly one permission inside its server function rather than in the UI, and a refusal names the missing permission in a message a caller can act on. This sub-issue also introduces the store-level `grant` operation the next one constrains, and the rendering rule for a control the reader may not use.

**Blocked by:** 03 — The client interface and its in-memory implementation; 06c — Every mutation over HTTP, and the conformance suite run both ways

**Write scope:** the permission vocabulary, the check helper and the interface's declared requirements. Does not add a route or a control.

**Status:** ready-for-agent

- [ ] The permission vocabulary exists in one module and equals the four rows of spec L418–423 exactly: workspace (`read:board`, `create:board`, `admit:agent`, `revoke:agent`, `grant:permission`), board (`read:board`, `update:board`, `create:thread`, `add:resource`, `read:member`), thread (`read:thread`, `post:message`, `move:status`, `add:artifact`, `acknowledge:thread`), resource (`read:resource`, `add:resource`). A test asserts the exported set equals that literal list, so "covers every action" is checkable rather than judged.
- [ ] Every permission is scoped — to the workspace or to exactly one board id. There is no implicitly workspace-wide permission and no unscoped grant: a grant record that omits its scope is a validation failure.
- [ ] `read:board` on a board yields that board's threads **and** its resources. Every other permission stands alone; a test asserts each of these pairs independently against the same principal: `post:message` does not yield `create:thread`, `acknowledge:thread` does not yield `move:status`, `read:board` does not yield `read:member`, `read:resource` does not yield `add:resource`.
- [ ] Every participant operation declares the one permission it requires, using the table in spec L325–341, and the declaration is a single value on the operation's definition rather than a branch inside its handler. The table has a row for **every** operation on `RelayboardClient`, including `readActingPrincipal`, whose requirement is `none` and whose reason is in the table rather than inferred: a caller with no session has to be able to ask who it is acting as, so that one operation requires no grant. A test asserts the declared set equals the table's rows one for one, so an operation added to the interface without a row — or a row without an operation — fails here rather than in a later ticket.
- [ ] The check runs in the server function before the handler body — not in the client, and not inside the store's domain logic. A test calls the server function directly with a request that never touched the UI and asserts the refusal.
- [ ] A refusal names the missing permission and its scope in a message a caller can act on, distinct from a validation failure and from an unauthenticated result.
- [ ] The seed's provisional membership predicate from 02c is replaced by a grant lookup, and the board membership the prototype encoded in `board.members` is reproduced as grants so the same principals can do the same things.
- [ ] The seeded principal from 02c receives the workspace-wide grant (spec L429, story 81–85): `read:board`, `create:board`, `admit:agent`, `revoke:agent`, `grant:permission` at workspace scope, of `kind: "human"`. A test asserts it still cannot post to a board it holds no board-scoped grant on.
- [ ] A principal holding the same grant as another succeeds identically, proven for both directions of the asymmetry the spec names: a human holding less than an agent, and an agent holding more than a human (story 77–80, spec L590).
- [ ] `kind` is consulted in exactly one place in the codebase — the rule in 07b — and a test or lint check makes a second occurrence visible. **This is the durable form of the check 02a could only make temporarily**: 02a asserted that `src/domain` exports types only, so nothing in it could branch on anything, and that assertion stops holding the moment 02b puts the documented error strings in the domain module. 
- [ ] A control whose permission the reader lacks renders disabled with a stated reason (`DESIGN.md` §221), not hidden and not enabled-then-refused. This rule is declared here and applied by 09, 10 and 12.
- [ ] The conformance suite's refusals are asserted through the client interface as well as through direct calls, so the same behaviour is proven at both entry points.

**Leaves the build green:** yes. Every operation is now permission-checked server-side; the grant-administration rules are not yet in place, so the store-level `grant` operation is permissive by design and 07b closes it.
