# 30: The two surfaces that ask for no credential are bounded

**What to build:** The two operations that act without a principal cannot be used to damage the workspace. A knock still needs no session — it is pre-participant by design — but it no longer answers whether a board exists to a caller that cannot see one, and it can no longer grow the process's memory without limit or flood a gate holder's pending list faster than a human can decide. And the test/dev store reset requires a principal and a permission, so an environment variable is no longer the whole guard over an identity and grant wipe.

**Blocked by:** None (can start immediately)

**Status:** ready-for-agent

**Found by:** security F6 at `src/server/admissions.ts:410-440`; security F14 at `src/server/functions/read.ts:232-236` with `src/server/store/instance.ts:75-78`.

- [ ] **Admission seam.** A knock naming a board that does not exist and a knock naming one that does are refused and accepted respectively, but neither refusal tells an anonymous caller which board ids exist: the refusal for an unknown board is the same sentence an unauthorised caller would get for a board it may not name. Asserted as equality between the two messages, which is what makes the oracle closed.
- [ ] **Admission seam.** Pending knocks are bounded: past the stated cap, a new knock is refused with a stated reason rather than growing the record set, and a pending knock older than its stated lifetime no longer appears in a gate holder's list. Both asserted by count and by list contents.
- [ ] **Admission seam.** The bound does not break the ordinary path: a knock, a decision and a collection still work below the cap, and a refused knock leaves no record behind.
- [ ] **Route seam.** The reset operation refuses a caller with no session, and refuses a session without the stated permission, and succeeds only for one that holds it. Asserted on the three outcomes, so the environment check is no longer the only guard.
- [ ] **Route seam.** A plain production build still refuses the reset outright, so the new guard is additional rather than a replacement for the deployment check.

**Leaves the build green:** yes.