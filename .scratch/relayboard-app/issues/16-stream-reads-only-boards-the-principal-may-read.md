# 16: The stream hands a principal only the boards it may read

**What to build:** A subscriber receives exactly what it may read over RPC, and nothing more. `subscribe` asks `read:board` per board — the same question every read handler asks — and both the replay walk and the live delivery consult it, so a principal confined to one board never receives another board's entries, in replay or as they commit. Delivery follows the grant too: a commit on a board a principal may not read does not advance that principal's `cursor`, so the delivery watermark stops being a workspace-wide fact. And a stream request carrying no session is refused rather than issued one, so an unauthenticated `GET` cannot advance the workspace's session round-robin and decide which principal the next browser acts as.

**Blocked by:** None (can start immediately)

**Status:** ready-for-agent

**Found by:** security F1 at `src/routes/api/stream.ts:52,111-122,187-198`; architecture F3 at the same two loops and `src/server/store/index.ts:829-835`; security F9 at `src/routes/api/stream.ts:52` into `src/server/principal.ts:229-247`.

- [ ] **Route seam.** A principal holding `read:board` on one board and no grant on another opens the stream and receives zero frames from the board it may not read — asserted on the frames (their `seq`, thread and text), not on a count the server chose to report. The same principal is refused that board over RPC in the same test, so the stream is provably not a superset of the request surface. The test must fail against a route that walks every board unfiltered.
- [ ] **Route seam.** A live entry committed on a board the subscriber may not read produces no frame on its open connection within a stated settle window, while an entry committed on a board it may read arrives in the same window. Both halves in one test, so a filter that drops everything cannot pass.
- [ ] **Contract seam.** For both implementations, `subscribe` delivers only entries whose board the subscriber may read, and a principal holding `read:board` nowhere is refused with the declared `atLeastOneBoard` refusal rather than handed an empty stream. Asserting the refusal as well as the filter is what stops "return nothing" from being a fix.
- [ ] **Store seam.** A commit on a board does not advance the `cursor` of a principal holding no `read:board` there; the entry stays in the thread and that principal's watermark is unchanged. Assert a named principal's watermark before and after, so an advance cannot hide in an aggregate.
- [ ] **Route seam.** Three unauthenticated `GET` requests to the stream leave the session rotation where they found it: the next browser is issued the principal it would have been issued without them, and the refusals carry no session cookie. Assert the issued principal, not the status code alone.
- [ ] **Unit/domain seam.** The filter is the store's own permission question, asked per board: a workspace `read:board` reads every board, a board-scoped one reads that board, and a principal holding neither reads nothing. All three directions asserted, so neither an allow-all nor a deny-all implementation passes.

**Leaves the build green:** yes.
