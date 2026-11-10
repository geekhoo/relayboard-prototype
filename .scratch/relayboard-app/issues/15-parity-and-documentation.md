# 15: Parity with the prototype, proven and documented

**What to build:** The claim "the app is the prototype, plus a real backend" becomes a checkable statement rather than an impression. Every behaviour `QA.md` recorded as verified for the prototype is exercised against the app through its routes, and the two behaviours that file listed as gaps are exercised as features. The design system and product record catch up with what the app now contains. The static prototype can then be retired without losing the record of what it did.

**Blocked by:** 11 — live, pause and replay; 12 — participant identity and progress; 13 — responsive and keyboard; 14 — demo purge and restore

**Status:** ready-for-agent

- [ ] A Playwright suite drives the running app through its routes and covers every behaviour in `QA.md`'s verified list.
- [ ] The two behaviours `QA.md` filed as gaps — mobile in-thread search and selection surviving a reload — are covered as passing features.
- [ ] The scaffold-reconciliation assertions live in that suite: no starter route resolves, no site chrome renders, no theme control exists, no external font host is contacted.
- [ ] Every route-seam test starts from a reset store, so runs do not depend on one another.
- [ ] `QA.md` is rewritten to describe the app rather than the prototype, keeping its method, its viewports and its honesty section.
- [ ] `DESIGN.md` and its sidecar document the components the app added and the prototype never had: the admission decision surface, an act entry, and the purge confirmation.
- [ ] `PRODUCT.md` records the permission model, the admission cycle and the demo-purge boundary.
- [ ] The shipped agent skills describe the app rather than `window.RelayboardMockAPI`, the skill review gate passes, and the instruction to remove the `relayboard-identity` exclusion is either carried out or explicitly recorded as still blocked.
- [ ] The root `AGENTS.md` convention about authorship is updated to cover "being admitted grants nothing".
- [ ] A one-page record states which parts of the prototype were carried across verbatim, which changed, and why — so retirement is a deliberate act rather than a delete.
