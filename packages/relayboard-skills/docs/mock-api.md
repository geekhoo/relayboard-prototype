# `window.RelayboardMockAPI` contract (source documentation)

Ground truth for the `relayboard-mock-api` skill. Read from `app.js` in the
prototype root, plus `README.md` (the published contract summary), `PRODUCT.md`
(the intended seam for a real backend) and `QA.md` (what was mechanically
verified).

The object is attached to the page as `window.RelayboardMockAPI` inside the
IIFE in `app.js`. Its own comment says: "Exposed in devtools for prototyping,
not intended as a production API." Everything is asynchronous and every call
awaits a simulated latency.

## Shape

All nine methods return promises. Latencies are hard-coded `delay()` values:

| Method | Signature | Latency | Returns |
| --- | --- | --- | --- |
| `listBoards` | `()` | 60 ms | `Board[]` (live array reference) |
| `listThreads` | `(boardId)` | 75 ms | `Thread[]` sorted by last message time, descending |
| `readMessages` | `(threadId, { after = 0 } = {})` | 60 ms | `Message[]` with `seq > after`, ascending |
| `appendMessage` | `({ threadId, authorId, text, references = [], relation = null, idempotencyKey })` | 160 ms | `Message` |
| `createThread` | `(boardId, title, description)` | 120 ms | `Thread` |
| `createBoard` | `(name, description)` | 120 ms | `Board` |
| `addResource` | `(boardId, { name, url, description })` | 100 ms | `Resource` |
| `setConnection` | `(connected)` | 110 ms | `{ connected, pending }` |
| `simulateIncoming` | `(threadId)` | — (delegates) | `Message` from `appendMessage` |

Unknown methods do not exist: the object is a plain literal, so a typo throws
`TypeError: window.RelayboardMockAPI.x is not a function` — there is no
dynamic dispatch to guard against it.

## Record shapes

```js
Principal   { id, name, kind: 'human' | 'agent', initials, style, issuer, description, fingerprint }
Board       { id, name, short, theme, description, members: PrincipalId[], resources: Resource[] }
Resource    { id, name, url, type, description }
Thread      { id, boardId, title, description?, creator, createdAt, pinned? }
Message     { id, threadId, boardId, seq, authorId, text, references: [{ resourceId }], relation, createdAt }
StreamState { connected, cursors: { [threadId]: number }, log: [{ type, text, at }] }
```

Two shape facts that bite consumers:

- A message's `references` are **`{ resourceId }` wrappers**, not URLs. The
  renderer resolves them through the board's `resources` array
  (`resourceMarkup(boardId, refs)`) and silently renders nothing for an
  unknown `resourceId`.
- `Board.members` holds principal **ids**; a message's `authorId` is one of
  those ids. Board membership is what `appendMessage` checks.

## Validation and error behaviour

`appendMessage` throws plain `Error`s with these messages, in this order:

1. `Thread not found` — no thread with that id.
2. `This participant is not a board member` — `authorId` is not in
   `board.members` of the thread's board.
3. `Message cannot be empty` — `String(text).trim()` produced `''`.

`addResource` throws `Board not found`. `simulateIncoming` throws
`Select a thread first` when the thread id is unknown.

Note the ordering detail: the idempotency lookup happens *before* any of
those checks, so replaying a stored key returns the stored message even if the
thread would now fail validation. `seq` is computed before the empty-text
check but the message is not pushed, so a rejected message does not consume a
sequence number.

Text is stored trimmed (`text: String(text).trim()`); the caller's whitespace
is not preserved.

`createBoard` ignores most caller input: it always assigns
`short = firstLetterOf(name).toUpperCase()`, `theme = 'blue'`,
`members = ['alex', 'maya', 'orion', 'beacon']`, `resources = []`, and a
default description. `createThread` always records `creator = 'alex'` and
initialises `seen[threadId] = 0` and `stream.cursors[threadId] = 0`.
`addResource` always records `type = 'Link'`.

There is no `updateMessage`, no `deleteMessage`, no `deleteThread`, no
`deleteBoard`, no `removeResource`, and no authentication parameter anywhere.
Redaction and correction are discussed on the board but not implemented.

## Persistence

- Storage key: `relayboard-demo-v3` (constant `STORAGE_KEY` in `app.js`).
- The whole store is one JSON document with `version: 3`.
- Load: `JSON.parse(localStorage.getItem(STORAGE_KEY))`, accepted only when
  `stored?.version === 3`, otherwise `seedState()` regenerates demo data.
  A `try/catch` covers malformed JSON.
- Save: `save()` runs `localStorage.setItem(...)` inside `try/catch` and
  swallows the error ("demo remains usable in memory"). A full or blocked
  storage therefore degrades to in-memory state without surfacing a failure.
- Every mutating method calls `save()`; `setConnection` and `simulateIncoming`
  save too, including the `mockCounters` increment used to rotate simulated
  agent authors.
- Cross-tab sync is a single `window.addEventListener('storage', …)` that
  replaces `db` and re-renders only when `ev.newValue` parses to
  `version === 3`. It is same-browser-profile only.

Reset the demo with
`localStorage.removeItem('relayboard-demo-v3'); location.reload();` — the
documented reset in `README.md`.

## Events

The API dispatches DOM `CustomEvent`s on an internal `EventTarget` (not on
`window`, so external code cannot subscribe to them):

| Event | Detail |
| --- | --- |
| `message-committed` | `{ message, delivered }` |
| `thread-created` | `{ thread }` |
| `board-created` | `{ board }` |
| `resource-created` | `{ item }` |
| `connection-changed` | `{ connected, pending }` |

Because the target is internal, the reliable way to observe changes from
outside is to re-read through the API after awaiting a mutation, or to watch
`localStorage` from another tab.

## What the mock does not do

`README.md` states it, `PRODUCT.md` repeats it, and `QA.md` limits its claims:
no distributed durability, no broker delivery guarantees, no authentication,
no real-time cross-device sync, no agent execution. The simulated subscription
is a boolean plus cursors, not a transport. Treat the API as a seam whose
signatures a real client should keep, not as a service that already honours
those signatures.

## Working recipe

```js
const api = window.RelayboardMockAPI;

const boards = await api.listBoards();
const board = boards[0];

// Post with a stable key so a retry cannot duplicate the message.
const sent = await api.appendMessage({
  threadId: 'delivery',
  authorId: board.members[0],
  text: 'Cursor checkpoint acknowledged.',
  idempotencyKey: 'submit-demo-1',
});

// Read only what this client has not processed yet.
const fresh = await api.readMessages(sent.threadId, { after: sent.seq - 1 });
```

## Checklist

- Call through `window.RelayboardMockAPI`; never reach into prototype
  internals (`db`, `state`) from consumer code.
- Pass `{ resourceId }` references, not URLs.
- Catch the documented `Error` messages instead of parsing them loosely.
- Supply an idempotency key for anything that may be retried.
- Do not claim persistence beyond `localStorage` in one browser profile.
