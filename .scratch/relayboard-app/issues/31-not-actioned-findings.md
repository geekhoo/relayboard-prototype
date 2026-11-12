# 31: Findings recorded and not actioned

**What to build:** Nothing. This file records the one review finding this batch deliberately does not turn into work, with the reason, so the panel's evidence is neither lost nor mistaken for covered.

**Status:** wontfix

**Found by:** architecture F15 at `src/server/store/index.ts:1079-1088`.

**Architecture F15 — creating a board writes the creator's member grant outside the grant rule.** The decision is not to action it, and the reason is that the behaviour is the product's while the rule is the thing that is slightly wrong. A principal that may create a board must be able to use it, or `create:board` is a permission that produces an unusable record. The store is the only writer, it writes one fixed set, and it writes it for the creator alone, so no caller can use this path to obtain a permission it did not already hold at the moment of creation. Routing the write through the grant rule today would either refuse the creator — the seeded superadmin holds `create:board` and no `post:message` anywhere — or require the rule to special-case the creator, which is the same bypass with more code and a weaker statement. The honest change is to name the creator's grant as an exception where the rule is written, and that is a documentation change whose value is small next to the Criticals.

**What would reopen it:** a second path that can create a board with a caller-chosen permission set, or a feature that lets a board's creator grant to someone else. At that point the bypass is reachable and the invariant "no grant exceeds its granter's permissions" becomes load-bearing on this line. The ticket to write then is "state the creator's board grant as a named exception in the grant rule, and assert that no second writer can use it".

**Leaves the build green:** yes — no code changes.
