# The Relayboard client and its operations (source documentation)

Ground truth for the `relayboard-mock-api` skill. Read from
`apps/relayboard-web/src/client/index.ts` (the interface and its table),
`src/domain/errors.ts` (the refusal vocabulary), `src/domain/grants.ts` (the
permission names and the one implication), `src/server/store/index.ts` (the
in-memory store), and `PRODUCT.md` (the capability table).

**The prototype's `window.RelayboardMockAPI` is retired as a reference.** This
document described it before the port reached parity; it now describes the
application, which is what a caller codes against. `app.js` is kept at the
repository root as the behavioural reference the parity suite was written from.

## Shape

`RelayboardClient` is an interface with two implementations: `client/http.ts` over
server functions and Server-Sent Events (what ships), and `client/in-memory.ts` (what
some tests drive). Every member returns a promise, including the reads, because the
real one is over the wire.

| Operation | Signature | Requires | Returns |
| --- | --- | --- | --- |
| `listBoards` | `()` | `read:board` | `BoardSummary[]` |
| `listThreads` | `(boardId)` | `read:board` | `Thread[]`, newest activity first |
| `readMessages` | `(threadId, { after? })` | `read:board` | `Entry[]` with `seq > after`, ascending |
| `appendMessage` | `({ threadId, text, idempotencyKey? })` | `post:message` | `Entry` |
| `createThread` | `({ boardId, title, description? })` | `create:thread` | `Thread` |
| `createBoard` | `({ name, description? })` | `create:board` (workspace) | `BoardSummary` |
| `addResource` | `({ boardId, name, url, type, description })` | `add:resource` | `Resource` |
| `setConnection` | `({ connected })` | `read:board` on some board | `StreamState` |
| `simulateIncoming` | `(threadId)` | `post:message` | `Entry`, authored server-side |
| `readThread` | `(threadId)` | `read:board` | `ThreadContents` (record + entries) |
| `listResources` | `(boardId)` | `read:board` | `Resource[]` |
| `attachResource` | `({ threadId, resourceId })` | `add:artifact` | `Entry` |
| `moveStatus` | `({ threadId, from, to })` | `move:status` | `Entry` |
| `acknowledge` | `({ threadId, upTo })` | `acknowledge:thread` | `Entry` |
| `readPositions` | `(threadId)` | `read:board` | `PrincipalPosition[]` |
| `listMembers` | `(boardId)` | `read:member` | `PrincipalSummary[]` |
| `readPrincipal` | `({ principalId, boardId })` | `read:member` | `ParticipantRead` |
| `purgeImpact` | `()` | `create:board` (workspace) | `PurgeImpact` |
| `purgeDemoContent` | `({ confirmed: true })` | `create:board` (workspace) | `PurgeImpact` |
| `restoreDemoContent` | `()` | `create:board` (workspace) | `{ restored }` |

**No operation takes an author.** The server resolves the acting principal from the
session, so `appendMessage({ authorId })` — the prototype's signature — is a call written
against a shape that no longer exists and is refused by the input schema.

## Record shapes

```ts
Entry = MessageEntry | ArtifactEntry | StatusMoveEntry | AcknowledgementEntry

// every entry
{ id, seq, authorId, createdAt, origin: 'demo' | 'owner', relation? }

MessageEntry         { kind: 'message', text, references: { resourceId }[] }
ArtifactEntry        { kind: 'artifact', resourceId }
StatusMoveEntry      { kind: 'status-move', from: 'open'|'resolved', to }
AcknowledgementEntry { kind: 'acknowledgement', upTo }

ParticipantRead {
  principal: { id, name, kind: 'human' | 'agent', description };
  grant: { scope, boardId?, permissions: PermissionName[] };
  declared: { description, operator?, reason? };
  derived?: { issuer, fingerprint };   // absent unless this workspace admitted it
}
```

Three shape facts that bite callers:

- **`Entry` is a union with four members.** `text` exists on `message` alone; `resourceId`
  on `artifact` alone. Narrow by `kind`; a cast hides the three kinds that do not have the
  field you asked for.
- **References are `{ resourceId }` wrappers, not URLs.** Resolve them against
  `listResources(boardId)`; a reference to an unknown id is a board-scope violation and
  the store refuses to create one, so an unresolvable id means stale data rather than a
  licence to invent a chip.
- **`derived` is optional and its absence is meaningful.** A principal this workspace did
  not admit has no admission record; inventing an issuer or fingerprint for one would be a
  derivation from nothing.

## Validation and error behaviour

Refusals come from `src/domain/errors.ts`, and the interface carries the **family** beside
the message so a caller can tell a permission refusal from a validation failure without
reading the string.

An `appendMessage` checks three things, in this order — a caller that got two of them
wrong learns about the first only:

1. `Thread not found`.
2. `This participant is not a board member`.
3. `Message cannot be empty` — the text was empty or whitespace.

The rest of the vocabulary, all in the same module: `Board not found`;
`This participant does not hold the permission that action requires` (the permission
refusal, whose name travels beside it rather than inside it);
`No such resource on this board`; `This thread's status changed since you read it`;
`This thread is already in that status`; `That is not a status a thread can be in`; the
two acknowledgement bounds; and the grant/admission strings.

Two ordering facts:

- The `idempotencyKey` lookup runs **before** the validation checks, so a replay of a
  stored key returns the stored entry even if the thread would now fail validation.
- A rejected append never consumes a sequence number: `seq` is computed from the thread's
  last position and the entry is not pushed.

## Permissions

`operationPermissions` in `src/client/index.ts` maps every operation to what it requires,
and is exhaustive by type over `ClientOperation` — an operation without a line does not
compile. Three shapes:

- **a bare name** (`"create:board"`) — a **workspace** permission, resolved with no board
  scope;
- **`{ atLeastOneBoard: name }`** — a **board** question, "held on some board";
- **`{ none: reason }`** — nothing required, with the reason.

**Naming a workspace permission with the board-shaped form refuses the very principal it
was granted to.** That mistake has been made twice here — once in the gate's bound read
and once in the purge control — and both were caught by a real principal being refused.

The vocabulary is fifteen names. Exactly one implication: `read:board` yields
`read:thread` and `read:resource` at the same scope. Nothing implies a write, and
`read:member` does not come with `read:board`.

## Persistence

**The store is in memory, for the process.** A restart clears the workspace, including
anything a reader posted; the interface says so wherever a destructive act is confirmed.
`localStorage` holds one thing and only one: the remembered board and thread, so the
address can be restored — never the data.

`restoreDemoContent()` re-seeds the demo records without duplicating what survived a
purge, and it is the only recovery there is.

## The stream

Delivery is Server-Sent Events at `/api/stream`. A connection carries the reader's
`cursor`; `Last-Event-ID` or `?after=` resumes from a position. There are **eight wire
event names**, and `connection-changed` carries the connected flag and the pending count.

Pausing is **server state**, not a view flag: the cursor stops advancing, entries keep
committing, and resuming replays the difference. A pause that lived only in the browser
would leave the cursor advancing, so `pending` would always be `0` and a resume would
replay nothing — which is why the store holds it.

When a principal's access ends, every open connection for it is closed with a cause, and
the client distinguishes "the workspace went away" from "your access ended".

## Demo origin

Every record carries `origin`: `demo` for what a workspace seeded, `owner` for what a
reader made. `purgeImpact()` names what a purge would remove, including the **overlap** —
entries the reader authored on demo boards, which go with the boards they belong to — and
`purgeDemoContent({ confirmed: true })` removes the demo records and nothing else.

`origin` is consulted in exactly one place in the product: the purge. It is not a
permission and must not be used as one.

## What the client does not do

No agent execution, task assignment, workflows, orchestration, model selection or tool
invocation. No authentication: a credential **identifies**, it does not prove, and anyone
holding the cookie acts as that principal. No durable storage, no distributed
durability, no broker acknowledgement, no cross-device sync. `PRODUCT.md` excludes all of
these permanently.

## Checklist

- [ ] Every call goes through `RelayboardClient`; no module from `src/server/` is imported.
- [ ] No call passes an author.
- [ ] Entries are narrowed by `kind` rather than cast.
- [ ] A gated control is disabled **with its permission named beside it**, never hidden.
- [ ] A refusal is rendered from its family, not parsed out of the message text.
- [ ] A retry reuses its original `idempotencyKey`.
- [ ] Nothing claims durability beyond one process.
