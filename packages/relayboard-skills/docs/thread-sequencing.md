# Thread sequencing and replay (source documentation)

Ground truth for the `relayboard-thread-sequencing` skill. Read from
`apps/relayboard-web/src/server/store/index.ts` (the one entry-writing path),
`src/client/index.ts` (the watermarks a read returns), `src/server/stream.ts` (the
wire vocabulary), and — for the rules the port had to reproduce — the prototype's
`app.js`, which is kept at the repository root as the behavioural reference.

## What a thread is

A thread is one flat, ordered line of work inside a board:

```ts
{ id: 'delivery', boardId: 'platform', title: 'Durable message delivery',
  creatorId: 'maya', createdAt, pinned: true, status: 'open' | 'resolved', origin }
```

Threads are flat. There is no reply tree; a **message** entry may carry a `relation`
(`{ type, entryId }`) that points at another entry, but that relation is presentation
metadata and does not change ordering or nesting.

## Four kinds in one chronology

A thread's entries are a union — `message`, `artifact`, `status-move`, `acknowledgement` —
and all four take a position in the same sequence. This is the port's central widening:
the prototype's `readMessages` returned messages, and the app's `readThread` returns
entries.

```ts
Entry = MessageEntry | ArtifactEntry | StatusMoveEntry | AcknowledgementEntry
// every member: id, seq, authorId, createdAt, origin, relation?
// message:         text, references             artifact:        resourceId
// status-move:     from, to                     acknowledgement: upTo
```

"The messages" is therefore not the unit to read, count or render, and a display that
treats every entry as prose leaves three of the four kinds blank.

## The canonical sequence

Every entry carries a per-thread integer `seq`. The store enforces:

1. **`seq` is per thread, starting at 1, and gapless.** Two threads both have a `#1`.
2. **`seq` is assigned by the store, from the thread's last position**, never by a caller.
3. **A rejected write consumes no position.** Validation runs first; an append that fails
   leaves the counter where it was.
4. **An entry's `seq` is never rewritten.** A correction is a new entry that points back
   at the position it corrects.

Rules 1 and 3 are what make `seq` a usable cursor: a gap would mean an entry that was
counted and then lost, and a re-used number would make two entries indistinguishable.

## Delivery is separate from history

History is the entries. Delivery is what a particular connection has received, tracked as
a `cursor`. They diverge whenever a reader is paused, offline, or has just reconnected.

- **A pause is server state.** The cursor stops advancing; entries keep committing.
  `setConnection({ connected: false })` returns a `pending` count computed from the
  difference between the cursor and the thread's last `seq`, so the number is the
  store's answer rather than a counter a component kept.
- **A resume replays that difference.** Nothing is stored per subscriber: the replay is
  derived from the cursor, which is why it cannot disagree with the history.
- **A pause that lived only in the browser would break both.** The cursor would advance
  with every commit, so `pending` would always be `0` and a resume would replay nothing.
  The port made this mistake once and the ticket that required a working pause found it.

### What the UI hides while paused

Nothing above the reader's `cursor`. The entries below it (by `seq`) are rendered; the
ones above are committed and withheld. The app asserts both halves at the route seam:
the entry is in the history and not in the paused reader's view.

## Three watermarks, three meanings

| Watermark | Moves when | Answers |
| --- | --- | --- |
| `cursor` | an entry is delivered to this client | what have I received? |
| `seen` | the reader reads a thread | how much have I read? |
| `acknowledged` | the principal acknowledges, explicitly | how far do I say I have processed? |

They are separate because they answer different questions and move for different reasons.
A single number would have to choose one meaning and silently drop the other two.

**The unread badge counts every entry past `seen`, including the reader's own.** The
prototype excluded the reader's own entries (`app.js` L135) and that exclusion was
deliberately **not** carried: the watermark is the rule (`spec L502`), and three seeded
threads read differently under the two rules. A badge written to the prototype's
exclusion disagrees with the watermark the server reports.

**Acknowledgement is a range, not a verdict.** `upTo` states how far a principal got; the
model carries no "done", "agreed" or "signed off" state, and copy must not invent one.
Acknowledging backwards is refused, as is acknowledging past the thread's last position.

## Idempotency

`appendMessage` accepts an optional `idempotencyKey`. The lookup runs **before** the
validation checks, so a replay of a stored key returns the stored entry even if the thread
would now fail validation. On failure, **keep the key**: a retry must replay, and a fresh
key makes the retry a second entry.

## Reading in practice

1. `readThread(threadId)` returns the record and its entries, in `seq` order.
2. `readMessages(threadId, { after })` returns the entries with `seq > after`, ascending —
   the catch-up read. Start a fresh client at `0`.
3. `readPositions(threadId)` returns every principal's watermarks on the thread.
4. Advance the cursor **after** handling an entry, never before: an interruption then
   re-reads rather than skips.

## Checklist

- [ ] Every read is ordered by `seq`, ascending — never by `createdAt`, never by array
      position.
- [ ] The cursor is kept per thread and advanced only after an entry is handled.
- [ ] A paused view renders nothing above its cursor, and nothing is treated as lost.
- [ ] The unread count follows `seen`, including the reader's own entries.
- [ ] A retry reuses its original `idempotencyKey`.
- [ ] Nothing claims guarantees beyond one process's memory.
