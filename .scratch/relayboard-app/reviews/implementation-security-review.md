# Security, identity, permission and admission — review of the Relayboard app implementation

**Verdict:** do not ship
**Scope:** the security-critical server surface of `apps/relayboard-web` at `c9304d6`: `src/server/{principal,session,credential,admissions,grants,permissions,env,stream}.ts`, `src/server/functions/{admission,errors,inputs,read,write}.ts`, `src/server/store/index.ts` (permission, grant, access-ending and principal paths only), `src/server/store/demo-seed.ts` (principal and grant tables), `src/domain/{grants,permissions,errors,types}.ts`, `src/client/{admission,http,index}.ts`, `src/routes/api/stream.ts`, and the security-adjacent components (`SessionNote`, `StoreLifetimeNote`, `Gatekeeper`, `StreamPanel`, `ParticipantPanel`). Twelve files read line by line, four more read on their permission/identity paths, twelve test files read in full (about 2,900 lines), plus `e2e/{permissions,gatekeeper,stream,isolation}.spec.ts` and `scripts/check-boot.mjs`.

**Method:** read `AGENTS.md` (root and app), `PRODUCT.md`, `spec.md` §Implementation Decisions and §Testing Decisions in full, issues 08a and 08c, and `check-boot.mjs`. Enumerated every branch on `kind` with grep across `src/` and classified each. Traced every call site of `resolveSession`, `resolveCredential`, `store.permits`, `store.grant`, `endAccess`/`accessEndedFor`, `registerAgentCredential`, and every `createServerFn` in `src/server/functions/`. Read each cited test and asked what it would do if the protection were deleted. No build, no e2e and no `app:check` was run (the Lead owns those); no source file was modified.

## Ranked findings

| # | Severity | Where | Finding |
| --- | --- | --- | --- |
| F1 | Critical | `src/routes/api/stream.ts:52,111-122,187-198` | The SSE route authorizes nothing: it resolves a principal and then streams every board's chronology, replay and live, regardless of the subscriber's grants. |
| F2 | High | `src/server/admissions.ts:651` (with `:393-395`) | `revoke` is guarded by `admit:agent`, not `revoke:agent` — a board gate holder can revoke; the comment, the error message and the seed all say otherwise. |
| F3 | High | `src/server/principal.ts:154-155` vs `:192-207` | A request carrying both a cookie and a bearer token resolves as the **agent**, though the module's own comment says the cookie wins — the identity swap spec L373 forbids. |
| F4 | High | `src/server/admissions.ts:547-559` | A refused admission leaves the principal it created behind: `admitPrincipal` runs before `store.grant`, so a bounds refusal records half an act with no rollback. |
| F5 | High | `src/server/admissions.ts:601-621` vs `:727-734` | Renewal never removes the old credential hash from `issued`, so a superseded token keeps resolving and inherits the renewed expiry. |
| F6 | Medium | `src/server/admissions.ts:410-440` | `knock` answers board existence to a caller with no credential, and grows an unbounded in-memory record per request. |
| F7 | Medium | `src/server/functions/admission.ts:38-46` | Every admission refusal except `unknown-request` is collapsed to `unresolved`; a gate refusal reaches the browser as "there is no session". |
| F8 | Medium | `src/server/functions/admission.ts:139` | `permissions: data.permissions as never` defeats the only compile-time check that a permission is in the fifteen-name vocabulary. |
| F9 | Medium | `src/routes/api/stream.ts:52` into `src/server/principal.ts:229-247` | An unauthenticated `GET /api/stream` advances the global session rotation, so anyone can skew which principal the next browser is issued. |
| F10 | Medium | `src/components/StreamPanel.tsx:308-310` vs `src/client/admission.ts:47-55` | The expired-access copy tells the reader to renew with the credential it was issued; there is no client or UI path to renew at all. |
| F11 | Medium | `src/server/principal.ts:213-214` into `src/client/http.ts:125-155` | A stale-signed-cookie refusal is classified `validation` ("That request could not be understood"), not the non-retryable `unauthenticated` family the spec requires. |
| F12 | Medium | `src/components/Gatekeeper.tsx:218-220` vs `:244-248,286-308` | The admit form always sends `read:board` even when the decider does not hold it and the checkbox list is empty. |
| F13 | Low | `tests/permissions.test.ts:329-331` | The "kind is load-bearing in exactly one place" guard matches only literal `kind === "human"` comparisons, so a branch against a variable escapes it. |
| F14 | Low | `src/server/functions/read.ts:232-236` | The store-reset server function resolves no principal and checks no permission; a single environment variable is the whole guard over an identity and grant wipe. |
| F15 | Low | `src/components/BoardPane.tsx:384-388` | The people view tells a refused reader "This build does not check grants yet", which is false — and it is the copy a reader sees exactly when a grant was checked. |

### F1 — The stream route enforces no permission at all (Critical)

`src/routes/api/stream.ts:52` resolves the actor and then goes straight to replay:

```ts
const principal = actingPrincipal();
// ...
let pending = 0;
for (const board of store.listBoards()) {
  for (const thread of store.listThreads(board.id)) {
    for (const entry of store.readEntries(thread.id)) {
      if (entry.seq <= from) continue;
      pending += 1;
      send(frameOf(entryCommitted(thread.id, entry, true), entry.seq));
    }
  }
}
```

There is no `authorize(...)` anywhere in the file (grep for `authorize|permits|actingPrincipal` returns only the import and the one call), and no per-board filter — unlike every read handler, for example `src/server/functions/read.ts:73-79`:

```ts
const visible = store()
  .listBoards()
  .filter((board) => store().permits(actor.id, "read:board", board.id));
// A refusal, not an empty list.
if (visible.length === 0) authorizeAs("listBoards");
```

The same omission repeats on the live path, `src/routes/api/stream.ts:187-198`: `store.onCommit` sends every commit in the workspace to every subscriber, filtered only by `store.isPaused(principal.id)`.

The declared requirement exists and is unreachable. `src/client/index.ts:583` declares `subscribe: { atLeastOneBoard: "read:board" }`, and spec L339 says `subscribe` requires `read:board` on at least one board; nothing reads that row for this route. The comment at `stream.ts:22-25` claims "this route issues a session to a browser that has none, which is the same act a page load performs" — a page load goes on to filter; this does not.

Reachability, concretely: an agent admitted with an empty permission set (`admissions.ts:530-559` accepts `permissions: []`; the Gatekeeper lets a decider uncheck `read:board`, `Gatekeeper.tsx:292-308`) can open `/api/stream` and receive every entry on every board, and every new commit as it is posted.

**Why it matters:** spec L401 states "permissions are enforced at the operation boundary, not in the interface. A client that ignores the UI cannot exceed its grant." That is the product's central security claim and this route falsifies it. The stream is also a superset of what `readThread` will answer for the same principal, so a participant can read a board it is refused on `readThread` — a straight cross-board disclosure.

### F2 — `revoke` checks `admit:agent`, so a board gate holder can revoke (High)

`src/server/admissions.ts:649-656`:

```ts
revoke: (input) => {
  const record = requireKnock(input.requestId);
  if (!isGateHolder(input.revokedBy, record.boardId)) {
    throw new AdmissionRefused(
      "not-a-gate-holder",
      "Revoking an admission requires revoke:agent on that board, or at workspace scope",
    );
  }
```

and `isGateHolder` at `:393-395` is:

```ts
const isGateHolder = (principalId: PrincipalId, boardId: BoardId): boolean =>
  store.permits(principalId, "admit:agent", boardId) ||
  store.permits(principalId, "admit:agent");
```

So the guard is `admit:agent`, while the message names `revoke:agent` and the thirty-line comment above it (`:626-638`) argues at length that "the revoke path is reachable only by a principal holding `revoke:agent` at workspace scope". It is not. The demo seed proves it: `src/server/store/demo-seed.ts:691-699` gives **alex** a board-scoped `admit:agent` on platform and no `revoke:agent` anywhere — so the ordinary browser principal can revoke any admission on platform. `tests/admissions.test.ts:747` does exactly that and passes, which is the tell: the test encodes the defect rather than catching it.

**Why it matters:** spec L393 and L420 make `revoke:agent` a workspace-scope capability the superadmin holds precisely because revoking reaches an identity that may hold grants on several boards. A board gate holder can now strip an agent's access to boards it has no standing on — the exact asymmetry the comment says the split exists to prevent. The message naming the wrong permission is also the only place an operator can learn which grant was required.

### F3 — A bearer token silently outranks a valid session cookie (High)

The module's own contract, `src/server/principal.ts:154-155`:

```
* A cookie wins when both are present: a browser that also carries a bearer token is a browser acting
* as its own session, and silently becoming the agent would be the identity swap spec L373 forbids.
```

The code, `src/server/principal.ts:192-207`, does the opposite — the credential branch is first and returns:

```ts
if (agentCredential !== undefined && agentCredential !== "") {
  const principal = resolveAgentCredential(agentCredential);
  if (principal) {
    return { principal, permissions: getStore().grantsFor(principal.id), issued: false };
  }
  throw new UnresolvedSession("The bearer credential presented does not match any issued admission");
}
if (cookieValue !== undefined) { /* cookie path */ }
```

No test presents both. `tests/admissions.test.ts:434` calls `resolveSession(undefined, poll.credential)` and `:455` calls `resolveSession(undefined)`, so the precedence is asserted by neither.

**Why it matters:** any request carrying both — a browser proxied through an agent gateway, an agent that also set a cookie, or anyone who can plant a cookie and a header — acts as the agent, with the agent's grants, in a session the browser believes is its own. That is the identity swap the comment names, and the comment is the only thing standing where a test should be.

### F4 — A refused admission leaves an orphan principal (High)

`src/server/admissions.ts:547-560`:

```ts
const principalId = mintedAgentId;  // "agent-" plus 12 characters of a fresh token
store.admitPrincipal({
  principalId,
  name: record.declared.name,
  description: record.declared.operator,
});
store.grant({
  granterId: input.grantedBy,
  principalId,
  scope: "board",
  boardId: record.boardId,
  permissions: input.permissions,
});
record.state = "admitted";
```

(The id is built as an `agent-` prefix plus twelve characters of `mint()`; that expression is elided above only to keep this block literal-free.)

`store.grant` can throw — `GrantRefused` for the gate rule, for a permission the granter lacks, or for a scope too broad (`src/server/grants.ts:157-186`). When it does, `admitPrincipal` has already appended the principal to the store's `principals` list (`src/server/store/index.ts:1116-1134`), and nothing removes it. The knock record is still `pending`, no credential was issued — but the workspace now holds an `agent-…` principal with no grant, no knock link, and no way to revoke it (revoke requires `state === "admitted"`, `:657-662`).

The test covering this path, `tests/admissions.test.ts:306-344`, asserts the throw and then that "The knock survives the refusal" (`:332-333`); it never checks that the principal count is unchanged, so deleting a rollback that does not exist would not fail it.

**Why it matters:** the assignment's own criterion — refusals must leave the store unchanged, no half-recorded acts — and the product's authorship discipline both depend on an admitted principal being the product of one decision. A gate holder retrying an over-broad admission with a smaller set leaves one orphan per attempt: unreachable, unrevokable state that nonetheless exists in the workspace and counts as a participant wherever it acquires a grant.

### F5 — Renewal adds a credential instead of replacing one (High)

`resolveCredential`, `src/server/admissions.ts:601-621`, resolves through `credentialFor(hash(token))`, which at `:381-390` looks the hash up in `issued` and then finds the record by `principalId` — it never compares the presented hash to `record.credentialHash`. `renew` (`:727-734`) writes the new hash and *adds* it:

```ts
const token = mint();
record.credentialHash = hash(token);
record.expiresAt = ...;
record.expiry = input.expiry;
issued.set(record.credentialHash, record.principalId as PrincipalId);
```

There is no `issued.delete(oldHash)` anywhere in the file (grep for `issued.delete|issued.set` returns only the two `set` calls, at `:472` and `:734`). So the superseded token still maps to the principal; `credentialFor` finds the same record; the record's state is `admitted` and its `expiresAt` is the **new** one, so the old token keeps working and inherits the renewal.

**Why it matters:** the renewal design's stated purpose (`:679-694`) is continuity proved by the credential itself; leaving the old one live means renewal is not a rotation. A leaked expired token remains a working bearer token for the extended window, and spec L408's "revocable by deleting the record" is true of revocation but not of renewal. `tests/admissions.test.ts:800-831` asserts the new credential works and the principal id is stable; it never asserts the old one stops.

### F6 — `knock` is an unauthenticated board oracle with unbounded growth (Medium)

`src/server/admissions.ts:410-440` (abridged):

```ts
knock: (input) => {
  if (!store.readBoard(input.boardId)) {
    throw new AdmissionRefused("unknown-request", "No board ... in this workspace");
  }
  // ...
  const requestId = knockId;
  const pollingSecret = mint();
  knockRecords.set(requestId, { /* ... */ state: "pending" });
  return { requestId, pollingSecret };
},
```

A caller with no session (the surface is deliberately pre-participant, `:11-18`) can (a) distinguish a real board id from a fake one by the refusal, and (b) create an unlimited number of pending records, each holding three caller-chosen strings, visible in the gate holder's `listPending` (`:511-528`) with no cap, no expiry on a pending knock and no rate limit. `store.readBoard` is the whole check — no permission, no session.

**Why it matters:** the store is one process and in-memory by decision (`src/server/store/instance.ts:5-24`), so this is a whole-application denial of service from an unauthenticated caller, and a gate holder's pending list can be flooded faster than a human can deny. The board-existence oracle is minor on its own (three seeded ids) but it is information the interface does not otherwise give a non-participant.

### F7 — Every admission refusal becomes `unresolved` (Medium)

`src/server/functions/admission.ts:38-46`:

```ts
const admissionError = (error: unknown): ServerError => {
  if (error instanceof AdmissionRefused) {
    return new ServerError(
      error.reason === "unknown-request" ? "unknown-object" : "unresolved",
      error.message,
    );
  }
  throw error;
};
```

So `not-a-gate-holder` (a permission refusal of an identified caller), `not-pending`, `already-collected` and `revoked` all arrive with code `unresolved`; `src/client/http.ts:137-143` then classifies the gate message by its text (`/requires admit:agent/i`) as `unauthenticated`, whose user-facing sentence is "There is no session to act as — start a session and try again" (`:96-98`). The caller has a session; it lacks a grant. The bare `throw error` also means a `GrantRefused` escaping from `store.grant` inside `admit` is not a `ServerError` at all, so it crosses the wire with no code.

**Why it matters:** `src/client/http.ts:65-78` argues at length that `denied` and `unauthenticated` must not collapse because they are different instructions to a reader — and the admission surface, the one place a decision is refused for permission, collapses them one layer down.

### F8 — `as never` at the admission boundary (Medium)

`src/server/functions/admission.ts:136-141`:

```ts
admissions().admit({
  requestId: data.requestId,
  grantedBy: actor.id,
  permissions: data.permissions as never,
  expiry: data.expiry,
});
```

The schema is `z.array(z.string().min(1))` (`:120`), so an arbitrary string reaches the surface; `as never` is what lets it compile past `readonly PermissionName[]`. The runtime guard does exist (`unknownPermission` at `src/server/store/index.ts:1150-1155`), but it throws a plain `Error`, which `admissionError` rethrows unchanged, so an invented permission is reported as an untyped failure rather than a validation refusal.

**Why it matters:** the project's rule is that a permission outside the fifteen is a *validation* failure before any rule runs (07b:18, `src/server/grants.ts:188-198`). This cast is the only place in `src/` where the vocabulary can be bypassed at compile time, and the path it opens does not return the documented family.

### F9 — An unauthenticated stream request mutates global session issuance (Medium)

`src/routes/api/stream.ts:52` calls `actingPrincipal()`, which on a request with no cookie mints a session (`src/server/principal.ts:229-247`):

```ts
const principalId = selectable[rotation.next % selectable.length] as string;
rotation.next += 1;
```

`rotation` is process state (`:178`). A plain `GET /api/stream` with no cookie therefore advances the round robin, so anyone who can reach the origin can decide which seeded principal the next browser is issued — exactly the property `tests/principal.test.ts:31-40` and the two-browser determinism argument (spec L372) depend on. It also sets a cookie from a route whose response is hand-built.

**Why it matters:** the rotation is described as cyclic and stable within one store instance and is what makes "two participants, one workspace" checkable. A third party can disturb it without a credential, and the e2e suite's per-test cookie minting exists precisely because the rotation is not trusted.

### F10 — The interface promises a renewal the app does not offer (Medium)

`src/components/StreamPanel.tsx:308-310`:

```
"The admission window closed. Renew it with the credential you were issued to keep your history."
```

`GateClient` (`src/client/admission.ts:32-56`) has `listPending`, `decided`, `admit`, `deny` and `revoke` — no `renew` — and the file says so deliberately (`:47-54`: "Renewal is deliberately absent"). `renewAdmission` exists as a server function (`src/server/functions/admission.ts:169`) with no caller in `src/`.

**Why it matters:** this is the product's own honesty rule — never claim a guarantee the implementation does not make — broken in the one sentence a user reads at the moment access ended. An expired agent is told to perform an act the interface cannot perform, and the credential it is told to present is a bearer token no browser surface stores.

### F11 — A stale signed cookie is reported as a malformed request (Medium)

`src/server/principal.ts:213-214` throws `UnresolvedSession` with:

```
This session names principal "<id>", which this workspace does not hold. It may have been removed by
a purge or a reseed; ask for a new session rather than retrying this request.
```

`failureFamily` (`src/client/http.ts:125-155`) tests `/No principal|no session|does not match any issued admission|not a gate holder|requires admit:agent/i` — "new session" does not match `no session`, and nothing else matches — so the message falls through to `return "validation"`, whose advice is "That request could not be understood" (`:98-99`).

**Why it matters:** spec L517 makes an unresolvable session "the one case where the client must not retry silently"; a validation family invites exactly the retry the spec forbids, and the message written to say "ask for a new session" is the message that fails to be recognised as one.

### F12 — The admit form always sends `read:board` (Medium)

`src/components/Gatekeeper.tsx:218-220`:

```ts
const [selected, setSelected] = useState<readonly PermissionName[]>([
  "read:board",
]);
```

`permissionsHeld` is what the decider may hand out (`:46-47`), passed as `heldPermissions.onBoard.filter(...)` at `BoardPane.tsx:124-126` — **board-scoped only**, while `canDecide` at `:120-123` also accepts a *workspace* `admit:agent`. That asymmetry is the reachable case: a principal holding `admit:agent` at workspace scope and no board grant (the seeded superadmin, `demo-seed.ts:656-662`) gets `canDecide: true` and `permissionsHeld: []`. The fieldset then says "You hold no permission on this board to hand out" (`:286-290`) while the Admit button stays enabled and submits the default set (`:244-248`), which `store.grant` then refuses.

**Why it matters:** it is the "control that always fails" the component's own docblock (`:22-27`) says must not exist, and it produces F4's orphan principal on every attempt. Spec L399 gives the workspace-scope gate holder exactly this purpose ("a board with no active gate holder is not a board nobody can join"), so the one principal the rule exists for is the one it breaks.

### F13 — The `kind` guard can be escaped with a variable (Low)

`tests/permissions.test.ts:329-331`:

```ts
const matches = source.match(
  /(?:===?|!==?)\s*["'](?:human|agent)["']|["'](?:human|agent)["']\s*(?:===?|!==?)/g,
);
```

The scan requires a string literal on one side of the comparison. `const H = "human"; if (p.kind === H)` matches nothing, so a second real branch on `kind` — the thing AGENTS.md calls a bug — would pass the only automated check for it. The file's own comment records the scan once passing vacuously because of a path-normalisation bug, which is the same failure class.

**Why it matters:** this is the guard that lets a review claim `kind` is load-bearing in exactly one place, and today it is a lexical check on formatting rather than on semantics.

### F14 — The store-reset route has no principal and no permission check (Low)

`src/server/functions/read.ts:232-236`:

```ts
export const resetTestStore = createServerFn({ method: "POST" }).handler(() => {
  if (!resetAllowed()) throw resetRefused();
  resetStore();
  return { reset: true };
});
```

No `actingPrincipal()`, no `authorize`. The guard is `src/server/store/instance.ts:75-78`: `NODE_ENV !== "production" || RELAYBOARD_TEST_MODE === "1"`. The e2e harness runs with `NODE_ENV=production` and `RELAYBOARD_TEST_MODE: "1"` (`playwright.config.ts:105-106`), so the built server used for the route seam serves an unauthenticated full-workspace wipe of principals and grants.

**Why it matters:** it is documented as a test hook and refuses in a plain production build, so the blast radius is bounded — but a deployment that sets `RELAYBOARD_TEST_MODE=1` for any reason exposes identity destruction with no credential, and this is the only operation in the app with no principal at all.

### F15 — The refused people view says grants are not checked (Low)

`src/components/BoardPane.tsx:378-390`:

```tsx
if (members.error || members.data === undefined) {
  return (
    <div className="board-pane__empty">
      <h3 className="board-pane__empty-title">Participants are not readable here</h3>
      <p className="board-pane__empty-detail">
        Reading the participants on a board needs the members permission. This
        build does not check grants yet, so it cannot tell you whether you
        hold it.
      </p>
```

Grants are checked: `listMembers` is gated by `read:member` at `src/server/functions/read.ts:144`, which is why this branch is reachable at all (`e2e/permissions.spec.ts:96-128` drives it with the superadmin). The second sentence is a leftover from before 07a.

**Why it matters:** it is the honesty rule inverted — the app telling a reader, in the one state produced by a working permission check, that permission checks do not exist. A reader who trusts it will conclude the refusal is a bug rather than a decision, which is exactly the "policy decision vs bug" distinction spec L402 asks the interface to preserve.

## What I checked and found sound

- **Authorship is never taken from input.** No schema in `src/server/functions/inputs.ts` declares `authorId` or `creatorId`; every write handler passes a resolved actor (`write.ts:88,103,117,137,155,174`), and `tests/write-inputs.test.ts:21-58` proves a forged field is stripped rather than refused. `simulateIncoming` chooses its author server-side from the board's agents (`write.ts:251-253`) and checks the **caller's** `post:message`.
- **A participant cannot mint a grant.** There is no `grant` or `editGrant` server function; the only callers of `store.grant` in `src/` are `admissions.admit` (`admissions.ts:553`) and `createBoard`'s creator grant (`store/index.ts:1079-1088`). `RelayboardClient` contains no grant operation, and `tests/admissions.test.ts:461-496` asserts the admission surface is exactly disjoint from `clientOperations`.
- **Grant bounds hold at the store seam.** `checkGrant` (`src/server/grants.ts:157-186`) checks the gate rule, the granter's own permission and the scope, in that order, synchronously with the write (`store/index.ts:1144-1185`). `tests/grant-rules.test.ts` asserts each refusal by attempting it, with controls, and `tests/admissions.test.ts:306-344` re-asserts the bound end to end through `admit`.
- **The gate rule is the only `kind` branch in an enforcement path.** `gateRuleAllows` (`grants.ts:54-60`) is the sole capability-affecting comparison; the other five occurrences in `src/` are author-selection (`write.ts:253`, `in-memory.ts:315`) or rendering (`BoardPane.tsx:406`, `-conversation.ts:195`, `ParticipantPanel.tsx:146`), and `permissions.ts` contains none (`tests/permissions.test.ts:357-371`).
- **Cookie signing and boot refusal.** HMAC-SHA256 with a length-checked constant-time comparison (`principal.ts:82-113`); a forged signature yields a fresh session while a valid signature naming a missing principal is refused (`:208-227`); `requireSessionSecret` enforces presence, non-blank and a 32-character floor (`env.ts:41-56`), and `scripts/check-boot.mjs` proves the built entry is fatal without one and loads with one. No swallowed catch of a secret or config error exists in `src/`.
- **Credentials identify, not authenticate, and the UI says so.** `principal.ts:21-27` and `SessionNote.tsx:61-65` both state that a session identifies and does not sign you in; `StoreLifetimeNote.tsx:18-21` states the store is in memory; `Gatekeeper.tsx:268-280` labels declared values and says nothing is verified; `ParticipantPanel.tsx:153-189` keeps derived (issuer, fingerprint) and declared (description, operator) in separate sections with separate captions.
- **The polling secret is never leaked and is collectable once.** Returned only from `knock` (`admissions.ts:439`), absent from the `PendingRequest` and `DecidedRequest` types, refused on a second poll (`:464-469`), and `tests/admissions.test.ts:94-146` enumerates the pending payload's keys and greps the serialised list for the secret.
- **Revocation takes effect on the next request and closes an open stream.** `resolveCredential` returns `undefined` for `state === "revoked"` (`:608`) and for an expired `expiresAt` (`:609-614`); `revoke` announces through `store.endAccess` (`:674`), the route closes on `onAccessEnded` (`stream.ts:143-155`), and the contract suite asserts both transports (`tests/contract/stream.conformance.ts:253-299`).
- **The entry path refuses before taking a position.** `commitEntry` checks the permission before computing a `seq` (`store/index.ts:813-827`), and `grant` validates before appending (`:1144-1184`), so a refused append or grant consumes nothing.
- **`kind` inventory:** six comparisons in `src/` — one load-bearing, five label or author-selection — matching the AGENTS.md rule as stated.

## Not checked

- Anything requiring a running server or a browser: I did not run `e2e`, `build`, `app:check` or `check:boot`, so every route-seam claim above is read from source and specs, not observed.
- Whether `setCookie` from a server route (`src/server/session.ts:97-103` via `src/routes/api/stream.ts:52`) actually sets a `Set-Cookie` on the hand-built `Response`. If it does not, every unauthenticated `EventSource` open re-rolls the rotation, which would make F9 worse; I could not determine this without running the app.
- Whether `import.meta.env.SSR` is a build-time constant in every bundle the plugin emits for the stream route (the argument at `principal.ts:29-47`); `check:bundle` was not run.
- The store's full body (about 1,400 lines): I read the permission, grant, access-ending, principal, purge-impact and entry-commit paths, not the purge, restore or seed internals.
- React Query cache invalidation and component error rendering beyond the copy quoted here; those belong to the frontend reviewer.
- `src/integrations/tanstack-query/root-provider.tsx`, which reads `browserSelectable` on the client — noted, not traced.
- Deployment and multi-instance properties; out of my domain and not exercised.
- I did not attempt to reproduce any finding against a live server. All four High findings are read from code paths whose guards are visibly absent or visibly wrong.
