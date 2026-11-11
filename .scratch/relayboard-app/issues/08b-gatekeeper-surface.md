# 08b: The gatekeeper's decision surface

**From:** 08 — An agent knocks, a gate holder admits it

**What to build:** The screen a human decides on, built to `DESIGN.md` §256. A human holding `admit:agent` sees the pending requests for the board — or, holding it at workspace scope, for every board, grouped by board — with the agent's declared name, declared operator and stated reason, each labelled as declared rather than as fact. The permission set and the expiry are chosen before admitting, not after. A denied request reads as denied afterwards.

**Blocked by:** 08a — Knock, wait, enter — the admission cycle on the server

**Write scope:** the gatekeeper surface: one route and its components, using the admission controls `DESIGN.md` documents.

**Status:** ready-for-agent

- [ ] A human holding `admit:agent` on a board sees that board's pending requests. A principal without the permission sees the surface disabled with a stated reason (`DESIGN.md` §221), not an empty list.
- [ ] A principal holding `admit:agent` at **workspace** scope sees every board's pending requests grouped by board, so a board whose gate holders are absent is still joinable (spec L397). A board-scoped holder sees only that board. The rule is stated, because the parent ticket does not say which it means.
- [ ] Each pending row shows the declared name, the declared operator and the stated reason, plus when it knocked. The design follows `DESIGN.md` §256: a *declared* label above the block at 11px in Ink-muted, never green, and **no declared value is tinted with the accent and none carries a checkmark**.
- [ ] Derived values (issuer, fingerprint) are visually separated from the declared block wherever both appear. Before admission there are none, and the surface says so rather than showing a placeholder that looks derived.
- [ ] Admitting requires choosing the permission set and the expiry in the same act: neither is defaulted silently, and the set offered is bounded to what the acting human itself holds (07b's rule, surfaced here as the list of choices rather than as a refusal after the fact).
- [ ] A bounded expiry is the default offered (spec L391); "never" is available and visibly exceptional rather than the default.
- [ ] Denying requires a reason, and the request then reads as denied with that reason rather than disappearing.
- [ ] An empty state states plainly that there are no pending requests, rather than showing an empty list frame (`DESIGN.md` §263).
- [ ] The polling secret is nowhere on this surface, and a test asserts the rendered page never contains a credential or a secret for any pending request.
- [ ] The surface is reachable from the app frame without leaving the current board, and opening and closing it preserves the reader's place — Escape closes it and focus returns to the control that opened it.
- [ ] A refusal from the decision (no permission, insufficient grant to hand out, expired request) leaves the pending row in place with the reason rather than closing the surface.

**Leaves the build green:** yes. The cycle now has a human in it.
