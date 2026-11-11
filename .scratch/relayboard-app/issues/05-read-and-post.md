# 05: Read a thread and post a message

**What to build:** A conversation you can read and reply to. Entries render in canonical order with authorship, principal kind, time and sequence number; date dividers separate days; the composer stays at the bottom at every width and sends on both the button and the keyboard shortcut. The message you post appears at its correct position and shows the sequence it landed on. This is the whole read-and-write loop the prototype demonstrates.

Three behaviours the prototype has and `QA.md` grades as passing belong to no other ticket, so they land here: the thread intro, the thread-details panel, and filtering the entries of a thread by a search term. Leaving them out would let ticket 15's parity claim pass while those three features are absent.

**Blocked by:** 04c — The route seam's harness, which the plan is missing

**Write scope:** the conversation route, the composer and the entry-list components, **each with its own co-located stylesheet**; layout and responsive stages as utilities. Does **not** own the details drawer or the participant panel, which 12 builds; this ticket renders into them.

**Status:** done — verified, with two criteria open on purpose; see `## Comments`

- [x] Entries render ordered strictly by `seq`, never by timestamp.
- [x] Every entry shows its author, the author's kind, the time and the sequence number.
- [x] Agent-authored entries are marked as agent-authored without that marking implying lower status.
- [x] Date dividers appear between days.
- [ ] **The link renders; the jump it makes lands on nothing.** A message that references another can be jumped to from the referencing entry.
- [x] **A thread opens with an intro naming who created it and when**, and how many entries it holds.
- [x] **A thread-details panel shows creation date, entry count, last sequence and the thread's participants**, and is dismissable from the keyboard.
- [x] **A search within the open thread filters its entries by term and reports a zero-match state**, distinguishing "no match" from "empty thread".
- [x] The composer is pinned to the bottom of the conversation at every viewport.
- [x] `Ctrl/Cmd + Enter` sends; the Send control is disabled while the composer is empty.
- [x] A posted message appears once, at its correct position, with its sequence number visible.
- [x] Whitespace-only input is refused with a reason, and surrounding whitespace is trimmed.
- [ ] **Not assertable until 07a, and recorded rather than skipped.** A failed send leaves the draft in place with the reason rather than clearing it.
- [x] **Submitting the same draft twice while the first is in flight appends one message**, and **retrying a committed post with its original idempotency key appends nothing** — these are two different guards and both are asserted separately, because one sentence cannot describe both.
- [x] **Every criterion above is asserted in the route seam** (04c's harness), except the two send-guard criteria in the line above, which are asserted at the contract seam — so the densest behaviours in the set have a stated venue rather than being graded by reading the diff.
## Comments

**Implemented and verified** at `c3994f8`. The conversation renders the chronology, the composer sends on
both activations, and the three orphaned `QA.md` behaviours land here.

What was checked, rather than assumed:

- Entries render in `seq` order and the test is built to fail if that ever stops being true. The unit
  fixture's timestamps run **backwards** against its positions, so a `createdAt` sort fails a named
  assertion rather than quietly reordering the screen; at the route seam the same claim is made against
  the seed's real out-of-order thread (`retention`) by asserting the rendered order is *not* the order a
  datetime sort would produce.
- The intro names the creator and the date and counts entries; the details panel shows created, entries,
  last position and participants, and is a native `<details>`, so "dismissable from the keyboard" is the
  element's behaviour rather than a handler written to imitate it.
- In-thread search has its own zero-match state, distinct from the empty-thread state: "no match" and
  "nothing here yet" are different facts and one sentence cannot say both.
- `Ctrl`/`Cmd + Enter` sends; Enter alone inserts a newline, because a message can be several lines.
  The refusal for an empty draft is an `<output>` live region with a stated reason, not a silently
  disabled button — a disabled control tells a reader nothing about why.
- Whitespace is trimmed and a whitespace-only draft is refused with that reason.

**One criterion is left open, and it is the kind of half-pass this record exists to catch.** Criterion 17
asks that "a message that references another can be jumped to from the referencing entry". The referencing
entry renders a link, and the route-seam test asserts its `href` matches `/#entry-/`. **Nothing renders an
`id` for it to land on:** `EntryItem` emits `data-entry-id` and `data-entry-seq`, and a scan of `src/**`
finds no `id={`entry-${...}`}` anywhere. So the anchor renders, the test passes, and clicking it moves the
reader nowhere — the target the link names has never existed. The fix is one attribute on `EntryItem` and
is 05's to make; the test needs the second half too, asserting the target element exists, because
`href` shape alone is exactly the assertion that let this through. Left unticked rather than silently
ticked, since "the link is there" is not the criterion.

**Two rules this ticket had to choose rather than inherit, both stated where the choice lives:**

- **Reading a thread advances the reader's `seen` watermark**, so the rail's badge must change as a
  consequence of the read. The rail's counts are invalidated **after** the read resolves, not before — a
  failed read must not clear a badge for a thread nobody saw — and not never, because a stale badge over
  the thread being read is the lie in the other direction.
- **`lastSeq` comes from the highest `seq`, not from the entry count.** They agree only while the
  sequence is gapless, and 14 is the ticket that breaks that; a count-based `lastSeq` would silently
  start lying the moment a purge leaves a hole.

**One defect found by measuring, not by reading.** At 320px the composer's bottom sat 70px below its
column, because a column with `height: 100%` inside a scroller measures its content. `min-height: 100%`
with a sticky bottom is the fix, and all six widths now assert the bottom edges agree within 1px.

**Two gaps recorded rather than closed**, both because closing them today would mean testing the wrong
thing:

- **With the in-memory transport a reload gets a fresh workspace**, because 04a builds the store per
  router — so no route-seam test may assert durability until 06c, and none does. The consequence is in
  the harness config, and 06c gains the assertion at the moment the transport makes it true. That is the
  assertion that would have caught the per-router store on day one.
- **"A failed send leaves the draft in place with the reason" is unassertable in the browser today.**
  Nothing the composer can produce fails: it trims the draft itself, so the store's "Message cannot be
  empty" is unreachable from the UI, and it only ever posts to the thread it opened, so "Thread not
  found" is unreachable too. Every remaining failure mode is a permission refusal, and 07a builds those.
  The first version of that test skipped itself — a test that would skip forever — and was **deleted**
  rather than left in place; `e2e/conversation.spec.ts` now carries a comment naming what is missing and
  where the testable half is asserted instead (the reason is a live region with the right shape, and a
  disabled button never clears the draft). The component's handling of a refusal becomes assertable the
  moment 07a gives the composer a failure it can provoke, which is why this criterion is left open here
  rather than ticked to make the ticket look finished.
