# 11b: Live, pause, replay — the reader's side of the stream

**From:** 11 — Live delivery, pause and replay over SSE

**What to build:** The interface over the transport: new entries appear in an open thread without a refresh; the live indicator pairs a colour with a word and never reads "Live" while disconnected; pausing withholds entries from the view while they keep accumulating in history; a paused reader sees how many are waiting; resuming replays them in order and reports the count; and the read position survives a reload so a refresh is not a data-loss event.

**Blocked by:** 11a — The stream as an SSE server route, with a written event contract

**Write scope:** the stream panel component with a co-located stylesheet, plus pause and replay state and the read-position persistence; layout as utilities.

**Status:** ready-for-agent

- [ ] New entries appear in an open thread without a refresh, in `seq` order, as they commit.
- [ ] The live indicator pairs a colour with a word (`DESIGN.md` §277, §292: never a status colour without its word). It reads "Live" only while the stream is connected, and "Paused" with the pending count while paused.
- [ ] Pausing withholds entries from the view while they continue to accumulate in history. A test pauses, commits two entries, and asserts the view still shows the pre-pause last entry while the thread's entry count has risen.
- [ ] A paused reader sees a count of the entries awaiting them, and that count is derived from the cursor rather than from a separate counter.
- [ ] **`setConnection` becomes a no-op returning the current `StreamState`.** Pause is this panel's own state and delivery belongs to the SSE connection, so there is no server-side connection flag to toggle and no queue to start or stop (spec L360); it stays on the interface rather than being deleted, because the prototype's nine are carried forward in name and intent (spec L287, L301, L352), and it now reads the caller's current connection, keeping its `read:board` requirement like `subscribe`'s (spec L339). Both implementations answer it this way, so 06c implements it as the no-op instead of guessing at a flag, and a test asserts the call returns the caller's `StreamState` and changes no subscriber's cursor, pause state or delivered set.
- [ ] Resuming replays the withheld entries in order and reports how many were replayed, in the wording the prototype used (`app.js` L118: "Replayed N missed message(s)") and in the stream log.
- [ ] The reader's position survives a page reload: a reload mid-thread restores the same thread and does not reset the cursor, so a refresh is not a data-loss event. `localStorage` holds only the remembered location (spec L505).
- [ ] A stream that cannot be reached reports itself as unavailable rather than rendering an empty thread as if it were complete (spec L518, story 149).
- [ ] The paused state is not lost on navigation: moving to another thread and back preserves it, or the interface states plainly that it does not.
- [ ] The unread badge counts from `seen`, and the stream replays from `cursor`; a test asserts they diverge in the paused case and that neither is used for the other's purpose (spec L571). **The badge counts every entry past `seen`, including the reader's own**, which is the watermark's rule and the one this ticket settles: the prototype subtracted the reader's own entries (`app.js` L135), and that exclusion is deliberately **not** carried, because `seen` already means "this principal has read up to here" and a second per-author rule would be a counter beside the watermark. So the seeded badge numbers follow from `seen` and are not the numbers the prototype's rail showed — `read-replay`, `launch` and `delivery` read 1/1/2 here where the prototype showed 0/0/1.
- [ ] The simulation control ("simulate an agent post") still works, and its panel states plainly that it is a demonstration and not another participant (story 51–52).
- [ ] The route seam covers pause → commit → resume → count reported, and reload → position retained.

**Leaves the build green:** yes.
