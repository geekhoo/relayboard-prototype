# 11: Live delivery, pause and replay over SSE

**What to build:** New entries arrive without a refresh, and a reader can pause that flow to read without the interface moving under them. While paused, entries accumulate in history but stay out of the view; the paused indicator carries a count; resuming replays precisely what was withheld and reports how many entries it replayed. A dropped connection recovers on its own, and a disconnected stream says so instead of rendering an empty thread as if it were complete.

**Blocked by:** 10 — authored acts share the thread chronology

**Status:** ready-for-agent

- [ ] New entries appear in an open thread without a refresh, in order, as they commit.
- [ ] The live indicator pairs a colour with a word, and never reads "Live" while disconnected.
- [ ] Pausing withholds entries from the view while they continue to accumulate in history.
- [ ] A paused reader sees a count of entries awaiting them.
- [ ] Resuming replays the withheld entries in order and reports how many were replayed.
- [ ] The read position survives a page reload, so a refresh is not a data-loss event.
- [ ] A dropped connection recovers without the reader noticing or intervening.
- [ ] A stream that cannot be reached reports itself as unavailable rather than rendering an empty thread.
- [ ] A permission revocation drops the affected principal's open stream rather than leaving it live.
- [ ] The simulation control ("simulate an agent post") still works, and its panel states plainly that it is a demonstration.
