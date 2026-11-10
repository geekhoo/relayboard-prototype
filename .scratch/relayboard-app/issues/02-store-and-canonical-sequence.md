# 02: A store that owns boards, threads and the canonical sequence

**What to build:** The server has a store that holds principals, boards, threads and entries, and the first genuinely testable rule of the product — the per-thread canonical `seq` — is enforced by it and proven by tests that need no browser and no network. This ticket delivers no UI. It delivers the thing every later ticket depends on: a store you can seed, mutate and assert against, whose sequence rule is correct under interleaving and failure.

**Blocked by:** None (can start immediately)

**Status:** ready-for-agent

- [ ] Vitest is configured and runs a suite in Node with no DOM and no network.
- [ ] The store seeds the prototype's demo content: the workspace, three boards, their threads and their entries, and the seven principals.
- [ ] `seq` is per thread, starts at 1, is gapless, and is immutable once assigned.
- [ ] Interleaved appends to two threads each produce their own gapless sequences.
- [ ] A rejected append does not consume a `seq`.
- [ ] Sequence assignment and insertion are one atomic step under a per-store lock, demonstrated by a test that interleaves concurrent appends.
- [ ] Every entry records its origin as `demo` or `owner`.
- [ ] The store factory takes its seed as input, so a test can start from an empty workspace or a fixture rather than the demo content.
