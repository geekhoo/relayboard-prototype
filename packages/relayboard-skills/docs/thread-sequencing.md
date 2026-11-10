# Thread sequencing and replay (source documentation)

Ground truth for the `relayboard-thread-sequencing` skill. Everything here is
read from the prototype's `app.js` (plain JavaScript, no backend) and from
`README.md`, `PRODUCT.md`, and `QA.md`. The prototype is the authoritative
behaviour today; where it only *simulates* a guarantee, this document says so.

## What a thread is

A thread is one flat, ordered line of work inside a board:

```js
{ id: 'delivery', boardId: 'platform', title: 'Durable message delivery', creator: 'maya', createdAt, pinned: true }
```

Threads are flat. There is no reply tree; a message may carry a `relation`
(`{ type: 'In response to', messageId }`) that points at another message, but
that relation is presentation metadata and does **not** change ordering or
nesting.

## The canonical sequence

Every message carries a per-thread integer `seq`:

```js
{ id, threadId, boardId, seq, authorId, text, references, relation, createdAt }
```

Rules the prototype actually enforces (all in `appendMessage`):

1. `seq` is computed as `(last(threadId)?.seq || 0) + 1`, where `last()` is the
   last stored message for that thread. Sequence is **per thread**, not per
   board and not global; two threads independently number from 1.
2. The sequence is assigned once, at commit, and never rewritten. A lone
   corrective message is modelled as a *new* message that references the old
   one, so the original position stays intact.
3. `createdAt` is an ISO timestamp, but ordering is by `seq`, not by
   `createdAt`. Seed data is generated with `ago(minutes)` timestamps that are
   not monotonic with sequence, which is deliberate: the reading order is the
   sequence.
4. `readMessages(threadId, { after })` returns `db.messages` filtered to
   `seq > after` and sorted by `seq` ascending. `after` is a **cursor**, i.e.
   the last sequence the caller has already processed. `after: 0` returns the
   whole thread.
5. The UI renders `#<seq>` in the message byline (`.message-seq`, title
   "Canonical thread sequence"), and the thread drawer reports
   "Last sequence `#<n>`" and "Message order: Per thread".

So the invariant to rely on is: for one thread, `seq` is a gap-free,
strictly increasing, immutable position. Across threads there is no ordering
relationship at all.

## Delivery is separate from history

`db.stream` models a durable subscription:

```js
stream: {
  connected: boolean,
  cursors: { [threadId]: number },  // highest seq delivered to this client
  log: [{ type, text, at }]         // last 20 entries
}
```

- **Commit** always happens: `appendMessage` pushes the message and its
  dedup record before any delivery decision.
- **Delivery** happens only while `stream.connected` is true: the thread's
  cursor jumps to the new `seq` and a `delivered` log entry is written
  (`Message #<seq> delivered`).
- **While paused**, an agent-authored message is still committed and gets a
  `queued` log entry (`Message #<seq> awaiting replay`). The author's own
  messages (`authorId === 'alex'` in the prototype) are never queued, because
  the local client already has them.
- `setConnection(connected)` returns `{ connected, pending }`. Reconnecting
  sets every thread cursor to that thread's last `seq` and logs
  `Replayed <n> missed message(s)` or `No missed messages to replay`.
  Disconnecting logs `Subscription paused`.

`pendingTotal()` is the sum over threads of messages with
`seq > cursor[threadId]` that were not authored by the local user. That single
number is what the "Paused · n" badge and the stream panel report.

### What the UI hides while paused

`visibleMessages(threadId)` keeps a message when the stream is connected, or
when `seq <= cursors[threadId]`, or when it is the local user's own message.
So a paused client shows history up to its cursor plus its own drafts, never
an agent message it has not received yet — even though that message is
already committed and durable.

## Read state is not the delivery cursor

`db.seen[threadId]` is the highest sequence the user has *looked at*, updated
by `markRead()` only while connected, and only forward
(`Math.max(seen, sequence)`). Unread counts, thread-row markers and the board
badges are computed from `seen`, not from `cursors`. Treat them as two
separate watermarks:

- `cursors[threadId]` — delivery. Advanced by commit (connected) or by
  reconnect/replay.
- `seen[threadId]` — human attention. Advanced by selecting or reading a
  thread.

## Idempotency

`appendMessage` accepts an `idempotencyKey`. The prototype keeps
`db.idem[key] = message.id` and returns the existing message when the same key
is presented again, before checking thread existence or board membership. The
composer generates one key per send attempt (`uid('submit')`) and the
simulated stream generates one per simulated post (`uid('sim')`), so a
double-submit of the same key cannot produce a second `seq`.

Consequences worth stating plainly:

- Idempotency is keyed by the caller-supplied string, in the same
  `localStorage` document. It is not a server-side dedup window.
- A retry must reuse the *original* key to be deduplicated; a fresh key is a
  new message and consumes a new sequence number.
- Because the dedup record and the message are written in the same tick as
  the outbox log line, the prototype is modelling a single atomic commit of
  message + dedup + notification, which is what its seeded discussion on the
  delivery thread recommends (transactional outbox).

## Replay boundaries the prototype does not implement

`README.md` and `PRODUCT.md` are explicit and the implementation agrees:

- No distributed durability, no broker delivery guarantees, no authentication,
  no cross-device sync. All state is `localStorage` in one browser profile.
- There is no snapshot-to-live watermark handoff, no overlap deduplication,
  and no server-side retention window; `readMessages` always reads the full
  simulated store.
- Reconnect replays by *jumping the cursor*, not by replaying a stored event
  log. The stream `log` is a 20-entry human-readable trace, not an event
  stream a client can consume.

Any guidance you write about Relayboard replay must keep that distinction:
the contract demonstrates cursor-based recovery; it does not prove
at-least-once delivery from a real broker.

## Working recipe: catch up after an absence

```js
const api = window.RelayboardMockAPI;
let cursor = 0; // persist this per (client, thread)

const missed = await api.readMessages('delivery', { after: cursor });
for (const message of missed) {
  render(message);            // order is already seq ascending
  cursor = message.seq;       // only advance after the message is handled
}
```

Then keep the same cursor for the live path: while connected, new commits
advance the thread cursor in the same units. The `read-replay` seed thread
states the rule the UI follows — "The same cursor must work across reconnects."

## Checklist

- Ordering derived from `seq`, never from array position or `createdAt`.
- Cursor advanced only after the message is processed, and persisted with the
  reading client.
- A paused client must not show messages beyond its cursor.
- Retries reuse the original `idempotencyKey`.
- Anything claiming durability beyond one browser profile is wrong.
