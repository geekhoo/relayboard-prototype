# 02c: The demo seed, with an origin on everything

**From:** 02 — A store that owns boards, threads and the canonical sequence

**What to build:** The store can be seeded with the prototype's demo workspace, transcribed from `app.js`'s `seedState` (`app.js` L19–84), with every board, thread, entry and resource carrying `origin: "demo"` and every entry's `createdAt` deliberately non-monotonic with respect to its `seq`. The seed is one input to a factory that already works without it, so a test can still start empty. This is a transcription job with one design decision in it: the prototype's `board.members` arrays have no home in the new model, and how they are represented here determines whether ticket 07 has to delete them.

**Blocked by:** 02b — The store and the per-thread sequence

**Write scope:** the seed fixture and the store's seeding path only.

**Status:** ready-for-agent

- [ ] The seed reproduces the prototype's workspace: the seven principals of `app.js` L20–28 (four humans, three agents) with the same ids, names, kinds and declared descriptions; the three boards of L29–33; the ten threads of L34–45; the seven resources; and the entries of L52–82 with their `references` and the one `relation` at L57.
- [ ] The seed is passed to the store factory, not baked into it — `createStore()` with no seed yields an empty workspace, and a test asserts that.
- [ ] Every seeded board, thread, entry and resource carries `origin: "demo"`, and nothing in the store branches on origin.
- [ ] Seeded `createdAt` values are deliberately non-monotonic with `seq`, so a sort by timestamp is visibly wrong. `AGENTS.md` L72 states this is the point of the seed; a test asserts at least one thread where timestamp order and `seq` order differ.
- [ ] Every thread starts at `seq` 1 and is gapless after seeding; per-thread entry counts match the prototype's.
- [ ] The prototype's `board.members` arrays are **not** seeded as a member list. They are carried as a provisional membership predicate the store consults for the "principal is not on this board" check, clearly named as the stand-in that ticket 07 replaces with a grant lookup; the seed's permutation of ids is recorded so 07a reproduces it exactly.
- [ ] The seeded superadmin human required by spec L406 exists as a principal of `kind: "human"` with `origin: "owner"`. Its grant is not this ticket's job and arrives in 07a, which must keep this principal id.
- [ ] The prototype's `seen` map (`app.js` L83) becomes the seeded `seen` watermark per `(principal, thread)` for `alex`, the principal the prototype hard-coded as its own — one of the browser-selectable principals, not the only human who acts — and the stream `cursors` become the seeded `cursor` watermarks — so the unread badges the prototype shows are the ones the app shows.
- [ ] **Each principal carries `browserSelectable: boolean`**, and the seed marks `alex` then `maya` selectable in that order, so the round-robin selection of spec L366, L370 walks a definite list. `alex` carries the prototype's `seen` map (`app.js` L83) and `maya` carries the same map shifted by one, so the badge counts differ and a test can tell the two browsers apart rather than finding every entry unread on the second.
- [ ] Seeding twice into one store is impossible (the factory takes one seed); a test asserts the seed function is pure and returns fresh copies, so two stores from one seed do not share arrays.
- [ ] The suite from 02b still passes against the seeded workspace, not only against fixtures.

**Leaves the build green:** yes. The store now has content, and nothing imports it yet.
