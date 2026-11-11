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
- [ ] **`setConnection` reaches the store, and the store is what pauses a reader.** The panel owns the *affordance* and the display; the server owns the state. This criterion used to require the opposite — a no-op, on the reasoning that pause is the panel's own state and delivery belongs to the SSE connection — and that reading is **wrong, and was corrected in this ticket rather than built**: spec L360 requires a paused subscriber to receive no events *and* to replay from its cursor on resume, which is a difference between the cursor and the thread's current seq, which requires the pause to be known where the cursor lives. `11a`'s criteria 16 and 17 already require exactly that, the store's pause primitive and its contract tests have asserted it since 02b, and the prototype implements it server-side (`app.js` L118 sets `db.stream.connected`, rewinds each thread's cursor on resume, and reports the replayed count). A no-op would have made criteria 15, 16 and 22 of this same ticket unsatisfiable while looking satisfied — three assertions that pass because nothing was paused. So: pausing withholds, the reader's cursor holds still while it does, resuming replays from that cursor and reports the count, and both implementations do it, keeping `read:board` like `subscribe`'s requirement (spec L339).
- [ ] Resuming replays the withheld entries in order and reports how many were replayed, in the wording the prototype used (`app.js` L118: "Replayed N missed message(s)") and in the stream log.
- [ ] The reader's position survives a page reload: a reload mid-thread restores the same thread and does not reset the cursor, so a refresh is not a data-loss event. `localStorage` holds only the remembered location (spec L505).
- [ ] A stream that cannot be reached reports itself as unavailable rather than rendering an empty thread as if it were complete (spec L518, story 149).
- [ ] The paused state is not lost on navigation: moving to another thread and back preserves it, or the interface states plainly that it does not.
- [ ] The unread badge counts from `seen`, and the stream replays from `cursor`; a test asserts they diverge in the paused case and that neither is used for the other's purpose (spec L571). **The badge counts every entry past `seen`, including the reader's own**, which is the watermark's rule and the one this ticket settles: the prototype subtracted the reader's own entries (`app.js` L135), and that exclusion is deliberately **not** carried, because `seen` already means "this principal has read up to here" and a second per-author rule would be a counter beside the watermark. So the seeded badge numbers follow from `seen` and are not the numbers the prototype's rail showed — `read-replay`, `launch` and `delivery` read 1/1/2 here where the prototype showed 0/0/1.
- [ ] The simulation control ("simulate an agent post") still works, and its panel states plainly that it is a demonstration and not another participant (story 51–52).
- [ ] The route seam covers pause → commit → resume → count reported, and reload → position retained.

**Leaves the build green:** yes.
