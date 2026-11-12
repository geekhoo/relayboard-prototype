# 21: A resume replays every thread's missed entries, not the longest thread's

**What to build:** Reconnecting after an absence replays what the reader missed in every thread, not nothing. The resume position is per thread, because `seq` is per thread: a reader whose last position was 9 in one thread must still be replayed that shorter thread's entries past its own last position. The single scalar cursor is replaced by the per-thread delivery watermarks the store already holds, so a reconnect, a pause-and-resume and a fresh page agree about where each thread stands, and the count reported on connect is the number of entries actually replayed.

This is the batch's one contract change — the shape of the resume position — and it lands in one ticket because the client, the route and the store must move together for the count to mean anything. If it is split instead, sequence it expand–contract: carry per-thread state beside the scalar, migrate the client then the route, and delete the scalar once no caller sends it; each step keeps the route seam green.

**Blocked by:** None (can start immediately). Ticket 16 rewrites the same replay loop, so take them in sequence rather than in parallel; neither gates the other.

**Status:** ready-for-agent

**Found by:** architecture F4 at `src/client/http.ts:408,420` and `src/routes/api/stream.ts:60-63,114`.

- [ ] **Route seam.** A subscriber that has read to `seq` 9 in one thread, disconnects, and reconnects receives every entry committed in a shorter thread while it was away — measured on the frames that arrive, including their `seq` and thread — and the reported pending count equals the number of frames replayed. The test must fail against one scalar compared with each thread's `seq`.
- [ ] **Route seam.** In the same reconnect, entries the subscriber had already received are not re-delivered. Both directions asserted together, so "replay everything" fails as loudly as "replay nothing".
- [ ] **Store seam.** The resume position for each thread is that principal's `cursor` for that thread, and a resume sets each thread's `cursor` to that thread's last `seq` while leaving `seen` and `acknowledged` untouched. All three watermarks asserted, so the ladder is not collapsed by the fix.
- [ ] **Store seam.** A paused subscriber's `cursor` does not move while entries commit, and its resume replays exactly those withheld entries: the withhold rule still holds under per-thread resumption.
- [ ] **Route seam.** A browser that has never connected and one that reconnects end at the same place — every thread's last `seq` — so the rendered chronology does not depend on which path it took.
- [ ] **Contract seam.** The stream conformance case for resume asserts cross-thread re-delivery rather than only that pending is a number and that a second subscribe reports zero. Its run against the shipped transport follows with ticket 29; the strengthened case fails against today's implementation at either seam.

**Leaves the build green:** yes.