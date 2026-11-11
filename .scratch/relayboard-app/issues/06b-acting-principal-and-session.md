# 06b: The acting principal — env, session and request-time resolution

**From:** 06 — Serve the operations from the server

**What to build:** The server decides who is acting, and every operation asks. The session signing secret becomes a required, server-only variable that is actually read, the app refuses to start without it, a browser is issued a signed session cookie naming the principal it acts as, and each server function resolves that principal before its handler runs. This is the ticket the parent does not mention and every later ticket assumes (review §5-A): without it, the mutations in 06c must accept an author from the caller, and ticket 07 has to remove a field the conformance suite has already frozen.

**Blocked by:** 06a — The read operations over HTTP, and one store for the process

**Write scope:** `src/env.ts`, the two server-only modules it names — `src/server/env.ts` and `src/server/principal.ts` — session issuance and the request-time resolver. `src/server/store/**` stays 06a's.

**Status:** done — verified, with one substitution and three criteria open; see `## Comments`

- [x] A required server-only session secret is declared in `env.ts`, and it is **not** `.optional()`. Its absence is a startup failure, not a first-request failure (spec L378, story 151).
- [x] `runtimeEnv` includes the server's process environment, not only `import.meta.env`. `NOTES.md` §5(d) measured that a plain server variable read through `import.meta.env` comes back `null`; this ticket fixes that and records the measurement in place.
- [x] **The secret is asserted where the resolver is built, in a module named here.** Verified: there is no `src/server.ts`, `src/start.ts`, `src/entry-server.tsx` or `app.config.ts` today, and `src/env.ts` has no importer at all — so "import it from the server entry" names a file that does not exist. The layout this ticket establishes is `src/server/env.ts` (server-only: it imports `env`, reads the process environment and throws if `SESSION_SECRET` is unset) imported by `src/server/principal.ts` (the request-time resolver every server function and the SSE route go through). Both files are this ticket's to create and belong in its write scope; no global server entry is added, because the resolver module is already loaded by every path that needs a principal.
- [ ] **Substituted: the criterion's claim is 'refuses to start', and what is true is 'serves nothing' — see Comments.** A missing secret fails the process before it serves a request, and that is asserted rather than described: importing the resolver module with `SESSION_SECRET` unset throws at import time, and a test spawns the server process with the variable absent and expects a non-zero exit with the missing variable named.
- [x] `.env.example` exists and names the required variable; `.env` stays gitignored. `README.md`'s stale reference to a file the CLI never generated is corrected or removed.
- [x] A first request without a session is issued a signed, `HttpOnly`, `SameSite=Lax` cookie naming the principal it acts as; a request with a valid cookie resolves to that principal. The first request receives the first selectable principal, the second a different one, and the third wraps to the first — stable within one store instance — so issuance walks 02c's `browserSelectable` order cyclically instead of handing every browser the same principal (spec L368, L372).
- [x] The cookie's value is not readable from client JavaScript and is not echoed into any payload.
- [ ] **Not satisfied as worded — the resolver yields the principal, not a permission set.** One request-time resolver yields a principal and its permission set, and both the browser cookie and an agent credential will go through it (the agent credential arrives in 08a; the resolver's shape must already allow it, and must not be written against cookies alone).
- [x] No operation asks which `kind` the principal is. The resolver exposes `kind` as a label on the principal, and the enforcement path does not branch on it.
- [ ] **Half satisfied — refused at the resolver, not yet distinguishable by the client.** A request whose session cannot be resolved is rejected as unauthenticated, and that refusal is distinguishable by the client from a permission refusal and from a validation failure. Spec L494 makes this the one case where the client must not retry silently.
- [x] The resolver is reusable by a plain server function and by a server route, so 11a's SSE route can authenticate the same way without duplicating the logic.
- [x] The interface states that a session identifies and does not authenticate (spec L368) — in copy a participant sees, not only in a comment.
- [ ] **Not satisfied as worded — see Comments.** The conformance suite still passes unchanged: reads that require no principal behave as before, and a read that requires one is now asserted through a real resolved session.

**Leaves the build green:** yes. The app still renders from the in-memory client; the server now knows who is calling it.

## Comments

**Implemented and verified** at `ebf7441`. The server decides who is acting, the app refuses to serve
without a signing secret, and both the browser cookie and the future agent credential arrive at one
resolver.

What was checked, rather than assumed:

- `SESSION_SECRET` is declared in `src/env.ts` with `.min(1)` and **not** `.optional()`, and its length
  floor lives in `requireSessionSecret` (`src/server/env.ts`) where the message can name the variable
  and say how to make one.
- `runtimeEnvironment()` merges `import.meta.env` with `process.env`, **process second and therefore
  winning**, because `NOTES.md` §5(d) measured that a server-only variable read through
  `import.meta.env` comes back `undefined` even when it is exported into the process.
- `.env.example` names the variable with its rules; `.env` is gitignored; `README.md`'s reference to a
  file the CLI never generated is corrected.
- The cookie is signed with HMAC-SHA256 over the principal id, `HttpOnly`, `SameSite=Lax`, `path=/`,
  30-day `Max-Age`, and `Secure` only outside development — a plain-http dev server would drop a
  `Secure` cookie and the reader would be re-issued a session on every request. Asserted on the header
  string rather than by a browser dropping a cookie, because a browser cannot observe `HttpOnly`;
  expiry and `Secure` are header assertions and the ticket says so rather than implying more.
- Signatures are compared with `timingSafeEqual`, after a length check because that function throws on
  unequal buffers. A truncated secret would otherwise accept every cookie the real one signs, and
  `tests/session.test.ts` asserts that it does not.
- A cookie whose signature is valid but which names a principal the workspace no longer holds resolves
  to **nobody** and is refused, rather than being quietly reassigned to a fresh principal.
- **Resolution is memoised per request, in a `WeakMap` keyed on the request object.** Measured, not
  reasoned: one page load calls several server functions — the rail's boards and counts, the pane's
  threads, the acting principal itself — and with resolution happening per call, one load advanced the
  session round-robin several times and issued several cookies, so **two browsers wrapped onto the same
  principal**, which is the opposite of spec L372. Keyed on the request, a resolution cannot outlive it
  and two concurrent requests cannot read each other's answer.
- **The session guard once shipped into the browser bundle.** Gating the secret read on
  `import.meta.env.SSR` is a build-time constant, so the server bundle keeps the guard and the client
  bundle has no secret at all. `check:bundle` is the mirror of `check:boot` and fails if the secret's
  name, the guard's name or a Node built-in appears in any built client asset.

**Criterion 4 is substituted, because the framework does not provide the check it looks like it does.**
The criterion asks for a test that spawns the server and expects a **non-zero exit**. Measured:
`src/start.ts` is the plugin's start entry and is imported **on the first request**, not at boot — a
start entry that throws at module scope leaves the process listening and fails the first request. So the
honest claim is *"the server serves nothing without a secret, and its first failure names the variable"*,
and that is what the module says. The true boot-time exit is asserted by `check:boot`, which imports the
built entry in a fresh process where the throw is fatal: absent fails, five characters fails saying too
short, and a usable secret loads clean. The third case is what stops a guard that always throws from
passing. It runs in CI after the build.

**Criterion 9 is left unticked.** It asks for a resolver that "yields a principal **and its permission
set**". `resolveSession` returns `{ principal, issued }` and `actingPrincipal()` returns the principal;
`ResolvedPrincipal` declares a `permissions` field that nothing populates, because there are no grants
yet — `readPrincipal` builds a grant from board *membership*. The clause that matters now, that the
shape admits a second credential without being rewritten against cookies, is argued and true; the
permission-set half arrives with 07a, and the box stays open rather than being ticked for the half that
exists. **Nothing on the enforcement path asks `kind`** (criterion 10), and the one `kind` lookup in the
server — `simulateIncoming` choosing an agent to author as — is choosing a speaker, not deciding a
capability.

**A lie in the interface that no gate would have caught.** With the UI on HTTP, the second browser's
cookie named `maya` while its session note named `alex`: the note's belief about who the reader was came
from the seed while its data came from the server. That is 06c's to fix at the query graph, and it is
recorded here because this ticket is what made it possible to have two answers to one question.

**The identity sentence is participant-visible, and it is the sentence the criterion asked for.**
`SessionNote` renders "You are acting as *{principal}*. A session identifies you to this workspace; it
does not sign you in, and anyone holding this browser's cookie acts as you." Asserted by the route seam
through `whoAmI`, which reads that element rather than assuming an id.

**Criterion 11 is left unticked, because the suite that would prove it does not touch the feature.**
"The conformance suite still passes unchanged: reads that require no principal behave as before, and a
read that requires one is now asserted through a real resolved session." The suite does still pass — but
against the **in-memory** client, which has no session at all, so its passing is not evidence about
resolution. The read that is asserted through a real session is in `e2e/participants.spec.ts`, which is a
different seam than the criterion names. Ticking it would be counting a green in the one file that cannot
see the change.

**Criterion 10 is half satisfied for the same reason, and it is recorded rather than waved through.**
Yes, a request whose session cannot be resolved is rejected: `resolveSession` throws `UnresolvedSession`
when a validly-signed cookie names a principal the workspace no longer holds, and when the seed marks
nobody selectable. But *"that refusal is distinguishable by the client from a permission refusal and from a
validation failure"* is not true yet — see the paragraph below.

**One refusal is not yet distinguishable by the client, and it matters.** `UnresolvedSession` is thrown by
`resolveSession`, but nothing maps it to a transport-level code: `ServerError` has an `unresolved` family
and `unknownPrincipal` and `resetRefused` use it, while `UnresolvedSession` is a bare `Error`. The three
families are declared and are not yet all produced by the path that produces them. 06c's error mapping is
where this gets closed, and it is recorded here because this is the ticket that introduced the thrower.
