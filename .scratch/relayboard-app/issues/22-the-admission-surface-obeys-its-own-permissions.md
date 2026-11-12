# 22: The admission surface obeys the grants and the kinds it names

**What to build:** Five refusals on the admission surface each say one thing and do another. Revoking an admission requires `revoke:agent`, not `admit:agent`, so a board gate holder can no longer strip an agent's access to boards it has no standing on. A refused admission leaves the workspace exactly as it was — no orphan agent principal, no half-recorded act — and the gate surface cannot offer an admission that is certain to be refused. A renewal is a rotation: the superseded credential stops resolving the moment the new one is issued. And an admission's set of permissions is checked against the vocabulary before it reaches a rule, so an invented permission is a validation refusal rather than an untyped failure.

**Blocked by:** None (can start immediately)

**Status:** ready-for-agent

**Found by:** security F2 at `src/server/admissions.ts:393-395,651`; security F4 at `src/server/admissions.ts:547-559`; security F12 at `src/components/Gatekeeper.tsx:218-220,244-248`; security F5 and architecture F12 at `src/server/admissions.ts:727-734` with `:381-390,601-621`; security F8 at `src/server/functions/admission.ts:139`.

- [ ] **Admission seam.** A principal holding board-scoped `admit:agent` and no `revoke:agent` anywhere is refused when it revokes, with the refusal naming `revoke:agent`; a principal holding `revoke:agent` at workspace scope succeeds. Both directions asserted, so the guard cannot be swapped for a blanket refusal. The existing admissions case that revokes as the seeded ordinary principal is rewritten, because it encodes the defect.
- [ ] **Admission seam.** A refused admission changes nothing: the principal count, the grant list and the knock record are identical before and after a refusal caused by a permission the granter does not hold. Asserting the principal count is the assertion the current test omits, and the refusal must be provoked through `admit` rather than through the store directly.
- [ ] **Admission seam.** Two refusals in a row from one gate holder leave no principals behind, so a retry with a smaller set succeeds and the workspace holds exactly one new agent — the case the orphan makes impossible today.
- [ ] **Route seam.** A decider holding `admit:agent` at workspace scope and no board grant is offered a form whose submitted set is empty rather than silently `read:board`, and the control that would submit a refused set is disabled with a stated reason. Asserted on the submitted payload and on the control's disabled state, so the default cannot come back unnoticed.
- [ ] **Admission seam.** After a renewal, the expired credential that prompted it no longer resolves, the new credential does, and both resolve to the same principal id. All three asserted in one case: a rotation that also splits the identity fails, and so does one that leaves the old token live.
- [ ] **Admission seam.** A renewal of a live credential is still refused, so the rotation fix does not open the laundering path the refusal exists to close.
- [ ] **Unit/domain seam.** An admission carrying a permission outside the fifteen is a validation refusal with that permission named, before any grant rule runs; the boundary no longer erases the permission type. Asserted through the surface, so a cast that compiles still fails the test.

**Leaves the build green:** yes.
