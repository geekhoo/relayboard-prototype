# 02b: The store and the per-thread sequence

**From:** 02 — A store that owns boards, threads and the canonical sequence

**What to build:** A store factory that takes an initial seed and returns operations over it, with the first genuinely testable rule of the product enforced inside it: `seq` is per thread, starts at 1, gapless, immutable once assigned, and its assignment plus insertion is one atomic step under a per-store async lock. The factory takes its seed as input so a test can start from an empty workspace or a small fixture rather than from the demo content. Every rejection leaves the store unchanged and consumes no `seq`.

**Blocked by:** 02a — A test harness and the domain types it will hold

**Write scope:** the store module under `src/server/store/**` and its tests. Does not touch the domain types, which 02a landed.

**Status:** ready-for-agent

- [ ] A store factory exists that accepts a seed (`{ principals, boards, threads, entries, resources }`, and nothing else) and returns the operations; two factories from two different seeds do not share state.
- [ ] `seq` is per thread, starts at 1, and is gapless; appends to two threads each produce their own gapless sequences.
- [ ] `seq` is immutable once assigned: no operation rewrites it, and re-appending never reuses a value.
- [ ] A rejected append does not consume a `seq` — the next accepted append takes the number the rejection would have taken, proven by a test.
- [ ] **`seq` assignment and insertion are one synchronous step, with no `await` between computing a thread's next `seq` and appending the entry.** The store is synchronous, so nothing can interleave: an async lock would protect nothing and a test of it would pass against a no-op. The rule is the invariant, stated in the module so a later move to an asynchronous store has something to preserve. There is no per-store lock to assert.
- [ ] The documented error strings live in one place in the domain and are asserted literally, in the documented order: an append to an unknown thread, an append by a principal not on the board, and an append whose text is empty after trim.
- [ ] An idempotent replay returns the identical entry and appends nothing; idempotency is checked before validation, so a replay of a valid key returns the stored entry even if the text would now be rejected.
- [ ] `cursor` and `seen` are independent watermarks per `(principal, thread)`: pausing advances neither, resuming advances `cursor` only, reading advances `seen` only.
- [ ] A paused subscriber is withheld entries that remain in the store's history.
- [ ] Every entry records its origin as `demo` or `owner`, and no operation branches on origin.
- [ ] The suite contains no assertion on a store-internal field name, map key or module layout — it asserts what a caller observes, plus the documented error strings.

**Leaves the build green:** yes. Nothing imports the store yet, so the app is unchanged; the suite proves the rule.
