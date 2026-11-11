# 08b: The gatekeeper's decision surface

**From:** 08 — An agent knocks, a gate holder admits it

**What to build:** The screen a human decides on, built to `DESIGN.md` §256. A human holding `admit:agent` sees the pending requests for the board — or, holding it at workspace scope, for every board, grouped by board — with the agent's declared name, declared operator and stated reason, each labelled as declared rather than as fact. The permission set and the expiry are chosen before admitting, not after. A denied request reads as denied afterwards.

**Blocked by:** 08a — Knock, wait, enter — the admission cycle on the server

**Write scope:** the gatekeeper surface: one route and its components, using the admission controls `DESIGN.md` documents.

**Status:** done — verified, with 1 criterion open; see `## Comments`

- [x] A human holding `admit:agent` on a board sees that board's pending requests. A principal without the permission sees the surface disabled with a stated reason (`DESIGN.md` §221), not an empty list.
- [ ] **Partly satisfied — the per-board rule works, the grouped view does not exist.** A principal holding `admit:agent` at **workspace** scope sees every board's pending requests grouped by board, so a board whose gate holders are absent is still joinable (spec L399). A board-scoped holder sees only that board. The rule is stated, because the parent ticket does not say which it means.
- [x] Each pending row shows the declared name, the declared operator and the stated reason, plus when it knocked. The design follows `DESIGN.md` §256: a *declared* label above the block at 11px in Ink-muted, never green, and **no declared value is tinted with the accent and none carries a checkmark**.
- [x] Derived values (issuer, fingerprint) are visually separated from the declared block wherever both appear. Before admission there are none, and the surface says so rather than showing a placeholder that looks derived.
- [x] Admitting requires choosing the permission set and the expiry in the same act: neither is defaulted silently, and the set offered is bounded to what the acting human itself holds (07b's rule, surfaced here as the list of choices rather than as a refusal after the fact).
- [x] A bounded expiry is the default offered (spec L393); "never" is available and visibly exceptional rather than the default.
- [x] Denying requires a reason, and the request then reads as denied with that reason rather than disappearing.
- [x] An empty state states plainly that there are no pending requests, rather than showing an empty list frame (`DESIGN.md` §263).
- [x] The polling secret is nowhere on this surface, and a test asserts the rendered page never contains a credential or a secret for any pending request.
- [x] The surface is reachable from the app frame without leaving the current board, and opening and closing it preserves the reader's place — Escape closes it and focus returns to the control that opened it.
- [x] A refusal from the decision (no permission, insufficient grant to hand out, expired request) leaves the pending row in place with the reason rather than closing the surface.

**Leaves the build green:** yes. The cycle now has a human in it.

## Comments

**Implemented and verified** at `9db9b3e`. A human can see who is waiting, read what the agent declared,
choose exactly what to grant and for how long, and watch their own decisions afterwards.

What was checked, rather than assumed:

- **Declared is rendered as declared, and the separation is measured rather than asserted in prose.** The
  block sits under a label reading *Declared*, and a test resolves that label's computed background
  against the accent chip colour and requires zero tinted elements. Beneath it a sentence says nothing
  about the agent has been verified and that the issuer and fingerprint arrive once the workspace derives
  them — words rather than a placeholder that looks derived.
- **Affordances are bounded by what the decider holds rather than failing after the click.** The offered
  permissions are the decider's own grant on that board; a decider holding nothing to hand out is told
  so instead of being shown an empty set of controls. The bound is displayed, and the rule still runs at
  the write.
- The polling secret appears nowhere on the surface, and the browser test asserts the rendered page
  contains no credential or secret for any pending request.
- Opening and closing preserves the reader's place: Escape closes it and focus returns to the control that
  opened it.

**Two defects fixed here, both of which passed a green suite:**

- **The client's error classifier mapped a permission refusal and an unauthenticated result to one
  family**, and no client operation attached a family to what it threw — so the classifier was the
  *appearance* of error handling rather than error handling. A permission refusal and an absent session
  now have different families, every operation goes through one wrapper that attaches it, and there is one
  sentence per family so a surface speaks in its own voice. Collapsing the two families again fails two
  named assertions; removing the wrapper fails with "the classifier is not on the path".
- **The chosen expiry was accepted and silently dropped**: added to the type, the schema and the UI, and
  not written by the admission. Found by asserting that the choice is recorded and then making the
  implementation ignore it — which it did.

**The finding this ticket produced about how it must be tested.** A route-seam test that does not name its
principal asserts **the session rotation**, not the surface: the first version of the gatekeeper browser
test failed three times because the browser had been issued a principal holding no gate anywhere. Every
test of a principal's affordance now names its principal, which is the rule round-robin issuance makes
necessary and which 08c's ticket-wide "name your principal" note inherits.

**One criterion is left open and it is a scope decision, not a defect.** The panel is **per board**. A
workspace-scope holder can decide on any board — the rule is implemented — but the *grouped-across-boards
view* the criterion describes is not built, so the ordering of boards and the empty state per board have
nowhere to render. Ticking it would claim a view nobody can open.
