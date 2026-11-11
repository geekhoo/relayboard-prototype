---
name: relayboard-mock-api
description: >-
  Use when calling the Relayboard client to list boards and threads, read or
  append entries, create a board or thread, add or attach a resource, move a
  thread's status, acknowledge, or change the stream's connection — and when
  deciding which permission an operation needs and what the store does and does
  not persist. Covers the operation vocabulary, the entry kinds, the refusal
  families and the demo-origin boundary; use relayboard-thread-sequencing for
  read ordering and watermarks, and relayboard-identity for authorship.
metadata:
  purpose: >-
    Call the app's client correctly: the operation vocabulary a caller actually
    has, the entry kinds one chronology holds, the permission each operation
    requires, the refusal families it can return, and the guarantees the
    in-memory store deliberately omits.
  type: core
  library: '@relayboard/skills'
  library_version: 0.1.0
sources:
  - 'docs/mock-api.md'
  - 'docs/thread-sequencing.md'
---

# The Relayboard client

Relayboard's application is a TanStack Start app under `apps/relayboard-web`. Its
client is an interface — `RelayboardClient` in `src/client/index.ts` — with an HTTP
implementation over server functions and Server-Sent Events, and an in-memory
implementation the tests drive. **There is no `window.RelayboardMockAPI`**: the
prototype that had one is retired as a reference and no longer the thing to code
against. Field-level detail is in [docs/mock-api.md](../../docs/mock-api.md).

## Setup

Every operation is a promise, including the reads, because the real one is over the
wire. Do not assume the in-memory implementation's immediacy.

```ts
interface RelayboardClient {
  // the prototype's nine, carried forward in name and intent
  listBoards(): Promise<readonly BoardSummary[]>
  listThreads(boardId: BoardId): Promise<readonly Thread[]>
  readMessages(threadId: ThreadId, options?: { after?: Seq }): Promise<readonly Entry[]>
  appendMessage(input: AppendMessageInput): Promise<Entry>
  createThread(input: CreateThreadInput): Promise<Thread>
  createBoard(input: CreateBoardInput): Promise<BoardSummary>
  addResource(input: AddResourceInput): Promise<Resource>
  setConnection(input: SetConnectionInput): Promise<StreamState>
  simulateIncoming(threadId: ThreadId): Promise<Entry>

  // a thread as a chronology, and the resources it points at
  readThread(threadId: ThreadId): Promise<ThreadContents>
  listResources(boardId: BoardId): Promise<readonly Resource[]>

  // the authored acts beyond a message
  attachResource(input: AttachResourceInput): Promise<Entry>
  moveStatus(input: MoveStatusInput): Promise<Entry>
  acknowledge(input: AcknowledgeInput): Promise<Entry>

  // progress, participants, and the demo boundary
  readPositions(threadId: ThreadId): Promise<readonly PrincipalPosition[]>
  listMembers(boardId: BoardId): Promise<readonly PrincipalSummary[]>
  readPrincipal(input: { principalId: PrincipalId; boardId: BoardId }): Promise<ParticipantRead>
  purgeImpact(): Promise<PurgeImpact>
  purgeDemoContent(input: { confirmed: true }): Promise<PurgeImpact>
  restoreDemoContent(): Promise<{ restored: number }>
}
```

**Nothing takes an `authorId`.** Authorship is resolved server-side from the session,
so a caller cannot say who spoke. The prototype's
`appendMessage({ threadId, authorId, text, idempotencyKey })` was superseded; a call
that passes an author is a call written against the old shape.

```ts
const post = (client: RelayboardClient, text: string): Promise<Entry> =>
  client.appendMessage({ threadId: 'delivery', text, idempotencyKey: 'submit-demo-1' })
```

## Core patterns

### Ask for the permission you need, before you call

Every operation declares the permission it requires, in `operationPermissions` — a
table that is exhaustive by type over `ClientOperation`, so an operation without a
line does not compile. Read it rather than guessing, and read it *before* rendering a
control: a control a reader may not use is disabled **with the missing permission
named beside it**, never hidden.

```ts
// The two shapes a requirement can take, and the distinction that matters:
//   a bare string        -> a WORKSPACE permission, resolved with no board scope
//   { atLeastOneBoard }  -> a BOARD question: "held on some board"
// Naming a workspace permission with the shaped form refuses the very principal it
// was granted to. That mistake has been made twice in this repository.
```

The vocabulary is fifteen names, and there is one implication:
`read:board` yields `read:thread` and `read:resource` at the same scope. Nothing
implies a write. `PRODUCT.md`'s permission table is the authoritative list.

### One chronology, four kinds of entry

A thread is a chronology of **entries**, not a list of messages. `Entry` is a union:
`message`, `artifact`, `status-move`, `acknowledgement`. Every one carries a `seq`, an
`authorId`, a `createdAt` and an `origin`. A `message` additionally carries `text` and
`references`; an `artifact` carries `resourceId` and nothing else about the resource.

```ts
const textOf = (entry: Entry): string =>
  // Narrow by the discriminant; never cast. An act's detail lives in its own fields.
  entry.kind === 'message' ? entry.text : ''
```

Narrow with the discriminant. A display that treats every entry as prose will render
three of the four kinds as blank rows, and a display that ranks them has invented a
hierarchy the model does not carry.

### Reference a resource by id, never by URL or content

A message's `references` hold `{ resourceId }` wrappers and an artifact holds a
`resourceId`; both resolve against `listResources(boardId)`. The resource is the
canonical object and the entry points at it — never copy its content into a thread,
and never treat a missing id as a reason to invent one. A message with references
shows them exactly as an artifact shows its own: same chip, same canonical href.

### Expect a refusal with a family, not just a message

A failed operation returns an error carrying a **family** as well as a message, so a
caller can tell a permission refusal from a validation failure without reading the
string. Render the family's sentence; do not parse the text.

```ts
// An append can fail with three strings, in this order — a caller that got two things
// wrong learns about the first one only:
//   'Thread not found'
//   'This participant is not a board member'
//   'Message cannot be empty'
// A rejected append never consumes a sequence number.
//
// The same module holds the rest of the vocabulary: 'This participant does not hold the
// permission that action requires', 'No such resource on this board', "This thread's
// status changed since you read it", 'This thread is already in that status', and the two
// acknowledgement bounds. They live in `src/domain/errors.ts` — one place, so a caller
// and a test assert the same literal.
```

`idempotencyKey` is optional, and a retry should supply the original one. The lookup runs **before** those checks, so a replay of a stored key
returns the stored entry even if the thread would now fail validation. On failure,
**keep the key**: a retry must replay, and a fresh key makes the retry a second post.

### Demo content is demo-origin, and it can be purged

Every record carries `origin`: `demo` for what a workspace seeded, `owner` for what a
reader made. The purge removes `demo` records and leaves the reader's own, and it
reports the **overlap** — entries the reader authored on demo boards — before it runs.
Code that reads a seeded board should therefore expect the purge rather than be
surprised by it, and should not treat `origin` as a permission: it decides what a
purge removes and nothing else.

### The store is in memory, and every surface should say so

A restart clears the workspace. `restoreDemoContent()` brings the demo back without
duplicating what survived, and that is the only recovery there is. No distributed
durability, no broker acknowledgement, no cross-device sync, no authentication (a
credential identifies; it does not prove), and no agent execution.

## Common mistakes

- **Passing an author.** `appendMessage({ authorId })` is the superseded signature.
  The server resolves the author from the session, and an author on the wire would be a
  caller choosing its own attribution.
- **Assuming creation inputs are honoured.** `createBoard` grants its **creator** the
  board's member set and nothing else; `createThread` records its creator. Read the
  returned record rather than the input you passed.
- **Treating a thread as messages.** Four kinds share one chronology and one sequence.
- **Reaching for methods that do not exist.** There is no `updateMessage`,
  `deleteMessage`, `deleteThread`, `deleteBoard`, `removeResource`, or auth parameter.
  Corrections are new entries.
- **Presenting the client as a service.** In-memory store, identifying credential, purgable
  demo seed. `README.md` and `PRODUCT.md` exclude the rest permanently.

## Completion

You are done when every call goes through `RelayboardClient`, no call passes an author,
every gated control is disabled with its permission named rather than hidden, entries are
narrowed by kind rather than assumed prose, retries reuse their original key, no
resource content is copied into a thread, and nothing in your change or copy claims
durability beyond one process.
