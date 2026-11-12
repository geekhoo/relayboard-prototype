# 17: Opening a thread advances `seen` on the shipped transport

**What to build:** Reading a thread is an act, and the transport the app ships performs it. Opening a thread over the HTTP path advances that principal's `seen` watermark to the thread's last `seq`, exactly as the in-memory client already does, so the unread badge on the thread row, the count on the board rail and the unread filter all fall. Fetching entries is not reading a thread, so `readMessages` still marks nothing. The two transports agree on this because a test says so, not because one implementation was read carefully.

**Blocked by:** None (can start immediately)

**Status:** ready-for-agent

**Found by:** architecture F5 at `src/server/functions/read.ts:97-106`; product F3 at `src/client/in-memory.ts:206-213` (the only caller of `markRead` in the shipped tree).

- [ ] **Route seam.** Open a thread whose row shows a non-zero unread badge; once its entries render, that row's badge and the board rail's count have both fallen to the true remainder, and the badge is zero when that thread was the reader's only unread one. The assertion is "the badge falls after opening", which is false today and must fail if `seen` never moves.
- [ ] **Route seam.** The reading of the badge starts from the seeded non-zero count and no store reset happens between reading the thread and observing the badge. The isolation case that claims to cover this compares counts across a reset, which is equal either way — so a fixed version of *that* case is not the same test, and this criterion names the difference.
- [ ] **Route seam.** Fetching a thread's entries without opening it (the in-thread search path, and the entry list re-fetch after a commit) leaves the badge where it was, so a fix applied to every read of a chronology is caught rather than shipped.
- [ ] **Unit/domain seam.** Unread arithmetic counts from `seen` and from nothing else: a thread whose `seen` equals its entry count reports zero rather than a full or negative count, and a client-side counter beside the watermark cannot disagree with it.
- [ ] **Contract seam.** The `readThread`-advances-`seen` case gains a run against the shipped HTTP transport once the shared suite runs there (ticket 29). Until that runner exists the route-seam criteria above are the observable; this criterion records that the route seam is a substitute for, not a replacement of, the seam the case belongs at.

**Leaves the build green:** yes. The failing behaviour is invisible to every gate today, so the first commit is a route-seam test that fails.