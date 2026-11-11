---
name: relayboard-thread-sequencing
description: >-
  Use when reading, ordering, replaying or resuming a Relayboard thread's
  chronology, including its per-thread canonical sequence, the delivery cursor
  versus the read and acknowledgement watermarks, catching up after a pause,
  and retrying a send idempotently. Covers entry ordering and the three
  watermarks; use relayboard-mock-api to write entries or create boards and
  threads.
metadata:
  purpose: >-
    Keep thread reads correct: order by the immutable per-thread sequence, keep
    the delivery cursor separate from the read and acknowledgement watermarks,
    catch up with readMessages({ after }), and retry with the original key.
  type: core
  library: '@relayboard/skills'
  library_version: 0.1.0
sources:
  - 'docs/thread-sequencing.md'
  - 'docs/mock-api.md'
---

# Thread sequencing and replay

A thread is a flat chronology of **entries**, each holding an immutable per-thread
integer `seq`. An entry is a message, an artifact, a status move or an
acknowledgement, and all four take a position in the same order — so "the
messages" is not the unit to read. Reading is only correct if you order by `seq`,
treat `seq` as your cursor, and keep delivery state separate from what a human has
looked at. Evidence for the app's own rules is in
[docs/thread-sequencing.md](../../docs/thread-sequencing.md).

## Setup

Read through `RelayboardClient` — `readThread(id)` for the whole chronology,
`readMessages(id, { after })` for a subset, `readPositions(id)` for the watermarks.
Never reach for a store or a module from `src/server/`.

```ts
// Model the watermarks as distinct values: they move for different reasons, and
// the app keeps all three for exactly that reason.
interface ThreadCheckpoint {
  readonly threadId: string
  /** Highest seq actually received by this client. */
  readonly cursor: number
  /** Highest seq the human has READ. Advanced only by reading a thread. */
  readonly seen: number
  /** Highest seq this principal has ACKNOWLEDGED. A report, never agreement. */
  readonly acknowledged: number
}

const createCheckpoint = (threadId: string): ThreadCheckpoint => ({
  threadId,
  cursor: 0,
  seen: 0,
  acknowledged: 0,
});

const advanceCursor = (
  checkpoint: ThreadCheckpoint,
  seq: number,
): ThreadCheckpoint => ({ ...checkpoint, cursor: Math.max(checkpoint.cursor, seq) });
```

Start a new thread's cursor at `0`: `readMessages(threadId, { after: 0 })` returns the
whole thread, which is what a fresh client needs.

## Core patterns

### Catch up after an absence

`readMessages(threadId, { after })` returns entries with `seq > after`, already sorted
ascending. Advance the cursor only after the entry is handled, so an interruption
re-reads rather than skips.

```ts
type Incoming = { readonly seq: number }

const catchUp = (
  start: ThreadCheckpoint,
  fetchAfter: (after: number) => readonly Incoming[],
): ThreadCheckpoint =>
  fetchAfter(start.cursor).reduce(
    (checkpoint, entry) => advanceCursor(checkpoint, entry.seq),
    start,
  );
```

### Never order by anything but `seq`

`createdAt` is an ISO timestamp and the seeded demo data is **not** monotonic with
sequence: the app's seed contains a thread whose timestamps run against its positions
precisely so an incorrect sort is visible. Array position is also unsafe — filtering by
search or unread removes entries without renumbering.

```ts
const inCanonicalOrder = <T extends { readonly seq: number }>(
  entries: readonly T[],
): T[] => [...entries].sort((a, b) => a.seq - b.seq);
```

### Three watermarks, three meanings

`cursor` is what was **received**, `seen` is what the human **read**, and
`acknowledged` is how far a principal **says** it has processed. The unread badge counts
every entry past `seen` — **including your own** — and that is deliberate: the app does
not exclude a reader's own entries, so a badge written to that exclusion disagrees with
the watermark the server reports.

Acknowledgement is a range, not a verdict. There is no "done", "agreed" or "signed
off" state, and copy must not invent one.

### A correction is a new entry, not an edit

There is no `updateMessage` or `deleteMessage`. The supported shape keeps the original
position intact and adds a new entry that points back at it.

```ts
interface Correction {
  readonly kind: 'correction';
  /** The entry being corrected; its seq is never rewritten. */
  readonly targetSeq: number;
  readonly text: string;
}
```

### Paused means "history up to my cursor"

While paused, entries are still **committed** — a pause withholds delivery, never the
write — and a paused reader must not render anything beyond its `cursor`. Resuming
replays the difference between the cursor and the thread's latest `seq`. That difference
only exists because the pause is known where the cursor lives, which is why the pause is
server state rather than a view flag.

## Common mistakes

- **Advancing the cursor before handling the entry.** An interruption then silently
  drops entries. Advance after, as in `catchUp` above.
- **Sharing one cursor across threads.** `seq` is per thread; two threads both start at
  1. A single global cursor skips work in every other thread.
- **Using the unread badge as a cursor.** `seen` moves only when the human reads; delivery
  uses `cursor`. They diverge the moment the stream is paused.
- **Excluding your own entries from the unread count.** The app counts from `seen` alone.
- **Retrying with a fresh idempotency key.** Deduplication is keyed by the caller's
  string, so a new key appends a second entry and burns a second position.
- **Claiming durable replay.** Reconnect replays by moving cursors to each thread's last
  `seq`; there is no stored event log, no broker acknowledgement and no cross-device
  persistence. The store is in-memory and says so.

## Completion

You are done when:

- every read is ordered by `seq`, ascending;
- the cursor is kept per thread and advanced only after an entry is handled;
- a paused view shows nothing above its cursor, and nothing is treated as lost;
- the unread count follows `seen` including the reader's own entries;
- each retry reuses its original `idempotencyKey`;
- nothing in your change claims guarantees beyond one process's memory.
