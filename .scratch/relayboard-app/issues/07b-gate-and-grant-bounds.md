# 07b: The two rules that keep the gate human and the grant unlaunderable

**From:** 07 — Named, scoped permissions enforced at the boundary

**What to build:** The two constraints that make granting safe, both enforced server-side in the same place a grant is written. `admit:agent` and `revoke:agent` may be granted only to a human principal, and an attempt to grant them to an agent is refused. A principal may not grant a permission it does not itself hold, so admission can never be a route to privilege nobody had. These are the only two places where `kind` is load-bearing, and this ticket is where that is made true and kept true.

**Blocked by:** 07a — The permission vocabulary, its scopes, and enforcement at the boundary

**Write scope:** the grant and gate rules inside the store; the store-level `grant` operation this ticket introduces.

**Status:** done — verified, with two criteria open; see `## Comments`

- [x] Granting `admit:agent` to an agent principal is refused, with a message naming why. Granting it to a human succeeds. The same holds for `revoke:agent`, asserted separately for each.
- [x] **Corrected while implementing it: the original clause "cannot admit, revoke, or grant anything" is false.** An agent already admitted cannot **hold the gate permissions and cannot hand them out** — `admit:agent` and `revoke:agent` may only be granted to a human, which refuses the grant to an agent whatever the granter holds, and an agent that does not hold them cannot pass them on either — and it **may** hand out what it actually holds, like any principal, because `kind` is a label rather than a capability (AGENTS.md). Both halves are asserted with a control that proves the difference: an agent is refused `admit:agent` for a human recipient, and the same agent successfully grants `read:board` on a board where it holds it. Asserted through the store's `grant` rather than through the UI.
- [ ] **Partly satisfied — the scan is stronger than the criterion, and the test the criterion names does not exist.** `kind` is read in exactly one place — the check that decides whether the gate permissions may be granted. A test asserts that removing `kind` from the principal record does not change any other outcome; a reviewer can therefore see the single branch rather than take it on trust.
- [x] A principal cannot grant a permission it does not itself hold, at the scope it does not hold it. A human who cannot `move:status` on a board cannot hand out `move:status` on that board; the same principal holding it at workspace scope may. Both directions are asserted.
- [x] A principal cannot grant at a scope broader than the one it holds the permission at — a board-scoped `read:member` holder cannot grant `read:member` at workspace scope.
- [x] Granting a permission the vocabulary does not define is refused as a validation failure before any rule above runs.
- [x] Granting follows the same no-`await`-between-read-and-write rule as `seq` assignment, so two concurrent grants to one principal cannot both read the old grant and both write. There is no per-store lock; the invariant is the ordering rule the store module states.
- [x] A refusal from either rule is distinguishable by a caller from a missing-permission refusal, so an operator can tell "you cannot do this" from "you cannot give this".
- [ ] **Half satisfied — the store seam is asserted and the admission seam is not, because 08a is not built.** Every one of the rules above is asserted at the store seam today and re-asserted at the admission seam by 08a, so the assertion is written once and re-used rather than restated — the seam itself is 08a's to build, because 08a is the ticket with an admission surface to drive (spec L584–599).

**Leaves the build green:** yes. The store-level `grant` operation is now constrained; 08 builds the path that calls it.

**Note on the parent's last criterion:** the parent's "A human cannot grant a permission it does not itself hold" has no call site until ticket 08 builds the admitting path, and the superadmin grant-editing surface is explicitly out of scope (spec L619). This sub-issue therefore proves the rule against the store-level `grant` operation it constrains, and 08a re-asserts it end to end through admission.

## Comments

**Implemented and verified** at `91a1aac`. Grant administration has rules, and they are data rather than
branches: a grant is refused for three distinct reasons — the principal does not hold what it is handing
out, the scope is broader than what it holds, or the permission is the gate and the granter is not a
human — and each reason has its own message, because an operator fixes different things.

**The bounds were permissive first, and eighteen tests passed against the permissive version.** That is
the finding worth keeping: weakening the rule to let a board-scoped holder grant at workspace scope left
every test green, because none of them had been written to notice. A permissive change nothing can see is
worse than a failing test, since the failing one tells you where to look. The rule is now split in
`src/domain/grants.ts` — a workspace grant requires holding it at workspace scope, a board grant is
satisfied by either — and repeating the same weakening fails a named assertion.

**The `kind` scan is enumeration, not prohibition.** It requires the set of kind comparisons in `src` to be
exactly the justified files, each entry naming **the rule it protects** rather than the path, and the
permission modules to contain none. It passed twice without matching anything before it bit: one version
threw `EISDIR` by reading directories as files, the next compared Windows paths against forward-slash keys
so every lookup missed. Both were found by adding a deliberate violation and watching the test still pass.
Removing the gate rule now fails six assertions by name.

**The seed's grants carry a granter that holds nothing.** Making `granterId` optional would let a caller
skip both rules by omission, so the seed names a principal that is permitted nothing and applies its grants
as **data** rather than through the `grant` operation — provisioning is not a participant's act, and a seed
that went through `grant` would have to be permitted to do what no participant may.

**One test premise of this ticket's own was false, and the code was right.** The first version asserted an
agent cannot grant anything; it failed because an agent can, and should — the fix was to the test, which is
the direction that keeps a wrong test from smuggling in a product change.

**Criterion 15 is left open, and the criterion is what is wrong.** It asks that *"removing `kind` from the
principal record does not change any other outcome"*. Nothing can remove a field the domain type requires,
and the check that actually holds the line is stronger than that: the enumeration above makes a **second**
comparison impossible to add quietly and a **justified** one impossible to leave behind, which is more than
"no other outcome changes". Left open with the reason rather than ticked for a test that would have to
weaken the type to exist.

**Criterion 21 is half satisfied, and the other half is not this ticket's to build.** Every rule above is
asserted at the store seam in `tests/grant-rules.test.ts`, which is the single statement of what the rules
are. The re-assertion at the admission seam belongs to 08a, which builds that seam; `checkGrant` is
exported for it precisely so 08a calls the rules rather than restating them. Ticking this now would claim a
seam that does not exist.
