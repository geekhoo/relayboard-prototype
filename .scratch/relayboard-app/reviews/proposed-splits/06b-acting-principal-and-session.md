# 06b: The acting principal — env, session and request-time resolution

**From:** 06 — Serve the operations from the server

**What to build:** The server decides who is acting, and every operation asks. The session signing secret becomes a required, server-only variable that is actually read, the app refuses to start without it, a browser is issued a signed session cookie naming the principal it acts as, and each server function resolves that principal before its handler runs. This is the ticket the parent does not mention and every later ticket assumes (review §5-A): without it, the mutations in 06c must accept an author from the caller, and ticket 07 has to remove a field the conformance suite has already frozen.

**Blocked by:** 06a — The read operations over HTTP, and one store for the process

**Status:** ready-for-agent

- [ ] A required server-only session secret is declared in `env.ts`, and it is **not** `.optional()`. Its absence is a startup failure, not a first-request failure (spec L355–356, story 151).
- [ ] `runtimeEnv` includes the server's process environment, not only `import.meta.env`. `NOTES.md` §5(d) measured that a plain server variable read through `import.meta.env` comes back `null`; this ticket fixes that and records the measurement in place.
- [ ] `env.ts` is imported by the server entry point, so validation actually runs. Today it is imported by nothing (`NOTES.md` §5; grep over `src/` finds no importer).
- [ ] `.env.example` exists and names the required variable; `.env` stays gitignored. `README.md`'s stale reference to a file the CLI never generated is corrected or removed.
- [ ] A first request without a session is issued a signed, `HttpOnly`, `SameSite=Lax` cookie naming the principal it acts as; a request with a valid cookie resolves to that principal.
- [ ] The cookie's value is not readable from client JavaScript and is not echoed into any payload.
- [ ] One request-time resolver yields a principal and its permission set, and both the browser cookie and an agent credential will go through it (the agent credential arrives in 08a; the resolver's shape must already allow it, and must not be written against cookies alone).
- [ ] No operation asks which `kind` the principal is. The resolver exposes `kind` as a label on the principal, and the enforcement path does not branch on it.
- [ ] A request whose session cannot be resolved is rejected as unauthenticated, and that refusal is distinguishable by the client from a permission refusal and from a validation failure. Spec L494 makes this the one case where the client must not retry silently.
- [ ] The resolver is reusable by a plain server function and by a server route, so 11a's SSE route can authenticate the same way without duplicating the logic.
- [ ] The interface states that a session identifies and does not authenticate (spec L352, §615) — in copy a participant sees, not only in a comment.
- [ ] The conformance suite still passes unchanged: reads that require no principal behave as before, and a read that requires one is now asserted through a real resolved session.

**Leaves the build green:** yes. The app still renders from the in-memory client; the server now knows who is calling it.
