# 19: The purge states what it removes, before and after

**What to build:** The purge tells the truth on both of its screens. Before the act, the overlap count counts the reader's own entries on demo boards whatever principal authored them: an entry made through the app belongs to the reader who made it, and whether a browser can act as its author is a session-issuance fact, not an authorship one. After the act, the receipt names what happened, including the overlap it warned about one click earlier, instead of telling the reader their work is untouched. And the restore the receipt offers is reachable and asserted where a reader reaches it.

**Blocked by:** None (can start immediately)

**Status:** ready-for-agent

**Found by:** product F2 at `src/components/PurgeDialog.tsx:210-215`; architecture F8 at `src/server/store/index.ts:770-783`; product F13's restore case at `src/components/PurgeDialog.tsx:216-223`.

- [ ] **Store seam.** The overlap count includes an owner-origin entry on a demo board whichever principal authored it — one written by an agent and one by a human no browser can act as — and still excludes seeded entries. Both halves in one test: a predicate that counts everything fails the second, and the current predicate fails the first.
- [ ] **Route seam.** As a reader who has posted an entry into demo content, the confirmation states that exactly one of the reader's entries will be removed; the purge then runs and the receipt names the same number and says that entry went with its board. The two sentences are asserted against each other, so the receipt cannot deny the warning.
- [ ] **Route seam.** With a zero overlap the receipt may say the reader's work is untouched — the sentence is conditioned on the number, not deleted, and the zero case is asserted so the honest sentence is not lost with the false one.
- [ ] **Route seam.** After a purge the receipt offers restore; pressing it brings the demo content back with the reader's own boards, threads and entries untouched and no duplicate demo record. This state is reachable today and no route-seam test presses it.
- [ ] **Store seam.** The count and the removal are one predicate: a workspace whose only owner entry on a demo board is agent-authored reports a non-zero overlap and, after the purge, is measured to have lost exactly that entry. The confirmation and the act cannot drift.

**Leaves the build green:** yes.
