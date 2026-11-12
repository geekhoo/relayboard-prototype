# 24: The store refuses what it cannot store, and hands out what cannot be rewritten

**What to build:** Two ends of the same guarantee. A name that trims to nothing is refused at the boundary before the store sees it, so a board, thread or resource created through the published surface cannot become a permanently blank record in a store that has no delete. And every record the store returns is frozen and is not the seed's own object — including after a purge and a restore, the documented demo workflow — so a caller that sorts or annotates a record in place cannot corrupt the workspace for the next reader.

**Blocked by:** None (can start immediately)

**Status:** ready-for-agent

**Found by:** architecture F9 at `src/server/functions/inputs.ts:69-77,89-95` against `src/domain/forms.ts:70-73,85-92` and `src/server/store/index.ts:1054,1099`; architecture F6 at `src/server/store/index.ts:983-1024` against the module's own promise at `:75-79` and the copying helpers at `:538-544,553-554,560-563`.

- [ ] **Store seam.** A board name of whitespace only is refused at the boundary with the same validation family the domain form produces, and the store's board count is unchanged. Asserted through the real schema and store, with the family checked rather than the prose.
- [ ] **Store seam.** The same for a thread title and a resource name, each asserted separately, because the three schemas are three places the same mistake can be made.
- [ ] **Unit/domain seam.** A name that trims to a non-empty short string survives with its trimmed value; the boundary refuses emptiness, not brevity. This is what a `min(2)` slip would break, and the domain forms already decide it.
- [ ] **Route seam.** The create dialog's refusal is unchanged: the client-side and server-side validators agree on the whitespace case, so a reader sees one message rather than two different ones.
- [ ] **Store seam.** After a purge and a restore, a board read back is frozen; writing a field on it throws in strict mode rather than silently mutating. Asserted for a restored thread and a restored resource too, because the restore has three insertion sites.
- [ ] **Store seam.** The restored record is not the seed snapshot's own object: mutating the seed object the test holds does not change what the store returns, and mutating what the store returned does not change the seed. Asserted in both directions, so copying without freezing fails as loudly as freezing without copying.
- [ ] **Store seam.** Records the store created itself — a board, a thread, a resource, an entry — are frozen on the same terms, so the guarantee is a property of the store rather than of one path through it.
- [ ] **Store seam.** Restore stays additive and idempotent under the fix: restoring twice does not duplicate a demo record, and a demo record that survived a purge is not replaced by the seed's copy.

**Leaves the build green:** yes.
