---
name: relayboard-thread-sequencing
description: >-
  Use when reading, ordering, replaying, or resuming Relayboard thread messages
  in the prototype, including per-thread canonical sequence numbers, delivery
  cursors versus read watermarks, catching up after a pause, and idempotent
  re-sends. Covers the window.RelayboardMockAPI read path only; use
  relayboard-mock-api to post messages or create boards and threads.
metadata:
  purpose: >-
    Keep thread reads correct: order by the immutable per-thread sequence, keep
    the delivery cursor separate from the human read watermark, catch up with
    readMessages({ after }), and retry with the original idempotency key.
  type: core
  library: '@relayboard/skills'
  library_version: 0.1.0
sources:
  - 'docs/thread-sequencing.md'
  - 'docs/mock-api.md'
---

# Thread sequencing and replay

Relayboard stores a flat thread whose messages each hold an immutable
per-thread integer `seq`. Reading is only correct if you order by `seq`, treat
`seq` as your cursor, and keep delivery state separate from what a human has
already looked at. Full evidence, including the exact `app.js` rules, is in
[docs/thread-sequencing.md](../../docs/thread-sequencing.md).

## Setup

Read through the mock API. Never reach into the prototype's internal `db` or
`state` objects.

```ts
// Model the two watermarks as distinct values: they move for different reasons.
interface ThreadCheckpoint {
  readonly threadId: string
  /** Highest seq actually processed by this caller. Advanced after handling. */
  readonly cursor: number
  /** Highest seq the human has seen. Advanced only by reading a thread. */
  readonly seen: number
}

const createCheckpoint = (threadId: string): ThreadCheckpoint => ({
  threadId,
  cursor: 0,
  seen: 0,
})

const advanceCursor = (
  checkpoint: ThreadCheckpoint,
  seq: number,
): ThreadCheckpoint => ({ ...checkpoint, cursor: Math.max(checkpoint.cursor, seq) })
```

Start a new thread's cursor at `0`: `readMessages(threadId, { after: 0 })`
returns the whole thread, which is what a fresh client needs.

## Core patterns

### Catch up after an absence

`readMessages(threadId, { after })` returns messages with `seq > after`, already
sorted ascending. Advance the cursor only after the message is handled, so an
interruption re-reads rather than skips.

```ts
type Incoming = { readonly seq: number; readonly text: string }

const catchUp = (
  start: ThreadCheckpoint,
  fetchAfter: (after: number) => Incoming[],
): ThreadCheckpoint =>
  fetchAfter(start.cursor).reduce(
    (checkpoint, message) => advanceCursor(checkpoint, message.seq),
    start,
  )
```

### Never order by anything but `seq`

`createdAt` is an ISO timestamp and the seeded demo data is **not** monotonic
with sequence. Sorting by `createdAt` reorders real threads. Array position is
also unsafe: filtering (search, unread filter) removes entries without
renumbering.

```ts
const inCanonicalOrder = <T extends { readonly seq: number }>(messages: readonly T[]): T[] =>
  [...messages].sort((a, b) => a.seq - b.seq)
```

### A correction is a new message, not an edit

There is no `updateMessage` or `deleteMessage`. The supported shape keeps the
original position intact and adds a new message that points back at it.

```ts
interface Correction {
  readonly kind: 'correction'
  /** The message being corrected; its seq is never rewritten. */
  readonly targetSeq: number
  readonly text: string
}
```

### Paused means "history up to my cursor"

While the simulated stream is paused, agent messages are still committed, but a
paused client must not render anything beyond `cursor`. The prototype enforces
this in `visibleMessages()`; any replacement view must keep the rule.

## Common mistakes

- **Advancing the cursor before handling the message.** A crash or an
  interrupted render then silently drops messages. Advance after, as in
  `catchUp` above.
- **Sharing one cursor across threads.** `seq` is per thread; thread `delivery`
  and thread `identity` both start at 1. A single global cursor skips work in
  every other thread.
- **Using the unread badge as a cursor.** Unread counts come from `seen`, which
  only moves when the human reads a thread; delivery uses `cursors`. They
  diverge the moment the stream is paused.
- **Retrying with a fresh idempotency key.** Deduplication is keyed by the
  caller's string, so a new key appends a second message and burns a second
  sequence number. Reuse the original key on retry.
- **Claiming durable replay.** Reconnect replays by moving cursors to each
  thread's last `seq`; there is no stored event log, no broker acknowledgement
  and no cross-device persistence. `README.md` and `PRODUCT.md` say so.

## Completion

You are done when:

- every read is ordered by `seq`, ascending;
- the cursor is persisted per `(client, thread)` and advanced only after a
  message is handled;
- a paused view shows nothing above its cursor;
- each retry reuses its original `idempotencyKey`;
- nothing in your change claims guarantees beyond one browser profile's
  `localStorage`.


