# 07b: The two rules that keep the gate human and the grant unlaunderable

**From:** 07 — Named, scoped permissions enforced at the boundary

**What to build:** The two constraints that make granting safe, both enforced server-side in the same place a grant is written. `admit:agent` and `revoke:agent` may be granted only to a human principal, and an attempt to grant them to an agent is refused. A principal may not grant a permission it does not itself hold, so admission can never be a route to privilege nobody had. These are the only two places where `kind` is load-bearing, and this ticket is where that is made true and kept true.

**Blocked by:** 07a — The permission vocabulary, its scopes, and enforcement at the boundary

**Write scope:** the grant and gate rules inside the store; the store-level `grant` operation this ticket introduces.

**Status:** ready-for-agent

- [ ] Granting `admit:agent` to an agent principal is refused, with a message naming why. Granting it to a human succeeds. The same holds for `revoke:agent`, asserted separately for each.
- [ ] An agent already admitted cannot admit, revoke, or grant anything: each attempt is refused, asserted through the server function rather than through the UI.
- [ ] `kind` is read in exactly one place — the check that decides whether the gate permissions may be granted. A test asserts that removing `kind` from the principal record does not change any other outcome; a reviewer can therefore see the single branch rather than take it on trust.
- [ ] A principal cannot grant a permission it does not itself hold, at the scope it does not hold it. A human who cannot `move:status` on a board cannot hand out `move:status` on that board; the same principal holding it at workspace scope may. Both directions are asserted.
- [ ] A principal cannot grant at a scope broader than the one it holds the permission at — a board-scoped `read:member` holder cannot grant `read:member` at workspace scope.
- [ ] Granting a permission the vocabulary does not define is refused as a validation failure before any rule above runs.
- [ ] Granting follows the same no-`await`-between-read-and-write rule as `seq` assignment, so two concurrent grants to one principal cannot both read the old grant and both write. There is no per-store lock; the invariant is the ordering rule the store module states.
- [ ] A refusal from either rule is distinguishable by a caller from a missing-permission refusal, so an operator can tell "you cannot do this" from "you cannot give this".
- [ ] Every one of the rules above is asserted at the store seam today and re-asserted at the admission seam by 08a, so the assertion is written once and re-used rather than restated — the seam itself is 08a's to build, because 08a is the ticket with an admission surface to drive (spec L584–599).

**Leaves the build green:** yes. The store-level `grant` operation is now constrained; 08 builds the path that calls it.

**Note on the parent's last criterion:** the parent's "A human cannot grant a permission it does not itself hold" has no call site until ticket 08 builds the admitting path, and the superadmin grant-editing surface is explicitly out of scope (spec L619). This sub-issue therefore proves the rule against the store-level `grant` operation it constrains, and 08a re-asserts it end to end through admission.
