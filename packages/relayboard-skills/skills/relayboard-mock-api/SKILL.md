---
name: relayboard-mock-api
description: >-
  Use when calling window.RelayboardMockAPI in the Relayboard prototype to list
  boards and threads, post or simulate messages, create boards and threads, add
  resource links, or toggle the simulated stream — and when deciding what the
  mock does and does not persist. Covers method shapes, error messages and
  localStorage behaviour; use relayboard-thread-sequencing for read ordering
  and cursors.
metadata:
  purpose: >-
    Call the prototype's asynchronous mock client correctly: the nine method
    signatures, the record shapes they return, the exact errors they throw, the
    localStorage key and reset, and the guarantees the mock deliberately omits.
  type: core
  library: '@relayboard/skills'
  library_version: 0.1.0
sources:
  - 'docs/mock-api.md'
  - 'docs/thread-sequencing.md'
---

# Relayboard mock API

`window.RelayboardMockAPI` is a plain object of nine async functions attached by
`app.js`. It is the prototype's intended seam for a real backend: keep its
signatures, do not assume its guarantees. Field-level detail, error ordering
and storage behaviour are in [docs/mock-api.md](../../docs/mock-api.md).

## Setup

Call the global from page code; there is nothing to import. Every method awaits
a simulated latency, so treat all calls as pending network work.

```ts
interface MockMessage {
  readonly id: string
  readonly threadId: string
  readonly boardId: string
  readonly seq: number
  readonly authorId: string
  readonly text: string
  readonly references: readonly { readonly resourceId: string }[]
  readonly createdAt: string
}

interface MockApi {
  listBoards(): Promise<readonly { readonly id: string; readonly name: string }[]>
  appendMessage(input: {
    readonly threadId: string
    readonly authorId: string
    readonly text: string
    readonly idempotencyKey: string
  }): Promise<MockMessage>
}

declare const api: MockApi

const post = async (): Promise<MockMessage> =>
  api.appendMessage({
    threadId: 'delivery',
    authorId: 'alex',
    text: 'Cursor checkpoint acknowledged.',
    idempotencyKey: 'submit-demo-1',
  })
```

## Core patterns

### Post with a stable idempotency key

Deduplication is keyed by the caller's string. Generate one key per user
intent, keep it for the retry, and let the mock return the original message.

```ts
const sendOnce = async (
  api: MockApi,
  key: string,
  text: string,
): Promise<{ readonly seq: number; readonly replayed: boolean }> => {
  const first = await api.appendMessage({
    threadId: 'delivery',
    authorId: 'alex',
    text,
    idempotencyKey: key,
  })
  const again = await api.appendMessage({
    threadId: 'delivery',
    authorId: 'alex',
    text,
    idempotencyKey: key,
  })
  return { seq: first.seq, replayed: first.id === again.id }
}
```

### Reference a resource by id, not by URL

`Message.references` holds `{ resourceId }` wrappers resolved against the
board's `resources`. A reference to an unknown id renders nothing at all.

```ts
const reference = (resourceId: string): { readonly resourceId: string } => ({ resourceId })
```

### Expect these errors verbatim

`appendMessage` throws `Error('Thread not found')`, then
`Error('This participant is not a board member')`, then
`Error('Message cannot be empty')` — in that order. `addResource` throws
`Error('Board not found')`; `simulateIncoming` throws
`Error('Select a thread first')`. Match on the message text; there are no error
codes.

One ordering detail matters: the `idempotencyKey` lookup runs **before** any of
those checks, so a replay of a stored key returns the stored message even if the
thread would now fail validation. A rejected message never consumes a sequence
number, because `seq` is computed but the message is not pushed.

```ts
const isMembershipError = (error: unknown): boolean =>
  error instanceof Error && error.message === 'This participant is not a board member'
```

### Reset the demo deliberately

State lives in `localStorage['relayboard-demo-v3']` as a single `version: 3`
document. A version mismatch or unparsable JSON silently reseeds demo data.

```ts
const resetRelayboardDemo = (): void => {
  localStorage.removeItem('relayboard-demo-v3')
  location.reload()
}
```

## Common mistakes

- **Assuming creation inputs are honoured.** `createBoard` overrides `short`,
  `theme: 'blue'`, a fixed member list and an empty `resources` array;
  `createThread` always sets `creator: 'alex'`; `addResource` always sets
  `type: 'Link'`. Read the returned record instead of the input you passed.
- **Subscribing to the API's custom events.** `message-committed`,
  `thread-created`, `board-created`, `resource-created` and
  `connection-changed` are dispatched on an internal `EventTarget`, not on
  `window`. Re-read through the API after awaiting a mutation instead.
- **Expecting a write error to surface when storage is full.** `save()` wraps
  `localStorage.setItem` in `try/catch` and keeps an in-memory demo running, so
  a persistence failure is invisible unless you check storage yourself.
- **Reaching for methods that do not exist.** There is no `updateMessage`,
  `deleteMessage`, `deleteThread`, `deleteBoard`, `removeResource`, or auth
  parameter. Corrections are new messages.
- **Presenting the mock as a service.** No distributed durability, broker
  delivery guarantees, authentication, cross-device sync, or agent execution —
  `README.md` and `PRODUCT.md` exclude all of them permanently.

## Completion

You are done when every call goes through `window.RelayboardMockAPI`, retries
reuse their original idempotency key, errors are matched by their documented
message text, references are `{ resourceId }` wrappers, and nothing in your
change or copy claims persistence beyond one browser profile.
