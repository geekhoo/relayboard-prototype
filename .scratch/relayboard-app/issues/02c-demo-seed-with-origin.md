# 02c: The demo seed, with an origin on everything

**From:** 02 — A store that owns boards, threads and the canonical sequence

**What to build:** The store can be seeded with the prototype's demo workspace, transcribed from `app.js`'s `seedState` (`app.js` L19–84), with every board, thread, entry and resource carrying `origin: "demo"` and at least one thread whose entry `createdAt` values run against its `seq` — which is a deliberate deviation the seed makes, because the prototype's own threads are strictly decreasing in `ago()` and a timestamp sort inside any of them would agree with `seq`. The seed is one input to a factory that already works without it, so a test can still start empty. This is a transcription job with one design decision in it: the prototype's `board.members` arrays have no home in the new model, and how they are represented here determines whether ticket 07 has to delete them.

**Blocked by:** 02b — The store and the per-thread sequence

**Write scope:** the seed fixture and the store's seeding path only.

**Status:** done — verified, see `## Comments`

- [x] The seed reproduces the prototype's workspace: the seven principals of `app.js` L20–28 (four humans, three agents) with the same ids, names, kinds and declared descriptions; the three boards of L29–33; the ten threads of L34–45; the seven resources; and the entries of L52–82 with their `references` and the one `relation` at L57.
- [x] The seed is passed to the store factory, not baked into it — `createStore()` with no seed yields an empty workspace, and a test asserts that.
- [x] Every seeded board, thread, entry and resource carries `origin: "demo"`, and nothing in the store branches on origin.
- [x] **At least one seeded thread has `createdAt` values that run against its `seq`**, so a sort by timestamp is visibly wrong. This is the one place the seed deviates from the prototype: every prototype thread is strictly decreasing in `ago()` (`app.js` L52–82), so transcription alone cannot satisfy this, and `AGENTS.md` L80 records it as the app's own addition rather than as parity. The deviation is recorded in the seed's own header, and a test asserts one thread where timestamp order and `seq` order differ.
- [x] Every thread starts at `seq` 1 and is gapless after seeding; per-thread entry counts match the prototype's.
- [x] The prototype's `board.members` arrays are **not** seeded as a member list. They are carried as a provisional membership predicate the store consults for the "principal is not on this board" check, clearly named as the stand-in that ticket 07 replaces with a grant lookup; the seed's permutation of ids is recorded so 07a reproduces it exactly.
- [x] The seeded superadmin human required by spec L427 exists as a principal of `kind: "human"` with `origin: "owner"`. Its grant is not this ticket's job and arrives in 07a, which must keep this principal id.
- [x] The prototype's `seen` map (`app.js` L83) becomes the seeded `seen` watermark per `(principal, thread)` for `alex`, the principal the prototype hard-coded as its own — one of the browser-selectable principals, not the only human who acts — and the stream `cursors` become the seeded `cursor` watermarks — so the unread badges the prototype shows are the ones the app shows.
- [x] **Each board carries `short` and `theme`**, transcribed from the prototype's `app.js` L30–32 — the 30px monogram and one of the four hues `sage`, `ochre`, `lavender`, `blue` as a closed set — because `DESIGN.md` §241 makes "30px rounded-square board marks at 4 hues" normative and the rail in 04a cannot render to the record without them. `createBoard` (`app.js` L116) derives `short` from the name's first letter and defaults the theme, so a board created through the app has both too.
- [x] **Each principal carries `browserSelectable: boolean`**, and the seed marks `alex` then `maya` selectable in that order, so the round-robin selection of spec L366, L370 walks a definite list. `alex` carries the prototype's `seen` map (`app.js` L83) and `maya` carries the same map shifted by one, so the badge counts differ and a test can tell the two browsers apart rather than finding every entry unread on the second.
- [x] Seeding twice into one store is impossible (the factory takes one seed); a test asserts the seed function is pure and returns fresh copies, so two stores from one seed do not share arrays.
- [x] The suite from 02b still passes against the seeded workspace, not only against fixtures.

**Leaves the build green:** yes. The store now has content, and nothing imports it yet.

## Comments

**Implemented and verified** at `c24c72f`. The store now has the prototype's workspace in it, and the transcription was checked mechanically rather than by eye: a one-off parse compared all 31 entries' thread, author, text, timestamp, references and relation against `app.js`, and the per-thread counts are asserted independently in `tests/demo-seed.test.ts` so a self-consistent seed that dropped an entry would still fail.

What was checked rather than assumed:

- 7 demo-origin principals (4 humans, 3 agents), the eighth being `nadia` of `origin: "owner"` — the out-of-band superadmin of spec L427, of `kind: "human"`, with the id asserted as a literal because 07a must keep it.
- 3 boards with the prototype's marks and hues (`P`/`sage`, `C`/`ochre`, `D`/`lavender`), 10 threads with their creators, 7 resources with their urls and types, 31 entries in the prototype's per-thread counts, 4 entries carrying a resource reference and exactly 1 carrying a relation (`{ type: "In response to", entryId: "seed-delivery-5" }`, `app.js` L57).
- `createStore()` with no seed is still an empty workspace; `demoSeed()` returns equal but distinct copies on every call, and two stores built from it share no state (posting in one leaves the other at 9). Re-run today: `npx vitest run tests/demo-seed.test.ts` reports **38 passing** across the seed's own assertions and 02b's contract re-run against the demo workspace, and the whole app suite is 116 passed / 6 skipped with `npm run app:check` exit 0.
- `origin: "demo"` on every board, thread, entry and resource, and a test proves the store's behaviour does not change because of it.
- Every thread starts at `seq` 1 and is gapless; the whole of 02b's contract suite runs a second time against this workspace rather than against a weaker copy — `tests/store-contract.ts` is one set of assertions, called twice.

**The record was wrong about one thing, and this is the seed's side of it.** `AGENTS.md` and `spec L499` described the demo seed as "deliberately non-monotonic" so an incorrect sort by `createdAt` would be visible. The prototype is not: every one of its ten threads (`app.js` L52–82) lists its messages in strictly decreasing `ago()` values, so an in-thread timestamp sort agrees with `seq` everywhere, and the only non-monotonicity is *across* threads — which proves nothing, because one thread's entries are never sorted against another's. Criterion 4 could therefore not be met by transcription. The seed deviates from the prototype **exactly once, on purpose and in writing**: `retention`'s two offsets are swapped (3200/2820 → 2820/3200), giving the thread whose first entry is newer than its second. That deviation is recorded in `demo-seed.ts`'s own header, and `AGENTS.md` L80, `spec L499` and this ticket's criterion were corrected to say it is the app's addition rather than parity — nothing downstream may cite it as parity with the prototype.

**Two prototype fields deliberately not carried**, both because they would have been dishonest to seed:

- `thread.pinned` (`app.js` L35, read by the sort at L142). No ticket owns it; 04b decides whether pinning is carried or dropped, and seeding a field nothing reads would have made that decision invisibly.
- The principal's `issuer` and `fingerprint`. The prototype hard-codes strings like `human:northstar/alex` next to a heading that says "Verified identity". Those are 08c's **derived** values — computed by the workspace from a credential it issued — and seeding a fabricated one is exactly the dishonesty spec L403 rejects. `description` is kept, because that one really is declared (`app.js` L21–27) and 12 labels it as such.

**One thing a later ticket inherits.** `demoOptions()` returns the membership predicate and the seeded watermarks **together**, and that pairing is deliberate: a store built from `demoSeed()` alone reproduces the content but none of the progress, so every badge comes back unread. `demoBoardMembers` records the prototype's permutation as data (`platform: [alex, maya, daniel, orion, beacon]` and the other two), in the prototype's own order, so 07a reproduces it as grants exactly rather than re-deriving an order from a set.
