# 02b: The store and the per-thread sequence

**From:** 02 — A store that owns boards, threads and the canonical sequence

**What to build:** A store factory that takes an initial seed and returns operations over it, with the first genuinely testable rule of the product enforced inside it: `seq` is per thread, starts at 1, gapless, immutable once assigned, and its assignment plus insertion are one synchronous step with no `await` between computing the number and appending the entry. The factory takes its seed as input so a test can start from an empty workspace or a small fixture rather than from the demo content. Every rejection leaves the store unchanged and consumes no `seq`.

**Blocked by:** 02a — A test harness and the domain types it will hold

**Write scope:** the store module under `src/server/store/**` and its tests. Does not touch the domain types, which 02a landed.

**Status:** done — verified; see `## Comments`

- [x] A store factory exists that accepts a seed (`{ principals, boards, threads, entries, resources }`, and nothing else) and returns the operations; two factories from two different seeds do not share state.
- [x] `seq` is per thread, starts at 1, and is gapless; appends to two threads each produce their own gapless sequences.
- [x] `seq` is immutable once assigned: no operation rewrites it, and re-appending never reuses a value.
- [x] A rejected append does not consume a `seq` — the next accepted append takes the number the rejection would have taken, proven by a test.
- [x] **`seq` assignment and insertion are one synchronous step, with no `await` between computing a thread's next `seq` and appending the entry.** The store is synchronous, so nothing can interleave: an async lock would protect nothing and a test of it would pass against a no-op. The rule is the invariant, stated in the module so a later move to an asynchronous store has something to preserve. There is no per-store lock to assert.
- [x] The documented error strings live in one place in the domain and are asserted literally, in the documented order: an append to an unknown thread, an append by a principal not on the board, and an append whose text is empty after trim.
- [x] An idempotent replay returns the identical entry and appends nothing; idempotency is checked before validation, so a replay of a valid key returns the stored entry even if the text would now be rejected.
- [x] `cursor` and `seen` are independent watermarks per `(principal, thread)`: pausing advances neither, resuming advances `cursor` only, reading advances `seen` only.
- [x] A paused subscriber is withheld entries that remain in the store's history.
- [x] Every entry records its origin as `demo` or `owner`, and no operation branches on origin.
- [x] The suite contains no assertion on a store-internal field name, map key or module layout — it asserts what a caller observes, plus the documented error strings.

**Leaves the build green:** yes. Nothing imports the store yet, so the app is unchanged; the suite proves the rule.

## Comments

**Implemented and verified** at `f565fb6`. The store exists as a factory over a seed, and the rule it enforces is the one the product's ordering depends on.

What was checked rather than assumed:

- The commit records 43 tests passing, with `check`, `check:styles`, `typecheck` and `build` all exit 0 and the build still `node-server`. The suite has since grown to 116 passed and 6 skipped as 02c and 03 added theirs, and re-running the store's own file today (`npx vitest run tests/store.test.ts`) gives **24 passing**, which is those assertions after 02c extracted them into `tests/store-contract.ts` (run against a fixture here and against the demo seed there) plus the two seeded-watermark cases that stayed. The gates were re-run on the current working tree, not at `f565fb6` in isolation: `npm test` 116 passed / 6 skipped, `npm run app:check` exit 0.
- `seq` is per thread, starts at 1, gapless and immutable: asserted by appending to two threads (`tests/store-contract.ts`, "starts each thread at 1 and appends its own gapless sequence") and by attempting to reassign a handed-out `seq`, which throws because every entry is frozen.
- A rejection consumes no number: three refusals then one accepted append lands on `last + 1`, not `last + 4`.
- The documented order is asserted against the domain's own list rather than against a copy: `expect(thrown).toEqual([...errorMessageList])`, so the three strings live once in `src/domain/errors.ts` and no test becomes their copy of record.
- Idempotency is checked before validation, proven negatively: a replay whose text is now empty returns the stored entry rather than throwing "Message cannot be empty".
- The synchronous pairing is asserted at the type level — `appendMessage` returns `Entry`, not a promise — so an `async` store cannot arrive quietly.

Two decisions a later ticket inherits:

- **Membership arrives as `StoreOptions.isBoardMember`, not as a member list in the seed.** `StoreSeed` is five collections and `expectTypeOf<keyof StoreSeed>` is a real guard, so a `members` array cannot be added without failing a test. A member list in the seed is precisely the thing 07a would have to delete, and a principal is on a board because it holds a grant there (spec L400). One predicate, named as the stand-in, is the whole of that debt — 02c supplies the demo permutation through it, and 07a replaces it with the grant lookup.
- **The store exposes `readPositions`, `readView`, `setConnection` and `markRead` because the watermark criteria are otherwise unobservable.** Criterion 8 (pausing advances neither, resuming advances `cursor` only, reading advances `seen` only) is a statement about numbers a caller has to be able to ask for. 03 therefore names `readPositions` and `setConnection` on the public interface; `readView` and `markRead` are reached through `readMessages` and `readThread` — reading a thread *is* the act that advances `seen` — so the interface does not need two more operations to make the ladder observable, and 11b's panel reads the pending count from the cursor through `setConnection`'s `StreamState`. **Checked against the tree at `f95c8c5`:** the in-memory client calls `markRead` (in `readThread`) and `readPositions`, and nothing calls `store.readView` yet — `readMessages` filters by `after` rather than by the caller's cursor, so the paused view is not implemented on the interface. That is 11b's to wire, not a gap in 02b's own criteria (which assert `readView` at the store seam), but it is the reason "reading a thread advances `seen`" is observable today while "a paused reader sees less" is not.

**The one shape assertion that names a type rather than an observation, and why it is not an internal.** Criterion 11 forbids assertions on a store-internal field or a map key. `tests/store.test.ts` does assert `expectTypeOf<keyof StoreSeed>()` and that no board carries `members` — but `StoreSeed` is the caller's own input contract, the thing a test constructs, not something the store holds; a caller that cannot state the seed's shape cannot build one. Nothing asserts on `entriesByThread`, `committed`, `watermarks` or any other field the store keeps, which is where the criterion actually bites.

One thing the store does that the commit message states and a later ticket must not undo: seeded history counts as delivered and nobody is credited with having read it. `cursor` defaults to the thread's last position and `seen` to zero, so a principal the seed says nothing about is not silently behind — and 02c's seeded watermarks win where they disagree.

**Finding carried forward.** `store.setConnection` is a real pause primitive with tests, but the in-memory client's `setConnection` is a no-op that does not call it (11b's decision: pause is the reader's state and delivery belongs to the stream). So nothing in the app pauses the store today. 11b's panel is the first consumer that must decide whether pausing the view calls this primitive or is purely local — the criterion there says the count derives from the cursor, which this primitive preserves, so wiring it is safe; leaving it unwired is also safe, but it must be a decision rather than an oversight.
